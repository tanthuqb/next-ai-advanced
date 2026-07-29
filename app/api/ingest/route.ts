import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { pipeline } from '@xenova/transformers'

let extractor: any = null;

export async function POST(req: Request) {
    try {
        const { content } = await req.json()
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!, 
            process.env.SUPABASE_SERVICE_ROLE_KEY! 
        )

        // 1. Initialize MPNet (768 dims)
        if (!extractor) {
            extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
        }

        // 2. Resolve the page ID based on the 'path' column (the schema declares path NOT NULL UNIQUE)
        const targetPath = '/internal/suzu-knowledge';
        let pageId: number;

        const { data: existingPage } = await supabase
            .from('nods_page')
            .select('id')
            .eq('path', targetPath)
            .single();

        if (existingPage) {
            pageId = existingPage.id;
        } else {
            // If it does not exist yet, create it with the schema columns: path, type, source
            const { data: newPage, error: pageError } = await supabase
                .from('nods_page')
                .insert({ 
                    path: targetPath, 
                    type: 'knowledge-base',
                    source: 'admin-upload'
                })
                .select('id')
                .single();
            
            if (pageError) throw new Error("Failed to create nods_page: " + pageError.message);
            pageId = newPage.id;
        }

        // 3. Split into chunks and generate embeddings
        const chunks = content.split('\n').filter((c: string) => c.trim().length > 0)
        
        for (const chunk of chunks) {
            const output = await extractor(chunk, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data);

            // 4. Insert into nods_page_section (columns: page_id, content, embedding, slug)
            const { error: insertError } = await supabase.from('nods_page_section').insert({
                page_id: pageId, // Bigint
                content: chunk,
                embedding: embedding, // 768 dims
                slug: `section-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`
            })

            if (insertError) {
                console.error('Failed to insert section:', insertError);
                throw insertError;
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Suzu has finished ingesting knowledge into path: ${targetPath}`
        })

    } catch (error: any) {
        console.error('Ingest Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}