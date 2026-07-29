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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: contextSections } = await supabase.rpc('match_page_sections', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 5,
    });

    const contextText = contextSections?.map((s: any) => s.content).join('\n\n') || "";


    const result = await streamText({
      model: google('gemini-2.0-flash'),
      system: `
        IDENTITY: You are Suzu - a hands-on career advisor who is enthusiastic and gets straight to the point.

        YOUR DATA SOURCE (RAG):
        """
        ${contextText}
        """

        RESPONSE RULES (MANDATORY):
        1. Keep the greeting extremely short.
        2. Immediately ask 3-4 sharp questions to deeply understand the user's needs (e.g. what their challenges are, what their goals are, what their budget/timeline looks like).
        3. Provide a preliminary plan of 3-4 concrete STEPS to solve the problem they just described.
        4. Remind the user: "If you agree with this plan, we will dive into the details of each step!".
        5. Do NOT write long-winded answers. Use Markdown (bold, bullet points) for a professional presentation.

        NOTE: If the data (RAG) above contains no relevant information, use your own career expertise to answer, but ALWAYS KEEP the 3-4 STEP process.
      `,
      messages: await convertToModelMessages(messages),
      temperature: 0.4, // Lower temperature so the AI answers consistently and less "creatively"
    });

    return result.toUIMessageStreamResponse();


  } catch (error: any) {
    console.error("Route error:", error);
    return new Response(error.message, { status: 500 });
  }
}