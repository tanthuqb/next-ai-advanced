-- The ivfflat index was created while the table was empty, so its centroid
-- lists were meaningless and approximate search missed rows entirely
-- (match_page_sections returned 0 rows even with threshold -1 while a
-- direct select saw the data). HNSW builds incrementally and stays correct
-- as rows are inserted, so it is the right choice for a growing knowledge base.

drop index if exists public.nods_page_section_embedding_cosine_idx;

create index nods_page_section_embedding_cosine_idx
on public.nods_page_section
using hnsw (embedding vector_cosine_ops);
