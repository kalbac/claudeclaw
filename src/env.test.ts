import { describe, it, expect } from 'vitest'

describe('env parser', () => {
  function parseEnv(content: string): Record<string, string> {
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      result[key] = value
    }
    return result
  }

  it('parses simple KEY=VALUE', () => {
    expect(parseEnv('FOO=bar\nBAZ=123')).toEqual({ FOO: 'bar', BAZ: '123' })
  })

  it('handles quoted values', () => {
    expect(parseEnv('FOO="hello world"\nBAR=\'single\'')).toEqual({ FOO: 'hello world', BAR: 'single' })
  })

  it('skips comments and empty lines', () => {
    expect(parseEnv('# comment\n\nFOO=bar')).toEqual({ FOO: 'bar' })
  })

  it('handles values with equals signs', () => {
    expect(parseEnv('URL=https://x.com?a=1')).toEqual({ URL: 'https://x.com?a=1' })
  })

  it('handles empty values', () => {
    expect(parseEnv('FOO=\nBAR=val')).toEqual({ FOO: '', BAR: 'val' })
  })

  it('returns empty for empty input', () => {
    expect(parseEnv('')).toEqual({})
  })
})
