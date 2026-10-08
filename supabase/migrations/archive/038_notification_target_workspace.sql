-- ── Where does a notification point? ───────────────────────────────────────
-- The inbox shows the current workspace's notifications. A notification for a
-- page (or chat room) in one of your OTHER workspaces can't be resolved from
-- the client — RLS only returns the current workspace's pages — so this says
-- which workspace it lives in, so the app can switch there and open it.
--
-- Returns the workspace id only when the caller OWNS that workspace (the only
-- workspaces they can switch into); null otherwise, including for trashed or
-- deleted pages. Reveals nothing about workspaces the caller doesn't own.
-- Idempotent.

create or replace function public.notification_target_workspace(
  p_page text,
  p_room text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select w.id
  from public.workspaces w
  where w.owner_id = (auth.uid())::text
    and w.id = coalesce(
      (select p.workspace_id
       from public.pages p
       where p.id = p_page
         and p.deleted_at is null),
      (select r.workspace_id
       from public.chat_rooms r
       where r.id = p_room)
    );
$$;

grant execute on function public.notification_target_workspace(text, text)
  to authenticated;
