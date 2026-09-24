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
Matched context + instructions ──► Gemini 3.6 Flash (streaming, AI SDK 7) ──► UI
                                   (falls back to 3.5 Flash / 3.5 Flash-Lite on 429/503)
```

Knowledge ingestion:

- **Admin page** (`/admin`): paste documents into a textarea → `POST /api/ingest` splits the text into one chunk per non-empty line and sends each chunk to the `Embedding` Edge Function with `isIngest: true`.
- **Edge Function** (`Embedding` with `isIngest: true`): embeds the chunk with Google `gemini-embedding-001` (768 dims, the same model used for chat queries) and inserts it into `nods_page_section` with the service-role key.
- **Server action** (`app/actions/embed.ts` → `saveDocument`): same pipeline as `/api/ingest`, for a single document.
- **Batch script** (`npm run embeddings`): embeds `.md`/`.mdx` files from a `./pages` directory with the same Gemini embedding model (requires `SUPABASE_SERVICE_ROLE_KEY`).

## 2. Tech stack

| Area | Package | Version |
| --- | --- | --- |
| Framework | `next` (App Router, Turbopack) | 16.3 |
| UI | `react` / `react-dom` | 19.3 |
| Styling | `tailwindcss` + shadcn/ui, `tw-animate-css` | 4.3 |
| AI | `ai` / `@ai-sdk/react` / `@ai-sdk/google` | 7.0 / 4.0 / 4.0 |
| Chat model | Google `gemini-3.6-flash` (fallbacks: `gemini-3.5-flash`, `gemini-3.5-flash-lite`) | — |
| Embeddings | Google `gemini-embedding-001`, 768 dims | — |
| Database | `@supabase/supabase-js`, Postgres + pgvector (HNSW), RLS, Edge Functions (Deno) | 2.117 |
| Markdown | `streamdown` | 2.6 |
| Tooling | TypeScript / ESLint / Prettier | 6.0 / 10 / 3.9 |
| E2E tests | `@playwright/test` (Chromium) | 1.63 |

Model names live in [lib/models.ts](lib/models.ts); the fallback logic is in [lib/chat-model.ts](lib/chat-model.ts).

> TypeScript stays on 6.0: `typescript-eslint` (used by `eslint-config-next`) does not support TypeScript 7 yet.

## 3. Project structure

```
app/
  page.tsx                  # Landing page
  chat/page.tsx             # Main chat UI (Suzu AI)
  admin/page.jsx            # Admin page to feed knowledge to the AI
  components/SuzuChat.tsx   # Alternative chat component (not routed)
  actions/embed.ts          # Server action: save a document via the Edge Function
  api/
    chat/route.ts           # Chat endpoint: RAG search + Gemini streaming
    ingest/route.ts         # Ingest endpoint: chunk + embed (Edge Function) + store
lib/
  models.ts                 # Chat / embedding model ids (shared with the UI)
  chat-model.ts             # Gemini model with 429/503 fallback middleware (server only)
  ingest.ts                 # Shared ingest helper (calls the Edge Function)
  generate-embeddings.ts    # Batch script: embed ./pages/**/*.md(x) with Gemini
e2e/                        # Playwright end-to-end tests
playwright.config.ts        # Playwright config (web server on port 3102)
supabase/
  functions/Embedding/      # Edge Function: Google embeddings + optional ingest
  migrations/               # Schema, RLS read policies, match_page_sections RPC, HNSW index
```

## 4. Prerequisites

- Node.js 20.9+ (tested on Node 24)
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

Copy [.env.example](.env.example) to `.env.local` and fill in real values.

Required keys:

| Key | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only; used by `npm run embeddings`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio API key (Gemini) |

### 5.3 Set up function env (local serve)

Copy [supabase/functions/.env.secrets.example](supabase/functions/.env.secrets.example) to `supabase/functions/.env.secrets` and fill in values.

Required keys:

- `EDGE_SUPABASE_URL`
- `EDGE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

On Supabase Cloud, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically and are used as fallbacks.

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

The function uses `Deno.serve` and imports `@supabase/supabase-js` through the `npm:` specifier declared in [supabase/functions/Embedding/deno.json](supabase/functions/Embedding/deno.json). Redeploy it after pulling changes to that folder.

## 7. Vercel deployment

### 7.1 Import the repo

Import this repository into Vercel.

### 7.2 Add env vars in Vercel

Set the same app envs as `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### 7.3 Deploy

The Vercel build command is `npm run build`.

`build` is set to `next build` to avoid running embedding generation during deploy.

## 8. Testing

### 8.1 Playwright end-to-end tests

One-time setup:

```bash
npx playwright install chromium
```

Run:

```bash
npm run test:e2e        # headless; builds the app and serves it on http://localhost:3102
npm run test:e2e:ui     # Playwright UI mode
```

The suite (in [e2e/](e2e)) covers:

| File | Tests |
| --- | --- |
| `e2e/pages.spec.ts` | Landing page and navigation; `/chat` renders, a typed message is sent and a (mocked) streamed reply is rendered; error state; `/admin` renders and submits to a mocked `/api/ingest` |
| `e2e/chat-live.spec.ts` | **LIVE**: sends a prompt in the real UI and waits for a streamed Gemini reply |
| `e2e/api.spec.ts` | `/api/chat` validation + **LIVE** stream contract (UI message stream, `sources` metadata, text deltas); `/api/ingest` validation + optional **LIVE** ingest |

Live tests use the real keys in `.env.local` (Supabase publishable key + Google AI key). Optional environment variables (set in your shell):

| Variable | Effect |
| --- | --- |
| `E2E_PORT` | Port for the test server (default `3102`) |
| `E2E_DEV_SERVER=1` | Use `next dev` instead of `next build && next start` |
| `E2E_SKIP_LIVE=1` | Skip tests that call Gemini / Supabase |
| `E2E_ALLOW_INGEST=1` | Run the `/api/ingest` live test. **It writes a row to the remote `nods_page_section` table**, so it is skipped by default |

If a server is already running on the port, it is reused (outside CI).

> The Google AI free tier has low per-model rate limits. The chat route falls back to other Flash models on 429/503, but if live tests still fail with rate-limit errors, wait a minute and re-run.

### 8.2 Manual verification on a deployment

1. Open `/chat` on the deployed app.
2. Send a prompt.
3. Confirm in the logs:
   - Vercel: [app/api/chat/route.ts](app/api/chat/route.ts) has no runtime error.
   - Supabase: the `Embedding` function is called successfully.
4. Confirm `match_page_sections` returns context rows.
5. Open `/admin`, paste a document, and click **Teach AI now** — then ask about that content in `/chat` to verify RAG retrieval.

## 9. Important notes

- Do not commit real keys in `.env`, `.env.local`, or `supabase/functions/.env.secrets`.
- If keys were committed before, rotate them immediately in the dashboard.
- Supabase CLI blocks some `SUPABASE_*` names in `supabase secrets set`; this project uses custom names for function secrets:
  - `EDGE_SUPABASE_URL`
  - `EDGE_SERVICE_ROLE_KEY`
- All ingest paths (`/api/ingest`, `saveDocument`, `npm run embeddings`) and chat queries use the same embedding model (`gemini-embedding-001`, 768 dims). If you change the model, re-embed all existing rows: vectors from different models are not comparable.
- `/api/ingest`, `/admin`, and the `Embedding` Edge Function (deployed with `--no-verify-jwt`) have no authentication. Anyone who can reach them can add knowledge. Add auth before exposing them publicly.
- The chat UI badge and the API read the model name from [lib/models.ts](lib/models.ts).

## 10. Useful commands

```bash
# app
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npm run format

# tests
npm run test:e2e
npm run test:e2e:ui

# optional batch embedding script (./pages/**/*.md(x))
npm run embeddings
npm run build:with-embeddings

# supabase
supabase db push
supabase functions deploy Embedding --no-verify-jwt
supabase secrets set --env-file ./supabase/functions/.env.secrets
```
