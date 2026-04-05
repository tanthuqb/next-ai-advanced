# next-ai-advanced

Next.js + Supabase + AI chat app (RAG-ready), with deployment flow for Supabase Cloud and Vercel.

## 1. Tech stack

- Next.js 16 (App Router)
- Tailwind CSS 4
- Supabase (Postgres + pgvector + Edge Functions)
- AI SDK + Google model

## 2. Prerequisites

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

## 3. Local setup

### 3.1 Install dependencies

```bash
npm install
```

### 3.2 Setup app env

Copy [ .env.example](.env.example) to `.env` and fill real values.

Required keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### 3.3 Setup function env (local serve)

Copy [supabase/functions/.env.secrets.example](supabase/functions/.env.secrets.example) to `supabase/functions/.env.secrets` and fill values.

Required keys:

- `EDGE_SUPABASE_URL`
- `EDGE_SERVICE_ROLE_KEY`

### 3.4 Run app

```bash
npm run dev
```

Optional: run edge function locally

```bash
npm run functions
```

## 4. Supabase Cloud setup (new project)

### 4.1 Create project and collect keys

In Supabase dashboard, create a new project and collect:

- Project URL
- Project ref
- anon/publishable key
- service_role key

### 4.2 Link local repo to cloud project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 4.3 Push schema and RPC

```bash
supabase db push
```

This applies migrations including:

- Base tables (`nods_page`, `nods_page_section`)
- Vector index
- `match_page_sections` RPC used by chat route

### 4.4 Set function secrets

Use env file (recommended):

```bash
supabase secrets set --env-file ./supabase/functions/.env.secrets
```

Or set directly:

```bash
supabase secrets set EDGE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co EDGE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 4.5 Deploy edge function

```bash
supabase functions deploy Embedding --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

## 5. Vercel deployment

### 5.1 Import repo

Import this repository to Vercel.

### 5.2 Add env vars in Vercel

Set the same app envs as `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### 5.3 Deploy

Vercel build command is `npm run build`.

`build` is set to `next build` to avoid running embedding generation during deploy.

## 6. End-to-end verification

1. Open `/chat` on deployed app.
2. Send a prompt.
3. Confirm in logs:
	 - Vercel: [app/api/chat/route.ts](app/api/chat/route.ts) has no runtime error.
	 - Supabase: `Embedding` function is called successfully.
4. Confirm `match_page_sections` returns context rows.

## 7. Important notes

- Do not commit real keys in `.env` or `supabase/functions/.env.secrets`.
- If keys were committed before, rotate them immediately in dashboard.
- Supabase CLI blocks some `SUPABASE_*` names in `supabase secrets set`; this project uses custom names for function secrets:
	- `EDGE_SUPABASE_URL`
	- `EDGE_SERVICE_ROLE_KEY`

## 8. Useful commands

```bash
# app
npm run dev
npm run build

# optional legacy embedding script
npm run embeddings
npm run build:with-embeddings

# supabase
supabase db push
supabase functions deploy Embedding --no-verify-jwt
supabase secrets set --env-file ./supabase/functions/.env.secrets
```
