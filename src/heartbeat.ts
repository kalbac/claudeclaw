import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { runAgent } from './agent.js'
import { sendTelegramMessage } from './scheduler.js'
import { audit } from './db.js'
import { PROJECT_ROOT, ALLOWED_CHAT_ID } from './config.js'
import { logger } from './logger.js'
import { getEnv } from './env.js'

const HEARTBEAT_FILE = resolve(PROJECT_ROOT, 'HEARTBEAT.md')
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

let timer: ReturnType<typeof setInterval> | null = null

interface HeartbeatConfig {
  disabled: boolean
  intervalMs: number
  activeHoursStart: number // hour (0-23)
  activeHoursEnd: number
  suppressOk: boolean // don't send "all good" messages to Telegram
}

function getConfig(): HeartbeatConfig {
  return {
    disabled: getEnv('HEARTBEAT_DISABLED', 'true') === 'true',
    intervalMs: parseInt(getEnv('HEARTBEAT_INTERVAL_MS', String(DEFAULT_INTERVAL_MS)), 10),
    activeHoursStart: parseInt(getEnv('HEARTBEAT_ACTIVE_START', '9'), 10),
    activeHoursEnd: parseInt(getEnv('HEARTBEAT_ACTIVE_END', '22'), 10),
    suppressOk: getEnv('HEARTBEAT_SUPPRESS_OK', 'true') === 'true',
  }
}

function isActiveHours(config: HeartbeatConfig): boolean {
  const hour = new Date().getHours()
  return hour >= config.activeHoursStart && hour < config.activeHoursEnd
}

function loadChecklist(): string | null {
  if (!existsSync(HEARTBEAT_FILE)) return null
  try {
    return readFileSync(HEARTBEAT_FILE, 'utf-8').trim()
  } catch {
    return null
  }
}

async function runHeartbeat(): Promise<void> {
  const config = getConfig()

  if (!isActiveHours(config)) {
    logger.debug('Heartbeat skipped — outside active hours')
    return
  }

  const checklist = loadChecklist()
  if (!checklist) {
    logger.debug('Heartbeat skipped — no HEARTBEAT.md')
    return
  }

  logger.info('Running heartbeat check')
  audit('heartbeat_start', 'Heartbeat triggered')

  try {
    const prompt = `You are running a scheduled heartbeat check. Review this checklist and report only items that need attention. If everything is fine, respond with exactly "HEARTBEAT_OK".\n\n${checklist}`

    const result = await runAgent(prompt)
    const text = result.text?.trim() ?? ''

    if (text === 'HEARTBEAT_OK' || text.includes('HEARTBEAT_OK')) {
      logger.info('Heartbeat: all clear')
      audit('heartbeat_ok', 'All checks passed')
      // Suppress OK messages — only log, don't send to Telegram
      if (!config.suppressOk && ALLOWED_CHAT_ID) {
        await sendTelegramMessage(ALLOWED_CHAT_ID, 'Heartbeat: all clear')
      }
    } else {
      // Something needs attention — always notify
      logger.info({ response: text.slice(0, 200) }, 'Heartbeat: attention needed')
      audit('heartbeat_alert', text.slice(0, 500))
      if (ALLOWED_CHAT_ID) {
        await sendTelegramMessage(ALLOWED_CHAT_ID, `Heartbeat:\n\n${text}`)
      }
    }
  } catch (err: any) {
    logger.error({ err }, 'Heartbeat failed')
    audit('heartbeat_error', err.message)
  }
}

export function initHeartbeat(): void {
  const config = getConfig()

  if (config.disabled) {
    logger.info('Heartbeat disabled')
    return
  }

  if (!existsSync(HEARTBEAT_FILE)) {
    logger.info('Heartbeat: no HEARTBEAT.md found — skipping')
    return
  }

  timer = setInterval(runHeartbeat, config.intervalMs)
  logger.info(
    { intervalMin: config.intervalMs / 60000, activeHours: `${config.activeHoursStart}-${config.activeHoursEnd}` },
    'Heartbeat started'
  )
}

export function stopHeartbeat(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
