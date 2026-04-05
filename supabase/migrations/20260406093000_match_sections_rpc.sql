create extension if not exists vector with schema public;

-- Ensure base tables exist in fresh cloud projects
create table if not exists public.nods_page (
  id bigserial primary key,
  parent_page_id bigint references public.nods_page,
  path text not null unique,
  checksum text,
  meta jsonb,
  type text,
  source text
);

create table if not exists public.nods_page_section (
  id bigserial primary key,
  page_id bigint not null references public.nods_page on delete cascade,
  content text,
  token_count int,
  embedding vector(768),
  slug text,
  heading text
);

-- Vector index for semantic search on nods_page_section.embedding
create index if not exists nods_page_section_embedding_cosine_idx
on public.nods_page_section
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- RPC used by app/api/chat/route.ts
create or replace function public.match_page_sections(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  page_id bigint,
  slug text,
  heading text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    s.id,
    s.page_id,
    s.slug,
    s.heading,
    s.content,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.nods_page_section s
  where s.embedding is not null
    and 1 - (s.embedding <=> query_embedding) >= match_threshold
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_page_sections(vector, float, int) to authenticated;
grant execute on function public.match_page_sections(vector, float, int) to service_role;