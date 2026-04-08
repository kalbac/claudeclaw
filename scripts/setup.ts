#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createInterface } from 'node:readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())))

async function main() {
  console.log(`
${cyan(`
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
`)}
${bold('ClaudeClaw Setup Wizard')}
`)

  // Step 1: Check requirements
  console.log(bold('\n--- Requirements ---\n'))

  const nodeVersion = process.version
  const nodeMajor = parseInt(nodeVersion.slice(1), 10)
  if (nodeMajor >= 20) {
    console.log(green(`✓ Node.js ${nodeVersion}`))
  } else {
    console.log(red(`✗ Node.js ${nodeVersion} — need >=20`))
    process.exit(1)
  }

  let claudeOk = false
  try {
    execSync('claude --version 2>/dev/null', { encoding: 'utf-8' })
    console.log(green('✓ Claude CLI installed'))
    claudeOk = true
  } catch {
    console.log(yellow('⚠ Claude CLI not found in PATH (may still work if installed)'))
  }

  // Check channels config
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const channelsEnv = resolve(home, '.claude', 'channels', 'telegram', '.env')
  const channelsAccess = resolve(home, '.claude', 'channels', 'telegram', 'access.json')

  if (existsSync(channelsEnv)) {
    console.log(green('✓ Telegram channels configured'))
  } else {
    console.log(red('✗ Telegram channels not configured'))
    console.log('  Run: claude --channels plugin:telegram@claude-plugins-official')
    console.log('  Then: /telegram:configure <bot-token>')
  }

  if (existsSync(channelsAccess)) {
    try {
      const access = JSON.parse(readFileSync(channelsAccess, 'utf-8'))
      if (access.allowFrom?.length > 0) {
        console.log(green(`✓ Chat ID: ${access.allowFrom[0]}`))
      } else {
        console.log(yellow('⚠ No allowed chat IDs — DM the bot and pair'))
      }
    } catch {
      console.log(yellow('⚠ Cannot read access.json'))
    }
  }

  // Step 1b: Create personal files from examples if missing
  for (const file of ['USER.md', 'AGENT.md']) {
    const filePath = resolve(ROOT, file)
    const examplePath = resolve(ROOT, `${file}.example`)
    if (!existsSync(filePath) && existsSync(examplePath)) {
      copyFileSync(examplePath, filePath)
      console.log(yellow(`⚠ Created ${file} from ${file}.example — edit it to personalize`))
    } else if (existsSync(filePath)) {
      console.log(green(`✓ ${file} exists`))
    }
  }

  // Step 2: Collect config
  console.log(bold('\n--- Configuration ---\n'))

  const envPath = resolve(ROOT, '.env')
  const envExample = resolve(ROOT, '.env.example')
  let envContent = ''

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8')
    console.log(green('✓ .env file exists'))
  } else if (existsSync(envExample)) {
    copyFileSync(envExample, envPath)
    envContent = readFileSync(envPath, 'utf-8')
    console.log(yellow('⚠ Created .env from .env.example'))
  }

  // Parse existing values
  const envVars: Record<string, string> = {}
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      envVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  }

  // Groq API Key
  const currentGroq = envVars['GROQ_API_KEY']
  if (currentGroq && !currentGroq.includes('your-')) {
    console.log(green(`✓ Groq API key set`))
  } else {
    const groqKey = await ask('Groq API key (free at console.groq.com, Enter to skip): ')
    if (groqKey) envVars['GROQ_API_KEY'] = groqKey
  }

  // Yandex Mail
  const currentYandex = envVars['YANDEX_EMAIL']
  if (currentYandex && !currentYandex.includes('your')) {
    console.log(green(`✓ Yandex Mail: ${currentYandex}`))
  } else {
    const email = await ask('Yandex email (Enter to skip): ')
    if (email) {
      envVars['YANDEX_EMAIL'] = email
      const appPass = await ask('Yandex app password: ')
      if (appPass) envVars['YANDEX_APP_PASSWORD'] = appPass
    }
  }

  // Dashboard
  const currentDashToken = envVars['DASHBOARD_TOKEN']
  if (currentDashToken && !currentDashToken.includes('your-')) {
    console.log(green(`✓ Dashboard token set`))
  } else {
    const { randomBytes } = await import('node:crypto')
    const token = randomBytes(24).toString('base64url')
    envVars['DASHBOARD_TOKEN'] = token
    console.log(green(`✓ Dashboard token generated: ${token}`))
  }

  const dashPort = envVars['DASHBOARD_PORT'] ?? '3141'
  envVars['DASHBOARD_PORT'] = dashPort

  // Write .env
  const newEnv = [
    '# === Voice (Groq Whisper STT) ===',
    `GROQ_API_KEY=${envVars['GROQ_API_KEY'] ?? ''}`,
    '',
    '# === Yandex Mail (IMAP) ===',
    `YANDEX_EMAIL=${envVars['YANDEX_EMAIL'] ?? ''}`,
    `YANDEX_APP_PASSWORD=${envVars['YANDEX_APP_PASSWORD'] ?? ''}`,
    '',
    '# === Dashboard ===',
    `DASHBOARD_PORT=${dashPort}`,
    `DASHBOARD_TOKEN=${envVars['DASHBOARD_TOKEN'] ?? ''}`,
  ].join('\n')

  writeFileSync(envPath, newEnv + '\n')
  console.log(green('\n✓ .env saved'))

  // Step 2b: Update .claude/settings.json with GROQ_API_KEY in env
  const settingsPath = resolve(ROOT, '.claude', 'settings.json')
  if (existsSync(settingsPath) && envVars['GROQ_API_KEY']) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      if (!settings.env) settings.env = {}
      settings.env['GROQ_API_KEY'] = envVars['GROQ_API_KEY']
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
      console.log(green('✓ GROQ_API_KEY added to .claude/settings.json'))
    } catch {
      console.log(yellow('⚠ Could not update .claude/settings.json — add GROQ_API_KEY manually'))
    }
  }

  // Step 3: Install dependencies + Build
  console.log(bold('\n--- Install & Build ---\n'))

  const nodeModulesExist = existsSync(resolve(ROOT, 'node_modules'))
  if (!nodeModulesExist) {
    console.log('Installing dependencies...')
    try {
      execSync('npm install', { cwd: ROOT, stdio: 'inherit' })
      console.log(green('✓ Dependencies installed'))
    } catch {
      console.log(red('✗ npm install failed'))
      process.exit(1)
    }
  } else {
    console.log(green('✓ Dependencies already installed'))
  }

  try {
    console.log('Compiling TypeScript...')
    execSync('npx tsc', { cwd: ROOT, stdio: 'inherit' })
    console.log(green('✓ Build successful'))
  } catch {
    console.log(red('✗ Build failed — check TypeScript errors'))
    process.exit(1)
  }

  // Step 4: Verify database
  console.log(bold('\n--- Database ---\n'))

  try {
    execSync('node dist/memory-cli.js stats', { cwd: ROOT, stdio: 'inherit' })
    console.log(green('✓ Database OK'))
  } catch {
    console.log(red('✗ Database initialization failed'))
  }

  // Step 5: Summary
  console.log(bold('\n--- Setup Complete ---\n'))
  console.log(`${bold('To start the background process (dashboard + scheduler):')}`)
  console.log(cyan('  npm start'))
  console.log('')
  console.log(`${bold('To start the Telegram assistant:')}`)
  console.log(cyan(`  cd ${ROOT}`))
  console.log(cyan('  claude --channels plugin:telegram@claude-plugins-official'))
  console.log('')
  console.log(`${bold('Dashboard:')}`)
  console.log(cyan(`  http://localhost:${dashPort}?token=${envVars['DASHBOARD_TOKEN']}`))
  console.log('')
  console.log(`${bold('Telegram commands:')}`)
  console.log('  /memory, /schedule, /mail, /briefing, /checkpoint, /new, /status')
  console.log('')
  console.log(`${bold('Edit CLAUDE.md to personalize your assistant.')}`)

  rl.close()
}

main().catch((err) => {
  console.error(red(err.message))
  process.exit(1)
})
