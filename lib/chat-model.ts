// Server-side only: imported by app/api/chat/route.ts.
import { google } from '@ai-sdk/google'
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'
import { CHAT_FALLBACK_MODEL_IDS, CHAT_MODEL_ID } from './models'

function describe(error: unknown) {
  const e = error as { statusCode?: number; message?: string } | null
  return `${e?.statusCode ?? '?'} ${(e?.message ?? String(error)).slice(0, 120)}`
}

function isTransientProviderError(error: unknown) {
  const e = error as { statusCode?: number; isRetryable?: boolean } | null
  return !!e && (e.isRetryable === true || e.statusCode === 429 || e.statusCode === 503)
}

// Gemini Flash models regularly return 503 "high demand" (and 429 on the free
// tier). The provider call fails before any token is streamed, so we can
// transparently retry the same request on the next model in the chain.
const fallbackMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v4',
  wrapStream: async ({ doStream, params }) => {
    try {
      return await doStream()
    } catch (error) {
      if (!isTransientProviderError(error)) throw error
      let lastError = error
      for (const modelId of CHAT_FALLBACK_MODEL_IDS) {
        try {
          console.warn(`Chat model unavailable (${describe(lastError)}), falling back to ${modelId}`)
          return await google(modelId).doStream(params)
        } catch (fallbackError) {
          lastError = fallbackError
          if (!isTransientProviderError(fallbackError)) throw fallbackError
        }
      }
      throw lastError
    }
  },
}

export function createChatModel(modelId: string = CHAT_MODEL_ID) {
  return wrapLanguageModel({ model: google(modelId), middleware: fallbackMiddleware })
}

export const chatModel = createChatModel()
