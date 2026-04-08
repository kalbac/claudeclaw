import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DB_PATH } from './config.js'
import { logger } from './logger.js'

const BetterSqlite3 = (Database as any).default ?? Database

let db: InstanceType<typeof Database>

export function getDb(): InstanceType<typeof Database> {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    db = new BetterSqlite3(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initDatabase(): void {
  const d = getDb()

  d.exec(`
    -- Sessions: maps chat_id to Claude Code session_id
    CREATE TABLE IF NOT EXISTS sessions (
      chat_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Memories: semantic + episodic with salience decay
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      topic_key TEXT,
      content TEXT NOT NULL,
      sector TEXT NOT NULL CHECK(sector IN ('semantic','episodic')),
      importance REAL NOT NULL DEFAULT 0.5,
      salience REAL NOT NULL DEFAULT 1.0,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      accessed_at INTEGER NOT NULL
    );

    -- FTS5 full-text search for memories
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content=memories,
      content_rowid=id
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE OF content ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.id, old.content);
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;

    -- Conversation log
    CREATE TABLE IF NOT EXISTS conversation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Scheduled tasks
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule TEXT NOT NULL,
      next_run INTEGER NOT NULL,
      last_run INTEGER,
      last_result TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','running')),
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status_next ON scheduled_tasks(status, next_run);

    -- Token usage tracking
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      agent_id TEXT DEFAULT 'main',
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_read INTEGER,
      model TEXT,
      created_at INTEGER NOT NULL
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      detail TEXT,
      chat_id TEXT,
      created_at INTEGER NOT NULL
    );
  `)

  logger.info('Database initialized')
}

// --- Sessions ---

export function getSession(chatId: string): string | null {
  const row = getDb()
    .prepare('SELECT session_id FROM sessions WHERE chat_id = ?')
    .get(chatId) as { session_id: string } | undefined
  return row?.session_id ?? null
}

export function setSession(chatId: string, sessionId: string): void {
  getDb()
    .prepare(
      `INSERT INTO sessions (chat_id, session_id, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET session_id = ?, updated_at = ?`
    )
    .run(chatId, sessionId, now(), sessionId, now())
}

export function clearSession(chatId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE chat_id = ?').run(chatId)
}

// --- Memories ---

export interface Memory {
  id: number
  chat_id: string
  topic_key: string | null
  content: string
  sector: 'semantic' | 'episodic'
  importance: number
  salience: number
  pinned: number
  created_at: number
  accessed_at: number
}

export function saveMemory(
  chatId: string,
  content: string,
  sector: 'semantic' | 'episodic',
  topicKey?: string,
  importance = 0.5
): number {
  const ts = now()
  const result = getDb()
    .prepare(
      `INSERT INTO memories (chat_id, topic_key, content, sector, importance, salience, created_at, accessed_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`
    )
    .run(chatId, topicKey ?? null, content, sector, importance, ts, ts)
  return Number(result.lastInsertRowid)
}

export function searchMemories(query: string, limit = 10, chatId?: string): Memory[] {
  const sanitized = query.replace(/[^\p{L}\p{N}\s]/gu, '').trim()
  if (!sanitized) return []

  const ftsQuery = sanitized
    .split(/\s+/)
    .map((w) => `"${w}"*`)
    .join(' OR ')

  if (chatId) {
    return getDb()
      .prepare(
        `SELECT m.* FROM memories m
         JOIN memories_fts fts ON m.id = fts.rowid
         WHERE memories_fts MATCH ? AND m.chat_id = ?
         ORDER BY m.salience DESC, m.accessed_at DESC
         LIMIT ?`
      )
      .all(ftsQuery, chatId, limit) as Memory[]
  }

  return getDb()
    .prepare(
      `SELECT m.* FROM memories m
       JOIN memories_fts fts ON m.id = fts.rowid
       WHERE memories_fts MATCH ?
       ORDER BY m.salience DESC, m.accessed_at DESC
       LIMIT ?`
    )
    .all(ftsQuery, limit) as Memory[]
}

export function getRecentMemories(chatId: string, limit = 20): Memory[] {
  return getDb()
    .prepare(
      `SELECT * FROM memories
       WHERE chat_id = ?
       ORDER BY accessed_at DESC
       LIMIT ?`
    )
    .all(chatId, limit) as Memory[]
}

export function getPinnedMemories(chatId: string): Memory[] {
  return getDb()
    .prepare('SELECT * FROM memories WHERE chat_id = ? AND pinned = 1 ORDER BY salience DESC')
    .all(chatId) as Memory[]
}

export function pinMemory(id: number): void {
  getDb().prepare('UPDATE memories SET pinned = 1 WHERE id = ?').run(id)
}

export function unpinMemory(id: number): void {
  getDb().prepare('UPDATE memories SET pinned = 0 WHERE id = ?').run(id)
}

export function deleteMemory(id: number): void {
  getDb().prepare('DELETE FROM memories WHERE id = ?').run(id)
}

export function touchMemory(id: number): void {
  getDb()
    .prepare('UPDATE memories SET accessed_at = ?, salience = MIN(salience + 0.1, 5.0) WHERE id = ?')
    .run(now(), id)
}

export function runDecaySweep(): { decayed: number; deleted: number } {
  const d = getDb()
  const oneDayAgo = now() - 86400

  const decayed = d
    .prepare('UPDATE memories SET salience = salience * 0.98 WHERE pinned = 0 AND created_at < ?')
    .run(oneDayAgo)

  const deleted = d
    .prepare('DELETE FROM memories WHERE pinned = 0 AND salience < 0.1')
    .run()

  return { decayed: decayed.changes, deleted: deleted.changes }
}

export function getMemoryStats(): {
  total: number
  semantic: number
  episodic: number
  pinned: number
  avgSalience: number
} {
  const row = getDb()
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN sector = 'semantic' THEN 1 ELSE 0 END) as semantic,
        SUM(CASE WHEN sector = 'episodic' THEN 1 ELSE 0 END) as episodic,
        SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) as pinned,
        AVG(salience) as avgSalience
       FROM memories`
    )
    .get() as any
  return {
    total: row.total ?? 0,
    semantic: row.semantic ?? 0,
    episodic: row.episodic ?? 0,
    pinned: row.pinned ?? 0,
    avgSalience: row.avgSalience ?? 0,
  }
}

// --- Conversation Log ---

export function logConversation(chatId: string, role: 'user' | 'assistant', content: string): void {
  getDb()
    .prepare('INSERT INTO conversation_log (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)')
    .run(chatId, role, content, now())
}

export function getConversationHistory(
  chatId: string,
  limit = 50,
  offset = 0
): Array<{ id: number; role: string; content: string; created_at: number }> {
  return getDb()
    .prepare(
      `SELECT id, role, content, created_at FROM conversation_log
       WHERE chat_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(chatId, limit, offset) as any[]
}

// --- Scheduled Tasks ---

export interface ScheduledTask {
  id: string
  chat_id: string
  prompt: string
  schedule: string
  next_run: number
  last_run: number | null
  last_result: string | null
  status: 'active' | 'paused' | 'running'
  created_at: number
}

export function createScheduledTask(
  id: string,
  chatId: string,
  prompt: string,
  schedule: string,
  nextRun: number
): void {
  getDb()
    .prepare(
      `INSERT INTO scheduled_tasks (id, chat_id, prompt, schedule, next_run, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(id, chatId, prompt, schedule, nextRun, now())
}

export function getAllScheduledTasks(): ScheduledTask[] {
  return getDb()
    .prepare('SELECT * FROM scheduled_tasks ORDER BY next_run ASC')
    .all() as ScheduledTask[]
}

export function getDueTasks(): ScheduledTask[] {
  return getDb()
    .prepare("SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run <= ?")
    .all(now()) as ScheduledTask[]
}

export function markTaskRunning(id: string): void {
  getDb().prepare("UPDATE scheduled_tasks SET status = 'running' WHERE id = ?").run(id)
}

export function updateTaskAfterRun(id: string, lastResult: string, nextRun: number): void {
  getDb()
    .prepare(
      "UPDATE scheduled_tasks SET status = 'active', last_run = ?, last_result = ?, next_run = ? WHERE id = ?"
    )
    .run(now(), lastResult, nextRun, id)
}

export function pauseScheduledTask(id: string): void {
  getDb().prepare("UPDATE scheduled_tasks SET status = 'paused' WHERE id = ?").run(id)
}

export function resumeScheduledTask(id: string): void {
  getDb().prepare("UPDATE scheduled_tasks SET status = 'active' WHERE id = ?").run(id)
}

export function deleteScheduledTask(id: string): void {
  getDb().prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id)
}

export function resetStuckTasks(): number {
  const result = getDb()
    .prepare("UPDATE scheduled_tasks SET status = 'active' WHERE status = 'running'")
    .run()
  return result.changes
}

// --- Token Usage ---

export function saveTokenUsage(
  sessionId: string | null,
  inputTokens: number,
  outputTokens: number,
  cacheRead: number,
  model: string,
  agentId = 'main'
): void {
  getDb()
    .prepare(
      `INSERT INTO token_usage (session_id, agent_id, input_tokens, output_tokens, cache_read, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(sessionId, agentId, inputTokens, outputTokens, cacheRead, model, now())
}

export function getTokenStats(days = 7): {
  totalInput: number
  totalOutput: number
  totalCache: number
  count: number
} {
  const since = now() - days * 86400
  const row = getDb()
    .prepare(
      `SELECT
        COALESCE(SUM(input_tokens), 0) as totalInput,
        COALESCE(SUM(output_tokens), 0) as totalOutput,
        COALESCE(SUM(cache_read), 0) as totalCache,
        COUNT(*) as count
       FROM token_usage
       WHERE created_at >= ?`
    )
    .get(since) as any
  return row
}

export function getTokenTimeline(days = 7): Array<{ day: string; input: number; output: number }> {
  const since = now() - days * 86400
  return getDb()
    .prepare(
      `SELECT
        date(created_at, 'unixepoch', 'localtime') as day,
        SUM(input_tokens) as input,
        SUM(output_tokens) as output
       FROM token_usage
       WHERE created_at >= ?
       GROUP BY day
       ORDER BY day ASC`
    )
    .all(since) as any[]
}

// --- Audit Log ---

export function audit(action: string, detail?: string, chatId?: string): void {
  getDb()
    .prepare('INSERT INTO audit_log (action, detail, chat_id, created_at) VALUES (?, ?, ?, ?)')
    .run(action, detail ?? null, chatId ?? null, now())
}

export function getAuditLog(limit = 50): Array<{
  id: number
  action: string
  detail: string | null
  chat_id: string | null
  created_at: number
}> {
  return getDb()
    .prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?')
    .all(limit) as any[]
}

// --- Helpers ---

function now(): number {
  return Math.floor(Date.now() / 1000)
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}
