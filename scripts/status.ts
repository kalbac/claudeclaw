#!/usr/bin/env tsx

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const green = (s: string) => `\x1b[32m✓\x1b[0m ${s}`
const red = (s: string) => `\x1b[31m✗\x1b[0m ${s}`
const yellow = (s: string) => `\x1b[33m⚠\x1b[0m ${s}`

console.log('\nClaudeClaw Status Check\n')

// Node version
try {
  const nodeVersion = process.version
  const major = parseInt(nodeVersion.slice(1), 10)
  console.log(major >= 20 ? green(`Node.js ${nodeVersion}`) : red(`Node.js ${nodeVersion} (need >=20)`))
} catch {
  console.log(red('Node.js not found'))
}

// Claude CLI
try {
  const claudeVersion = execSync('claude --version 2>/dev/null', { encoding: 'utf-8' }).trim()
  console.log(green(`Claude CLI: ${claudeVersion}`))
} catch {
  console.log(red('Claude CLI not found'))
}

// Config (checks .env + channels fallback)
const envPath = resolve(ROOT, '.env')
const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''
const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
const channelsEnvPath = resolve(home, '.claude', 'channels', 'telegram', '.env')
const channelsEnv = existsSync(channelsEnvPath) ? readFileSync(channelsEnvPath, 'utf-8') : ''
const accessPath = resolve(home, '.claude', 'channels', 'telegram', 'access.json')

const hasToken = (envContent.includes('TELEGRAM_BOT_TOKEN=') && !envContent.includes('TELEGRAM_BOT_TOKEN=your'))
  || channelsEnv.includes('TELEGRAM_BOT_TOKEN=')
let hasChatId = envContent.includes('ALLOWED_CHAT_ID=') && !envContent.includes('ALLOWED_CHAT_ID=your')
if (!hasChatId && existsSync(accessPath)) {
  try {
    const access = JSON.parse(readFileSync(accessPath, 'utf-8'))
    hasChatId = access.allowFrom?.length > 0
  } catch {}
}
const hasGroq = envContent.includes('GROQ_API_KEY=') && !envContent.includes('GROQ_API_KEY=your')
const hasYandex = envContent.includes('YANDEX_EMAIL=') && !envContent.includes('YANDEX_EMAIL=your')

console.log(hasToken ? green('Telegram bot token configured') : red('Telegram bot token not set'))
console.log(hasChatId ? green('Chat ID configured') : yellow('Chat ID not set'))
console.log(hasGroq ? green('Groq API key configured (voice)') : yellow('Groq API key not set (voice disabled)'))
console.log(hasYandex ? green('Yandex Mail configured') : yellow('Yandex Mail not configured'))
if (!existsSync(envPath)) {
  console.log(yellow('.env file not found — copy .env.example to .env for Groq/Yandex/Dashboard'))
}

// Database
const dbPath = resolve(ROOT, 'store', 'claudeclaw.db')
if (existsSync(dbPath)) {
  const { statSync } = await import('node:fs')
  const size = statSync(dbPath).size
  console.log(green(`Database: ${(size / 1024).toFixed(1)} KB`))
} else {
  console.log(yellow('Database not yet created (will be created on first run)'))
}

// PID / running
const pidPath = resolve(ROOT, 'store', 'claudeclaw.pid')
if (existsSync(pidPath)) {
  const pid = readFileSync(pidPath, 'utf-8').trim()
  try {
    process.kill(parseInt(pid, 10), 0)
    console.log(green(`Background process running (PID: ${pid})`))
  } catch {
    console.log(yellow(`PID file exists but process ${pid} is not running`))
  }
} else {
  console.log(yellow('Background process not running'))
}

// Build
const distPath = resolve(ROOT, 'dist', 'index.js')
console.log(existsSync(distPath) ? green('Built (dist/ exists)') : yellow('Not built yet — run npm run build'))

// CLAUDE.md
const claudeMdPath = resolve(ROOT, 'CLAUDE.md')
console.log(existsSync(claudeMdPath) ? green('CLAUDE.md present') : red('CLAUDE.md missing'))

console.log('')
