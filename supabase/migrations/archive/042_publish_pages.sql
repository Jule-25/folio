-- 042: publish a page to the web.
--
-- A published page can be read by anyone with its link (/p/<page id>), no
-- account needed, read-only. "Include subpages" publishes everything under
-- it too, including subpages added later. Visitors always see the latest
-- saved version: the public view reads pages.content, which the
-- collaboration server keeps up to date.
--
--   • pages.published_at      — when it was published; null = not published.
--   • pages.publish_subpages  — the subpages are published with it.
--
-- Only someone with full access to a page can publish or unpublish it, and
-- only through set_page_published(): a trigger keeps both columns unchanged
-- on any other insert or update (duplicates, imports, ordinary edits).
--
-- Visitors never read the pages table. get_published_page() returns one page
-- (title, cover, content) plus its breadcrumb trail and visible subpages,
-- and nothing else (no owner, workspace or access details).
-- Idempotent.

alter table public.pages
  add column if not exists published_at timestamptz,
  add column if not exists publish_subpages boolean not null default false;

-- ═══ 1. Only set_page_published() changes the publish columns ═════════════

create or replace function public.guard_page_publish()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('folio.publishing', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.published_at := null;
    new.publish_subpages := false;
  else
    new.published_at := old.published_at;
    new.publish_subpages := old.publish_subpages;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_page_publish on public.pages;
create trigger trg_guard_page_publish
  before insert or update of published_at, publish_subpages
  on public.pages
  for each row
  execute function public.guard_page_publish();

-- ═══ 2. Publish / unpublish (full access only) ════════════════════════════

create or replace function public.set_page_published(
  p_id text,
  p_published boolean,
  p_subpages boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller text := (auth.uid())::text;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from public.pages where id = p_id and deleted_at is null) then
    raise exception 'Page not found';
  end if;
  if public.page_effective_role(p_id, caller) is distinct from 'full' then
    raise exception 'Only people with full access can publish this page';
  end if;

  perform set_config('folio.publishing', 'on', true);
  update public.pages
  set published_at = case
        when p_published then coalesce(published_at, now())
        else null
      end,
      publish_subpages = p_published and coalesce(p_subpages, false)
  where id = p_id;
  perform set_config('folio.publishing', '', true);
end;
$$;

grant execute on function public.set_page_published(text, boolean, boolean)
  to authenticated;

-- ═══ 3. Which published page makes this one visible ══════════════════════
-- The page itself if it's published, else the nearest ancestor published
-- with its subpages. Null when nothing publishes it, or when the page or any
-- page between it and that ancestor is in the trash.

create or replace function public.published_root_of(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with recursive up as (
    select id, parent_id, published_at, publish_subpages, deleted_at,
           0 as depth
    from public.pages
    where id = p_id
    union all
    select p.id, p.parent_id, p.published_at, p.publish_subpages, p.deleted_at,
           up.depth + 1
    from public.pages p
    join up on p.id = up.parent_id
    where up.depth < 64
  )
  select u.id
  from up u
  where u.published_at is not null
    and (u.depth = 0 or u.publish_subpages)
    and not exists (
      select 1 from up d where d.depth <= u.depth and d.deleted_at is not null
    )
  order by u.depth
  limit 1;
$$;

-- ═══ 4. What a visitor gets ═══════════════════════════════════════════════
-- { page: {id, title, cover, content, settings, updated_at},
--   root_id, trail: [{id, title, cover}] (root → parent),
--   subpages: [{id, title, cover}] }  — or null when not published.

create or replace function public.get_published_page(p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  root text := public.published_root_of(p_id);
  root_subpages boolean;
  result jsonb;
begin
  if root is null then
    return null;
  end if;
  select publish_subpages into root_subpages from public.pages where id = root;

  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'cover', p.cover,
      'content', p.content,
      'settings', p.settings,
      'updated_at', p.updated_at
    ),
    'root_id', root,
    -- Ancestors from the published root down to this page's parent.
    'trail', coalesce((
      with recursive up as (
        select a.id, a.parent_id, a.title, a.cover, 0 as depth
        from public.pages a
        where a.id = p.parent_id and p.id <> root
        union all
        select a.id, a.parent_id, a.title, a.cover, up.depth + 1
        from public.pages a
        join up on a.id = up.parent_id
        where up.id <> root and up.depth < 64
      )
      select jsonb_agg(
        jsonb_build_object('id', up.id, 'title', up.title, 'cover', up.cover)
        order by up.depth desc
      )
      from up
    ), '[]'::jsonb),
    -- Subpages are visible only when the root publishes them.
    'subpages', case when root_subpages then coalesce((
      select jsonb_agg(
        jsonb_build_object('id', c.id, 'title', c.title, 'cover', c.cover)
        order by c.created_at
      )
      from public.pages c
      where c.parent_id = p.id
        and c.deleted_at is null
        and c.source_id is null
        and c.category is distinct from 'Template'
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  into result
  from public.pages p
  where p.id = p_id;

  return result;
end;
$$;

grant execute on function public.get_published_page(text) to anon, authenticated;

-- published_root_of is an internal helper: no direct calls from the API.
revoke execute on function public.published_root_of(text) from public, anon, authenticated;
