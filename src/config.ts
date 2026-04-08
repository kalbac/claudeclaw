import { resolve, dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readEnvFile, getEnv } from './env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Paths
export const PROJECT_ROOT = resolve(__dirname, '..')
export const STORE_DIR = resolve(PROJECT_ROOT, 'store')
export const UPLOADS_DIR = resolve(PROJECT_ROOT, 'workspace', 'uploads')
export const DB_PATH = resolve(STORE_DIR, 'claudeclaw.db')

// Channels config path (where Claude Code stores the token)
const CHANNELS_ENV = join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.claude', 'channels', 'telegram', '.env'
)

// Read Telegram token: project .env first, fallback to channels config
function resolveTelegramToken(): string {
  const fromProject = getEnv('TELEGRAM_BOT_TOKEN')
  if (fromProject) return fromProject

  try {
    const channelsEnv = readFileSync(CHANNELS_ENV, 'utf-8')
    const match = channelsEnv.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  } catch {
    // channels not configured — that's fine
  }
  return ''
}

// Read chat ID: project .env first, fallback to channels access.json
function resolveAllowedChatId(): string {
  const fromProject = getEnv('ALLOWED_CHAT_ID')
  if (fromProject) return fromProject

  try {
    const accessPath = join(
      process.env.HOME ?? process.env.USERPROFILE ?? '',
      '.claude', 'channels', 'telegram', 'access.json'
    )
    const access = JSON.parse(readFileSync(accessPath, 'utf-8'))
    if (access.allowFrom?.length > 0) return access.allowFrom[0]
  } catch {
    // no access config
  }
  return ''
}

// Telegram
export const TELEGRAM_BOT_TOKEN = resolveTelegramToken()
export const ALLOWED_CHAT_ID = resolveAllowedChatId()

// Voice
export const GROQ_API_KEY = getEnv('GROQ_API_KEY')

// IMAP Mail (default: Yandex)
export const IMAP_EMAIL = getEnv('IMAP_EMAIL') || getEnv('YANDEX_EMAIL')
export const IMAP_PASSWORD = getEnv('IMAP_PASSWORD') || getEnv('YANDEX_APP_PASSWORD')
export const IMAP_HOST = getEnv('IMAP_HOST', 'imap.yandex.ru')
export const IMAP_PORT = parseInt(getEnv('IMAP_PORT', '993'), 10)

// Dashboard
export const DASHBOARD_PORT = parseInt(getEnv('DASHBOARD_PORT', '3141'), 10)
export const DASHBOARD_TOKEN = getEnv('DASHBOARD_TOKEN')

// Limits
export const MAX_MESSAGE_LENGTH = 4096
export const TYPING_REFRESH_MS = 4000
export const AGENT_TIMEOUT_MS = parseInt(getEnv('AGENT_TIMEOUT_MS', '900000'), 10)
export const CONTEXT_LIMIT = 1_000_000
export const SCHEDULER_POLL_MS = 60_000
export const TASK_TIMEOUT_MS = 900_000
export const DECAY_RATE = 0.98
export const DECAY_THRESHOLD = 0.1
