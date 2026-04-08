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

function assertConfigured(): void {
  if (!IMAP_EMAIL || !IMAP_PASSWORD) {
    throw new Error('Mail not configured (set IMAP_EMAIL + IMAP_PASSWORD in .env)')
  }
}

/**
 * Get recent messages (last N by sequence number, newest first).
 * This returns the latest messages regardless of read status.
 */
export async function getRecentMail(limit = 10): Promise<MailMessage[]> {
  assertConfigured()
  const client = await getImapClient()
  const messages: MailMessage[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      const status = await client.status('INBOX', { messages: true })
      const total = status.messages ?? 0
      if (total === 0) return []

      // Fetch last N messages by sequence range (newest = highest seq number)
      const from = Math.max(1, total - limit + 1)
      const range = `${from}:${total}`

      for await (const msg of client.fetch(range, { envelope: true, uid: true })) {
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

  // Sort newest first
  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return messages.slice(0, limit)
}

/**
 * Get unread messages, sorted newest first.
 */
export async function getUnreadMail(limit = 10): Promise<MailMessage[]> {
  assertConfigured()
  const client = await getImapClient()
  const messages: MailMessage[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      // Collect all unread UIDs first
      const uids: number[] = []
      for await (const msg of client.fetch({ seen: false }, { uid: true })) {
        uids.push(msg.uid)
      }

      if (uids.length === 0) return []

      // Take last N UIDs (highest = newest)
      const newestUids = uids.slice(-limit)

      // Fetch envelopes for those UIDs
      for await (const msg of client.fetch(
        { uid: newestUids.join(',') },
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

  // Sort newest first
  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return messages
}

/**
 * Search by subject or sender.
 */
export async function searchMail(query: string, limit = 10): Promise<MailMessage[]> {
  assertConfigured()
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

  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return messages
}
