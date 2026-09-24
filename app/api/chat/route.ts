import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { createClient } from '@supabase/supabase-js'
import { chatModel } from '@/lib/chat-model'
import { getEmbeddingFunctionRequest } from '@/lib/embedding-function'
import { prepareChatMessages } from '@/lib/chat-guard'
import { createRateLimiter, getClientIp, readPositiveInt } from '@/lib/rate-limit'

// Quota protection (Gemini free tier is ~5 requests/min/model for the whole API key).
// In-memory limiter: global on a single `next start` server, per instance on Vercel.
const chatLimiter = createRateLimiter({
  limit: readPositiveInt(process.env.CHAT_RATE_LIMIT_PER_MIN, 10),
  windowMs: 60_000,
})
const CHAT_LIMITS = {
  maxMessages: readPositiveInt(process.env.CHAT_MAX_HISTORY_MESSAGES, 20),
  maxChars: readPositiveInt(process.env.CHAT_MAX_MESSAGE_CHARS, 4000),
}
// Hard cap on the raw request body, checked before JSON parsing.
const MAX_BODY_BYTES = 512 * 1024

type MatchedSection = {
  id: number
  page_id: number
  slug: string | null
  heading: string | null
  content: string | null
  similarity: number
}

function getMessageText(message?: UIMessage) {
  if (!message) {
    return ''
  }

  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }

  return { supabaseUrl, publishableKey }
}

async function getEmbeddingFromSupabase(input: string) {
  const { url, headers } = getEmbeddingFunctionRequest({ requireSecret: false })

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Embedding function failed: ${response.status} ${text}`)
  }

  const payload = (await response.json()) as { embedding?: number[] }

  if (!Array.isArray(payload.embedding) || payload.embedding.length === 0) {
    throw new Error('Embedding function returned invalid embedding payload.')
  }

  return payload.embedding
}

async function findContextSections(query: string): Promise<MatchedSection[]> {
  const { supabaseUrl, publishableKey } = getSupabaseEnv()
  const embedding = await getEmbeddingFromSupabase(query)
  const supabase = createClient(supabaseUrl, publishableKey)

  const { data, error } = await supabase.rpc('match_page_sections', {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 5,
  })

  if (error) {
    throw new Error(`match_page_sections failed: ${error.message}`)
  }

  return (data ?? []) as MatchedSection[]
}

// Citations sent to the client as message metadata (rendered as "View sources").
// Only cite sources the answer is genuinely grounded in. Weakly-related
// matches (kept in the prompt context for the model) would over-claim as citations.
const CITATION_THRESHOLD = 0.7

function buildSources(sections: MatchedSection[]) {
  const seenKeys = new Set<string>()

  return (
    sections
      .filter((s) => s.similarity >= CITATION_THRESHOLD)
      .map((s) => {
        const content = typeof s.content === 'string' ? s.content : ''
        // Stored headings are generic ("Edge ingest"), so derive a title from the chunk itself.
        const hasRealHeading = s.heading && s.heading !== 'Edge ingest'
        const title: string = hasRealHeading
          ? (s.heading as string)
          : content.split(/[.:\n]/)[0].trim().slice(0, 60) || s.slug || `Section ${s.id}`
        return {
          id: s.id,
          title,
          similarity: s.similarity,
          // Omit the snippet when it would just repeat the title.
          snippet:
            content.length > title.length + 20
              ? content.length > 180
                ? content.slice(0, 180) + '…'
                : content
              : '',
          dedupeKey: (content || title).trim().toLowerCase(),
        }
      })
      // Duplicate chunks (same doc ingested twice) collapse into one entry;
      // results are sorted by similarity, so the best match wins.
      .filter((s) => {
        const keys = [s.dedupeKey, s.title.toLowerCase()]
        if (keys.some((k) => seenKeys.has(k))) return false
        keys.forEach((k) => seenKeys.add(k))
        return true
      })
      .map((s) => ({ id: s.id, title: s.title, similarity: s.similarity, snippet: s.snippet }))
  )
}

function textResponse(text: string, status: number, headers: Record<string, string> = {}) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  })
}

export async function POST(req: Request) {
  // Rate limit first, so even invalid requests count and never reach Gemini.
  const rate = await chatLimiter.check(getClientIp(req.headers))
  if (!rate.allowed) {
    const seconds = Math.max(1, Math.ceil(rate.retryAfterMs / 1000))
    return textResponse(
      `You are sending too many messages. Please wait ${seconds} seconds and try again.`,
      429,
      {
        'Retry-After': String(seconds),
        'X-RateLimit-Limit': String(chatLimiter.limit),
        'X-RateLimit-Remaining': '0',
      }
    )
  }

  try {
    const declaredLength = Number(req.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_BODY_BYTES) {
      return textResponse('Request body is too large.', 413)
    }
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return textResponse('Request body is too large.', 413)
    }

    let body: { messages?: unknown } | null = null
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }

    const prepared = prepareChatMessages(body?.messages, CHAT_LIMITS)
    if ('error' in prepared) {
      return textResponse(prepared.error, prepared.status)
    }
    const messages = prepared.messages

    const lastMessage = getMessageText(messages[messages.length - 1])

    // RAG retrieval. If it fails (edge function / RPC down), keep chatting
    // without context instead of failing the whole request.
    let contextSections: MatchedSection[] = []
    try {
      contextSections = lastMessage.trim() ? await findContextSections(lastMessage) : []
    } catch (error) {
      console.error('RAG retrieval failed, answering without context:', error)
    }

    const contextText = contextSections.map((s) => s.content).join('\n\n')
    const sources = buildSources(contextSections)

    const result = streamText({
      model: chatModel,
      instructions: `
        IDENTITY: You are Suzu - a hands-on career advisor who is enthusiastic, warm, and gets straight to the point.

        YOUR DATA SOURCE (RAG):
        """
        ${contextText}
        """

        CONVERSATION PHASES (MANDATORY):

        1. GREETING (first exchange only, when the user has just said hi or opened the chat):
           - Introduce yourself in 2-3 sentences max. If the RAG context clearly states which company you represent, mention it in ONE short phrase - but never guess: job boards, hiring channels, or partners mentioned in the context are NOT your company. When unsure, introduce yourself simply as a career advisor.
           - Ask exactly ONE question to understand the user's goal.
           - Do NOT provide any plan, step list, or detailed company info yet.

        2. ADVISING (after the user has shared their goal or asked a concrete question):
           - Ground answers in the RAG context above when relevant; otherwise use your own career expertise.
           - Give specific, personalized guidance based on what the user actually said.
           - Ask at most ONE follow-up question per reply, only when something essential is missing.
           - Offer a short action plan (3-4 steps) only once the user's goal is clear, then ask if they agree before diving into details.

        STYLE RULES:
        - Always reply in English unless the user writes in another language.
        - Keep replies short and conversational. Never ask multiple numbered questions in one message.
        - Use Markdown (bold, bullet points) sparingly for a professional presentation.
      `,
      messages: await convertToModelMessages(messages),
      temperature: 0.4, // Lower temperature so the AI answers consistently and less "creatively"
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        // Log the real error server-side; send the client a safe, readable message.
        onError: (error) => {
          console.error('Chat stream error:', error)
          const text = error instanceof Error ? error.message : String(error)
          if (/quota|rate limit|RESOURCE_EXHAUSTED|429/i.test(text)) {
            return 'Suzu has hit the AI provider rate limit. Please wait a moment and try again.'
          }
          if (/high demand|overloaded|UNAVAILABLE|503/i.test(text)) {
            return 'The AI model is overloaded right now. Please try again shortly.'
          }
          return 'Suzu could not generate a reply.'
        },
        messageMetadata: ({ part }) => {
          if (part.type === 'start') {
            return { sources }
          }
        },
      }),
    })
  } catch (error) {
    console.error('Route error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(message, { status: 500 })
  }
}
