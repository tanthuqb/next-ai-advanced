// Server-only: how the Next.js server calls the Supabase `Embedding` Edge Function.
// The function requires `x-ingest-secret` (INGEST_SECRET) on every request, both for
// query embeddings (/api/chat) and for knowledge ingestion (isIngest: true).

export const INGEST_SECRET_HEADER = 'x-ingest-secret'

// requireSecret: ingest (a DB write) always requires it. The chat query path sends it when
// set; the function itself rejects calls without it once INGEST_SECRET is configured there.
export function getEmbeddingFunctionRequest({ requireSecret = true } = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const ingestSecret = process.env.INGEST_SECRET

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }
  if (!ingestSecret && requireSecret) {
    throw new Error(
      'Missing INGEST_SECRET: it must match the INGEST_SECRET secret of the Embedding Edge Function.'
    )
  }

  return {
    url: `${supabaseUrl}/functions/v1/Embedding`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publishableKey}`,
      apikey: publishableKey,
      ...(ingestSecret ? { [INGEST_SECRET_HEADER]: ingestSecret } : {}),
    } as Record<string, string>,
  }
}
