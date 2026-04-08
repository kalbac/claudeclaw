import cronParser from 'cron-parser'
import {
  getDueTasks,
  markTaskRunning,
  updateTaskAfterRun,
  resetStuckTasks,
  audit,
} from './db.js'
import { runAgent } from './agent.js'
import { SCHEDULER_POLL_MS, TASK_TIMEOUT_MS, TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID } from './config.js'
import { logger } from './logger.js'

const CronExpression = (cronParser as any).default ?? cronParser

type Sender = (chatId: string, text: string) => Promise<void>

let pollTimer: ReturnType<typeof setInterval> | null = null
let sendFn: Sender

export function initScheduler(send: Sender): void {
  sendFn = send

  // Reset any tasks stuck in 'running' from a previous crash
  const stuck = resetStuckTasks()
  if (stuck > 0) {
    logger.warn({ stuck }, 'Reset stuck tasks')
  }

  pollTimer = setInterval(runDueTasks, SCHEDULER_POLL_MS)
  logger.info('Scheduler started (polling every %ds)', SCHEDULER_POLL_MS / 1000)
}

export function stopScheduler(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export async function runDueTasks(): Promise<void> {
  const tasks = getDueTasks()
  if (tasks.length === 0) return

  for (const task of tasks) {
    logger.info({ taskId: task.id, prompt: task.prompt.slice(0, 80) }, 'Running scheduled task')
    markTaskRunning(task.id)
    audit('task_start', `Task ${task.id}: ${task.prompt.slice(0, 100)}`, task.chat_id)

    try {
      const result = await runAgent(task.prompt)

      const resultText = result.text ?? '[No output]'

      // Send result to Telegram
      if (sendFn) {
        await sendFn(task.chat_id, `📋 *Task: ${task.id}*\n\n${resultText}`)
      }

      // Compute next run
      const nextRun = computeNextRun(task.schedule)
      updateTaskAfterRun(task.id, resultText.slice(0, 1000), nextRun)

      audit('task_complete', `Task ${task.id} completed`, task.chat_id)
      logger.info({ taskId: task.id }, 'Task completed')
    } catch (err: any) {
      logger.error({ err, taskId: task.id }, 'Task failed')
      const nextRun = computeNextRun(task.schedule)
      updateTaskAfterRun(task.id, `Error: ${err.message}`, nextRun)
      audit('task_error', `Task ${task.id}: ${err.message}`, task.chat_id)
    }
  }
}

export function computeNextRun(cronExpression: string): number {
  try {
    const interval = CronExpression.parseExpression
      ? CronExpression.parseExpression(cronExpression)
      : CronExpression.parse
        ? CronExpression.parse(cronExpression)
        : (() => { throw new Error('Cannot parse cron') })()

    const next = interval.next?.() ?? interval
    const date = next.toDate?.() ?? next
    return Math.floor(date.getTime() / 1000)
  } catch (err: any) {
    logger.error({ err, cronExpression }, 'Failed to parse cron expression')
    // Fallback: 1 hour from now
    return Math.floor(Date.now() / 1000) + 3600
  }
}

// Telegram Bot API direct sender (for scheduler — doesn't go through channels)
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn('Cannot send Telegram message: no bot token')
    return
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      parse_mode: 'Markdown',
    }),
  })

  if (!response.ok) {
    // Retry with plain text if Markdown fails
    const plainResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
      }),
    })
    if (!plainResponse.ok) {
      logger.error({ status: plainResponse.status }, 'Failed to send Telegram message')
    }
  }
}
