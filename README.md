# next-ai-advanced

**Suzu AI** — a RAG-powered (Retrieval-Augmented Generation) career advisor chatbot built with Next.js, Supabase (Postgres + pgvector), and Google Gemini, ready to deploy on Supabase Cloud and Vercel.

## 1. Overview

Suzu is a hands-on career advisor chat assistant. It answers questions using knowledge stored in a Supabase vector database (RAG), falling back to the model's own expertise when no relevant context is found.

### How it works

```
User message (/chat)
   │
   ▼
POST /api/chat ──► Supabase Edge Function `Embedding` (Google gemini-embedding-001, 768 dims)
   │                       │
   │                       ▼
   │              returns query embedding
   ▼
Supabase RPC `match_page_sections` (pgvector similarity search)
   │
   ▼
Matched context + system prompt ──► Gemini 2.0 Flash (streaming) ──► UI
```

Knowledge ingestion:

- **Admin page** (`/admin`): paste documents into a textarea → `POST /api/ingest` chunks the text, generates embeddings locally with `Xenova/all-mpnet-base-v2` (768 dims), and inserts rows into `nods_page_section`.
- **Edge Function** (`Embedding` with `isIngest: true`): generates the embedding with Google's embedding API and stores the content directly from the edge.

## 2. Tech stack

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS 4** + shadcn/ui components
- **Supabase** — Postgres, pgvector, Row Level Security, Edge Functions (Deno)
- **AI SDK** (`ai`, `@ai-sdk/google`, `@ai-sdk/react`) with Google Gemini
- **@xenova/transformers** — local embedding generation for the ingest route

## 3. Project structure

```
app/
  page.tsx                  # Landing page
  chat/page.tsx             # Main chat UI (Suzu AI)
  admin/page.jsx            # Admin page to feed knowledge to the AI
  components/SuzuChat.tsx   # Alternative chat component
  actions/embed.ts          # Server action: save a document via the Edge Function
  api/
    chat/route.ts           # Chat endpoint: RAG search + Gemini streaming
    ingest/route.ts         # Ingest endpoint: chunk + embed + store knowledge
lib/
  local-embed.ts            # Local embedding helper (all-mpnet-base-v2)
  generate-embeddings.ts    # Legacy batch embedding script
supabase/
  functions/Embedding/      # Edge Function: Google embeddings + optional ingest
  migrations/               # Schema: nods_page, nods_page_section, match_page_sections RPC
```

## 4. Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI 2.8x recommended

### Install / update Supabase CLI

Supabase CLI is not an npm package. If you used `npm update supabase -g`, that is expected to fail.

- Windows (Scoop): `scoop install supabase` then `scoop update supabase`
- Windows (Chocolatey): `choco install supabase` then `choco upgrade supabase`
- macOS (Homebrew): `brew install supabase/tap/supabase` then `brew upgrade supabase`

Check version:

```bash
supabase --version
```

## 5. Local setup

### 5.1 Install dependencies

```bash
npm install
```

### 5.2 Set up app env

Copy [.env.example](.env.example) to `.env` and fill in real values.

Required keys:

| Key | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio API key (Gemini) |

### 5.3 Set up function env (local serve)

Copy [supabase/functions/.env.secrets.example](supabase/functions/.env.secrets.example) to `supabase/functions/.env.secrets` and fill in values.

Required keys:

- `EDGE_SUPABASE_URL`
- `EDGE_SERVICE_ROLE_KEY`

### 5.4 Run the app

```bash
npm run dev
```

Open:

- `/` — landing page
- `/chat` — chat with Suzu
- `/admin` — feed knowledge to the AI

Optional: run the edge function locally

```bash
npm run functions
```

## 6. Supabase Cloud setup (new project)

### 6.1 Create a project and collect keys

In the Supabase dashboard, create a new project and collect:

- Project URL
- Project ref
- anon/publishable key
- service_role key

### 6.2 Link the local repo to the cloud project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 6.3 Push schema and RPC

```bash
supabase db push
```

This applies migrations including:

- Base tables (`nods_page`, `nods_page_section`) with pgvector `vector(768)` embeddings
- Full-text search column and GIN index
- `match_page_sections` RPC used by the chat route

### 6.4 Set function secrets

Use an env file (recommended):

```bash
supabase secrets set --env-file ./supabase/functions/.env.secrets
```

Or set them directly:

```bash
supabase secrets set EDGE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co EDGE_SERVICE_ROLE_KEY=your_service_role_key_here
```

The Edge Function also needs the Google key for embeddings:

```bash
supabase secrets set GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key
```

### 6.5 Deploy the edge function

```bash
supabase functions deploy Embedding --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

## 7. Vercel deployment

### 7.1 Import the repo

Import this repository into Vercel.

### 7.2 Add env vars in Vercel

Set the same app envs as `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### 7.3 Deploy

The Vercel build command is `npm run build`.

`build` is set to `next build` to avoid running embedding generation during deploy.

## 8. End-to-end verification

1. Open `/chat` on the deployed app.
2. Send a prompt.
3. Confirm in the logs:
   - Vercel: [app/api/chat/route.ts](app/api/chat/route.ts) has no runtime error.
   - Supabase: the `Embedding` function is called successfully.
4. Confirm `match_page_sections` returns context rows.
5. Open `/admin`, paste a document, and click **Teach AI now** — then ask about that content in `/chat` to verify RAG retrieval.

## 9. Important notes

- Do not commit real keys in `.env` or `supabase/functions/.env.secrets`.
- If keys were committed before, rotate them immediately in the dashboard.
- Supabase CLI blocks some `SUPABASE_*` names in `supabase secrets set`; this project uses custom names for function secrets:
  - `EDGE_SUPABASE_URL`
  - `EDGE_SERVICE_ROLE_KEY`
- The ingest route (`/api/ingest`) embeds with a local MPNet model, while the chat route embeds queries through the Edge Function (Google `gemini-embedding-001`). Both produce 768-dim vectors, but they are different embedding spaces — for best retrieval quality, ingest and query with the same model (e.g. ingest through the Edge Function with `isIngest: true`).

## 10. Useful commands

```bash
# app
npm run dev
npm run build
npm run lint
npm run format

# optional legacy embedding script
npm run embeddings
npm run build:with-embeddings

# supabase
supabase db push
supabase functions deploy Embedding --no-verify-jwt
supabase secrets set --env-file ./supabase/functions/.env.secrets
```
