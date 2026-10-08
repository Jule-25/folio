-- ── Uploads: one Storage bucket for page files, covers, icons and avatars ────
-- Replaces the old localhost:3000 upload server.
--
-- Public bucket: page content stores each file's URL, so the URL must keep
-- working (a signed URL would expire). Paths hold a random UUID, so a file is
-- only reachable by someone who was given its URL. Uploading and listing are
-- limited to workspace members.
--
-- Paths:
--   w/<workspace id>/content/<uuid>-<name>   images, files, audio in pages
--   w/<workspace id>/covers/<uuid>-<name>    page covers
--   w/<workspace id>/icons/<uuid>-<name>     uploaded page icons
--   u/<person id>/<uuid>-<name>              profile pictures

-- 1. The bucket, 25 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 26214400)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- 2. Who counts as a member of a workspace for uploads: its owner, or anyone
--    whose current workspace it is (the same rule as workspace_settings).
create or replace function public.can_use_workspace_uploads(ws text, uid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = uid
  )
  or exists (
    select 1 from public.people p
    where p.id = uid and p.workspace_id = ws
  );
$$;

revoke all on function public.can_use_workspace_uploads(text, text) from public;
grant execute on function public.can_use_workspace_uploads(text, text) to authenticated;

-- 3. Listing (the "Previously uploaded" grids) and uploading: your
--    workspace's folders, and your own avatar folder.
drop policy if exists "uploads_select" on storage.objects;
create policy "uploads_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and (
      (
        (storage.foldername(name))[1] = 'w'
        and public.can_use_workspace_uploads((storage.foldername(name))[2], (auth.uid())::text)
      )
      or (
        (storage.foldername(name))[1] = 'u'
        and (storage.foldername(name))[2] = (auth.uid())::text
      )
    )
  );

drop policy if exists "uploads_insert" on storage.objects;
create policy "uploads_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (
      (
        (storage.foldername(name))[1] = 'w'
        and public.can_use_workspace_uploads((storage.foldername(name))[2], (auth.uid())::text)
      )
      or (
        (storage.foldername(name))[1] = 'u'
        and (storage.foldername(name))[2] = (auth.uid())::text
      )
    )
  );

-- 4. Only the person who uploaded a file can delete it.
drop policy if exists "uploads_delete" on storage.objects;
create policy "uploads_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and owner = auth.uid());