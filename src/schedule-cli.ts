#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import {
  initDatabase,
  createScheduledTask,
  getAllScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  deleteScheduledTask,
} from './db.js'
import { computeNextRun } from './scheduler.js'
import { ALLOWED_CHAT_ID } from './config.js'

initDatabase()

const [, , command, ...args] = process.argv
const chatId = ALLOWED_CHAT_ID || 'default'

switch (command) {
  case 'create': {
    const prompt = args[0]
    const cron = args[1]
    const targetChatId = args[2] ?? chatId

    if (!prompt || !cron) {
      console.log('Usage: schedule-cli create "<prompt>" "<cron>" [chat_id]')
      console.log('Example: schedule-cli create "Check unread emails and summarize" "0 9 * * 1-5"')
      process.exit(1)
    }

    const id = randomUUID().slice(0, 8)
    const nextRun = computeNextRun(cron)
    createScheduledTask(id, targetChatId, prompt, cron, nextRun)

    const nextDate = new Date(nextRun * 1000).toLocaleString('ru-RU')
    console.log(`Task created:`)
    console.log(`  ID: ${id}`)
    console.log(`  Cron: ${cron}`)
    console.log(`  Next run: ${nextDate}`)
    console.log(`  Prompt: ${prompt.slice(0, 100)}`)
    break
  }

  case 'list': {
    const tasks = getAllScheduledTasks()
    if (tasks.length === 0) {
      console.log('No scheduled tasks.')
    } else {
      for (const t of tasks) {
        const next = new Date(t.next_run * 1000).toLocaleString('ru-RU')
        const status = t.status === 'active' ? '✅' : t.status === 'paused' ? '⏸' : '🔄'
        console.log(`${status} [${t.id}] ${t.schedule} — ${t.prompt.slice(0, 80)}`)
        console.log(`   Next: ${next}${t.last_run ? ' | Last: ' + new Date(t.last_run * 1000).toLocaleString('ru-RU') : ''}`)
      }
    }
    break
  }

  case 'pause': {
    const id = args[0]
    if (!id) {
      console.log('Usage: schedule-cli pause <id>')
      process.exit(1)
    }
    pauseScheduledTask(id)
    console.log(`Task ${id} paused.`)
    break
  }

  case 'resume': {
    const id = args[0]
    if (!id) {
      console.log('Usage: schedule-cli resume <id>')
      process.exit(1)
    }
    resumeScheduledTask(id)
    console.log(`Task ${id} resumed.`)
    break
  }

  case 'delete': {
    const id = args[0]
    if (!id) {
      console.log('Usage: schedule-cli delete <id>')
      process.exit(1)
    }
    deleteScheduledTask(id)
    console.log(`Task ${id} deleted.`)
    break
  }

  default:
    console.log(`ClaudeClaw Schedule CLI

Commands:
  create "<prompt>" "<cron>" [chat_id]   Create a scheduled task
  list                                    List all tasks
  pause <id>                              Pause a task
  resume <id>                             Resume a task
  delete <id>                             Delete a task

Cron examples:
  "0 9 * * *"      — Daily at 9:00
  "0 9 * * 1-5"    — Weekdays at 9:00
  "0 */3 * * *"    — Every 3 hours
  "30 22 * * *"    — Daily at 22:30`)
    break
}
