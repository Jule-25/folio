-- ── Open a page someone shared with you ────────────────────────────────────
-- Pages are only readable through RLS inside your CURRENT workspace (or via a
-- teamspace you're in): pages_select checks can_read_page() only for pages in
-- that workspace. So a page shared with you from someone else's workspace —
-- "Anyone with the link", a direct invite, a group invite — could never be
-- read, even though page_effective_role() (and the collaboration server)
-- grant it.
--
-- pages_select stays as it is on purpose: the app loads "all pages" with one
-- unfiltered query, so widening the policy would pour every public page of
-- every workspace into everyone's sidebar. Instead, this function returns ONE
-- page by id when the caller has any role on it, and the app uses it when it
-- opens a page that isn't in the current workspace.
-- Idempotent.

create or replace function public.get_accessible_page(p_id text)
returns setof public.pages
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.pages p
  where p.id = p_id
    and p.deleted_at is null
    and auth.uid() is not null
    and public.page_effective_role(p.id, (auth.uid())::text) is not null;
$$;

grant execute on function public.get_accessible_page(text) to authenticated;
