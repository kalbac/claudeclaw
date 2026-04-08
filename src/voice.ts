import { readFileSync, copyFileSync } from 'node:fs'
import { resolve, dirname, basename, extname } from 'node:path'
import { GROQ_API_KEY } from './config.js'
import { logger } from './logger.js'

export function voiceCapabilities(): { stt: boolean } {
  return { stt: !!GROQ_API_KEY }
}

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured')
  }

  // Groq requires .ogg extension, Telegram sends .oga (same Ogg Opus format)
  let uploadPath = filePath
  if (extname(filePath).toLowerCase() === '.oga') {
    uploadPath = resolve(dirname(filePath), basename(filePath, '.oga') + '.ogg')
    copyFileSync(filePath, uploadPath)
  }

  const fileBuffer = readFileSync(uploadPath)
  const fileName = basename(uploadPath)

  // Build multipart/form-data manually (no extra deps)
  const boundary = '----ClaudeClaw' + Date.now().toString(36)
  const parts: Buffer[] = []

  // File part
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: audio/ogg\r\n\r\n`
    )
  )
  parts.push(fileBuffer)
  parts.push(Buffer.from('\r\n'))

  // Model part
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n`
    )
  )

  // Response format part
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n`
    )
  )

  // Closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Groq API error ${response.status}: ${errorText}`)
  }

  const transcript = await response.text()
  logger.info({ filePath, chars: transcript.length }, 'Audio transcribed')
  return transcript.trim()
}
