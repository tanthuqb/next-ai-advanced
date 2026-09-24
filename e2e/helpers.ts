import type { Route } from '@playwright/test'

/** Fulfil a request with a minimal AI SDK UI message stream (SSE) containing `text`. */
export async function fulfillWithUIMessageStream(route: Route, text: string) {
  const chunks = [
    { type: 'start', messageMetadata: { sources: [] } },
    { type: 'start-step' },
    { type: 'text-start', id: 'text-1' },
    ...text.split(' ').map((word, i) => ({
      type: 'text-delta',
      id: 'text-1',
      delta: i === 0 ? word : ` ${word}`,
    })),
    { type: 'text-end', id: 'text-1' },
    { type: 'finish-step' },
    { type: 'finish' },
  ]
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'

  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
    body,
  })
}

/** Build a UI message body for POST /api/chat. */
export function chatRequestBody(text: string) {
  return {
    id: `e2e-${Date.now()}`,
    messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text }] }],
  }
}

/** Parse the SSE body returned by /api/chat into UI message chunks. */
export function parseUIMessageStream(body: string) {
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice('data: '.length)) as { type: string; [k: string]: unknown })
}
