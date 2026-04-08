import { writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { UPLOADS_DIR, TELEGRAM_BOT_TOKEN } from './config.js'
import { logger } from './logger.js'

mkdirSync(UPLOADS_DIR, { recursive: true })

export async function downloadTelegramFile(fileId: string, originalFilename?: string): Promise<string> {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured')

  // Step 1: Get file path from Telegram
  const fileInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  const fileInfoRes = await fetch(fileInfoUrl)
  const fileInfo = (await fileInfoRes.json()) as any

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`)
  }

  const telegramFilePath = fileInfo.result.file_path

  // Step 2: Download the file
  const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${telegramFilePath}`
  const downloadRes = await fetch(downloadUrl)
  if (!downloadRes.ok) {
    throw new Error(`Failed to download file: ${downloadRes.status}`)
  }

  const buffer = Buffer.from(await downloadRes.arrayBuffer())

  // Step 3: Save locally
  const sanitized = (originalFilename ?? telegramFilePath.split('/').pop() ?? 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
  const localPath = join(UPLOADS_DIR, `${Date.now()}_${sanitized}`)
  writeFileSync(localPath, buffer)

  logger.info({ fileId, localPath, size: buffer.length }, 'File downloaded')
  return localPath
}

export function cleanupOldUploads(maxAgeMs = 24 * 60 * 60 * 1000): number {
  let cleaned = 0
  const cutoff = Date.now() - maxAgeMs

  try {
    for (const file of readdirSync(UPLOADS_DIR)) {
      const fullPath = join(UPLOADS_DIR, file)
      try {
        const stat = statSync(fullPath)
        if (stat.mtimeMs < cutoff) {
          unlinkSync(fullPath)
          cleaned++
        }
      } catch {
        // skip files we can't stat
      }
    }
  } catch {
    // uploads dir may not exist yet
  }

  if (cleaned > 0) {
    logger.info({ cleaned }, 'Old uploads cleaned')
  }
  return cleaned
}

export function buildPhotoMessage(localPath: string, caption?: string): string {
  const msg = `[Photo attached: ${localPath}]`
  return caption ? `${msg}\nCaption: ${caption}` : msg
}

export function buildDocumentMessage(localPath: string, filename: string, caption?: string): string {
  const msg = `[Document attached: ${filename} at ${localPath}]`
  return caption ? `${msg}\nCaption: ${caption}` : msg
}
