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
const home = process.env.HOME ?? process.env.USERPROFILE ?? ''

// Resolve bot token (same logic as config.ts)
function getToken(): string {
  // Try project .env
  try {
    const env = readFileSync(resolve(ROOT, '.env'), 'utf-8')
    const match = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  } catch {}

  // Fallback to channels config
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
  { command: 'model', description: 'Сменить модель: opus, sonnet, haiku' },
  { command: 'forget', description: 'Сбросить сессию / Reset session' },
]

async function main() {
  const token = getToken()
  if (!token) {
    console.error('Bot token not found. Configure Telegram channels first.')
    process.exit(1)
  }

  const url = `https://api.telegram.org/bot${token}/setMyCommands`

  // Resolve chat ID for chat-specific scope (highest priority, survives plugin restarts)
  let chatId = ''
  try {
    const envContent = readFileSync(resolve(ROOT, '.env'), 'utf-8')
    chatId = envContent.match(/^ALLOWED_CHAT_ID=(.+)$/m)?.[1]?.trim() ?? ''
  } catch {}
  if (!chatId) {
    try {
      const accessPath = resolve(home, '.claude', 'channels', 'telegram', 'access.json')
      const access = JSON.parse(readFileSync(accessPath, 'utf-8'))
      chatId = access.allowFrom?.[0] ?? ''
    } catch {}
  }

  // Set at all three scope levels so commands always show
  const scopes: Array<{ type: string; chat_id?: string }> = [
    { type: 'default' },
    { type: 'all_private_chats' },
  ]
  if (chatId) scopes.push({ type: 'chat', chat_id: chatId })

  let ok = true
  for (const scope of scopes) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands, scope }),
    })
    const data = await res.json() as any
    if (!data.ok) { ok = false; console.error(`✗ Failed for scope ${scope.type}:`, data.description) }
  }

  if (ok) {
    console.log(`✓ ${commands.length} commands registered (${scopes.length} scopes):`)
    for (const cmd of commands) {
      console.log(`  /${cmd.command} — ${cmd.description}`)
    }
  }
}

main()
