// Server-only helper: stores knowledge through the `Embedding` Edge Function
// with isIngest: true, so documents are embedded with the SAME model the chat
// route uses for queries (gemini-embedding-001, 768 dims). Embedding with a
// different model would put vectors in a different space and break retrieval.
// Callers must verify the admin session first (see lib/admin-auth.ts).
import { getEmbeddingFunctionRequest } from './embedding-function'

export function splitIntoChunks(content: string) {
  return content
    .split('\n')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

export async function ingestChunks(chunks: string[]) {
  const { url, headers } = getEmbeddingFunctionRequest()

  // The Edge Function stores one nods_page_section row per call.
  let ingested = 0
  for (const chunk of chunks) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input: chunk, isIngest: true }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `Embedding function failed on chunk ${ingested + 1}/${chunks.length}: ${response.status} ${text}`
      )
    }

    ingested++
  }

  return ingested
}
