-- ── Workspace membership, invites and invite links ─────────────────────────
-- Until now a person belonged to exactly ONE workspace (people.workspace_id)
-- and could only switch between workspaces they own, so nobody could be
-- invited into a workspace. This adds real membership:
--
--   • workspace_members: who belongs to which workspace, with which role
--     (owner / member / guest). You keep your own workspace and can join
--     others, then switch between them.
--   • people.workspace_id / people.role keep their meaning — the workspace
--     you're CURRENTLY in and your role there — so every existing access
--     rule keeps working. Switching updates both from your membership.
--   • Invites by email (accept / decline in the app) and one real invite
--     link per workspace (/invite/<token>, can be turned off or replaced).
--   • Owners change roles and remove members; members can leave.
--
-- It also closes holes in rules that predate the migrations folder:
--   • people_update_self let anyone set their own workspace_id/role — i.e.
--     move themselves into ANY workspace and read its pages. Those columns
--     are now server-set only (switch / accept / join functions).
--   • groups_write allowed anyone who is an owner ANYWHERE (everyone owns
--     their own workspace) to edit ANY group — and groups grant page access.
--     Now only the owners of the group's workspace can.
--   • workspaces_select only showed workspaces you own or are currently in,
--     so the switcher couldn't list workspaces you're a member of.
--   • workspace_settings held ONE invite link for every workspace.
-- Idempotent.

-- ═══ 1. Membership ════════════════════════════════════════════════════════

create table if not exists public.workspace_members (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  person_id    text not null references public.people(id) on delete cascade,
  role         text not null default 'member'
               check (role in ('owner', 'member', 'guest')),
  created_at   bigint not null default public.now_ms(),
  primary key (workspace_id, person_id)
);

create index if not exists workspace_members_person_idx
  on public.workspace_members (person_id);

-- Backfill: everyone's current workspace, and every workspace's owner.
insert into public.workspace_members (workspace_id, person_id, role)
select p.workspace_id, p.id,
       case when p.role in ('owner', 'member', 'guest') then p.role else 'member' end
from public.people p
join public.workspaces w on w.id = p.workspace_id
on conflict (workspace_id, person_id) do nothing;

insert into public.workspace_members (workspace_id, person_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
join public.people p on p.id = w.owner_id
on conflict (workspace_id, person_id) do update set role = 'owner';

-- Helpers (security definer: usable inside policies without recursion).
create or replace function public.workspace_role_of(ws text, person text)
returns text language sql stable security definer set search_path = public as $$
  select role from public.workspace_members
  where workspace_id = ws and person_id = person;
$$;

create or replace function public.is_workspace_member_of(ws text, person text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and person_id = person
  );
$$;

alter table public.workspace_members enable row level security;

drop policy if exists "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select" on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member_of(workspace_id, (auth.uid())::text));
-- No write policies: membership changes only through the functions below.
grant select on public.workspace_members to authenticated;

-- ═══ 2. Guard people.workspace_id / people.role ═══════════════════════════
-- NOT security definer: current_user is 'authenticated' for direct client
-- writes and the function owner inside the SECURITY DEFINER functions below.

create or replace function public.guard_people_membership()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.workspace_id is distinct from old.workspace_id
          or new.role is distinct from old.role) then
    raise exception 'workspace and role change only by switching, joining or an owner'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_people_membership on public.people;
create trigger trg_guard_people_membership
  before update on public.people
  for each row execute function public.guard_people_membership();

-- Moves `person` into another of their workspaces (their own first) after
-- they left or were removed from the one they're currently in.
create or replace function public.reassign_current_workspace(person text)
returns void language plpgsql security definer set search_path = public as $$
declare
  next_ws text;
  next_role text;
begin
  select m.workspace_id, m.role into next_ws, next_role
  from public.workspace_members m
  left join public.workspaces w on w.id = m.workspace_id
  where m.person_id = person
  order by (w.owner_id = person) desc nulls last, m.created_at
  limit 1;

  if next_ws is not null then
    update public.people set workspace_id = next_ws, role = next_role
    where id = person;
  end if;
end;
$$;

-- ═══ 3. Workspaces: members can see (and switch to) them ══════════════════

drop policy if exists "workspaces_select" on public.workspaces;
create policy "workspaces_select" on public.workspaces
  for select to authenticated
  using (
    owner_id = (auth.uid())::text
    or public.is_workspace_member_of(id, (auth.uid())::text)
  );

-- Switch into any workspace you're a member of; your role comes along.
create or replace function public.switch_workspace(target_ws_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
  r text;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  r := public.workspace_role_of(target_ws_id, caller);
  if r is null then
    raise exception 'you are not a member of that workspace' using errcode = '42501';
  end if;

  update public.people set workspace_id = target_ws_id, role = r
  where id = caller;
end;
$$;

-- New workspace: owned by the caller, recorded as a membership, switched to.
create or replace function public.create_workspace(ws_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  caller_id text := (auth.uid())::text;
  new_ws_id text := gen_random_uuid()::text;
begin
  if caller_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.workspaces (id, name, owner_id)
  values (new_ws_id, coalesce(nullif(trim(ws_name), ''), 'New workspace'), caller_id);

  insert into public.workspace_members (workspace_id, person_id, role)
  values (new_ws_id, caller_id, 'owner')
  on conflict (workspace_id, person_id) do update set role = 'owner';

  update public.people set workspace_id = new_ws_id, role = 'owner'
  where id = caller_id;

  return new_ws_id;
end;
$$;

grant execute on function public.switch_workspace(text) to authenticated;
grant execute on function public.create_workspace(text) to authenticated;

-- Sign-up: same as before, plus the owner membership of the new workspace.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first  boolean;
  display   text;
  new_ws_id text;
begin
  select count(*) = 0 into is_first from public.people;

  display := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  if is_first then
    insert into public.people (id, workspace_id, name, email, avatar_url, role)
    values (
      new.id::text, 'workspace_default', display, new.email,
      new.raw_user_meta_data ->> 'avatar_url', 'owner'
    )
    on conflict (id) do nothing;

    update public.workspaces
    set name = display || '''s Space',
        owner_id = coalesce(owner_id, new.id::text)
    where id = 'workspace_default'
      and name = 'My Workspace';

    insert into public.workspace_members (workspace_id, person_id, role)
    values ('workspace_default', new.id::text, 'owner')
    on conflict (workspace_id, person_id) do nothing;
  else
    new_ws_id := gen_random_uuid()::text;

    insert into public.workspaces (id, name, owner_id)
    values (new_ws_id, display || '''s Space', new.id::text);

    insert into public.people (id, workspace_id, name, email, avatar_url, role)
    values (
      new.id::text, new_ws_id, display, new.email,
      new.raw_user_meta_data ->> 'avatar_url', 'owner'
    )
    on conflict (id) do nothing;

    insert into public.workspace_members (workspace_id, person_id, role)
    values (new_ws_id, new.id::text, 'owner')
    on conflict (workspace_id, person_id) do nothing;
  end if;

  return new;
end;
$$;

-- ═══ 4. The people of a workspace ═════════════════════════════════════════
-- Every member — not only the ones currently switched into it — with their
-- role in THIS workspace. Members only; others' notification settings are
-- not returned.

create or replace function public.workspace_people(ws text)
returns setof public.people language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email, p.avatar_url, m.role, p.created_at,
         m.workspace_id,
         case when p.id = (auth.uid())::text
              then p.notification_settings else '{}'::jsonb end
  from public.workspace_members m
  join public.people p on p.id = m.person_id
  where m.workspace_id = ws
    and public.is_workspace_member_of(ws, (auth.uid())::text)
  order by p.name;
$$;

grant execute on function public.workspace_people(text) to authenticated;

-- ═══ 5. Members: roles, removal, leaving ══════════════════════════════════

create or replace function public.set_workspace_member_role(ws text, person text, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
begin
  if public.workspace_role_of(ws, caller) is distinct from 'owner' then
    raise exception 'only workspace owners can change roles' using errcode = '42501';
  end if;
  if new_role not in ('owner', 'member', 'guest') then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if exists (select 1 from public.workspaces where id = ws and owner_id = person)
     and new_role <> 'owner' then
    raise exception 'the workspace creator always stays an owner' using errcode = '42501';
  end if;

  update public.workspace_members set role = new_role
  where workspace_id = ws and person_id = person;

  update public.people set role = new_role
  where id = person and workspace_id = ws;
end;
$$;

create or replace function public.remove_workspace_member(ws text, person text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
begin
  if person <> caller
     and public.workspace_role_of(ws, caller) is distinct from 'owner' then
    raise exception 'only workspace owners can remove members' using errcode = '42501';
  end if;
  if exists (select 1 from public.workspaces where id = ws and owner_id = person) then
    raise exception 'the workspace creator can''t be removed' using errcode = '42501';
  end if;

  delete from public.workspace_members
  where workspace_id = ws and person_id = person;

  -- Out of this workspace's groups too (groups grant page access).
  update public.groups
  set member_ids = array_remove(member_ids, person)
  where workspace_id = ws and person = any (member_ids);

  if exists (select 1 from public.people where id = person and workspace_id = ws) then
    perform public.reassign_current_workspace(person);
  end if;
end;
$$;

grant execute on function public.set_workspace_member_role(text, text, text) to authenticated;
grant execute on function public.remove_workspace_member(text, text) to authenticated;

-- ═══ 6. Email invites ═════════════════════════════════════════════════════

create table if not exists public.workspace_invites (
  id             text primary key default gen_random_uuid()::text,
  workspace_id   text not null references public.workspaces(id) on delete cascade,
  email          text not null,
  role           text not null default 'member' check (role in ('member', 'guest')),
  invited_by     text,
  inviter_name   text,
  workspace_name text,
  status         text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at     bigint not null default public.now_ms(),
  responded_at   bigint
);

create unique index if not exists workspace_invites_pending_uniq
  on public.workspace_invites (workspace_id, lower(email))
  where status = 'pending';

alter table public.workspace_invites enable row level security;

drop policy if exists "workspace_invites_select" on public.workspace_invites;
create policy "workspace_invites_select" on public.workspace_invites
  for select to authenticated
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner'
  );

grant select on public.workspace_invites to authenticated;

create or replace function public.invite_to_workspace(ws text, p_email text, p_role text default 'member')
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
  em text := lower(trim(p_email));
begin
  if public.workspace_role_of(ws, caller) is distinct from 'owner' then
    raise exception 'only workspace owners can invite' using errcode = '42501';
  end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if p_role not in ('member', 'guest') then
    raise exception 'unknown role' using errcode = '22023';
  end if;

  -- Already a member → nothing to do.
  if exists (
    select 1 from public.workspace_members m
    join public.people p on p.id = m.person_id
    where m.workspace_id = ws and lower(p.email) = em
  ) then
    return;
  end if;

  insert into public.workspace_invites
    (workspace_id, email, role, invited_by, inviter_name, workspace_name)
  values (
    ws, em, p_role, caller,
    (select name from public.people where id = caller),
    (select name from public.workspaces where id = ws)
  )
  on conflict do nothing;
end;
$$;

create or replace function public.accept_workspace_invite(p_invite text)
returns text language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
  me_email text := lower(auth.jwt() ->> 'email');
  inv public.workspace_invites;
begin
  select * into inv from public.workspace_invites where id = p_invite for update;
  if inv.id is null or inv.status <> 'pending' or lower(inv.email) <> me_email then
    raise exception 'invitation not found' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, person_id, role)
  values (inv.workspace_id, caller, inv.role)
  on conflict (workspace_id, person_id) do nothing;

  update public.workspace_invites
  set status = 'accepted', responded_at = public.now_ms()
  where id = p_invite;

  return inv.workspace_id;
end;
$$;

create or replace function public.decline_workspace_invite(p_invite text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.workspace_invites
  set status = 'declined', responded_at = public.now_ms()
  where id = p_invite
    and status = 'pending'
    and lower(email) = lower(auth.jwt() ->> 'email');
end;
$$;

create or replace function public.revoke_workspace_invite(p_invite text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.workspace_invites
  set status = 'revoked', responded_at = public.now_ms()
  where id = p_invite
    and status = 'pending'
    and public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner';
end;
$$;

grant execute on function public.invite_to_workspace(text, text, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant execute on function public.decline_workspace_invite(text) to authenticated;
grant execute on function public.revoke_workspace_invite(text) to authenticated;

-- ═══ 7. Invite links ══════════════════════════════════════════════════════
-- One per workspace. Only owners read or change it (through the functions);
-- anyone signed in who has the token can see the workspace's name and join
-- while the link is on.

create table if not exists public.workspace_invite_links (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  token        text not null unique,
  enabled      boolean not null default false,
  created_at   bigint not null default public.now_ms()
);

alter table public.workspace_invite_links enable row level security;
-- No policies: read and written only through the functions below.

create or replace function public.new_invite_token()
returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.get_workspace_invite_link(ws text)
returns table (token text, enabled boolean)
language plpgsql security definer set search_path = public as $$
begin
  if public.workspace_role_of(ws, (auth.uid())::text) is distinct from 'owner' then
    raise exception 'only workspace owners can see the invite link' using errcode = '42501';
  end if;

  insert into public.workspace_invite_links (workspace_id, token)
  values (ws, public.new_invite_token())
  on conflict (workspace_id) do nothing;

  return query
  select l.token, l.enabled from public.workspace_invite_links l
  where l.workspace_id = ws;
end;
$$;

create or replace function public.set_workspace_invite_link_enabled(ws text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.workspace_role_of(ws, (auth.uid())::text) is distinct from 'owner' then
    raise exception 'only workspace owners can change the invite link' using errcode = '42501';
  end if;

  insert into public.workspace_invite_links (workspace_id, token, enabled)
  values (ws, public.new_invite_token(), p_enabled)
  on conflict (workspace_id) do update set enabled = excluded.enabled;
end;
$$;

create or replace function public.regenerate_workspace_invite_link(ws text)
returns text language plpgsql security definer set search_path = public as $$
declare
  t text := public.new_invite_token();
begin
  if public.workspace_role_of(ws, (auth.uid())::text) is distinct from 'owner' then
    raise exception 'only workspace owners can change the invite link' using errcode = '42501';
  end if;

  insert into public.workspace_invite_links (workspace_id, token, enabled)
  values (ws, t, true)
  on conflict (workspace_id) do update set token = t, created_at = public.now_ms();

  return t;
end;
$$;

-- What the join screen shows. Nothing when the link is off or unknown.
create or replace function public.preview_workspace_invite(p_token text)
returns table (
  workspace_id text,
  name text,
  icon text,
  icon_color text,
  icon_target text,
  member_count bigint,
  already_member boolean
)
language sql stable security definer set search_path = public as $$
  select w.id, w.name, w.icon, w.icon_color, w.icon_target,
         (select count(*) from public.workspace_members m where m.workspace_id = w.id),
         public.is_workspace_member_of(w.id, (auth.uid())::text)
  from public.workspace_invite_links l
  join public.workspaces w on w.id = l.workspace_id
  where l.token = p_token
    and l.enabled
    and auth.uid() is not null;
$$;

create or replace function public.join_workspace_with_link(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare
  caller text := (auth.uid())::text;
  ws text;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select l.workspace_id into ws
  from public.workspace_invite_links l
  where l.token = p_token and l.enabled;

  if ws is null then
    raise exception 'this invite link is no longer valid' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, person_id, role)
  values (ws, caller, 'member')
  on conflict (workspace_id, person_id) do nothing;

  return ws;
end;
$$;

grant execute on function public.get_workspace_invite_link(text) to authenticated;
grant execute on function public.set_workspace_invite_link_enabled(text, boolean) to authenticated;
grant execute on function public.regenerate_workspace_invite_link(text) to authenticated;
grant execute on function public.preview_workspace_invite(text) to authenticated;
grant execute on function public.join_workspace_with_link(text) to authenticated;

-- ═══ 8. Groups: only the owners of the group's workspace edit them ════════

drop policy if exists "groups_write" on public.groups;
drop policy if exists "groups_insert" on public.groups;
drop policy if exists "groups_update" on public.groups;
drop policy if exists "groups_delete" on public.groups;

create policy "groups_insert" on public.groups
  for insert to authenticated
  with check (public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner');

create policy "groups_update" on public.groups
  for update to authenticated
  using (public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner')
  with check (public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner');

create policy "groups_delete" on public.groups
  for delete to authenticated
  using (public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner');

-- ═══ 9. Notifications can lead into any workspace you're a member of ══════
-- (038 only allowed workspaces you own.)

create or replace function public.notification_target_workspace(p_page text, p_room text)
returns text language sql stable security definer set search_path = public as $$
  select w.id
  from public.workspaces w
  where public.is_workspace_member_of(w.id, (auth.uid())::text)
    and w.id = coalesce(
      (select p.workspace_id from public.pages p
       where p.id = p_page and p.deleted_at is null),
      (select r.workspace_id from public.chat_rooms r where r.id = p_room)
    );
$$;
