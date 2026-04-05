import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pipeline, env } from 'https://esm.sh/@xenova/transformers@2.17.1'


// Setup CORS headers để gọi được từ trình duyệt (Next.js)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

env.allowLocalModels = false;

serve(async (req) => {
  // Xử lý request Preflight (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { input, isIngest } = await req.json()

    // 1. Khởi tạo pipeline tạo embedding (Dùng đúng model bạn chọn)
    const extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');

    // 2. Tạo vector từ text truyền vào
    const output = await extractor(input, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);


    // 3. Nếu là Admin đang nạp kiến thức (Ingest)
    if (isIngest) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { error } = await supabase
        .from('suzu_knowledge') 
        .insert({
          content: input,
          embedding: embedding // Vector này giờ đã chuẩn 768 chiều của MPNet
        })

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Suzu đã học xong kiến thức mới!" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Nếu là Chat (Search), trả về embedding để thực hiện RPC tìm kiếm
    return new Response(JSON.stringify({ embedding }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

   
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})