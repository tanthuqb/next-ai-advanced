'use server'

import { ingestChunks } from '@/lib/ingest'

// Server action: save a single document through the `Embedding` Edge Function
// (same pipeline as POST /api/ingest). The Edge Function writes with the
// service-role key, attaches the row to the knowledge-base page, and uses the
// same embedding model as the chat route.
export async function saveDocument(content: string) {
  try {
    if (!content || content.trim().length === 0) {
      throw new Error('content must be a non-empty string')
    }

    await ingestChunks([content.trim()])

    return { success: true }
  } catch (error) {
    console.error('Error saving document:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
