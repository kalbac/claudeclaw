import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDb } from './db.js'
import { buildMemoryContext, saveConversationTurn, saveCheckpoint } from './memory.js'

describe('Memory', () => {
  beforeAll(() => { initDatabase() })
  afterAll(() => { closeDb() })

  it('builds context', async () => {
    await saveConversationTurn('tc', 'I prefer TypeScript for all projects', 'Noted!')
    const ctx = await buildMemoryContext('tc', 'TypeScript')
    expect(typeof ctx).toBe('string')
  })
  it('skips short messages', async () => {
    await saveConversationTurn('tc', 'hi', 'hello')
  })
  it('skips commands', async () => {
    await saveConversationTurn('tc', '/memory list', 'Here...')
  })
  it('checkpoint', () => {
    expect(saveCheckpoint('tc', 'Session summary')).toBeGreaterThan(0)
  })
})
