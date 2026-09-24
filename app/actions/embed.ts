'use server'

import { hasAdminSession } from '@/lib/admin-auth'
import { ingestChunks } from '@/lib/ingest'

// Server action: save a single document through the `Embedding` Edge Function
// (same pipeline as POST /api/ingest). The Edge Function writes with the
// service-role key, attaches the row to the knowledge-base page, and uses the
// same embedding model as the chat route.
// Server actions are public POST endpoints, so the admin session is checked here.
export async function saveDocument(content: string) {
  if (!(await hasAdminSession())) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('content must be a non-empty string')
    }

    await ingestChunks([content.trim()])

    return { success: true }
  } catch (error) {
    console.error('Error saving document:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
