import { createClient } from '@supabase/supabase-js'


// Setup CORS headers so the function can be called from the browser (Next.js)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const KNOWLEDGE_PATH = '/internal/suzu-knowledge'
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

async function getGoogleEmbedding(input: string) {
  const googleApiKey =
    Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ?? Deno.env.get('GEMINI_API_KEY')

  if (!googleApiKey) {
    throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) in function secrets')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${googleApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: input }],
        },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google embedding API failed: ${response.status} ${body}`)
  }

  const payload = await response.json()
  const values = payload?.embedding?.values

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Google embedding API returned invalid embedding payload')
  }

  return values as number[]
}

Deno.serve(async (req) => {
  // Handle preflight requests (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { input, isIngest } = await req.json()

    if (!input || typeof input !== 'string') {
      return new Response(JSON.stringify({ error: 'input must be a non-empty string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const embedding = await getGoogleEmbedding(input)


    // If an admin is ingesting knowledge (Ingest)
    if (isIngest) {
      const supabaseUrl = Deno.env.get('EDGE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')
      // SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
      // Supabase Edge Runtime. Writes must use the service-role key (RLS blocks anon writes).
      const serviceRoleKey =
        Deno.env.get('EDGE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
          'Missing EDGE_SUPABASE_URL/EDGE_SERVICE_ROLE_KEY (or the built-in SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY) in function secrets'
        )
      }

      const supabase = createClient(
        supabaseUrl,
        serviceRoleKey
      )

      const { data: page, error: pageError } = await supabase
        .from('nods_page')
        .upsert(
          {
            path: KNOWLEDGE_PATH,
            type: 'knowledge-base',
            source: 'edge-function-ingest',
          },
          { onConflict: 'path' }
        )
        .select('id')
        .single()

      if (pageError) {
        throw pageError
      }

      const { error } = await supabase
        .from('nods_page_section')
        .insert({
          content: input,
          embedding,
          page_id: page.id,
          slug: `edge-${Date.now()}`,
          heading: 'Edge ingest',
        })

      if (error) throw error

      return new Response(JSON.stringify({ success: true, message: "Suzu has finished learning the new knowledge!" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Chat (search) request, return the embedding for the search RPC
    return new Response(JSON.stringify({ embedding }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

   
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})