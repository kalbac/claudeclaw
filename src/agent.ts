import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PROJECT_ROOT, AGENT_TIMEOUT_MS } from './config.js'
import { logger } from './logger.js'

interface AgentResult {
  text: string | null
  newSessionId?: string
  inputTokens?: number
  outputTokens?: number
  cacheRead?: number
  model?: string
}

export async function runAgent(
  message: string,
  sessionId?: string,
  onTyping?: () => void
): Promise<AgentResult> {
  const { query } = await import('@anthropic-ai/claude-code')

  // Read system prompt files
  const parts: string[] = []

  for (const file of ['CLAUDE.md', 'AGENT.md', 'USER.md']) {
    try {
      parts.push(readFileSync(resolve(PROJECT_ROOT, file), 'utf-8'))
    } catch {
      // Optional files — skip silently
    }
  }

  if (parts.length === 0) {
    logger.warn('No prompt files found (CLAUDE.md, AGENT.md, USER.md)')
  }

  const systemPrompt = parts.join('\n\n---\n\n')
  const fullMessage = systemPrompt
    ? `You MUST follow these instructions at all times:\n\n${systemPrompt}\n\n---\nUser message:\n${message}`
    : message

  const typingInterval = onTyping ? setInterval(onTyping, 4000) : undefined

  let resultText: string | null = null
  let newSessionId: string | undefined
  let inputTokens = 0
  let outputTokens = 0
  let cacheRead = 0
  let model = ''

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

  try {
    const events = query({
      prompt: fullMessage,
      options: {
        cwd: PROJECT_ROOT,
        ...(sessionId ? { resume: sessionId } : {}),
        maxTurns: 50,
        permissionMode: 'bypassPermissions',
        abortController,
      },
    })

    for await (const event of events) {
      if (event.type === 'system' && 'subtype' in event && event.subtype === 'init') {
        newSessionId = event.session_id
        if ('model' in event) model = event.model as string
      }

      if (event.type === 'result') {
        if (event.subtype === 'success') {
          resultText = event.result
        } else {
          resultText = `[Error: ${event.subtype}]`
        }

        // Extract token usage from result
        if (event.usage) {
          inputTokens = event.usage.input_tokens ?? 0
          outputTokens = event.usage.output_tokens ?? 0
          cacheRead = event.usage.cache_read_input_tokens ?? 0
        }

        // Extract model from modelUsage keys
        if (event.modelUsage) {
          const models = Object.keys(event.modelUsage)
          if (models.length > 0 && !model) model = models[0]
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      logger.warn('Agent timed out')
      resultText = '[Agent timed out after ' + (AGENT_TIMEOUT_MS / 1000) + 's]'
    } else {
      logger.error({ err }, 'Agent error')
      resultText = `[Error: ${err.message}]`
    }
  } finally {
    clearTimeout(timeout)
    if (typingInterval) clearInterval(typingInterval)
  }

  return { text: resultText, newSessionId, inputTokens, outputTokens, cacheRead, model }
}
