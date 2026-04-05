create extension if not exists vector with schema public;
-- 1. Tạo bảng nods_page
create table if not exists "public"."nods_page" (
  id bigserial primary key,
  parent_page_id bigint references public.nods_page,
  path text not null unique,
  checksum text,
  meta jsonb,
  type text,
  source text
);

alter table "public"."nods_page" enable row level security;

-- 2. Tạo bảng nods_page_section
create table if not exists "public"."nods_page_section" (
  id bigserial primary key,
  page_id bigint not null references public.nods_page on delete cascade,
  content text,
  token_count int,
  embedding vector(768),
  slug text,
  heading text
);

--3. Tạo cột search_vector để tìm kiếm không cần Embedding
ALTER TABLE nods_page_section 
ADD COLUMN IF NOT EXISTS fts_tokens tsvector 
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

--4. Tạo index để tìm kiếm siêu tốc
CREATE INDEX IF NOT EXISTS fts_idx ON nods_page_section USING GIN (fts_tokens);

alter table "public"."nods_page_section" enable row level security;

