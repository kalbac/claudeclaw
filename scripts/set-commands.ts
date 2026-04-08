#!/usr/bin/env tsx

/**
 * Registers Telegram bot menu commands via Bot API.
 * Run once: npx tsx scripts/set-commands.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const ROOT = resolve(__dirname, '..')

// Resolve bot token (same logic as config.ts)
function getToken(): string {
  // Try project .env
  try {
    const env = readFileSync(resolve(ROOT, '.env'), 'utf-8')
    const match = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}

  // Fallback to channels config
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  try {
    const env = readFileSync(resolve(home, '.claude', 'channels', 'telegram', '.env'), 'utf-8')
    const match = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}

  return ''
}

const commands = [
  { command: 'new', description: 'Новый разговор / New conversation' },
  { command: 'memory', description: 'Память: save, search, list, pin, stats' },
  { command: 'mail', description: 'Проверить почту / Check email' },
  { command: 'briefing', description: 'Утренний брифинг / Morning briefing' },
  { command: 'schedule', description: 'Задачи: create, list, delete' },
  { command: 'checkpoint', description: 'Сохранить саммари сессии / Save session summary' },
  { command: 'status', description: 'Статус системы / System status' },
  { command: 'convolife', description: 'Контекстное окно % / Context window %' },
  { command: 'forget', description: 'Сбросить сессию / Reset session' },
]

async function main() {
  const token = getToken()
  if (!token) {
    console.error('Bot token not found. Configure Telegram channels first.')
    process.exit(1)
  }

  // Must use same scope as channels plugin (all_private_chats) to override
  const url = `https://api.telegram.org/bot${token}/setMyCommands`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands,
      scope: { type: 'all_private_chats' },
    }),
  })

  const data = await res.json() as any

  if (data.ok) {
    console.log(`✓ ${commands.length} commands registered:`)
    for (const cmd of commands) {
      console.log(`  /${cmd.command} — ${cmd.description}`)
    }
  } else {
    console.error('✗ Failed:', data.description)
    process.exit(1)
  }
}

main()
