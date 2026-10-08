-- ── Teamspace moves ────────────────────────────────────────────────────────
-- Adds:
--   • move_teamspace(): a teamspace owner moves a teamspace (and every page,
--     template and room in it) to another workspace they own.
--   • delete_teamspace(): deletes a teamspace together with all its pages.
-- Fixes:
--   • A teamspace's root page could be dragged INSIDE another page, which
--     re-stamped it into that page's teamspace and made it vanish. (Moving a
--     teamspace to another workspace goes through move_teamspace instead.)
--   • Dropping a page at the top of "Teamspaces" made a fake teamspace (a
--     root page with no teamspaces row).
--   • Moves only carried teamspace_id down a subtree, not workspace_id, and a
--     page moved OUT of a teamspace kept the host's workspace_id.
--   • Clients could patch pages.workspace_id directly.
--   • Deleting a teamspace left its pages behind (teamspace_id set null).
-- Idempotent.

-- ═══ 1. Helpers ════════════════════════════════════════════════════════════

create or replace function public.is_teamspace_root(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teamspaces where id = pid);
$$;

-- ═══ 2. Repair data broken by earlier moves (runs as the migration owner) ═

-- 2a. Teamspace root pages back to the top of the Teamspaces section.
--     Setting parent_id re-fires the stamping trigger, which re-pins the root
--     (and, via propagation, its subtree) to its own teamspace.
update public.pages p
set parent_id = null,
    category = 'Teamspaces'
from public.teamspaces t
where p.id = t.id
  and (p.parent_id is not null or p.category is distinct from 'Teamspaces');

-- 2b. Fake teamspaces: top-level "Teamspaces" pages with no teamspaces row.
update public.pages p
set category = 'Private'
where p.parent_id is null
  and p.source_id is null
  and p.category = 'Teamspaces'
  and not exists (select 1 from public.teamspaces t where t.id = p.id);

-- 2c. Re-stamp teamspace_id + workspace_id down every teamspace tree
--     (roots and teamspace templates), following children and database rows.
with recursive
edges(id, up) as (
  select id, parent_id from public.pages where parent_id is not null
  union all
  select r.id, ds.page_id
  from public.pages r
  join public.data_sources ds on ds.id = r.source_id
  where ds.page_id is not null
),
sub(id, ts) as (
  select p.id, p.id
  from public.pages p
  where p.id in (select id from public.teamspaces)
  union
  select p.id, p.teamspace_id
  from public.pages p
  where p.category = 'Template'
    and p.parent_id is null
    and p.teamspace_id is not null
  union
  select e.id, s.ts
  from sub s
  join edges e on e.up = s.id
)
update public.pages p
set teamspace_id = sub.ts,
    workspace_id = coalesce(t.workspace_id, p.workspace_id)
from sub
left join public.teamspaces t on t.id = sub.ts
where p.id = sub.id
  and (p.teamspace_id is distinct from sub.ts
       or p.workspace_id is distinct from coalesce(t.workspace_id, p.workspace_id));

-- 2d. Pages still stamped with a teamspace they're no longer under.
with recursive
edges(id, up) as (
  select id, parent_id from public.pages where parent_id is not null
  union all
  select r.id, ds.page_id
  from public.pages r
  join public.data_sources ds on ds.id = r.source_id
  where ds.page_id is not null
),
sub(id) as (
  select p.id from public.pages p
  where p.id in (select id from public.teamspaces)
     or (p.category = 'Template' and p.parent_id is null and p.teamspace_id is not null)
  union
  select e.id from sub s join edges e on e.up = s.id
)
update public.pages p
set teamspace_id = null
where p.teamspace_id is not null
  and p.id not in (select id from sub);

-- 2e. Pages outside teamspaces live in their top-level page's workspace.
with recursive
edges(id, up) as (
  select id, parent_id from public.pages where parent_id is not null
  union all
  select r.id, ds.page_id
  from public.pages r
  join public.data_sources ds on ds.id = r.source_id
  where ds.page_id is not null
),
sub(id, ws) as (
  select p.id, p.workspace_id
  from public.pages p
  where p.parent_id is null
    and p.source_id is null
    and p.teamspace_id is null
  union
  select e.id, s.ws
  from sub s
  join edges e on e.up = s.id
)
update public.pages p
set workspace_id = sub.ws
from sub
where p.id = sub.id
  and p.teamspace_id is null
  and sub.ws is not null
  and p.workspace_id is distinct from sub.ws;

-- ═══ 3. Stamping: teamspace_id AND workspace_id from the page's position ══

create or replace function public.set_page_teamspace_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ts text;
  parent_ws text;
  host_ws text;
  caller_ws text;
begin
  if new.parent_id is not null then
    select teamspace_id, workspace_id into ts, parent_ws
    from public.pages where id = new.parent_id;
  elsif new.source_id is not null then
    select p.teamspace_id, p.workspace_id into ts, parent_ws
    from public.data_sources ds
    join public.pages p on p.id = ds.page_id
    where ds.id = new.source_id;
  elsif exists (select 1 from public.teamspaces where id = new.id) then
    ts := new.id;
  elsif new.category = 'Template'
    and new.teamspace_id is not null
    and (
      auth.uid() is null
      or public.is_teamspace_member_person(new.teamspace_id, (auth.uid())::text)
    ) then
    ts := new.teamspace_id;
  end if;

  new.teamspace_id := ts;

  if ts is not null then
    -- Inside a teamspace: always the host workspace.
    select workspace_id into host_ws
    from public.teamspaces where id = ts;
    if host_ws is not null then
      new.workspace_id := host_ws;
    end if;
  elsif parent_ws is not null then
    -- Under a page or database outside any teamspace: its workspace.
    new.workspace_id := parent_ws;
  elsif tg_op = 'UPDATE'
    and old.teamspace_id is not null
    and auth.uid() is not null then
    -- Moved out of a teamspace to the top level: the mover's workspace.
    select workspace_id into caller_ws
    from public.people where id = (auth.uid())::text;
    if caller_ws is not null then
      new.workspace_id := caller_ws;
    end if;
  end if;

  return new;
end;
$$;

-- ═══ 4. Propagation: carry workspace_id down with teamspace_id ════════════

create or replace function public.propagate_page_teamspace_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.teamspace_id is distinct from old.teamspace_id
     or new.workspace_id is distinct from old.workspace_id then
    with recursive
    edges(id, up) as (
      select id, parent_id from public.pages where parent_id is not null
      union all
      select r.id, ds.page_id
      from public.pages r
      join public.data_sources ds on ds.id = r.source_id
      where ds.page_id is not null
    ),
    sub(id) as (
      select new.id
      union
      select e.id from sub s join edges e on e.up = s.id
    )
    update public.pages
    set teamspace_id = new.teamspace_id,
        workspace_id = new.workspace_id
    where id in (select id from sub where id <> new.id)
      and (teamspace_id is distinct from new.teamspace_id
           or workspace_id is distinct from new.workspace_id);
  end if;
  return null;
end;
$$;

-- (trg_propagate_page_teamspace_id from 013 keeps pointing at this function.)

-- ═══ 5. Guard client moves ════════════════════════════════════════════════
-- NOT security definer: current_user is 'authenticated' for direct client
-- writes, and the function owner inside the SECURITY DEFINER triggers/RPCs
-- (so propagation and the delete RPC pass). Named trg_a_… so it runs before
-- trg_set_page_teamspace_id (same-timing triggers fire in name order).

create or replace function public.guard_page_moves()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- workspace_id is the server's to set.
  new.workspace_id := old.workspace_id;

  -- A teamspace root stays at the top of the Teamspaces section.
  if public.is_teamspace_root(old.id) and (
       new.parent_id is distinct from old.parent_id
       or new.source_id is distinct from old.source_id
       or new.category is distinct from old.category
     ) then
    raise exception 'A teamspace can''t be moved'
      using errcode = '42501';
  end if;

  -- Only real teamspaces sit at the top of the Teamspaces section.
  if new.category = 'Teamspaces'
     and new.parent_id is null
     and new.source_id is null
     and (new.category is distinct from old.category
          or new.parent_id is distinct from old.parent_id)
     and not public.is_teamspace_root(new.id) then
    raise exception 'Only teamspaces can be placed in the Teamspaces section'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_a_guard_page_moves on public.pages;
create trigger trg_a_guard_page_moves
  before update on public.pages
  for each row
  execute function public.guard_page_moves();

-- ═══ 6. Delete a teamspace with all its pages ═════════════════════════════
-- Owners only. Removes every page under the teamspace (children, database
-- rows, templates, trashed ones), their comments/threads/versions, the
-- databases that live on those pages, then the teamspace row (rooms,
-- invites and members cascade from it; notifications cascade from pages).

create or replace function public.delete_teamspace(ts_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
  ids text[];
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.teamspaces
    where id = ts_id and caller = any (owner_ids)
  ) then
    raise exception 'Only teamspace owners can delete a teamspace'
      using errcode = '42501';
  end if;

  with recursive
  edges(id, up) as (
    select id, parent_id from public.pages where parent_id is not null
    union all
    select r.id, ds.page_id
    from public.pages r
    join public.data_sources ds on ds.id = r.source_id
    where ds.page_id is not null
  ),
  sub(id) as (
    select p.id from public.pages p
    where p.id = ts_id or p.teamspace_id = ts_id
    union
    select e.id from sub s join edges e on e.up = s.id
  )
  select coalesce(array_agg(id), '{}') into ids from sub;

  delete from public.comments
  where thread_id in (select id from public.threads where page_id = any (ids));
  delete from public.threads where page_id = any (ids);
  delete from public.versions where page_id = any (ids);
  delete from public.pages where id = any (ids);
  delete from public.data_sources where page_id = any (ids);
  delete from public.teamspaces where id = ts_id;
end;
$$;

grant execute on function public.delete_teamspace(text) to authenticated;

-- ═══ 7. Move a teamspace to another workspace ═════════════════════════════
-- Owners of the teamspace only, and only into a workspace the caller owns.
-- Members keep access (membership doesn't depend on the workspace); for the
-- owner, the teamspace now shows up in the target workspace.

create or replace function public.move_teamspace(ts_id text, target_ws_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.teamspaces
    where id = ts_id and caller = any (owner_ids)
  ) then
    raise exception 'Only teamspace owners can move a teamspace'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.workspaces
    where id = target_ws_id and owner_id = caller
  ) then
    raise exception 'You can only move a teamspace to a workspace you own'
      using errcode = '42501';
  end if;

  update public.teamspaces
  set workspace_id = target_ws_id
  where id = ts_id;

  -- Root, children, database rows and templates all carry teamspace_id.
  update public.pages
  set workspace_id = target_ws_id
  where (id = ts_id or teamspace_id = ts_id)
    and workspace_id is distinct from target_ws_id;

  update public.chat_rooms
  set workspace_id = target_ws_id
  where teamspace_id = ts_id
    and workspace_id is distinct from target_ws_id;
end;
$$;

grant execute on function public.move_teamspace(text, text) to authenticated;
