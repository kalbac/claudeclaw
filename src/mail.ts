import { IMAP_EMAIL, IMAP_PASSWORD, IMAP_HOST, IMAP_PORT } from './config.js'
import { logger } from './logger.js'

export interface MailMessage {
  uid: number
  from: string
  subject: string
  date: string
  preview: string
  seen: boolean
}

async function getImapClient() {
  const { ImapFlow } = await import('imapflow')

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: IMAP_EMAIL,
      pass: IMAP_PASSWORD,
    },
    logger: false,
  })

  return client
}

export async function getUnreadMail(limit = 10): Promise<MailMessage[]> {
  if (!IMAP_EMAIL || !IMAP_PASSWORD) {
    throw new Error('Mail not configured (set IMAP_EMAIL + IMAP_PASSWORD, or YANDEX_EMAIL + YANDEX_APP_PASSWORD in .env)')
  }

  const client = await getImapClient()
  const messages: MailMessage[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      for await (const msg of client.fetch(
        { seen: false },
        { envelope: true, uid: true }
      )) {
        const env = msg.envelope
        if (env) {
          messages.push({
            uid: msg.uid,
            from: env.from?.[0]?.address ?? 'unknown',
            subject: env.subject ?? '(no subject)',
            date: env.date?.toISOString?.() ?? '',
            preview: '',
            seen: false,
          })
        }
        if (messages.length >= limit) break
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err: any) {
    logger.error({ err }, 'IMAP error')
    try { await client.logout() } catch {}
    throw err
  }

  return messages
}

export async function searchMail(query: string, limit = 10): Promise<MailMessage[]> {
  if (!IMAP_EMAIL || !IMAP_PASSWORD) {
    throw new Error('Mail not configured')
  }

  const client = await getImapClient()
  const messages: MailMessage[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      for await (const msg of client.fetch(
        { or: [{ subject: query }, { from: query }] },
        { envelope: true, uid: true }
      )) {
        const env = msg.envelope
        if (env) {
          messages.push({
            uid: msg.uid,
            from: env.from?.[0]?.address ?? 'unknown',
            subject: env.subject ?? '(no subject)',
            date: env.date?.toISOString?.() ?? '',
            preview: '',
            seen: true,
          })
        }
        if (messages.length >= limit) break
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err: any) {
    logger.error({ err }, 'IMAP search error')
    try { await client.logout() } catch {}
    throw err
  }

  return messages
}
