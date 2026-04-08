#!/usr/bin/env node

import { getUnreadMail, searchMail } from './mail.js'

const [, , command, ...args] = process.argv

async function main() {
  switch (command) {
    case 'unread': {
      const limit = parseInt(args[0] ?? '10', 10)
      try {
        const messages = await getUnreadMail(limit)
        if (messages.length === 0) {
          console.log('No unread messages.')
        } else {
          console.log(`Unread messages (${messages.length}):`)
          for (const m of messages) {
            const date = m.date ? new Date(m.date).toLocaleDateString('ru-RU') : '?'
            console.log(`  📧 [${m.uid}] ${date} | ${m.from} | ${m.subject}`)
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`)
        process.exit(1)
      }
      break
    }

    case 'search': {
      const query = args.join(' ')
      if (!query) {
        console.log('Usage: mail-cli search <query>')
        process.exit(1)
      }
      try {
        const messages = await searchMail(query)
        if (messages.length === 0) {
          console.log('No messages found.')
        } else {
          for (const m of messages) {
            const date = m.date ? new Date(m.date).toLocaleDateString('ru-RU') : '?'
            console.log(`  📧 [${m.uid}] ${date} | ${m.from} | ${m.subject}`)
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`)
        process.exit(1)
      }
      break
    }

    default:
      console.log(`ClaudeClaw Mail CLI (IMAP)

Commands:
  unread [limit]     Show unread messages (default: 10)
  search <query>     Search by subject or sender`)
      break
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
