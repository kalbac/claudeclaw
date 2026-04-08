/**
 * Telegram Bot API utilities for sending rich messages.
 * Used by Claude via Bash: node dist/telegram-utils.js <command> [args]
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function getToken(): string {
  try {
    const env = readFileSync(resolve(ROOT, '.env'), 'utf-8')
    const match = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  try {
    const env = readFileSync(resolve(home, '.claude', 'channels', 'telegram', '.env'), 'utf-8')
    const match = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}
  return ''
}

function getChatId(): string {
  try {
    const env = readFileSync(resolve(ROOT, '.env'), 'utf-8')
    const match = env.match(/^ALLOWED_CHAT_ID=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  try {
    const access = JSON.parse(readFileSync(resolve(home, '.claude', 'channels', 'telegram', 'access.json'), 'utf-8'))
    if (access.allowFrom?.[0]) return access.allowFrom[0]
  } catch {}
  return ''
}

async function sendWithKeyboard(text: string, buttons: string[][]): Promise<void> {
  const token = getToken()
  const chatId = getChatId()
  if (!token || !chatId) {
    console.error('Token or chat ID not found')
    process.exit(1)
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        keyboard: buttons.map(row => row.map(text => ({ text }))),
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    }),
  })

  const data = await res.json() as any
  if (!data.ok) {
    console.error('Failed:', data.description)
    process.exit(1)
  }
  console.log('Sent with keyboard')
}

async function removeKeyboard(text: string): Promise<void> {
  const token = getToken()
  const chatId = getChatId()
  if (!token || !chatId) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { remove_keyboard: true },
    }),
  })
}

// CLI interface
const [, , command, ...args] = process.argv

switch (command) {
  case 'model-picker': {
    const current = args[0] ?? 'sonnet'
    await sendWithKeyboard(
      `Current model: ${current}\nSelect a model:`,
      [
        ['/model opus', '/model sonnet'],
        ['/model haiku'],
      ]
    )
    break
  }

  case 'remove-keyboard': {
    const text = args.join(' ') || 'Done'
    await removeKeyboard(text)
    break
  }

  default:
    console.log(`Telegram Utils

Commands:
  model-picker [current]   Send model selection keyboard
  remove-keyboard [text]   Remove custom keyboard`)
}
