#!/usr/bin/env node

import {
  initDatabase,
  searchMemories,
  getRecentMemories,
  getPinnedMemories,
  saveMemory,
  pinMemory,
  unpinMemory,
  deleteMemory,
  clearSession,
  getMemoryStats,
} from './db.js'
import { saveCheckpoint } from './memory.js'
import { ALLOWED_CHAT_ID } from './config.js'

initDatabase()

const [, , command, ...args] = process.argv
const chatId = ALLOWED_CHAT_ID || 'default'

switch (command) {
  case 'search': {
    const query = args.join(' ')
    if (!query) {
      console.log('Usage: memory-cli search <query>')
      process.exit(1)
    }
    const results = searchMemories(query, 10)
    if (results.length === 0) {
      console.log('No memories found.')
    } else {
      for (const m of results) {
        const tag = m.pinned ? '📌' : m.sector === 'semantic' ? '🧠' : '💬'
        const date = new Date(m.created_at * 1000).toLocaleDateString('ru-RU')
        console.log(`${tag} [#${m.id}] (${date}, salience: ${m.salience.toFixed(2)}) ${m.content}`)
      }
    }
    break
  }

  case 'save': {
    const content = args.join(' ')
    if (!content) {
      console.log('Usage: memory-cli save <content>')
      process.exit(1)
    }
    const id = saveMemory(chatId, content, 'semantic', undefined, 0.8)
    console.log(`Memory saved (id: ${id})`)
    break
  }

  case 'list': {
    const limit = parseInt(args[0] ?? '20', 10)
    const memories = getRecentMemories(chatId, limit)
    if (memories.length === 0) {
      console.log('No memories yet.')
    } else {
      for (const m of memories) {
        const tag = m.pinned ? '📌' : m.sector === 'semantic' ? '🧠' : '💬'
        const date = new Date(m.created_at * 1000).toLocaleDateString('ru-RU')
        console.log(`${tag} [#${m.id}] (${date}, salience: ${m.salience.toFixed(2)}) ${m.content.slice(0, 120)}`)
      }
    }
    break
  }

  case 'pinned': {
    const pinned = getPinnedMemories(chatId)
    if (pinned.length === 0) {
      console.log('No pinned memories.')
    } else {
      for (const m of pinned) {
        console.log(`📌 [#${m.id}] ${m.content}`)
      }
    }
    break
  }

  case 'pin': {
    const id = parseInt(args[0], 10)
    if (isNaN(id)) {
      console.log('Usage: memory-cli pin <id>')
      process.exit(1)
    }
    pinMemory(id)
    console.log(`Memory #${id} pinned.`)
    break
  }

  case 'unpin': {
    const id = parseInt(args[0], 10)
    if (isNaN(id)) {
      console.log('Usage: memory-cli unpin <id>')
      process.exit(1)
    }
    unpinMemory(id)
    console.log(`Memory #${id} unpinned.`)
    break
  }

  case 'forget':
  case 'delete': {
    const id = parseInt(args[0], 10)
    if (isNaN(id)) {
      console.log('Usage: memory-cli forget <id>')
      process.exit(1)
    }
    deleteMemory(id)
    console.log(`Memory #${id} deleted.`)
    break
  }

  case 'clear-session': {
    clearSession(chatId)
    console.log('Session cleared. Next message starts a new conversation.')
    break
  }

  case 'checkpoint': {
    const summary = args.join(' ')
    if (!summary) {
      console.log('Usage: memory-cli checkpoint <summary>')
      process.exit(1)
    }
    const id = saveCheckpoint(chatId, summary)
    console.log(`Checkpoint saved (id: ${id}, salience: 5.0). Safe to start a new session.`)
    break
  }

  case 'stats': {
    const stats = getMemoryStats()
    console.log(`Memories: ${stats.total} total (${stats.semantic} semantic, ${stats.episodic} episodic, ${stats.pinned} pinned)`)
    console.log(`Average salience: ${stats.avgSalience.toFixed(2)}`)
    break
  }

  default:
    console.log(`ClaudeClaw Memory CLI

Commands:
  search <query>        Search memories by text
  save <content>        Save a semantic memory
  list [limit]          Show recent memories (default: 20)
  pinned                Show pinned memories
  pin <id>              Pin a memory
  unpin <id>            Unpin a memory
  forget <id>           Delete a memory
  clear-session         Clear current session (start new conversation)
  checkpoint <summary>  Save high-salience session checkpoint
  stats                 Show memory statistics`)
    break
}
