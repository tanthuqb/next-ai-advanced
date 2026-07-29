import { pipeline } from '@xenova/transformers';

export async function getLocalEmbedding(text: string) {

    // This model is very lightweight (~100MB) with decent multilingual support
    const extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
    
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    // Convert the result to a plain number array
    return Array.from(output.data); 
}