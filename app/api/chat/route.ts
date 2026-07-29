import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { createClient } from '@supabase/supabase-js';

function getMessageText(message?: UIMessage) {
  if (!message) {
    return '';
  }

  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

async function getEmbeddingFromSupabase(input: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables for embedding function call.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/Embedding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding function failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as { embedding?: number[] };

  if (!Array.isArray(payload.embedding) || payload.embedding.length === 0) {
    throw new Error('Embedding function returned invalid embedding payload.');
  }

  return payload.embedding;
}

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] };
    const lastMessage = getMessageText(messages[messages.length - 1]);

    const embedding = await getEmbeddingFromSupabase(lastMessage);
    // 2. Search in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    const { data: contextSections } = await supabase.rpc('match_page_sections', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 5,
    });

    const contextText = contextSections?.map((s: any) => s.content).join('\n\n') || "";

    // Citations sent to the client as message metadata (rendered as "View sources").
    // Only cite sources the answer is genuinely grounded in. Weakly-related
    // matches (kept in contextText for the model) would over-claim as citations.
    const CITATION_THRESHOLD = 0.7;
    const seenKeys = new Set<string>();
    const sources = (contextSections ?? [])
      .filter((s: any) => s.similarity >= CITATION_THRESHOLD)
      .map((s: any) => {
        const content: string = typeof s.content === 'string' ? s.content : '';
        // Stored headings are generic ("Edge ingest"), so derive a title from the chunk itself.
        const hasRealHeading = s.heading && s.heading !== 'Edge ingest';
        const title: string = hasRealHeading
          ? s.heading
          : content.split(/[.:\n]/)[0].trim().slice(0, 60) || s.slug || `Section ${s.id}`;
        return {
          id: s.id,
          title,
          similarity: s.similarity,
          // Omit the snippet when it would just repeat the title.
          snippet: content.length > title.length + 20
            ? (content.length > 180 ? content.slice(0, 180) + '…' : content)
            : '',
          _dedupeKey: (content || title).trim().toLowerCase(),
        };
      })
      // Duplicate chunks (same doc ingested twice) collapse into one entry;
      // results are sorted by similarity, so the best match wins.
      .filter((s: { _dedupeKey: string; title: string }) => {
        const keys = [s._dedupeKey, s.title.toLowerCase()];
        if (keys.some((k) => seenKeys.has(k))) return false;
        keys.forEach((k) => seenKeys.add(k));
        return true;
      })
      .map(({ _dedupeKey, ...s }: { _dedupeKey: string; [k: string]: any }) => s);


    const result = await streamText({
      model: google('gemini-3.6-flash'),
      system: `
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
        - Keep replies short and conversational. Never ask multiple numbered questions in one message.
        - Use Markdown (bold, bullet points) sparingly for a professional presentation.
      `,
      messages: await convertToModelMessages(messages),
      temperature: 0.4, // Lower temperature so the AI answers consistently and less "creatively"
    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === 'start') {
          return { sources };
        }
      },
    });


  } catch (error: any) {
    console.error("Route error:", error);
    return new Response(error.message, { status: 500 });
  }
}