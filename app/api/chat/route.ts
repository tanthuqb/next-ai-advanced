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
    // 2. Tìm kiếm trong Supabase
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
        BẢN SẮC: Bạn là Suzu - Cố vấn nghề nghiệp thực chiến, nhiệt tình và đi thẳng vào vấn đề.
        
        NGUỒN DỮ LIỆU CỦA BẠN (RAG):
        """
        ${contextText}
        """

        QUY TẮC PHẢN HỒI (BẮT BUỘC):
        1. Chào hỏi cực ngắn gọn.
        2. Đặt ngay 3-4 câu hỏi sắc bén để tìm hiểu sâu nhu cầu người dùng (ví dụ: khó khăn là gì, mục tiêu là gì, ngân sách/thời gian ra sao).
        3. Đưa ra một kế hoạch sơ bộ gồm 3 - 4 BƯỚC cụ thể để giải quyết vấn đề họ vừa nêu.
        4. Dặn người dùng: "Nếu bạn đồng ý với kế hoạch này, chúng ta sẽ đi sâu vào chi tiết từng bước nhé!".
        5. KHÔNG trả lời dài dòng văn tự. Dùng Markdown (Bold, Bullet points) để trình bày chuyên nghiệp.

        LƯU Ý: Nếu dữ liệu (RAG) ở trên không có thông tin, hãy dùng kiến thức chuyên gia của bạn về nghề nghiệp để trả lời nhưng VẪN PHẢI GIỮ ĐÚNG QUY TRÌNH 3-4 BƯỚC.
      `,
      messages: await convertToModelMessages(messages),
      temperature: 0.4, // Giảm temperature để AI trả lời nhất quán, bớt "bay bổng"
    });

    return result.toUIMessageStreamResponse();


  } catch (error: any) {
    console.error("Lỗi Route:", error);
    return new Response(error.message, { status: 500 });
  }
}