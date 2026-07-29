-- RLS was enabled on both tables in 20260404170603_init.sql but no policies
-- were ever created, so the anon (publishable) key could neither read nor
-- write. Reads are needed by the chat route: match_page_sections is a
-- security-invoker function, so it reads nods_page_section under the
-- caller's RLS. Writes remain service-role only (used by /api/ingest).

create policy "Allow public read access"
on public.nods_page
for select
to anon, authenticated
using (true);

create policy "Allow public read access"
on public.nods_page_section
for select
to anon, authenticated
using (true);

-- The chat route calls this RPC with the publishable (anon) key.
grant execute on function public.match_page_sections(vector, float, int) to anon;
