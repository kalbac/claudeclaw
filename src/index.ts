import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { initDatabase, audit } from './db.js'
import { runDecaySweep } from './memory.js'
import { initScheduler, sendTelegramMessage, stopScheduler } from './scheduler.js'
import { initHeartbeat, stopHeartbeat } from './heartbeat.js'
import { startDashboard } from './dashboard.js'
import { cleanupOldUploads } from './media.js'
import { STORE_DIR, TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID } from './config.js'
import { logger } from './logger.js'

const PID_FILE = resolve(STORE_DIR, 'claudeclaw.pid')
const DAY_MS = 24 * 60 * 60 * 1000

function acquireLock(): void {
  if (existsSync(PID_FILE)) {
    const oldPid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
    if (!isNaN(oldPid)) {
      try {
        process.kill(oldPid, 0) // Check if alive
        logger.warn({ oldPid }, 'Killing stale process')
        process.kill(oldPid, 'SIGTERM')
      } catch {
        // Process already dead — safe to overwrite
      }
    }
  }
  writeFileSync(PID_FILE, String(process.pid))
}

function releaseLock(): void {
  try {
    unlinkSync(PID_FILE)
  } catch {}
}

async function main(): Promise<void> {
  console.log(`
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝╚══════╝
 ██████╗██╗      █████╗ ██╗    ██╗
██╔════╝██║     ██╔══██╗██║    ██║
██║     ██║     ███████║██║ █╗ ██║
██║     ██║     ██╔══██║██║███╗██║
╚██████╗███████╗██║  ██║╚███╔███╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
`)

  // 1. Acquire PID lock
  acquireLock()
  logger.info({ pid: process.pid }, 'ClaudeClaw starting')

  // 2. Check required config
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error('TELEGRAM_BOT_TOKEN not set in .env — exiting')
    process.exit(1)
  }

  // 3. Initialize database
  initDatabase()

  // 4. Run initial cleanup
  cleanupOldUploads()

  // 5. Run memory decay sweep + schedule daily
  runDecaySweep()
  setInterval(runDecaySweep, DAY_MS)

  // 6. Start dashboard
  startDashboard()

  // 7. Start scheduler
  const sender = async (chatId: string, text: string) => {
    await sendTelegramMessage(chatId, text)
  }
  initScheduler(sender)

  // 8. Start heartbeat (disabled by default — set HEARTBEAT_DISABLED=false in .env)
  initHeartbeat()

  // 9. Log startup
  audit('startup', `PID: ${process.pid}`)
  logger.info('ClaudeClaw is running')

  // 9. Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...')
    stopScheduler()
    stopHeartbeat()
    audit('shutdown', `PID: ${process.pid}`)
    releaseLock()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error')
  releaseLock()
  process.exit(1)
})
