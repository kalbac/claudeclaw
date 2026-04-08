import {
  searchMemories,
  getRecentMemories,
  getPinnedMemories,
  saveMemory,
  touchMemory,
  logConversation,
  runDecaySweep as dbDecaySweep,
  type Memory,
} from './db.js'
import { logger } from './logger.js'

const SEMANTIC_SIGNALS = /\b(my|i am|i'm|i prefer|remember|always|never|мой|я|предпочитаю|запомни|всегда|никогда)\b/i

export async function buildMemoryContext(chatId: string, userMessage: string): Promise<string> {
  const parts: string[] = []

  // 1. FTS5 search by user message keywords
  const ftsResults = searchMemories(userMessage, 5)

  // 2. Recent memories for this chat
  const recent = getRecentMemories(chatId, 5)

  // 3. Pinned memories
  const pinned = getPinnedMemories(chatId)

  // Deduplicate by id
  const seen = new Set<number>()
  const all: Memory[] = []

  for (const m of [...pinned, ...ftsResults, ...recent]) {
    if (!seen.has(m.id)) {
      seen.add(m.id)
      all.push(m)
    }
  }

  // Touch accessed memories (boost salience)
  for (const m of ftsResults) {
    touchMemory(m.id)
  }

  if (all.length === 0) return ''

  parts.push('[Memory context]')
  for (const m of all) {
    const tag = m.pinned ? '[pinned]' : `[${m.sector}]`
    parts.push(`- ${tag} ${m.content}`)
  }

  return parts.join('\n')
}

export async function saveConversationTurn(
  chatId: string,
  userMsg: string,
  assistantMsg: string
): Promise<void> {
  // Log conversation
  logConversation(chatId, 'user', userMsg)
  logConversation(chatId, 'assistant', assistantMsg)

  // Skip memory extraction for short or command messages
  if (userMsg.length <= 20 || userMsg.startsWith('/')) return

  // Detect semantic vs episodic
  const isSemanticUser = SEMANTIC_SIGNALS.test(userMsg)
  const isSemanticAssistant = SEMANTIC_SIGNALS.test(assistantMsg)

  if (isSemanticUser) {
    saveMemory(chatId, userMsg, 'semantic', undefined, 0.7)
  }

  // Always save a shorter episodic memory of the exchange
  const summary = userMsg.length > 200 ? userMsg.slice(0, 200) + '...' : userMsg
  saveMemory(chatId, summary, 'episodic', undefined, 0.3)
}

export function runDecaySweep(): void {
  const result = dbDecaySweep()
  if (result.decayed > 0 || result.deleted > 0) {
    logger.info(
      { decayed: result.decayed, deleted: result.deleted },
      'Memory decay sweep complete'
    )
  }
}

export function saveCheckpoint(chatId: string, summary: string): number {
  return saveMemory(chatId, summary, 'semantic', 'checkpoint', 5.0)
}
