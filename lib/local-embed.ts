import { pipeline } from '@xenova/transformers';

export async function getLocalEmbedding(text: string) {

    // Model này cực nhẹ (~100MB), hỗ trợ đa ngôn ngữ ổn
    const extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
    
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    // Chuyển kết quả về mảng số thuần túy
    return Array.from(output.data); 
}