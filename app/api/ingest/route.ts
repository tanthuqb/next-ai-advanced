import { NextResponse } from 'next/server'
import { hasAdminSession } from '@/lib/admin-auth'
import { ingestChunks, splitIntoChunks } from '@/lib/ingest'

export async function POST(req: Request) {
  // Re-check the session here too: proxy.ts is only an optimistic check.
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => null)) as { content?: unknown } | null
    const content = body?.content

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 })
    }

    const ingested = await ingestChunks(splitIntoChunks(content))

    return NextResponse.json({
      success: true,
      ingested,
      message: `Suzu has finished ingesting ${ingested} knowledge chunk(s).`,
    })
  } catch (error) {
    console.error('Ingest Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
