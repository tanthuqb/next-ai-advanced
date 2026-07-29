import { NextResponse } from 'next/server'

// Ingest goes through the `Embedding` Edge Function with isIngest: true so
// knowledge is embedded with the SAME model the chat route uses for queries
// (gemini-embedding-001). Embedding ingest with a different model (the old
// local MPNet pipeline) produced vectors in a different embedding space,
// making similarity search useless.
export async function POST(req: Request) {
    try {
        const { content } = await req.json()

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

        if (!supabaseUrl || !publishableKey) {
            throw new Error('Missing Supabase environment variables for embedding function call.')
        }

        // Split into chunks; the Edge Function stores one nods_page_section per call.
        const chunks = content.split('\n').filter((c: string) => c.trim().length > 0)

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
                throw new Error(`Embedding function failed on chunk ${ingested + 1}/${chunks.length}: ${response.status} ${text}`)
            }

            ingested++
        }

        return NextResponse.json({
            success: true,
            message: `Suzu has finished ingesting ${ingested} knowledge chunk(s).`,
        })
    } catch (error: any) {
        console.error('Ingest Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
