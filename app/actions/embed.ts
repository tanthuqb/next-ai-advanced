'use server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function saveDocument(content: string) {
  try {
    // 1. Gọi cái Edge Function mình vừa làm
    const res = await fetch('http://127.0.0.1:54321/functions/v1/Embedding', {
      method: 'POST',
      body: JSON.stringify({ input: content })
    })
    
    if (!res.ok) {
      throw new Error(`Embedding API error: ${res.statusText}`)
    }
    
    const { embedding } = await res.json()

    // 2. Lưu vào Supabase
    const { error } = await supabase
      .from('nods_page_section')
      .insert({
        content: content,
        embedding: embedding,
        slug: 'quy-dinh-cong-ty',
        heading: 'Quy định'
      })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving document:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}