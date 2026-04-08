#!/usr/bin/env node

import { getUnreadMail, getRecentMail, searchMail } from './mail.js'
import type { MailMessage } from './mail.js'

const [, , command, ...args] = process.argv

function formatMessages(messages: MailMessage[]): void {
  if (messages.length === 0) {
    console.log('No messages found.')
    return
  }
  for (const m of messages) {
    const date = m.date ? new Date(m.date).toLocaleDateString('ru-RU') : '?'
    const flag = m.seen ? '  ' : '📧'
    console.log(`${flag} [${m.uid}] ${date} | ${m.from} | ${m.subject}`)
  }
}

async function main() {
  switch (command) {
    case 'recent': {
      const limit = parseInt(args[0] ?? '10', 10)
      console.log(`Last ${limit} messages:`)
      formatMessages(await getRecentMail(limit))
      break
    }

    case 'unread': {
      const limit = parseInt(args[0] ?? '10', 10)
      console.log('Unread messages (newest first):')
      formatMessages(await getUnreadMail(limit))
      break
    }

    case 'search': {
      const query = args.join(' ')
      if (!query) {
        console.log('Usage: mail-cli search <query>')
        process.exit(1)
      }
      formatMessages(await searchMail(query))
      break
    }

    default:
      console.log(`ClaudeClaw Mail CLI (IMAP)

Commands:
  recent [limit]     Last N messages, newest first (default: 10)
  unread [limit]     Unread messages, newest first (default: 10)
  search <query>     Search by subject or sender`)
      break
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
