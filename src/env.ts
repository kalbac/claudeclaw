import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

let envCache: Record<string, string> | null = null

export function readEnvFile(keys?: string[]): Record<string, string> {
  if (envCache) {
    if (!keys) return { ...envCache }
    const filtered: Record<string, string> = {}
    for (const k of keys) {
      if (k in envCache) filtered[k] = envCache[k]
    }
    return filtered
  }

  const envPath = resolve(PROJECT_ROOT, '.env')
  const result: Record<string, string> = {}

  let raw: string
  try {
    raw = readFileSync(envPath, 'utf-8')
  } catch {
    envCache = result
    return result
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  envCache = result

  if (!keys) return { ...result }

  const filtered: Record<string, string> = {}
  for (const k of keys) {
    if (k in result) filtered[k] = result[k]
  }
  return filtered
}

export function getEnv(key: string, fallback = ''): string {
  const env = readEnvFile()
  return env[key] ?? fallback
}

export { PROJECT_ROOT }
