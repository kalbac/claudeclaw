import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import {
  initDatabase, saveMemory, searchMemories, getRecentMemories,
  getPinnedMemories, pinMemory, unpinMemory, deleteMemory, getMemoryStats,
  runDecaySweep, logConversation, getConversationHistory,
  createScheduledTask, getAllScheduledTasks, getDueTasks,
  pauseScheduledTask, resumeScheduledTask, deleteScheduledTask,
  markTaskRunning, updateTaskAfterRun, resetStuckTasks,
  saveTokenUsage, getTokenStats, audit, getAuditLog,
  getSession, setSession, clearSession, closeDb,
} from './db.js'

describe('Database', () => {
  beforeAll(() => { initDatabase() })
  afterAll(() => { closeDb() })

  describe('Sessions', () => {
    it('set and get', () => {
      setSession('c1', 's1')
      expect(getSession('c1')).toBe('s1')
    })
    it('returns null for unknown', () => {
      expect(getSession('unknown')).toBeNull()
    })
    it('clears', () => {
      setSession('c2', 's2')
      clearSession('c2')
      expect(getSession('c2')).toBeNull()
    })
    it('overwrites', () => {
      setSession('c1', 's1-new')
      expect(getSession('c1')).toBe('s1-new')
    })
  })

  describe('Memories', () => {
    it('saves and retrieves', () => {
      const id = saveMemory('c1', 'dark mode preference', 'semantic')
      expect(id).toBeGreaterThan(0)
      const recent = getRecentMemories('c1', 10)
      expect(recent.some(m => m.content === 'dark mode preference')).toBe(true)
    })
    it('FTS5 search', () => {
      saveMemory('c1', 'TypeScript is preferred', 'semantic')
      const results = searchMemories('TypeScript')
      expect(results.length).toBeGreaterThan(0)
    })
    it('scoped search by chatId', () => {
      saveMemory('c-other', 'Python is great', 'semantic')
      const results = searchMemories('Python', 10, 'c1')
      expect(results.some(m => m.chat_id === 'c-other')).toBe(false)
    })
    it('pins and unpins', () => {
      const id = saveMemory('c1', 'pinned fact', 'semantic')
      pinMemory(id)
      expect(getPinnedMemories('c1').some(m => m.id === id)).toBe(true)
      unpinMemory(id)
      expect(getPinnedMemories('c1').some(m => m.id === id)).toBe(false)
    })
    it('deletes', () => {
      const id = saveMemory('c1', 'temp', 'episodic')
      deleteMemory(id)
      expect(searchMemories('temp').some(m => m.id === id)).toBe(false)
    })
    it('stats', () => {
      const s = getMemoryStats()
      expect(s.total).toBeGreaterThan(0)
    })
    it('decay sweep', () => {
      const r = runDecaySweep()
      expect(r).toHaveProperty('decayed')
      expect(r).toHaveProperty('deleted')
    })
  })

  describe('Conversation', () => {
    it('logs and retrieves', () => {
      logConversation('c1', 'user', 'Hello')
      logConversation('c1', 'assistant', 'Hi')
      const h = getConversationHistory('c1', 10)
      expect(h.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Tasks', () => {
    it('CRUD', () => {
      const nr = Math.floor(Date.now() / 1000) + 3600
      createScheduledTask('t1', 'c1', 'Test', '0 * * * *', nr)
      expect(getAllScheduledTasks().some(t => t.id === 't1')).toBe(true)
    })
    it('due tasks', () => {
      createScheduledTask('t2', 'c1', 'Due', '* * * * *', Math.floor(Date.now() / 1000) - 60)
      expect(getDueTasks().some(t => t.id === 't2')).toBe(true)
    })
    it('pause/resume', () => {
      pauseScheduledTask('t1')
      expect(getAllScheduledTasks().find(t => t.id === 't1')?.status).toBe('paused')
      resumeScheduledTask('t1')
      expect(getAllScheduledTasks().find(t => t.id === 't1')?.status).toBe('active')
    })
    it('running/update', () => {
      markTaskRunning('t2')
      expect(getAllScheduledTasks().find(t => t.id === 't2')?.status).toBe('running')
      updateTaskAfterRun('t2', 'OK', Math.floor(Date.now() / 1000) + 3600)
      expect(getAllScheduledTasks().find(t => t.id === 't2')?.status).toBe('active')
    })
    it('reset stuck', () => {
      markTaskRunning('t1')
      expect(resetStuckTasks()).toBeGreaterThan(0)
    })
    it('delete', () => {
      deleteScheduledTask('t1')
      deleteScheduledTask('t2')
    })
  })

  describe('Tokens', () => {
    it('saves and stats', () => {
      saveTokenUsage('s1', 1000, 500, 200, 'claude-sonnet')
      const s = getTokenStats(1)
      expect(s.totalInput).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('Audit', () => {
    it('logs and retrieves', () => {
      audit('test', 'detail', 'c1')
      expect(getAuditLog(10).some(e => e.action === 'test')).toBe(true)
    })
  })
})
