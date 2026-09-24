// Single source of truth for the model names shown in the UI and used by the API.
// Keep in sync with supabase/functions/Embedding/index.ts (EMBEDDING_MODEL).
// gemini-3.8-flash and gemini-3.7-flash exist but returned 503 "high demand" for this
// project's key during the 2026-09 upgrade; 3.6 is current and served reliably.
export const CHAT_MODEL_ID = 'gemini-3.6-flash'
export const CHAT_MODEL_LABEL = 'Gemini 3.6 Flash'
// Tried in order when the primary model returns 503 (overloaded) or 429 (rate limited).
export const CHAT_FALLBACK_MODEL_IDS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite']

export const EMBEDDING_MODEL_ID = 'gemini-embedding-001'
export const EMBEDDING_DIMENSIONS = 768
