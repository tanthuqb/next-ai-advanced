// Validates and trims the chat history before it reaches the model, so a single
// request can't send huge prompts (tokens are quota too) or inject system messages.
import type { UIMessage } from 'ai'

export type ChatLimits = {
  /** Most recent messages kept from the history sent by the client. */
  maxMessages: number
  /** Max characters of the latest user message (older messages are truncated to this). */
  maxChars: number
}

export type PrepareResult =
  | { ok: true; messages: UIMessage[] }
  | { ok: false; status: 400 | 413; error: string }

type RawMessage = { id?: unknown; role?: unknown; parts?: unknown }
type RawPart = { type?: unknown; text?: unknown }

function textParts(parts: unknown) {
  if (!Array.isArray(parts)) return []
  return (parts as RawPart[])
    .filter((p) => p?.type === 'text' && typeof p.text === 'string')
    .map((p) => ({ type: 'text' as const, text: p.text as string }))
}

const EMPTY = 'Request body must include a non-empty "messages" array.'

export function prepareChatMessages(input: unknown, limits: ChatLimits): PrepareResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, status: 400, error: EMPTY }
  }

  // Only user/assistant turns with text parts are forwarded; client "system" messages
  // and file parts are dropped (the UI never sends them).
  const cleaned = (input as RawMessage[])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m, i) => ({
      id: typeof m.id === 'string' ? m.id : `m${i}`,
      role: m.role as 'user' | 'assistant',
      parts: textParts(m.parts),
    }))
    .filter((m) => m.parts.length > 0)

  const last = cleaned[cleaned.length - 1]
  if (!last || last.role !== 'user') {
    return { ok: false, status: 400, error: 'The last message must be a user message.' }
  }

  const lastLength = last.parts.reduce((n, p) => n + p.text.length, 0)
  if (lastLength > limits.maxChars) {
    return {
      ok: false,
      status: 413,
      error: `Your message is too long (max ${limits.maxChars} characters). Please shorten it and try again.`,
    }
  }

  let recent = cleaned.slice(-limits.maxMessages)
  const firstUser = recent.findIndex((m) => m.role === 'user')
  recent = recent.slice(firstUser)

  const messages = recent.map((m) => ({
    ...m,
    parts: m.parts.map((p) => ({ ...p, text: p.text.slice(0, limits.maxChars) })),
  })) as UIMessage[]

  return { ok: true, messages }
}
