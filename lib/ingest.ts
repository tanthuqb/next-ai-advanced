// Server-only helper: stores knowledge through the `Embedding` Edge Function
// with isIngest: true, so documents are embedded with the SAME model the chat
// route uses for queries (gemini-embedding-001, 768 dims). Embedding with a
// different model would put vectors in a different space and break retrieval.

export function splitIntoChunks(content: string) {
  return content
    .split('\n')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

export async function ingestChunks(chunks: string[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing Supabase environment variables for embedding function call.')
  }

  // The Edge Function stores one nods_page_section row per call.
  let ingested = 0
  for (const chunk of chunks) {
    const response = await fetch(`${supabaseUrl}/functions/v1/Embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publishableKey}`,
        apikey: publishableKey,
      },
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
