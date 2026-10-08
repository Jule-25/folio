-- 000: Folio's full database schema, as of October 2026.
--
-- A fresh Supabase project needs only this file, then any migration numbered
-- 043 or higher. Run it once, in the SQL Editor or with the Supabase CLI.
--
-- It was exported from the live database (structure only, no data) and
-- replaces migrations 006–042, which are kept in archive/ for history. The
-- live database already has all of this: never run it there.
--
-- Contents, in order: extensions, types, tables, functions, column defaults
-- that call functions, constraints, foreign keys, indexes, triggers (including
-- the sign-up trigger on auth.users), row level security, policies, grants,
-- realtime tables, storage buckets, and a little seed data at the end.

set check_function_bodies = off; set search_path = public, extensions;

create extension if not exists pg_stat_statements with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists supabase_vault with schema vault;

create extension if not exists "uuid-ossp" with schema extensions;

create type public.general_access as enum ('private', 'teamspace', 'workspace', 'public');

create type public.page_role as enum ('view', 'comment', 'edit', 'full');

create type public.workspace_plan as enum ('free', 'pro');

create table public.chat_attachments (
  id text default (gen_random_uuid())::text not null,
  room_id text not null,
  message_id text not null,
  uploader_id text,
  path text not null,
  name text not null,
  mime text default 'application/octet-stream'::text not null,
  size bigint default 0 not null,
  created_at bigint not null
);

create table public.chat_block_refs (
  message_id text not null,
  room_id text not null,
  page_id text not null,
  block_id text not null,
  snapshot text default ''::text not null,
  created_at bigint not null
);

create table public.chat_members (
  room_id text not null,
  person_id text not null,
  role text default 'member'::text not null,
  last_read_at bigint default 0 not null,
  joined_at bigint default ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint not null
);

create table public.chat_messages (
  id text default (gen_random_uuid())::text not null,
  room_id text not null,
  author_id text,
  body text not null,
  reply_to_id text,
  created_at bigint default ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint not null,
  edited_at bigint,
  deleted_at bigint
);

create table public.chat_reactions (
  room_id text not null,
  message_id text not null,
  person_id text not null,
  emoji text not null,
  created_at bigint not null
);

create table public.chat_rooms (
  id text default (gen_random_uuid())::text not null,
  kind text default 'room'::text not null,
  name text,
  icon text,
  workspace_id text,
  teamspace_id text,
  visibility text default 'private'::text not null,
  created_by text,
  created_at bigint default ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint not null,
  last_message_at bigint,
  dm_key text,
  page_id text,
  showcase_page_id text
);

create table public.chat_row_refs (
  message_id text not null,
  room_id text not null,
  page_id text not null,
  created_at bigint not null
);

create table public.chat_study_participants (
  session_id text not null,
  room_id text not null,
  person_id text not null,
  joined_at bigint not null
);

create table public.chat_study_sessions (
  id text default (gen_random_uuid())::text not null,
  room_id text not null,
  started_by text,
  started_at bigint not null,
  focus_minutes integer not null,
  break_minutes integer not null,
  rounds integer not null,
  ended_at bigint
);

create table public.comments (
  id text not null,
  thread_id text not null,
  person_id text not null,
  body text default ''::text not null,
  created_at bigint not null,
  updated_at bigint,
  reactions jsonb default '{}'::jsonb not null
);

create table public.data_sources (
  id text not null,
  data jsonb default '{}'::jsonb not null,
  created_at bigint not null,
  updated_at bigint,
  name text,
  page_id text,
  properties jsonb default '[]'::jsonb not null,
  views jsonb default '[]'::jsonb not null,
  saved_views jsonb default '[]'::jsonb not null,
  row_templates jsonb default '[]'::jsonb not null,
  default_template_id text
);

create table public.groups (
  id text not null,
  name text default ''::text not null,
  icon text,
  member_ids text[] default '{}'::text[] not null,
  created_at bigint not null,
  workspace_id text default 'workspace_default'::text not null
);

create table public.notifications (
  id text not null,
  recipient_id text not null,
  actor_id text,
  type text not null,
  title text not null,
  message text not null,
  read boolean default false not null,
  source_page_id text,
  source_page_title text,
  target_node_id text,
  mention_id text,
  mention_label text,
  dedup_key text,
  created_at bigint not null,
  source_room_id text
);

create table public.page_access (
  id text default (gen_random_uuid())::text not null,
  page_id text not null,
  subject_type text not null,
  subject_id text not null,
  role public.page_role not null,
  created_at bigint default ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint not null
);

create table public.page_ydocs (
  page_id text not null,
  state bytea not null,
  updated_at timestamp with time zone default now() not null
);

create table public.pages (
  id text not null,
  title text default ''::text not null,
  settings jsonb default '{"text": "normal", "width": "medium", "locked": false}'::jsonb not null,
  cover jsonb default '{"color": null, "target": null, "gradient": null, "iconName": null, "positionY": null, "coverImage": null}'::jsonb not null,
  content jsonb default '{}'::jsonb not null,
  parent_id text,
  category text default 'Private'::text not null,
  source_id text,
  "values" jsonb,
  created_at bigint not null,
  updated_at bigint,
  workspace_id text default 'workspace_default'::text not null,
  general_access public.general_access default 'teamspace'::public.general_access not null,
  general_access_role public.page_role default 'view'::public.page_role not null,
  owner_id text,
  deleted_at bigint,
  teamspace_id text,
  edited_by text,
  published_at timestamp with time zone,
  publish_subpages boolean default false not null
);

create table public.people (
  id text not null,
  name text not null,
  email text not null,
  avatar_url text,
  role text default 'member'::text not null,
  created_at bigint default ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint not null,
  workspace_id text default 'workspace_default'::text not null,
  notification_settings jsonb default '{}'::jsonb not null
);

create table public.plan_limits (
  plan public.workspace_plan not null,
  max_members integer,
  max_teamspaces integer,
  max_workspaces integer,
  version_history boolean default false not null
);

create table public.teamspace_invites (
  id text default (gen_random_uuid())::text not null,
  teamspace_id text not null,
  email text not null,
  invited_by text,
  inviter_name text,
  teamspace_name text,
  icon_name text,
  icon_target text,
  status text default 'pending'::text not null,
  created_at bigint not null,
  responded_at bigint
);

create table public.teamspaces (
  id text not null,
  description text,
  access text default 'open'::text not null,
  member_ids text[] default '{}'::text[] not null,
  group_ids text[] default '{}'::text[] not null,
  owner_ids text[] default '{}'::text[] not null,
  created_at bigint not null,
  workspace_id text default 'workspace_default'::text not null,
  pinned_page_ids text[] default '{}'::text[] not null
);

create table public.threads (
  id text not null,
  page_id text not null,
  anchor jsonb default '{"to": 0, "from": 0}'::jsonb,
  status text default 'open'::text not null,
  suggestion jsonb
);

create table public.versions (
  id text not null,
  page_id text not null,
  title text default ''::text not null,
  content jsonb,
  name text,
  created_at bigint not null
);

create table public.workspace_invite_links (
  workspace_id text not null,
  token text not null,
  enabled boolean default false not null,
  created_at bigint not null
);

create table public.workspace_invites (
  id text default (gen_random_uuid())::text not null,
  workspace_id text not null,
  email text not null,
  role text default 'member'::text not null,
  invited_by text,
  inviter_name text,
  workspace_name text,
  status text default 'pending'::text not null,
  created_at bigint not null,
  responded_at bigint
);

create table public.workspace_members (
  workspace_id text not null,
  person_id text not null,
  role text default 'member'::text not null,
  created_at bigint not null
);

create table public.workspace_settings (
  id text default 'default'::text not null,
  invite_link jsonb default '{"url": "", "enabled": false}'::jsonb not null
);

create table public.workspaces (
  id text not null,
  name text default 'My Workspace'::text not null,
  icon text,
  settings jsonb default '{"sidebar": {"showShowcase": true, "defaultCollapsedSections": []}, "language": "en", "inviteLink": {"url": "", "enabled": false}, "defaultTheme": "system", "landingOnInvite": "welcome", "landingOnSwitch": "last-visited", "hoverCardsEnabled": true, "peopleDirectoryEnabled": true, "showRecentActivityOnProfiles": true}'::jsonb not null,
  created_at bigint default ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint not null,
  updated_at bigint,
  icon_color text,
  plan public.workspace_plan default 'free'::public.workspace_plan not null,
  owner_id text,
  icon_target text
);

CREATE OR REPLACE FUNCTION public.accept_teamspace_invite(p_invite text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  me_email text := lower(auth.jwt() ->> 'email');
  inv public.teamspace_invites;
begin
  select * into inv from public.teamspace_invites where id = p_invite for update;
  if inv.id is null or inv.status <> 'pending' or lower(inv.email) <> me_email then
    raise exception 'invitation not found' using errcode = '42501';
  end if;

  update public.teamspaces
  set member_ids = case
    when caller = any (member_ids) then member_ids
    else array_append(member_ids, caller)
  end
  where id = inv.teamspace_id;

  update public.teamspace_invites
  set status = 'accepted', responded_at = public.now_ms()
  where id = p_invite;

  return inv.teamspace_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_invite text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.add_chat_members(p_room text, p_member_ids text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  r public.chat_rooms;
  added integer;
begin
  select * into r from public.chat_rooms where id = p_room;
  if r.id is null or r.kind <> 'room' then
    raise exception 'room not found' using errcode = '22023';
  end if;
  if not public.is_chat_member(p_room, caller) then
    raise exception 'only members can invite' using errcode = '42501';
  end if;

  insert into public.chat_members (room_id, person_id, role)
  select p_room, m, 'member'
  from unnest(coalesce(p_member_ids, '{}')) as m
  where public.chat_scope_allows(r.workspace_id, r.teamspace_id, m)
  on conflict do nothing;

  get diagnostics added = row_count;
  return added;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_teamspace_member(p_ts text, p_person text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  host_ws text;
begin
  if not public.is_teamspace_owner_person(p_ts, caller) then
    raise exception 'only teamspace owners can add members' using errcode = '42501';
  end if;

  select workspace_id into host_ws from public.teamspaces where id = p_ts;
  if (select workspace_id from public.people where id = p_person)
       is distinct from host_ws then
    raise exception 'this person is not in the workspace; invite them by email'
      using errcode = '22023';
  end if;

  update public.teamspaces
  set member_ids = case
    when p_person = any (member_ids) then member_ids
    else array_append(member_ids, p_person)
  end
  where id = p_ts;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_page(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when auth.uid() is null then false
    else coalesce(
      (
        select (auth.uid())::text in (
          select public.teamspace_effective_members(ts_id)
        )
        from (select public.page_teamspace_id(p_id) as ts_id) t
        where t.ts_id is not null
      ),
      -- ts_id is null → page is not under a teamspace → allow any signed-in user
      auth.uid() is not null
    )
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_comment_page(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.page_effective_role(p_id, (auth.uid())::text) >= 'comment'::public.page_role;
$function$
;

CREATE OR REPLACE FUNCTION public.can_person_access_page(p_id text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select
      pg.owner_id = person
      or (
        pg.teamspace_id is not null
        and public.is_teamspace_member_person(pg.teamspace_id, person)
      )
      or public.page_effective_role(pg.id, person) is not null
    from public.pages pg
    where pg.id = p_id
  ), false);
$function$
;

CREATE OR REPLACE FUNCTION public.can_read_page(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.page_effective_role(p_id, (auth.uid())::text) is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.can_see_chat_room(p_room text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select person is not null and coalesce((
    select case
      when r.kind = 'page' then
        public.collab_page_access(r.page_id, person) is not null
      else
        public.is_chat_member(p_room, person)
        or (
          r.kind = 'room'
          and r.visibility = 'open'
          and public.chat_scope_allows(r.workspace_id, r.teamspace_id, person)
        )
    end
    from public.chat_rooms r
    where r.id = p_room
  ), false);
$function$
;

CREATE OR REPLACE FUNCTION public.can_use_workspace_uploads(ws text, uid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = uid
  )
  or exists (
    select 1 from public.people p
    where p.id = uid and p.workspace_id = ws
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_write_data_source(p_source text, p_page text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_page is not null then
      public.can_write_page(p_page)
      or public.teamspace_grants_access_to_page(p_page)
    else exists (
      select 1 from public.pages r
      where r.source_id = p_source
        and (public.can_write_page(r.id)
             or public.teamspace_grants_access_to_page(r.id))
    )
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_write_page(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.page_effective_role(p_id, (auth.uid())::text) >= 'edit'::public.page_role;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_mention_excerpt(p_body text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result text := p_body;
  m text[];
begin
  for m in select regexp_matches(p_body, '@\[person:([^\]]+)\]', 'g') loop
    result := replace(
      result,
      '@[person:' || m[1] || ']',
      '@' || coalesce((select name from public.people where id = m[1]), 'someone')
    );
  end loop;
  result := regexp_replace(result, '@\[page:[^\]]+\]', 'a page', 'g');
  return left(result, 160);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_notify_mentions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  person text;
  author_name text;
  room public.chat_rooms;
  page_title text;
  note_title text;
  excerpt text;
begin
  if new.deleted_at is not null or position('@[person:' in new.body) = 0 then
    return new;
  end if;

  select * into room from public.chat_rooms where id = new.room_id;
  select name into author_name from public.people where id = new.author_id;
  excerpt := public.chat_mention_excerpt(new.body);

  if room.kind = 'page' then
    select nullif(title, '') into page_title from public.pages where id = room.page_id;
  end if;

  note_title := coalesce(author_name, 'Someone') || case
    when room.kind = 'dm' then ' mentioned you in a direct message'
    when room.kind = 'page' then
      ' mentioned you in the discussion on "' || coalesce(page_title, 'a page') || '"'
    else ' mentioned you in #' || coalesce(room.name, 'a room')
  end;

  for person in
    select distinct (regexp_matches(new.body, '@\[person:([^\]]+)\]', 'g'))[1]
  loop
    continue when person = new.author_id;
    continue when not public.can_see_chat_room(new.room_id, person);

    insert into public.notifications
      (id, recipient_id, actor_id, type, title, message, read,
       source_room_id, source_page_id, source_page_title,
       target_node_id, dedup_key, created_at)
    select
      gen_random_uuid()::text, person, new.author_id, 'chat-mention',
      note_title, excerpt, false,
      new.room_id,
      case when room.kind = 'page' then room.page_id end,
      case when room.kind = 'page' then page_title end,
      new.id, 'chat:' || new.id || ':' || person, public.now_ms()
    where not exists (
      select 1 from public.notifications
      where dedup_key = 'chat:' || new.id || ':' || person
    );
  end loop;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_room_postable(p_room text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select case
      when r.kind = 'page' then public.page_chat_can_post(r.page_id, person)
      else true
    end
    from public.chat_rooms r
    where r.id = p_room
  ), false);
$function$
;

CREATE OR REPLACE FUNCTION public.chat_scope_allows(p_workspace text, p_teamspace text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_teamspace is not null
      then public.is_teamspace_member_person(p_teamspace, person)
    else p_workspace is not null and p_workspace = (
      select workspace_id from public.people where id = person
    )
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_teamspace_general()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  room text;
  owner text := new.owner_ids[1];
begin
  insert into public.chat_rooms (name, kind, visibility, teamspace_id, workspace_id, created_by)
  values ('general', 'room', 'open', new.id, new.workspace_id, owner)
  returning id into room;

  if owner is not null then
    insert into public.chat_members (room_id, person_id, role)
    values (room, owner, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_touch_room()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.chat_rooms
  set last_message_at = new.created_at
  where id = new.room_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_unread_counts()
 RETURNS TABLE(room_id text, unread integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.room_id, count(msg.id)::integer
  from public.chat_members m
  join public.chat_messages msg
    on msg.room_id = m.room_id
   and msg.created_at > m.last_read_at
   and msg.deleted_at is null
   and msg.author_id is distinct from m.person_id
  where m.person_id = (auth.uid())::text
  group by m.room_id;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_unread_mentions()
 RETURNS TABLE(room_id text, mentions integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.room_id, count(msg.id)::integer
  from public.chat_members m
  join public.chat_messages msg
    on msg.room_id = m.room_id
   and msg.created_at > m.last_read_at
   and msg.deleted_at is null
   and msg.author_id is distinct from m.person_id
   and position('@[person:' || m.person_id || ']' in msg.body) > 0
  where m.person_id = (auth.uid())::text
  group by m.room_id;
$function$
;

CREATE OR REPLACE FUNCTION public.collab_page_access(p_id text, person text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (
    select case
      when person is null then null
      when pg.owner_id = person then 'edit'
      when pg.teamspace_id is not null
           and public.is_teamspace_member_person(pg.teamspace_id, person)
        then 'edit'
      when public.page_effective_role(pg.id, person) >= 'edit'::public.page_role
        then 'edit'
      when public.page_effective_role(pg.id, person) is not null
        then 'view'
      else null
    end
    from public.pages pg
    where pg.id = p_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.create_chat_room(p_name text, p_icon text, p_teamspace_id text, p_visibility text, p_member_ids text[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  ws text;
  room text;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'room name required' using errcode = '22023';
  end if;

  if p_teamspace_id is not null then
    if not public.is_teamspace_member_person(p_teamspace_id, caller) then
      raise exception 'not a member of this teamspace' using errcode = '42501';
    end if;
    select workspace_id into ws from public.teamspaces where id = p_teamspace_id;
  else
    select workspace_id into ws from public.people where id = caller;
  end if;

  insert into public.chat_rooms (name, icon, kind, visibility, workspace_id, teamspace_id, created_by)
  values (trim(p_name), p_icon, 'room',
          case when p_visibility = 'open' then 'open' else 'private' end,
          ws, p_teamspace_id, caller)
  returning id into room;

  insert into public.chat_members (room_id, person_id, role)
  values (room, caller, 'owner');

  -- Invitees outside the room's scope are skipped, not errors.
  insert into public.chat_members (room_id, person_id, role)
  select room, m, 'member'
  from unnest(coalesce(p_member_ids, '{}')) as m
  where m <> caller
    and public.chat_scope_allows(ws, p_teamspace_id, m)
  on conflict do nothing;

  return room;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_workspace(ws_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.decline_teamspace_invite(p_invite text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me_email text := lower(auth.jwt() ->> 'email');
begin
  update public.teamspace_invites
  set status = 'declined', responded_at = public.now_ms()
  where id = p_invite
    and status = 'pending'
    and lower(email) = me_email;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.decline_workspace_invite(p_invite text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.workspace_invites
  set status = 'declined', responded_at = public.now_ms()
  where id = p_invite
    and status = 'pending'
    and lower(email) = lower(auth.jwt() ->> 'email');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_chat_room(p_room text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
begin
  -- Owner = an 'owner' member, or the room's creator (rooms created before
  -- owner roles were written have only created_by).
  if caller is null or not exists (
    select 1
    from public.chat_rooms r
    where r.id = p_room
      and r.kind = 'room'
      and (
        r.created_by = caller
        or exists (
          select 1 from public.chat_members m
          where m.room_id = r.id
            and m.person_id = caller
            and m.role = 'owner'
        )
      )
  ) then
    raise exception 'only the room owner can delete this room'
      using errcode = '42501';
  end if;

  delete from public.chat_rooms where id = p_room;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_teamspace(ts_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_workspace_plan_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Only care when `plan` is actually being changed.
  if new.plan is distinct from old.plan then
    -- auth.role() is 'service_role' for server-side calls made with the
    -- service key, and 'authenticated'/'anon' for normal client calls.
    -- current_user is 'postgres'/superuser for direct SQL-editor edits.
    -- Allow the change only from those privileged contexts.
    if coalesce(auth.role(), '') <> 'service_role'
       and current_user not in ('postgres', 'supabase_admin') then
      raise exception
        'plan can only be changed by the server (attempted % -> %)',
        old.plan, new.plan
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_accessible_page(p_id text)
 RETURNS SETOF public.pages
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.*
  from public.pages p
  where p.id = p_id
    and p.deleted_at is null
    and auth.uid() is not null
    and public.page_effective_role(p.id, (auth.uid())::text) is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.get_published_page(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_workspace_invite_link(ws text)
 RETURNS TABLE(token text, enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.greatest_role(a public.page_role, b public.page_role)
 RETURNS public.page_role
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when a is null then b
    when b is null then a
    when a >= b then a
    else b
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_page_moves()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_page_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_people_membership()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_user in ('authenticated', 'anon')
     and (new.workspace_id is distinct from old.workspace_id
          or new.role is distinct from old.role) then
    raise exception 'workspace and role change only by switching, joining or an owner'
      using errcode = '42501';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_teamspace_membership()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_user in ('authenticated', 'anon')
     and (
       new.member_ids      is distinct from old.member_ids
       or new.owner_ids    is distinct from old.owner_ids
       or new.workspace_id is distinct from old.workspace_id
       or new.pinned_page_ids is distinct from old.pinned_page_ids
     )
  then
    raise exception 'membership changes must go through the membership functions'
      using errcode = '42501';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_deleted_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.people where id = old.id::text;
  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.people (id, name, email, role)
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'member'
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.invite_to_teamspace(p_ts text, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  em text := lower(trim(p_email));
  ts public.teamspaces;
begin
  if not public.is_teamspace_owner_person(p_ts, caller) then
    raise exception 'only teamspace owners can invite' using errcode = '42501';
  end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select * into ts from public.teamspaces where id = p_ts;

  -- Already in the teamspace → nothing to do.
  if exists (
    select 1 from public.people p
    where lower(p.email) = em
      and (p.id = any (ts.member_ids) or p.id = any (ts.owner_ids))
  ) then
    return;
  end if;

  insert into public.teamspace_invites
    (teamspace_id, email, invited_by, inviter_name, teamspace_name, icon_name, icon_target)
  values (
    p_ts,
    em,
    caller,
    (select name from public.people where id = caller),
    (select title from public.pages where id = p_ts),
    (select cover ->> 'iconName' from public.pages where id = p_ts),
    (select cover ->> 'target' from public.pages where id = p_ts)
  )
  on conflict do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.invite_to_workspace(ws text, p_email text, p_role text DEFAULT 'member'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_chat_member(p_room text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.chat_members
    where room_id = p_room and person_id = person
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_teamspace_member(ts_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_teamspace_member_person(ts_id, (auth.uid())::text);
$function$
;

CREATE OR REPLACE FUNCTION public.is_teamspace_member_person(ts_id text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select person is not null and exists (
    select 1 from public.teamspaces t
    where t.id = ts_id
      and (
        person = any (t.owner_ids)
        or person = any (t.member_ids)
        or exists (
          select 1 from public.groups g
          where g.id = any (t.group_ids)
            and person = any (g.member_ids)
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_teamspace_owner_person(ts_id text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select person is not null and exists (
    select 1 from public.teamspaces
    where id = ts_id and person = any (owner_ids)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_teamspace_root(pid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.teamspaces where id = pid);
$function$
;

CREATE OR REPLACE FUNCTION public.is_workspace_member_of(ws text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and person_id = person
  );
$function$
;

CREATE OR REPLACE FUNCTION public.join_chat_room(p_room text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
begin
  if not public.can_see_chat_room(p_room, caller) then
    raise exception 'cannot join this room' using errcode = '42501';
  end if;
  insert into public.chat_members (room_id, person_id, role)
  values (p_room, caller, 'member')
  on conflict do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.join_study_session(p_session text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  s public.chat_study_sessions;
begin
  select * into s from public.chat_study_sessions where id = p_session;
  if s.id is null or not public.study_session_is_open(s) then
    raise exception 'this session has ended' using errcode = '22023';
  end if;
  if not (public.is_chat_member(s.room_id, caller)
          and public.chat_room_postable(s.room_id, caller)) then
    raise exception 'only room members can join' using errcode = '42501';
  end if;

  insert into public.chat_study_participants (session_id, room_id, person_id)
  values (p_session, s.room_id, caller)
  on conflict do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.join_workspace_with_link(p_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.leave_study_session(p_session text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.chat_study_participants
  where session_id = p_session and person_id = (auth.uid())::text;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_chat_read(p_room text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.chat_members
  set last_read_at = public.now_ms()
  where room_id = p_room and person_id = (auth.uid())::text;
$function$
;

CREATE OR REPLACE FUNCTION public.move_teamspace(ts_id text, target_ws_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.my_editable_page_ids()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select p.id
  from public.pages p
  where p.deleted_at is null
    and (
      p.owner_id = (auth.uid())::text
      or public.can_write_page(p.id)
      or public.teamspace_grants_access(p.teamspace_id, p.workspace_id)
    );
$function$
;

CREATE OR REPLACE FUNCTION public.new_invite_token()
 RETURNS text
 LANGUAGE sql
AS $function$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$function$
;

CREATE OR REPLACE FUNCTION public.notification_target_workspace(p_page text, p_room text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select w.id
  from public.workspaces w
  where public.is_workspace_member_of(w.id, (auth.uid())::text)
    and w.id = coalesce(
      (select p.workspace_id from public.pages p
       where p.id = p_page and p.deleted_at is null),
      (select r.workspace_id from public.chat_rooms r where r.id = p_room)
    );
$function$
;

CREATE OR REPLACE FUNCTION public.now_ms()
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  select (extract(epoch from now()) * 1000)::bigint;
$function$
;

CREATE OR REPLACE FUNCTION public.open_dm(p_other text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  key text;
  room text;
  shares boolean;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_other is null or p_other = caller then
    raise exception 'invalid recipient' using errcode = '22023';
  end if;

  -- DMs between people who share a workspace or a teamspace.
  select
    (select workspace_id from public.people where id = p_other)
      = (select workspace_id from public.people where id = caller)
    or exists (
      select 1 from public.teamspaces t
      where public.is_teamspace_member_person(t.id, caller)
        and public.is_teamspace_member_person(t.id, p_other)
    )
  into shares;

  if not coalesce(shares, false) then
    raise exception 'you can only message people you share a space with'
      using errcode = '42501';
  end if;

  key := least(caller, p_other) || ':' || greatest(caller, p_other);

  select id into room from public.chat_rooms where dm_key = key;
  if room is null then
    insert into public.chat_rooms (kind, dm_key, workspace_id, created_by)
    values ('dm', key, (select workspace_id from public.people where id = caller), caller)
    returning id into room;
  end if;

  insert into public.chat_members (room_id, person_id, role)
  values (room, caller, 'member'), (room, p_other, 'member')
  on conflict do nothing;

  return room;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.open_page_chat(p_page text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  room text;
begin
  if caller is null or public.collab_page_access(p_page, caller) is null then
    raise exception 'no access to this page' using errcode = '42501';
  end if;

  insert into public.chat_rooms
    (kind, page_id, workspace_id, teamspace_id, visibility, created_by)
  select 'page', pg.id, pg.workspace_id, pg.teamspace_id, 'private', caller
  from public.pages pg
  where pg.id = p_page
  on conflict (page_id) where page_id is not null do nothing;

  select id into room from public.chat_rooms where page_id = p_page;

  if public.page_chat_can_post(p_page, caller) then
    insert into public.chat_members (room_id, person_id, role)
    values (room, caller, 'member')
    on conflict do nothing;
  end if;

  return room;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.page_chat_can_post(p_page text, person text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select person is not null and exists (
    select 1 from public.pages pg
    where pg.id = p_page
      and (
        pg.owner_id = person
        or (pg.teamspace_id is not null
            and public.is_teamspace_member_person(pg.teamspace_id, person))
        or public.page_effective_role(pg.id, person) >= 'comment'::public.page_role
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.page_effective_role(p_id text, person text)
 RETURNS public.page_role
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  best     public.page_role := null;
  pg_owner text;
  pg_cat   text;
  pg_ws    text;
  ga       public.general_access;
  ga_role  public.page_role;
  ts_id    text;
  in_ws    boolean := false;
begin
  select owner_id, category, workspace_id, general_access, general_access_role
    into pg_owner, pg_cat, pg_ws, ga, ga_role
  from public.pages where id = p_id;

  -- Page doesn't exist.
  if not found then
    return null;
  end if;

  -- 1. Owner always has full access.
  if person is not null and pg_owner is not null and person = pg_owner then
    return 'full';
  end if;

  -- Anonymous: only a 'public' general access grants anything.
  if person is null then
    if ga = 'public' then
      return ga_role;
    end if;
    return null;
  end if;

  -- Is the person part of THIS page's workspace? (Current members, or the
  -- workspace's owner.) Guests don't count.
  in_ws := exists (
      select 1 from public.people
      where id = person
        and role in ('owner', 'member')
        and workspace_id = pg_ws
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = pg_ws and w.owner_id = person
    );

  -- 2. Explicit grants (direct + group), inherited up the parent chain.
  with recursive chain as (
    select id, parent_id from public.pages where id = p_id
    union all
    select p.id, p.parent_id
    from public.pages p join chain c on p.id = c.parent_id
  ),
  grants as (
    select pa.role
    from public.page_access pa
    join chain c on c.id = pa.page_id
    where pa.subject_type = 'person' and pa.subject_id = person
    union all
    select pa.role
    from public.page_access pa
    join chain c on c.id = pa.page_id
    join public.groups g on g.id = pa.subject_id
    where pa.subject_type = 'group' and person = any (g.member_ids)
  )
  select max(role) into best from grants;

  -- 3. General-access override.
  if ga = 'workspace' then
    if in_ws then
      best := public.greatest_role(best, ga_role);
    end if;
  elsif ga = 'teamspace' then
    -- "Everyone in the teamspace": members of the teamspace this page is in
    -- (direct, owners, or via an attached group) get the chosen role.
    ts_id := public.page_teamspace_id(p_id);
    if ts_id is not null
       and person in (select public.teamspace_effective_members(ts_id)) then
      best := public.greatest_role(best, ga_role);
    end if;
  elsif ga = 'public' then
    best := public.greatest_role(best, ga_role);
  end if;

  -- 4. Category baseline (only adds).
  if pg_cat = 'Shared' then
    -- Members of this page's workspace.
    if in_ws then
      best := public.greatest_role(best, coalesce(ga_role, 'view'));
    end if;
  elsif pg_cat = 'Teamspaces' then
    ts_id := public.page_teamspace_id(p_id);
    if ts_id is not null
       and person in (select public.teamspace_effective_members(ts_id)) then
      best := public.greatest_role(best, 'view');
    end if;
  end if;

  return best;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.page_teamspace_id(p_id text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recursive chain as (
    select id, parent_id
    from public.pages
    where id = p_id
    union all
    select p.id, p.parent_id
    from public.pages p
    join chain c on p.id = c.parent_id
  )
  select c.id
  from chain c
  join public.teamspaces ts on ts.id = c.id
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.person_exists(p_id text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.people where id = p_id);
$function$
;

CREATE OR REPLACE FUNCTION public.post_showcase_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  msg_id text;
begin
  if new.source_id is null
     or new.category = 'Template'
     or new.deleted_at is not null then
    return new;
  end if;

  for r in
    select cr.id
    from public.chat_rooms cr
    join public.data_sources ds on ds.page_id = cr.showcase_page_id
    where ds.id = new.source_id
  loop
    if exists (
      select 1 from public.chat_row_refs x
      where x.room_id = r.id and x.page_id = new.id
    ) then
      continue;
    end if;

    msg_id := gen_random_uuid()::text;
    insert into public.chat_messages (id, room_id, author_id, body)
    values (msg_id, r.id, new.owner_id, '');
    insert into public.chat_row_refs (message_id, room_id, page_id)
    values (msg_id, r.id, new.id);
  end loop;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_workspace_invite(p_token text)
 RETURNS TABLE(workspace_id text, name text, icon text, icon_color text, icon_target text, member_count bigint, already_member boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select w.id, w.name, w.icon, w.icon_color, w.icon_target,
         (select count(*) from public.workspace_members m where m.workspace_id = w.id),
         public.is_workspace_member_of(w.id, (auth.uid())::text)
  from public.workspace_invite_links l
  join public.workspaces w on w.id = l.workspace_id
  where l.token = p_token
    and l.enabled
    and auth.uid() is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.propagate_page_teamspace_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.published_root_of(p_id text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.reassign_current_workspace(person text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.regenerate_workspace_invite_link(ws text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.remove_teamspace_member(p_ts text, p_person text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  ts public.teamspaces;
begin
  select * into ts from public.teamspaces where id = p_ts;
  if ts.id is null then
    raise exception 'teamspace not found' using errcode = '22023';
  end if;
  if caller <> p_person and not (caller = any (ts.owner_ids)) then
    raise exception 'only teamspace owners can remove members' using errcode = '42501';
  end if;
  if p_person = any (ts.owner_ids) and coalesce(array_length(ts.owner_ids, 1), 0) <= 1 then
    raise exception 'a teamspace needs at least one owner' using errcode = '22023';
  end if;

  update public.teamspaces
  set member_ids = array_remove(member_ids, p_person),
      owner_ids  = array_remove(owner_ids, p_person)
  where id = p_ts;

  delete from public.chat_members
  where person_id = p_person
    and room_id in (select id from public.chat_rooms where teamspace_id = p_ts);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(ws text, person text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_teamspace_invite(p_invite text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
begin
  delete from public.teamspace_invites i
  where i.id = p_invite
    and i.status = 'pending'
    and public.is_teamspace_owner_person(i.teamspace_id, caller);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(p_invite text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.workspace_invites
  set status = 'revoked', responded_at = public.now_ms()
  where id = p_invite
    and status = 'pending'
    and public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.room_block_refs(p_room text)
 RETURNS TABLE(message_id text, page_id text, block_id text, snapshot text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    r.message_id,
    case when a.readable then r.page_id end,
    case when a.readable then r.block_id end,
    case when a.readable then r.snapshot end
  from public.chat_block_refs r
  join public.chat_messages m
    on m.id = r.message_id and m.deleted_at is null
  cross join lateral (
    select public.collab_page_access(r.page_id, (auth.uid())::text) is not null
      as readable
  ) a
  where r.room_id = p_room
    and public.can_see_chat_room(p_room, (auth.uid())::text);
$function$
;

CREATE OR REPLACE FUNCTION public.room_row_refs(p_room text)
 RETURNS TABLE(message_id text, page_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    r.message_id,
    case
      when public.collab_page_access(r.page_id, (auth.uid())::text) is not null
      then r.page_id
    end
  from public.chat_row_refs r
  join public.chat_messages m
    on m.id = r.message_id and m.deleted_at is null
  where r.room_id = p_room
    and public.can_see_chat_room(p_room, (auth.uid())::text);
$function$
;

CREATE OR REPLACE FUNCTION public.send_block_message(p_id text, p_room text, p_body text, p_reply_to text, p_page text, p_block text, p_snapshot text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  msg public.chat_messages;
begin
  if caller is null
     or not public.is_chat_member(p_room, caller)
     or not public.chat_room_postable(p_room, caller) then
    raise exception 'you can''t post in this room' using errcode = '42501';
  end if;

  if public.collab_page_access(p_page, caller) is null then
    raise exception 'you can''t read that page' using errcode = '42501';
  end if;

  if p_reply_to is not null and not exists (
    select 1 from public.chat_messages r
    where r.id = p_reply_to and r.room_id = p_room
  ) then
    raise exception 'reply target is not in this room' using errcode = '22023';
  end if;

  insert into public.chat_messages (id, room_id, author_id, body, reply_to_id)
  values (p_id, p_room, caller, coalesce(p_body, ''), p_reply_to)
  returning * into msg;

  insert into public.chat_block_refs (message_id, room_id, page_id, block_id, snapshot)
  values (p_id, p_room, p_page, p_block, left(coalesce(p_snapshot, ''), 2000));

  return jsonb_build_object('message', to_jsonb(msg));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_id text, p_room text, p_body text, p_reply_to text, p_attachments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  msg public.chat_messages;
  file_count integer := coalesce(jsonb_array_length(p_attachments), 0);
  body_text text := coalesce(p_body, '');
begin
  if file_count > 10 then
    raise exception 'too many attachments' using errcode = '22023';
  end if;
  if btrim(body_text) = '' and file_count = 0 then
    raise exception 'empty message' using errcode = '22023';
  end if;

  insert into public.chat_messages (id, room_id, author_id, body, reply_to_id)
  values (p_id, p_room, (auth.uid())::text, body_text, p_reply_to)
  returning * into msg;

  insert into public.chat_attachments
    (room_id, message_id, uploader_id, path, name, mime, size)
  select
    p_room, p_id, (auth.uid())::text,
    a ->> 'path',
    left(coalesce(a ->> 'name', 'file'), 255),
    coalesce(a ->> 'mime', 'application/octet-stream'),
    coalesce((a ->> 'size')::bigint, 0)
  from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) as a;

  return jsonb_build_object(
    'message', to_jsonb(msg),
    'attachments', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.created_at)
       from public.chat_attachments x
       where x.message_id = p_id),
      '[]'::jsonb
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_page_edited_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid text := (auth.uid())::text;
begin
  if uid is not null
     and exists (select 1 from public.people where id = uid) then
    new.edited_by := uid;
  elsif tg_op = 'UPDATE' then
    new.edited_by := old.edited_by;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_page_published(p_id text, p_published boolean, p_subpages boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_page_teamspace_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_room_showcase(p_room text, p_page text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
begin
  if caller is null or not exists (
    select 1 from public.chat_members
    where room_id = p_room and person_id = caller and role = 'owner'
  ) then
    raise exception 'only the room owner can do this' using errcode = '42501';
  end if;

  if p_page is not null then
    if public.collab_page_access(p_page, caller) is null then
      raise exception 'you can''t read that page' using errcode = '42501';
    end if;
    if not exists (select 1 from public.data_sources ds where ds.page_id = p_page) then
      raise exception 'that page is not a database' using errcode = '22023';
    end if;
  end if;

  update public.chat_rooms
     set showcase_page_id = p_page
   where id = p_room and kind = 'room';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_teamspace_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  caller_ws text;
begin
  if caller is null then
    return new;
  end if;

  select workspace_id into caller_ws
  from public.people where id = caller;
  if caller_ws is not null then
    new.workspace_id := caller_ws;
  end if;

  if coalesce(array_length(new.owner_ids, 1), 0) = 0 then
    new.owner_ids := array[caller];
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_teamspace_owner(p_ts text, p_person text, p_owner boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  ts public.teamspaces;
begin
  select * into ts from public.teamspaces where id = p_ts;
  if not (caller = any (ts.owner_ids)) then
    raise exception 'only teamspace owners can change roles' using errcode = '42501';
  end if;
  if not (p_person = any (ts.member_ids) or p_person = any (ts.owner_ids)) then
    raise exception 'not a member of this teamspace' using errcode = '22023';
  end if;

  if p_owner then
    update public.teamspaces
    set owner_ids = case
          when p_person = any (owner_ids) then owner_ids
          else array_append(owner_ids, p_person)
        end,
        member_ids = case
          when p_person = any (member_ids) then member_ids
          else array_append(member_ids, p_person)
        end
    where id = p_ts;
  else
    if coalesce(array_length(ts.owner_ids, 1), 0) <= 1 and p_person = any (ts.owner_ids) then
      raise exception 'a teamspace needs at least one owner' using errcode = '22023';
    end if;
    update public.teamspaces
    set owner_ids = array_remove(owner_ids, p_person),
        member_ids = case
          when p_person = any (member_ids) then member_ids
          else array_append(member_ids, p_person)
        end
    where id = p_ts;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_teamspace_pin(ts_id text, page_id text, pinned boolean)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  result text[];
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.teamspaces
    where id = ts_id and caller = any (owner_ids)
  ) then
    raise exception 'only teamspace owners can pin pages' using errcode = '42501';
  end if;

  if pinned and not exists (
    select 1 from public.pages
    where id = page_id and teamspace_id = ts_id
  ) then
    raise exception 'page is not in this teamspace' using errcode = '22023';
  end if;

  update public.teamspaces
  set pinned_page_ids = case
    when pinned then array_append(array_remove(pinned_page_ids, page_id), page_id)
    else array_remove(pinned_page_ids, page_id)
  end
  where id = ts_id
  returning pinned_page_ids into result;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_workspace_invite_link_enabled(ws text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.workspace_role_of(ws, (auth.uid())::text) is distinct from 'owner' then
    raise exception 'only workspace owners can change the invite link' using errcode = '42501';
  end if;

  insert into public.workspace_invite_links (workspace_id, token, enabled)
  values (ws, public.new_invite_token(), p_enabled)
  on conflict (workspace_id) do update set enabled = excluded.enabled;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_workspace_member_role(ws text, person text, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.start_study_session(p_room text, p_focus integer, p_break integer, p_rounds integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  session_id text;
begin
  if not (public.is_chat_member(p_room, caller)
          and public.chat_room_postable(p_room, caller)) then
    raise exception 'only room members can start a study session'
      using errcode = '42501';
  end if;

  -- Close sessions that ran their course without being stopped.
  update public.chat_study_sessions s
  set ended_at = public.now_ms()
  where s.room_id = p_room
    and s.ended_at is null
    and not public.study_session_is_open(s);

  insert into public.chat_study_sessions
    (room_id, started_by, focus_minutes, break_minutes, rounds)
  values (p_room, caller, p_focus, p_break, p_rounds)
  returning id into session_id;

  insert into public.chat_study_participants (session_id, room_id, person_id)
  values (session_id, p_room, caller);

  return session_id;
exception
  when unique_violation then
    raise exception 'a study session is already running in this room'
      using errcode = '22023';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.stop_study_session(p_session text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller text := (auth.uid())::text;
  s public.chat_study_sessions;
begin
  select * into s from public.chat_study_sessions where id = p_session;
  if s.id is null then
    raise exception 'session not found' using errcode = '22023';
  end if;
  if s.started_by is distinct from caller and not exists (
    select 1 from public.chat_members m
    where m.room_id = s.room_id and m.person_id = caller and m.role = 'owner'
  ) then
    raise exception 'only the starter or a room owner can stop it'
      using errcode = '42501';
  end if;

  update public.chat_study_sessions
  set ended_at = public.now_ms()
  where id = p_session and ended_at is null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.study_session_is_open(s public.chat_study_sessions)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select s.ended_at is null
    and s.started_at
        + public.study_session_total_ms(s.focus_minutes, s.break_minutes, s.rounds)
        > public.now_ms();
$function$
;

CREATE OR REPLACE FUNCTION public.study_session_total_ms(f integer, b integer, r integer)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select ((r * (f + b)) - b)::bigint * 60000;
$function$
;

CREATE OR REPLACE FUNCTION public.switch_workspace(target_ws_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.teamspace_effective_members(ts_id text)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ts.member_ids[i]
  from public.teamspaces ts,
       generate_subscripts(ts.member_ids, 1) as i
  where ts.id = ts_id
  union
  select g.member_ids[i]
  from public.teamspaces ts
  join public.groups g on g.id = any (ts.group_ids),
       generate_subscripts(g.member_ids, 1) as i
  where ts.id = ts_id;
$function$
;

CREATE OR REPLACE FUNCTION public.teamspace_grants_access(ts_id text, page_ws_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ts_id is not null
    and public.is_teamspace_member(ts_id)
    and (
      page_ws_id = (
        select p.workspace_id from public.people p
        where p.id = (auth.uid())::text
      )
      or not exists (
        select 1 from public.workspaces w
        where w.id = page_ws_id
          and w.owner_id = (auth.uid())::text
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.teamspace_grants_access_to_page(pid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select public.teamspace_grants_access(p.teamspace_id, p.workspace_id)
     from public.pages p where p.id = pid),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.workspace_people(ws text)
 RETURNS SETOF public.people
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.name, p.email, p.avatar_url, m.role, p.created_at,
         m.workspace_id,
         case when p.id = (auth.uid())::text
              then p.notification_settings else '{}'::jsonb end
  from public.workspace_members m
  join public.people p on p.id = m.person_id
  where m.workspace_id = ws
    and public.is_workspace_member_of(ws, (auth.uid())::text)
  order by p.name;
$function$
;

CREATE OR REPLACE FUNCTION public.workspace_role_of(ws text, person text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.workspace_members
  where workspace_id = ws and person_id = person;
$function$
;

alter table public.chat_attachments alter column created_at set default public.now_ms();

alter table public.chat_block_refs alter column created_at set default public.now_ms();

alter table public.chat_reactions alter column created_at set default public.now_ms();

alter table public.chat_row_refs alter column created_at set default public.now_ms();

alter table public.chat_study_participants alter column joined_at set default public.now_ms();

alter table public.chat_study_sessions alter column started_at set default public.now_ms();

alter table public.teamspace_invites alter column created_at set default public.now_ms();

alter table public.workspace_invite_links alter column created_at set default public.now_ms();

alter table public.workspace_invites alter column created_at set default public.now_ms();

alter table public.workspace_members alter column created_at set default public.now_ms();

alter table public.chat_attachments add constraint chat_attachments_pkey PRIMARY KEY (id);

alter table public.chat_block_refs add constraint chat_block_refs_block_id_check CHECK (((char_length(block_id) >= 1) AND (char_length(block_id) <= 100)));

alter table public.chat_block_refs add constraint chat_block_refs_pkey PRIMARY KEY (message_id);

alter table public.chat_block_refs add constraint chat_block_refs_snapshot_check CHECK ((char_length(snapshot) <= 2000));

alter table public.chat_members add constraint chat_members_pkey PRIMARY KEY (room_id, person_id);

alter table public.chat_members add constraint chat_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));

alter table public.chat_messages add constraint chat_messages_body_check CHECK ((length(body) <= 8000));

alter table public.chat_messages add constraint chat_messages_pkey PRIMARY KEY (id);

alter table public.chat_reactions add constraint chat_reactions_emoji_check CHECK (((char_length(emoji) >= 1) AND (char_length(emoji) <= 16)));

alter table public.chat_reactions add constraint chat_reactions_pkey PRIMARY KEY (message_id, person_id, emoji);

alter table public.chat_rooms add constraint chat_rooms_dm_key_key UNIQUE (dm_key);

alter table public.chat_rooms add constraint chat_rooms_kind_check CHECK ((kind = ANY (ARRAY['room'::text, 'dm'::text, 'page'::text])));

alter table public.chat_rooms add constraint chat_rooms_pkey PRIMARY KEY (id);

alter table public.chat_rooms add constraint chat_rooms_visibility_check CHECK ((visibility = ANY (ARRAY['open'::text, 'private'::text])));

alter table public.chat_row_refs add constraint chat_row_refs_pkey PRIMARY KEY (message_id);

alter table public.chat_study_participants add constraint chat_study_participants_pkey PRIMARY KEY (session_id, person_id);

alter table public.chat_study_sessions add constraint chat_study_sessions_break_minutes_check CHECK (((break_minutes >= 1) AND (break_minutes <= 60)));

alter table public.chat_study_sessions add constraint chat_study_sessions_focus_minutes_check CHECK (((focus_minutes >= 5) AND (focus_minutes <= 120)));

alter table public.chat_study_sessions add constraint chat_study_sessions_pkey PRIMARY KEY (id);

alter table public.chat_study_sessions add constraint chat_study_sessions_rounds_check CHECK (((rounds >= 1) AND (rounds <= 12)));

alter table public.comments add constraint comments_pkey PRIMARY KEY (id);

alter table public.data_sources add constraint data_sources_pkey PRIMARY KEY (id);

alter table public.groups add constraint groups_pkey PRIMARY KEY (id);

alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);

alter table public.page_access add constraint page_access_page_id_subject_type_subject_id_key UNIQUE (page_id, subject_type, subject_id);

alter table public.page_access add constraint page_access_pkey PRIMARY KEY (id);

alter table public.page_access add constraint page_access_subject_type_check CHECK ((subject_type = ANY (ARRAY['person'::text, 'group'::text])));

alter table public.page_ydocs add constraint page_ydocs_pkey PRIMARY KEY (page_id);

alter table public.pages add constraint pages_category_check CHECK ((category = ANY (ARRAY['Favorites'::text, 'Shared'::text, 'Private'::text, 'Template'::text, 'Teamspaces'::text])));

alter table public.pages add constraint pages_pkey PRIMARY KEY (id);

alter table public.people add constraint people_pkey PRIMARY KEY (id);

alter table public.people add constraint people_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text, 'guest'::text])));

alter table public.plan_limits add constraint plan_limits_pkey PRIMARY KEY (plan);

alter table public.teamspace_invites add constraint teamspace_invites_pkey PRIMARY KEY (id);

alter table public.teamspace_invites add constraint teamspace_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])));

alter table public.teamspaces add constraint teamspaces_access_check CHECK ((access = ANY (ARRAY['open'::text, 'closed'::text, 'private'::text])));

alter table public.teamspaces add constraint teamspaces_pkey PRIMARY KEY (id);

alter table public.threads add constraint threads_pkey PRIMARY KEY (id);

alter table public.threads add constraint threads_status_check CHECK ((status = ANY (ARRAY['active'::text, 'resolved'::text, 'drafted'::text, 'open'::text, 'deleted'::text])));

alter table public.threads add constraint threads_suggestion_shape CHECK (((suggestion IS NULL) OR ((jsonb_typeof(suggestion) = 'object'::text) AND (jsonb_typeof((suggestion -> 'original'::text)) = 'string'::text) AND (jsonb_typeof((suggestion -> 'text'::text)) = 'string'::text) AND ((suggestion ->> 'state'::text) = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))));

alter table public.versions add constraint versions_pkey PRIMARY KEY (id);

alter table public.workspace_invite_links add constraint workspace_invite_links_pkey PRIMARY KEY (workspace_id);

alter table public.workspace_invite_links add constraint workspace_invite_links_token_key UNIQUE (token);

alter table public.workspace_invites add constraint workspace_invites_pkey PRIMARY KEY (id);

alter table public.workspace_invites add constraint workspace_invites_role_check CHECK ((role = ANY (ARRAY['member'::text, 'guest'::text])));

alter table public.workspace_invites add constraint workspace_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'revoked'::text])));

alter table public.workspace_members add constraint workspace_members_pkey PRIMARY KEY (workspace_id, person_id);

alter table public.workspace_members add constraint workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text, 'guest'::text])));

alter table public.workspace_settings add constraint workspace_settings_pkey PRIMARY KEY (id);

alter table public.workspaces add constraint workspaces_pkey PRIMARY KEY (id);

alter table public.chat_attachments add constraint chat_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;

alter table public.chat_attachments add constraint chat_attachments_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_attachments add constraint chat_attachments_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.chat_block_refs add constraint chat_block_refs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;

alter table public.chat_block_refs add constraint chat_block_refs_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.chat_block_refs add constraint chat_block_refs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_members add constraint chat_members_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;

alter table public.chat_members add constraint chat_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_messages add constraint chat_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.chat_messages add constraint chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;

alter table public.chat_messages add constraint chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_reactions add constraint chat_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;

alter table public.chat_reactions add constraint chat_reactions_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;

alter table public.chat_reactions add constraint chat_reactions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_rooms add constraint chat_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.chat_rooms add constraint chat_rooms_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.chat_rooms add constraint chat_rooms_showcase_page_id_fkey FOREIGN KEY (showcase_page_id) REFERENCES public.pages(id) ON DELETE SET NULL;

alter table public.chat_rooms add constraint chat_rooms_teamspace_id_fkey FOREIGN KEY (teamspace_id) REFERENCES public.teamspaces(id) ON DELETE CASCADE;

alter table public.chat_rooms add constraint chat_rooms_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.chat_row_refs add constraint chat_row_refs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;

alter table public.chat_row_refs add constraint chat_row_refs_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.chat_row_refs add constraint chat_row_refs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_study_participants add constraint chat_study_participants_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;

alter table public.chat_study_participants add constraint chat_study_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_study_participants add constraint chat_study_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_study_sessions(id) ON DELETE CASCADE;

alter table public.chat_study_sessions add constraint chat_study_sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

alter table public.chat_study_sessions add constraint chat_study_sessions_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.comments add constraint comments_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;

alter table public.comments add constraint comments_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;

alter table public.groups add constraint groups_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.notifications add constraint notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.people(id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_source_page_id_fkey FOREIGN KEY (source_page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.page_access add constraint page_access_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.page_ydocs add constraint page_ydocs_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.pages add constraint pages_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.pages add constraint pages_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.pages add constraint pages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.pages add constraint pages_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id) ON DELETE CASCADE;

alter table public.pages add constraint pages_teamspace_id_fkey FOREIGN KEY (teamspace_id) REFERENCES public.teamspaces(id) ON DELETE SET NULL;

alter table public.pages add constraint pages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.people add constraint people_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.teamspace_invites add constraint teamspace_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.people(id) ON DELETE SET NULL;

alter table public.teamspace_invites add constraint teamspace_invites_teamspace_id_fkey FOREIGN KEY (teamspace_id) REFERENCES public.teamspaces(id) ON DELETE CASCADE;

alter table public.teamspaces add constraint teamspaces_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.threads add constraint threads_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.versions add constraint versions_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;

alter table public.workspace_invite_links add constraint workspace_invite_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.workspace_invites add constraint workspace_invites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.workspace_members add constraint workspace_members_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;

alter table public.workspace_members add constraint workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

alter table public.workspaces add constraint workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.people(id);

CREATE INDEX chat_attachments_message_idx ON public.chat_attachments USING btree (message_id);

CREATE INDEX chat_attachments_room_idx ON public.chat_attachments USING btree (room_id);

CREATE INDEX chat_block_refs_room_idx ON public.chat_block_refs USING btree (room_id);

CREATE INDEX chat_members_person_idx ON public.chat_members USING btree (person_id);

CREATE INDEX chat_messages_room_created_idx ON public.chat_messages USING btree (room_id, created_at DESC);

CREATE INDEX chat_reactions_room_idx ON public.chat_reactions USING btree (room_id);

CREATE UNIQUE INDEX chat_rooms_page_uniq ON public.chat_rooms USING btree (page_id) WHERE (page_id IS NOT NULL);

CREATE UNIQUE INDEX chat_rooms_showcase_page_uniq ON public.chat_rooms USING btree (showcase_page_id) WHERE (showcase_page_id IS NOT NULL);

CREATE INDEX chat_rooms_teamspace_idx ON public.chat_rooms USING btree (teamspace_id);

CREATE INDEX chat_row_refs_room_idx ON public.chat_row_refs USING btree (room_id);

CREATE UNIQUE INDEX chat_row_refs_room_page_uniq ON public.chat_row_refs USING btree (room_id, page_id);

CREATE INDEX chat_study_participants_room_idx ON public.chat_study_participants USING btree (room_id);

CREATE UNIQUE INDEX chat_study_sessions_open_uniq ON public.chat_study_sessions USING btree (room_id) WHERE (ended_at IS NULL);

CREATE INDEX comments_thread_id_idx ON public.comments USING btree (thread_id);

CREATE INDEX groups_workspace_id_idx ON public.groups USING btree (workspace_id);

CREATE UNIQUE INDEX notifications_dedup_idx ON public.notifications USING btree (recipient_id, dedup_key) WHERE (dedup_key IS NOT NULL);

CREATE INDEX notifications_recipient_idx ON public.notifications USING btree (recipient_id, created_at DESC);

CREATE INDEX page_access_page_idx ON public.page_access USING btree (page_id);

CREATE INDEX page_access_subject_idx ON public.page_access USING btree (subject_type, subject_id);

CREATE INDEX pages_category_idx ON public.pages USING btree (category);

CREATE INDEX pages_deleted_at_idx ON public.pages USING btree (deleted_at);

CREATE INDEX pages_owner_id_idx ON public.pages USING btree (owner_id);

CREATE INDEX pages_parent_id_idx ON public.pages USING btree (parent_id);

CREATE INDEX pages_source_id_idx ON public.pages USING btree (source_id);

CREATE INDEX pages_teamspace_id_idx ON public.pages USING btree (teamspace_id);

CREATE INDEX pages_workspace_id_idx ON public.pages USING btree (workspace_id);

CREATE INDEX people_workspace_id_idx ON public.people USING btree (workspace_id);

CREATE INDEX teamspace_invites_email_idx ON public.teamspace_invites USING btree (email);

CREATE UNIQUE INDEX teamspace_invites_pending_uniq ON public.teamspace_invites USING btree (teamspace_id, email) WHERE (status = 'pending'::text);

CREATE INDEX teamspaces_workspace_id_idx ON public.teamspaces USING btree (workspace_id);

CREATE INDEX threads_page_id_idx ON public.threads USING btree (page_id);

CREATE INDEX versions_page_id_idx ON public.versions USING btree (page_id);

CREATE UNIQUE INDEX workspace_invites_pending_uniq ON public.workspace_invites USING btree (workspace_id, lower(email)) WHERE (status = 'pending'::text);

CREATE INDEX workspace_members_person_idx ON public.workspace_members USING btree (person_id);

CREATE TRIGGER trg_chat_notify_mentions AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.chat_notify_mentions();

CREATE TRIGGER trg_chat_touch_room AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.chat_touch_room();

CREATE TRIGGER trg_a_guard_page_moves BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.guard_page_moves();

CREATE TRIGGER trg_guard_page_publish BEFORE INSERT OR UPDATE OF published_at, publish_subpages ON public.pages FOR EACH ROW EXECUTE FUNCTION public.guard_page_publish();

CREATE TRIGGER trg_post_showcase_row AFTER INSERT ON public.pages FOR EACH ROW EXECUTE FUNCTION public.post_showcase_row();

CREATE TRIGGER trg_propagate_page_teamspace_id AFTER UPDATE OF parent_id, source_id ON public.pages FOR EACH ROW EXECUTE FUNCTION public.propagate_page_teamspace_id();

CREATE TRIGGER trg_set_page_edited_by BEFORE INSERT OR UPDATE OF title, "values", cover, settings, content ON public.pages FOR EACH ROW EXECUTE FUNCTION public.set_page_edited_by();

CREATE TRIGGER trg_set_page_teamspace_id BEFORE INSERT OR UPDATE OF parent_id, source_id ON public.pages FOR EACH ROW EXECUTE FUNCTION public.set_page_teamspace_id();

CREATE TRIGGER trg_guard_people_membership BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.guard_people_membership();

CREATE TRIGGER trg_chat_teamspace_general AFTER INSERT ON public.teamspaces FOR EACH ROW EXECUTE FUNCTION public.chat_teamspace_general();

CREATE TRIGGER trg_guard_teamspace_membership BEFORE UPDATE ON public.teamspaces FOR EACH ROW EXECUTE FUNCTION public.guard_teamspace_membership();

CREATE TRIGGER trg_set_teamspace_defaults BEFORE INSERT ON public.teamspaces FOR EACH ROW EXECUTE FUNCTION public.set_teamspace_defaults();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

CREATE TRIGGER trg_workspace_plan_immutable BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_plan_immutable();

alter table public.chat_attachments enable row level security;

alter table public.chat_block_refs enable row level security;

alter table public.chat_members enable row level security;

alter table public.chat_messages enable row level security;

alter table public.chat_reactions enable row level security;

alter table public.chat_rooms enable row level security;

alter table public.chat_row_refs enable row level security;

alter table public.chat_study_participants enable row level security;

alter table public.chat_study_sessions enable row level security;

alter table public.comments enable row level security;

alter table public.data_sources enable row level security;

alter table public.groups enable row level security;

alter table public.notifications enable row level security;

alter table public.page_access enable row level security;

alter table public.page_ydocs enable row level security;

alter table public.pages enable row level security;

alter table public.people enable row level security;

alter table public.plan_limits enable row level security;

alter table public.teamspace_invites enable row level security;

alter table public.teamspaces enable row level security;

alter table public.threads enable row level security;

alter table public.versions enable row level security;

alter table public.workspace_invite_links enable row level security;

alter table public.workspace_invites enable row level security;

alter table public.workspace_members enable row level security;

alter table public.workspace_settings enable row level security;

alter table public.workspaces enable row level security;

create policy chat_attachments_insert on public.chat_attachments as permissive for insert to authenticated
  with check (((uploader_id = (auth.uid())::text) AND public.is_chat_member(room_id, (auth.uid())::text) AND public.chat_room_postable(room_id, (auth.uid())::text) AND (path ~~ (room_id || '/%'::text)) AND (EXISTS ( SELECT 1
   FROM public.chat_messages m
  WHERE ((m.id = chat_attachments.message_id) AND (m.room_id = chat_attachments.room_id) AND (m.author_id = (auth.uid())::text))))));

create policy chat_attachments_select on public.chat_attachments as permissive for select to authenticated
  using ((public.can_see_chat_room(room_id, (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.chat_messages m
  WHERE ((m.id = chat_attachments.message_id) AND (m.deleted_at IS NULL))))));

create policy chat_members_delete on public.chat_members as permissive for delete to authenticated
  using (((person_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.chat_members o
  WHERE ((o.room_id = chat_members.room_id) AND (o.person_id = (auth.uid())::text) AND (o.role = 'owner'::text))))));

create policy chat_members_select on public.chat_members as permissive for select to authenticated
  using (public.can_see_chat_room(room_id, (auth.uid())::text));

create policy chat_messages_insert on public.chat_messages as permissive for insert to authenticated
  with check (((author_id = (auth.uid())::text) AND (deleted_at IS NULL) AND public.is_chat_member(room_id, (auth.uid())::text) AND public.chat_room_postable(room_id, (auth.uid())::text) AND ((reply_to_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.chat_messages r
  WHERE ((r.id = chat_messages.reply_to_id) AND (r.room_id = chat_messages.room_id)))))));

create policy chat_messages_select on public.chat_messages as permissive for select to authenticated
  using (public.can_see_chat_room(room_id, (auth.uid())::text));

create policy chat_messages_update on public.chat_messages as permissive for update to authenticated
  using ((author_id = (auth.uid())::text))
  with check ((author_id = (auth.uid())::text));

create policy chat_reactions_delete on public.chat_reactions as permissive for delete to authenticated
  using ((person_id = (auth.uid())::text));

create policy chat_reactions_insert on public.chat_reactions as permissive for insert to authenticated
  with check (((person_id = (auth.uid())::text) AND public.is_chat_member(room_id, (auth.uid())::text) AND public.chat_room_postable(room_id, (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.chat_messages m
  WHERE ((m.id = chat_reactions.message_id) AND (m.room_id = chat_reactions.room_id) AND (m.deleted_at IS NULL))))));

create policy chat_reactions_select on public.chat_reactions as permissive for select to authenticated
  using (public.can_see_chat_room(room_id, (auth.uid())::text));

create policy chat_rooms_delete on public.chat_rooms as permissive for delete to authenticated
  using (((kind = 'room'::text) AND (EXISTS ( SELECT 1
   FROM public.chat_members m
  WHERE ((m.room_id = chat_rooms.id) AND (m.person_id = (auth.uid())::text) AND (m.role = 'owner'::text))))));

create policy chat_rooms_select on public.chat_rooms as permissive for select to authenticated
  using (public.can_see_chat_room(id, (auth.uid())::text));

create policy chat_rooms_update on public.chat_rooms as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM public.chat_members m
  WHERE ((m.room_id = chat_rooms.id) AND (m.person_id = (auth.uid())::text) AND (m.role = 'owner'::text)))));

create policy chat_study_participants_select on public.chat_study_participants as permissive for select to authenticated
  using (public.can_see_chat_room(room_id, (auth.uid())::text));

create policy chat_study_sessions_select on public.chat_study_sessions as permissive for select to authenticated
  using (public.can_see_chat_room(room_id, (auth.uid())::text));

create policy comments_delete_own on public.comments as permissive for delete to public
  using ((person_id = (auth.uid())::text));

create policy comments_insert on public.comments as permissive for insert to public
  with check (((person_id = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.threads t
  WHERE ((t.id = comments.thread_id) AND public.can_comment_page(t.page_id))))));

create policy comments_select on public.comments as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM public.threads t
  WHERE ((t.id = comments.thread_id) AND public.can_read_page(t.page_id)))));

create policy comments_update_own on public.comments as permissive for update to public
  using ((person_id = (auth.uid())::text))
  with check ((person_id = (auth.uid())::text));

create policy data_sources_delete on public.data_sources as permissive for delete to authenticated
  using (public.can_write_data_source(id, page_id));

create policy data_sources_insert on public.data_sources as permissive for insert to authenticated
  with check (((auth.uid() IS NOT NULL) AND ((page_id IS NULL) OR public.can_write_data_source(id, page_id))));

create policy data_sources_select on public.data_sources as permissive for select to authenticated
  using ((((page_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.pages p
  WHERE (p.id = data_sources.page_id)))) OR ((page_id IS NULL) AND (EXISTS ( SELECT 1
   FROM public.pages r
  WHERE (r.source_id = data_sources.id))))));

create policy data_sources_update on public.data_sources as permissive for update to authenticated
  using (public.can_write_data_source(id, page_id))
  with check (public.can_write_data_source(id, page_id));

create policy groups_delete on public.groups as permissive for delete to authenticated
  using ((public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner'::text));

create policy groups_insert on public.groups as permissive for insert to authenticated
  with check ((public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner'::text));

create policy groups_select on public.groups as permissive for select to authenticated
  using (((workspace_id = ( SELECT p.workspace_id
   FROM public.people p
  WHERE (p.id = (auth.uid())::text))) OR ((auth.uid())::text = ANY (member_ids))));

create policy groups_update on public.groups as permissive for update to authenticated
  using ((public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner'::text))
  with check ((public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner'::text));

create policy notifications_delete on public.notifications as permissive for delete to public
  using ((recipient_id = (auth.uid())::text));

create policy notifications_insert on public.notifications as permissive for insert to public
  with check (true);

create policy notifications_select on public.notifications as permissive for select to public
  using (((recipient_id = (auth.uid())::text) OR (actor_id = (auth.uid())::text)));

create policy notifications_update on public.notifications as permissive for update to public
  using ((recipient_id = (auth.uid())::text));

create policy page_access_select on public.page_access as permissive for select to public
  using (public.can_read_page(page_id));

create policy page_access_write on public.page_access as permissive for all to public
  using (((public.page_effective_role(page_id, (auth.uid())::text) = 'full'::public.page_role) OR (EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = (auth.uid())::text) AND (people.role = 'owner'::text))))))
  with check (((public.page_effective_role(page_id, (auth.uid())::text) = 'full'::public.page_role) OR (EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = (auth.uid())::text) AND (people.role = 'owner'::text))))));

create policy pages_delete on public.pages as permissive for delete to public
  using (public.can_write_page(id));

create policy pages_insert on public.pages as permissive for insert to authenticated
  with check (((auth.uid() IS NOT NULL) AND ((parent_id IS NULL) OR public.can_write_page(parent_id) OR public.teamspace_grants_access_to_page(parent_id))));

create policy pages_select on public.pages as permissive for select to authenticated
  using ((((workspace_id IN ( SELECT p.workspace_id
   FROM public.people p
  WHERE (p.id = (auth.uid())::text))) AND ((owner_id = (auth.uid())::text) OR public.can_read_page(id))) OR public.teamspace_grants_access(teamspace_id, workspace_id)));

create policy pages_update on public.pages as permissive for update to authenticated
  using ((public.can_write_page(id) OR public.teamspace_grants_access(teamspace_id, workspace_id)))
  with check ((public.can_write_page(id) OR public.teamspace_grants_access(teamspace_id, workspace_id)));

create policy "people are readable by any authenticated user" on public.people as permissive for select to authenticated
  using (true);

create policy "people can update own row" on public.people as permissive for update to authenticated
  using ((id = (auth.uid())::text))
  with check (((id = (auth.uid())::text) AND (role = ( SELECT people_1.role
   FROM public.people people_1
  WHERE (people_1.id = (auth.uid())::text)))));

create policy people_insert_self on public.people as permissive for insert to public
  with check ((id = (auth.uid())::text));

create policy people_select on public.people as permissive for select to public
  using ((auth.uid() IS NOT NULL));

create policy people_update_self on public.people as permissive for update to public
  using ((id = (auth.uid())::text))
  with check ((id = (auth.uid())::text));

create policy "plan_limits readable by authenticated" on public.plan_limits as permissive for select to authenticated
  using (true);

create policy teamspace_invites_select on public.teamspace_invites as permissive for select to authenticated
  using (((lower(email) = lower((auth.jwt() ->> 'email'::text))) OR public.is_teamspace_owner_person(teamspace_id, (auth.uid())::text)));

create policy teamspaces_delete on public.teamspaces as permissive for delete to authenticated
  using (((auth.uid())::text = ANY (owner_ids)));

create policy teamspaces_insert on public.teamspaces as permissive for insert to authenticated
  with check ((((auth.uid())::text = ANY (owner_ids)) AND (workspace_id = ( SELECT p.workspace_id
   FROM public.people p
  WHERE (p.id = (auth.uid())::text)))));

create policy teamspaces_select on public.teamspaces as permissive for select to authenticated
  using ((public.is_teamspace_member(id) OR ((access = ANY (ARRAY['open'::text, 'closed'::text])) AND (workspace_id = ( SELECT p.workspace_id
   FROM public.people p
  WHERE (p.id = (auth.uid())::text))))));

create policy teamspaces_update on public.teamspaces as permissive for update to authenticated
  using (((auth.uid())::text = ANY (owner_ids)))
  with check (((auth.uid())::text = ANY (owner_ids)));

create policy threads_all on public.threads as permissive for all to public
  using (public.can_read_page(page_id))
  with check (public.can_comment_page(page_id));

create policy versions_all on public.versions as permissive for all to public
  using (public.can_read_page(page_id))
  with check (public.can_write_page(page_id));

create policy workspace_invites_select on public.workspace_invites as permissive for select to authenticated
  using (((lower(email) = lower((auth.jwt() ->> 'email'::text))) OR (public.workspace_role_of(workspace_id, (auth.uid())::text) = 'owner'::text)));

create policy workspace_members_select on public.workspace_members as permissive for select to authenticated
  using (public.is_workspace_member_of(workspace_id, (auth.uid())::text));

create policy workspace_settings_select on public.workspace_settings as permissive for select to authenticated
  using (((id IN ( SELECT w.id
   FROM public.workspaces w
  WHERE (w.owner_id = (auth.uid())::text))) OR (id = ( SELECT p.workspace_id
   FROM public.people p
  WHERE (p.id = (auth.uid())::text)))));

create policy workspace_settings_update on public.workspace_settings as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = (auth.uid())::text) AND (people.role = 'owner'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = (auth.uid())::text) AND (people.role = 'owner'::text)))));

create policy workspaces_select on public.workspaces as permissive for select to authenticated
  using (((owner_id = (auth.uid())::text) OR public.is_workspace_member_of(id, (auth.uid())::text)));

create policy workspaces_update on public.workspaces as permissive for update to authenticated
  using ((owner_id = (auth.uid())::text))
  with check ((EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = (auth.uid())::text) AND (people.role = 'owner'::text)))));

create policy chat_files_delete on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'chat-attachments'::text) AND (owner = auth.uid())));

create policy chat_files_insert on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'chat-attachments'::text) AND public.is_chat_member((storage.foldername(name))[1], (auth.uid())::text) AND public.chat_room_postable((storage.foldername(name))[1], (auth.uid())::text)));

create policy chat_files_select on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'chat-attachments'::text) AND public.can_see_chat_room((storage.foldername(name))[1], (auth.uid())::text)));

create policy uploads_delete on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'uploads'::text) AND (owner = auth.uid())));

create policy uploads_insert on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'uploads'::text) AND ((((storage.foldername(name))[1] = 'w'::text) AND public.can_use_workspace_uploads((storage.foldername(name))[2], (auth.uid())::text)) OR (((storage.foldername(name))[1] = 'u'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)))));

create policy uploads_select on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'uploads'::text) AND ((((storage.foldername(name))[1] = 'w'::text) AND public.can_use_workspace_uploads((storage.foldername(name))[2], (auth.uid())::text)) OR (((storage.foldername(name))[1] = 'u'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)))));

revoke all on public.chat_attachments from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_attachments to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_attachments to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_attachments to anon;

revoke all on public.chat_block_refs from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_block_refs to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_block_refs to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_block_refs to anon;

revoke all on public.chat_members from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_members to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_members to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_members to anon;

revoke all on public.chat_messages from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_messages to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_messages to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_messages to anon;

revoke all on public.chat_reactions from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_reactions to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_reactions to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_reactions to anon;

revoke all on public.chat_rooms from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_rooms to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_rooms to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_rooms to anon;

revoke all on public.chat_row_refs from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_row_refs to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_row_refs to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_row_refs to anon;

revoke all on public.chat_study_participants from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_study_participants to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_study_participants to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_study_participants to anon;

revoke all on public.chat_study_sessions from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_study_sessions to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_study_sessions to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.chat_study_sessions to anon;

revoke all on public.comments from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.comments to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.comments to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.comments to anon;

revoke all on public.data_sources from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.data_sources to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.data_sources to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.data_sources to anon;

revoke all on public.groups from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.groups to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.groups to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.groups to anon;

revoke all on public.notifications from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.notifications to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.notifications to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.notifications to anon;

revoke all on public.page_access from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.page_access to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.page_access to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.page_access to anon;

revoke all on public.page_ydocs from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.page_ydocs to service_role;

revoke all on public.pages from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.pages to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.pages to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.pages to anon;

revoke all on public.people from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.people to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.people to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.people to anon;

revoke all on public.plan_limits from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.plan_limits to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.plan_limits to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.plan_limits to anon;

revoke all on public.teamspace_invites from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.teamspace_invites to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.teamspace_invites to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.teamspace_invites to anon;

revoke all on public.teamspaces from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.teamspaces to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.teamspaces to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.teamspaces to anon;

revoke all on public.threads from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.threads to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.threads to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.threads to anon;

revoke all on public.versions from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.versions to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.versions to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.versions to anon;

revoke all on public.workspace_invite_links from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_invite_links to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_invite_links to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_invite_links to anon;

revoke all on public.workspace_invites from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_invites to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_invites to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_invites to anon;

revoke all on public.workspace_members from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_members to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_members to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_members to anon;

revoke all on public.workspace_settings from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_settings to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_settings to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspace_settings to anon;

revoke all on public.workspaces from anon, authenticated, service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspaces to service_role; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspaces to authenticated; grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on public.workspaces to anon;

revoke all on function public.accept_teamspace_invite(p_invite text) from public, anon, authenticated, service_role; grant execute on function public.accept_teamspace_invite(p_invite text) to public; grant execute on function public.accept_teamspace_invite(p_invite text) to anon; grant execute on function public.accept_teamspace_invite(p_invite text) to authenticated; grant execute on function public.accept_teamspace_invite(p_invite text) to service_role;

revoke all on function public.accept_workspace_invite(p_invite text) from public, anon, authenticated, service_role; grant execute on function public.accept_workspace_invite(p_invite text) to public; grant execute on function public.accept_workspace_invite(p_invite text) to anon; grant execute on function public.accept_workspace_invite(p_invite text) to authenticated; grant execute on function public.accept_workspace_invite(p_invite text) to service_role;

revoke all on function public.add_chat_members(p_room text, p_member_ids text[]) from public, anon, authenticated, service_role; grant execute on function public.add_chat_members(p_room text, p_member_ids text[]) to public; grant execute on function public.add_chat_members(p_room text, p_member_ids text[]) to anon; grant execute on function public.add_chat_members(p_room text, p_member_ids text[]) to authenticated; grant execute on function public.add_chat_members(p_room text, p_member_ids text[]) to service_role;

revoke all on function public.add_teamspace_member(p_ts text, p_person text) from public, anon, authenticated, service_role; grant execute on function public.add_teamspace_member(p_ts text, p_person text) to public; grant execute on function public.add_teamspace_member(p_ts text, p_person text) to anon; grant execute on function public.add_teamspace_member(p_ts text, p_person text) to authenticated; grant execute on function public.add_teamspace_member(p_ts text, p_person text) to service_role;

revoke all on function public.can_access_page(p_id text) from public, anon, authenticated, service_role; grant execute on function public.can_access_page(p_id text) to public; grant execute on function public.can_access_page(p_id text) to anon; grant execute on function public.can_access_page(p_id text) to authenticated; grant execute on function public.can_access_page(p_id text) to service_role;

revoke all on function public.can_comment_page(p_id text) from public, anon, authenticated, service_role; grant execute on function public.can_comment_page(p_id text) to public; grant execute on function public.can_comment_page(p_id text) to anon; grant execute on function public.can_comment_page(p_id text) to authenticated; grant execute on function public.can_comment_page(p_id text) to service_role;

revoke all on function public.can_person_access_page(p_id text, person text) from public, anon, authenticated, service_role; grant execute on function public.can_person_access_page(p_id text, person text) to service_role;

revoke all on function public.can_read_page(p_id text) from public, anon, authenticated, service_role; grant execute on function public.can_read_page(p_id text) to public; grant execute on function public.can_read_page(p_id text) to anon; grant execute on function public.can_read_page(p_id text) to authenticated; grant execute on function public.can_read_page(p_id text) to service_role;

revoke all on function public.can_see_chat_room(p_room text, person text) from public, anon, authenticated, service_role; grant execute on function public.can_see_chat_room(p_room text, person text) to public; grant execute on function public.can_see_chat_room(p_room text, person text) to anon; grant execute on function public.can_see_chat_room(p_room text, person text) to authenticated; grant execute on function public.can_see_chat_room(p_room text, person text) to service_role;

revoke all on function public.can_use_workspace_uploads(ws text, uid text) from public, anon, authenticated, service_role; grant execute on function public.can_use_workspace_uploads(ws text, uid text) to anon; grant execute on function public.can_use_workspace_uploads(ws text, uid text) to authenticated; grant execute on function public.can_use_workspace_uploads(ws text, uid text) to service_role;

revoke all on function public.can_write_data_source(p_source text, p_page text) from public, anon, authenticated, service_role; grant execute on function public.can_write_data_source(p_source text, p_page text) to public; grant execute on function public.can_write_data_source(p_source text, p_page text) to anon; grant execute on function public.can_write_data_source(p_source text, p_page text) to authenticated; grant execute on function public.can_write_data_source(p_source text, p_page text) to service_role;

revoke all on function public.can_write_page(p_id text) from public, anon, authenticated, service_role; grant execute on function public.can_write_page(p_id text) to public; grant execute on function public.can_write_page(p_id text) to anon; grant execute on function public.can_write_page(p_id text) to authenticated; grant execute on function public.can_write_page(p_id text) to service_role;

revoke all on function public.chat_mention_excerpt(p_body text) from public, anon, authenticated, service_role; grant execute on function public.chat_mention_excerpt(p_body text) to public; grant execute on function public.chat_mention_excerpt(p_body text) to anon; grant execute on function public.chat_mention_excerpt(p_body text) to authenticated; grant execute on function public.chat_mention_excerpt(p_body text) to service_role;

revoke all on function public.chat_notify_mentions() from public, anon, authenticated, service_role; grant execute on function public.chat_notify_mentions() to public; grant execute on function public.chat_notify_mentions() to anon; grant execute on function public.chat_notify_mentions() to authenticated; grant execute on function public.chat_notify_mentions() to service_role;

revoke all on function public.chat_room_postable(p_room text, person text) from public, anon, authenticated, service_role; grant execute on function public.chat_room_postable(p_room text, person text) to public; grant execute on function public.chat_room_postable(p_room text, person text) to anon; grant execute on function public.chat_room_postable(p_room text, person text) to authenticated; grant execute on function public.chat_room_postable(p_room text, person text) to service_role;

revoke all on function public.chat_scope_allows(p_workspace text, p_teamspace text, person text) from public, anon, authenticated, service_role; grant execute on function public.chat_scope_allows(p_workspace text, p_teamspace text, person text) to public; grant execute on function public.chat_scope_allows(p_workspace text, p_teamspace text, person text) to anon; grant execute on function public.chat_scope_allows(p_workspace text, p_teamspace text, person text) to authenticated; grant execute on function public.chat_scope_allows(p_workspace text, p_teamspace text, person text) to service_role;

revoke all on function public.chat_teamspace_general() from public, anon, authenticated, service_role; grant execute on function public.chat_teamspace_general() to public; grant execute on function public.chat_teamspace_general() to anon; grant execute on function public.chat_teamspace_general() to authenticated; grant execute on function public.chat_teamspace_general() to service_role;

revoke all on function public.chat_touch_room() from public, anon, authenticated, service_role; grant execute on function public.chat_touch_room() to public; grant execute on function public.chat_touch_room() to anon; grant execute on function public.chat_touch_room() to authenticated; grant execute on function public.chat_touch_room() to service_role;

revoke all on function public.chat_unread_counts() from public, anon, authenticated, service_role; grant execute on function public.chat_unread_counts() to public; grant execute on function public.chat_unread_counts() to anon; grant execute on function public.chat_unread_counts() to authenticated; grant execute on function public.chat_unread_counts() to service_role;

revoke all on function public.chat_unread_mentions() from public, anon, authenticated, service_role; grant execute on function public.chat_unread_mentions() to public; grant execute on function public.chat_unread_mentions() to anon; grant execute on function public.chat_unread_mentions() to authenticated; grant execute on function public.chat_unread_mentions() to service_role;

revoke all on function public.collab_page_access(p_id text, person text) from public, anon, authenticated, service_role; grant execute on function public.collab_page_access(p_id text, person text) to service_role;

revoke all on function public.create_chat_room(p_name text, p_icon text, p_teamspace_id text, p_visibility text, p_member_ids text[]) from public, anon, authenticated, service_role; grant execute on function public.create_chat_room(p_name text, p_icon text, p_teamspace_id text, p_visibility text, p_member_ids text[]) to public; grant execute on function public.create_chat_room(p_name text, p_icon text, p_teamspace_id text, p_visibility text, p_member_ids text[]) to anon; grant execute on function public.create_chat_room(p_name text, p_icon text, p_teamspace_id text, p_visibility text, p_member_ids text[]) to authenticated; grant execute on function public.create_chat_room(p_name text, p_icon text, p_teamspace_id text, p_visibility text, p_member_ids text[]) to service_role;

revoke all on function public.create_workspace(ws_name text) from public, anon, authenticated, service_role; grant execute on function public.create_workspace(ws_name text) to public; grant execute on function public.create_workspace(ws_name text) to anon; grant execute on function public.create_workspace(ws_name text) to authenticated; grant execute on function public.create_workspace(ws_name text) to service_role;

revoke all on function public.decline_teamspace_invite(p_invite text) from public, anon, authenticated, service_role; grant execute on function public.decline_teamspace_invite(p_invite text) to public; grant execute on function public.decline_teamspace_invite(p_invite text) to anon; grant execute on function public.decline_teamspace_invite(p_invite text) to authenticated; grant execute on function public.decline_teamspace_invite(p_invite text) to service_role;

revoke all on function public.decline_workspace_invite(p_invite text) from public, anon, authenticated, service_role; grant execute on function public.decline_workspace_invite(p_invite text) to public; grant execute on function public.decline_workspace_invite(p_invite text) to anon; grant execute on function public.decline_workspace_invite(p_invite text) to authenticated; grant execute on function public.decline_workspace_invite(p_invite text) to service_role;

revoke all on function public.delete_chat_room(p_room text) from public, anon, authenticated, service_role; grant execute on function public.delete_chat_room(p_room text) to anon; grant execute on function public.delete_chat_room(p_room text) to authenticated; grant execute on function public.delete_chat_room(p_room text) to service_role;

revoke all on function public.delete_teamspace(ts_id text) from public, anon, authenticated, service_role; grant execute on function public.delete_teamspace(ts_id text) to public; grant execute on function public.delete_teamspace(ts_id text) to anon; grant execute on function public.delete_teamspace(ts_id text) to authenticated; grant execute on function public.delete_teamspace(ts_id text) to service_role;

revoke all on function public.enforce_workspace_plan_immutable() from public, anon, authenticated, service_role; grant execute on function public.enforce_workspace_plan_immutable() to public; grant execute on function public.enforce_workspace_plan_immutable() to anon; grant execute on function public.enforce_workspace_plan_immutable() to authenticated; grant execute on function public.enforce_workspace_plan_immutable() to service_role;

revoke all on function public.get_accessible_page(p_id text) from public, anon, authenticated, service_role; grant execute on function public.get_accessible_page(p_id text) to public; grant execute on function public.get_accessible_page(p_id text) to anon; grant execute on function public.get_accessible_page(p_id text) to authenticated; grant execute on function public.get_accessible_page(p_id text) to service_role;

revoke all on function public.get_published_page(p_id text) from public, anon, authenticated, service_role; grant execute on function public.get_published_page(p_id text) to public; grant execute on function public.get_published_page(p_id text) to anon; grant execute on function public.get_published_page(p_id text) to authenticated; grant execute on function public.get_published_page(p_id text) to service_role;

revoke all on function public.get_workspace_invite_link(ws text) from public, anon, authenticated, service_role; grant execute on function public.get_workspace_invite_link(ws text) to public; grant execute on function public.get_workspace_invite_link(ws text) to anon; grant execute on function public.get_workspace_invite_link(ws text) to authenticated; grant execute on function public.get_workspace_invite_link(ws text) to service_role;

revoke all on function public.greatest_role(a public.page_role, b public.page_role) from public, anon, authenticated, service_role; grant execute on function public.greatest_role(a public.page_role, b public.page_role) to public; grant execute on function public.greatest_role(a public.page_role, b public.page_role) to anon; grant execute on function public.greatest_role(a public.page_role, b public.page_role) to authenticated; grant execute on function public.greatest_role(a public.page_role, b public.page_role) to service_role;

revoke all on function public.guard_page_moves() from public, anon, authenticated, service_role; grant execute on function public.guard_page_moves() to public; grant execute on function public.guard_page_moves() to anon; grant execute on function public.guard_page_moves() to authenticated; grant execute on function public.guard_page_moves() to service_role;

revoke all on function public.guard_page_publish() from public, anon, authenticated, service_role; grant execute on function public.guard_page_publish() to public; grant execute on function public.guard_page_publish() to anon; grant execute on function public.guard_page_publish() to authenticated; grant execute on function public.guard_page_publish() to service_role;

revoke all on function public.guard_people_membership() from public, anon, authenticated, service_role; grant execute on function public.guard_people_membership() to public; grant execute on function public.guard_people_membership() to anon; grant execute on function public.guard_people_membership() to authenticated; grant execute on function public.guard_people_membership() to service_role;

revoke all on function public.guard_teamspace_membership() from public, anon, authenticated, service_role; grant execute on function public.guard_teamspace_membership() to public; grant execute on function public.guard_teamspace_membership() to anon; grant execute on function public.guard_teamspace_membership() to authenticated; grant execute on function public.guard_teamspace_membership() to service_role;

revoke all on function public.handle_deleted_user() from public, anon, authenticated, service_role; grant execute on function public.handle_deleted_user() to public; grant execute on function public.handle_deleted_user() to anon; grant execute on function public.handle_deleted_user() to authenticated; grant execute on function public.handle_deleted_user() to service_role;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated, service_role; grant execute on function public.handle_new_auth_user() to public; grant execute on function public.handle_new_auth_user() to anon; grant execute on function public.handle_new_auth_user() to authenticated; grant execute on function public.handle_new_auth_user() to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role; grant execute on function public.handle_new_user() to public; grant execute on function public.handle_new_user() to anon; grant execute on function public.handle_new_user() to authenticated; grant execute on function public.handle_new_user() to service_role;

revoke all on function public.invite_to_teamspace(p_ts text, p_email text) from public, anon, authenticated, service_role; grant execute on function public.invite_to_teamspace(p_ts text, p_email text) to public; grant execute on function public.invite_to_teamspace(p_ts text, p_email text) to anon; grant execute on function public.invite_to_teamspace(p_ts text, p_email text) to authenticated; grant execute on function public.invite_to_teamspace(p_ts text, p_email text) to service_role;

revoke all on function public.invite_to_workspace(ws text, p_email text, p_role text) from public, anon, authenticated, service_role; grant execute on function public.invite_to_workspace(ws text, p_email text, p_role text) to public; grant execute on function public.invite_to_workspace(ws text, p_email text, p_role text) to anon; grant execute on function public.invite_to_workspace(ws text, p_email text, p_role text) to authenticated; grant execute on function public.invite_to_workspace(ws text, p_email text, p_role text) to service_role;

revoke all on function public.is_chat_member(p_room text, person text) from public, anon, authenticated, service_role; grant execute on function public.is_chat_member(p_room text, person text) to public; grant execute on function public.is_chat_member(p_room text, person text) to anon; grant execute on function public.is_chat_member(p_room text, person text) to authenticated; grant execute on function public.is_chat_member(p_room text, person text) to service_role;

revoke all on function public.is_teamspace_member(ts_id text) from public, anon, authenticated, service_role; grant execute on function public.is_teamspace_member(ts_id text) to public; grant execute on function public.is_teamspace_member(ts_id text) to anon; grant execute on function public.is_teamspace_member(ts_id text) to authenticated; grant execute on function public.is_teamspace_member(ts_id text) to service_role;

revoke all on function public.is_teamspace_member_person(ts_id text, person text) from public, anon, authenticated, service_role; grant execute on function public.is_teamspace_member_person(ts_id text, person text) to service_role;

revoke all on function public.is_teamspace_owner_person(ts_id text, person text) from public, anon, authenticated, service_role; grant execute on function public.is_teamspace_owner_person(ts_id text, person text) to public; grant execute on function public.is_teamspace_owner_person(ts_id text, person text) to anon; grant execute on function public.is_teamspace_owner_person(ts_id text, person text) to authenticated; grant execute on function public.is_teamspace_owner_person(ts_id text, person text) to service_role;

revoke all on function public.is_teamspace_root(pid text) from public, anon, authenticated, service_role; grant execute on function public.is_teamspace_root(pid text) to public; grant execute on function public.is_teamspace_root(pid text) to anon; grant execute on function public.is_teamspace_root(pid text) to authenticated; grant execute on function public.is_teamspace_root(pid text) to service_role;

revoke all on function public.is_workspace_member_of(ws text, person text) from public, anon, authenticated, service_role; grant execute on function public.is_workspace_member_of(ws text, person text) to public; grant execute on function public.is_workspace_member_of(ws text, person text) to anon; grant execute on function public.is_workspace_member_of(ws text, person text) to authenticated; grant execute on function public.is_workspace_member_of(ws text, person text) to service_role;

revoke all on function public.join_chat_room(p_room text) from public, anon, authenticated, service_role; grant execute on function public.join_chat_room(p_room text) to public; grant execute on function public.join_chat_room(p_room text) to anon; grant execute on function public.join_chat_room(p_room text) to authenticated; grant execute on function public.join_chat_room(p_room text) to service_role;

revoke all on function public.join_study_session(p_session text) from public, anon, authenticated, service_role; grant execute on function public.join_study_session(p_session text) to public; grant execute on function public.join_study_session(p_session text) to anon; grant execute on function public.join_study_session(p_session text) to authenticated; grant execute on function public.join_study_session(p_session text) to service_role;

revoke all on function public.join_workspace_with_link(p_token text) from public, anon, authenticated, service_role; grant execute on function public.join_workspace_with_link(p_token text) to public; grant execute on function public.join_workspace_with_link(p_token text) to anon; grant execute on function public.join_workspace_with_link(p_token text) to authenticated; grant execute on function public.join_workspace_with_link(p_token text) to service_role;

revoke all on function public.leave_study_session(p_session text) from public, anon, authenticated, service_role; grant execute on function public.leave_study_session(p_session text) to public; grant execute on function public.leave_study_session(p_session text) to anon; grant execute on function public.leave_study_session(p_session text) to authenticated; grant execute on function public.leave_study_session(p_session text) to service_role;

revoke all on function public.mark_chat_read(p_room text) from public, anon, authenticated, service_role; grant execute on function public.mark_chat_read(p_room text) to public; grant execute on function public.mark_chat_read(p_room text) to anon; grant execute on function public.mark_chat_read(p_room text) to authenticated; grant execute on function public.mark_chat_read(p_room text) to service_role;

revoke all on function public.move_teamspace(ts_id text, target_ws_id text) from public, anon, authenticated, service_role; grant execute on function public.move_teamspace(ts_id text, target_ws_id text) to public; grant execute on function public.move_teamspace(ts_id text, target_ws_id text) to anon; grant execute on function public.move_teamspace(ts_id text, target_ws_id text) to authenticated; grant execute on function public.move_teamspace(ts_id text, target_ws_id text) to service_role;

revoke all on function public.my_editable_page_ids() from public, anon, authenticated, service_role; grant execute on function public.my_editable_page_ids() to public; grant execute on function public.my_editable_page_ids() to anon; grant execute on function public.my_editable_page_ids() to authenticated; grant execute on function public.my_editable_page_ids() to service_role;

revoke all on function public.new_invite_token() from public, anon, authenticated, service_role; grant execute on function public.new_invite_token() to public; grant execute on function public.new_invite_token() to anon; grant execute on function public.new_invite_token() to authenticated; grant execute on function public.new_invite_token() to service_role;

revoke all on function public.notification_target_workspace(p_page text, p_room text) from public, anon, authenticated, service_role; grant execute on function public.notification_target_workspace(p_page text, p_room text) to public; grant execute on function public.notification_target_workspace(p_page text, p_room text) to anon; grant execute on function public.notification_target_workspace(p_page text, p_room text) to authenticated; grant execute on function public.notification_target_workspace(p_page text, p_room text) to service_role;

revoke all on function public.now_ms() from public, anon, authenticated, service_role; grant execute on function public.now_ms() to public; grant execute on function public.now_ms() to anon; grant execute on function public.now_ms() to authenticated; grant execute on function public.now_ms() to service_role;

revoke all on function public.open_dm(p_other text) from public, anon, authenticated, service_role; grant execute on function public.open_dm(p_other text) to public; grant execute on function public.open_dm(p_other text) to anon; grant execute on function public.open_dm(p_other text) to authenticated; grant execute on function public.open_dm(p_other text) to service_role;

revoke all on function public.open_page_chat(p_page text) from public, anon, authenticated, service_role; grant execute on function public.open_page_chat(p_page text) to public; grant execute on function public.open_page_chat(p_page text) to anon; grant execute on function public.open_page_chat(p_page text) to authenticated; grant execute on function public.open_page_chat(p_page text) to service_role;

revoke all on function public.page_chat_can_post(p_page text, person text) from public, anon, authenticated, service_role; grant execute on function public.page_chat_can_post(p_page text, person text) to public; grant execute on function public.page_chat_can_post(p_page text, person text) to anon; grant execute on function public.page_chat_can_post(p_page text, person text) to authenticated; grant execute on function public.page_chat_can_post(p_page text, person text) to service_role;

revoke all on function public.page_effective_role(p_id text, person text) from public, anon, authenticated, service_role; grant execute on function public.page_effective_role(p_id text, person text) to public; grant execute on function public.page_effective_role(p_id text, person text) to anon; grant execute on function public.page_effective_role(p_id text, person text) to authenticated; grant execute on function public.page_effective_role(p_id text, person text) to service_role;

revoke all on function public.page_teamspace_id(p_id text) from public, anon, authenticated, service_role; grant execute on function public.page_teamspace_id(p_id text) to public; grant execute on function public.page_teamspace_id(p_id text) to anon; grant execute on function public.page_teamspace_id(p_id text) to authenticated; grant execute on function public.page_teamspace_id(p_id text) to service_role;

revoke all on function public.person_exists(p_id text) from public, anon, authenticated, service_role; grant execute on function public.person_exists(p_id text) to public; grant execute on function public.person_exists(p_id text) to anon; grant execute on function public.person_exists(p_id text) to authenticated; grant execute on function public.person_exists(p_id text) to service_role;

revoke all on function public.post_showcase_row() from public, anon, authenticated, service_role; grant execute on function public.post_showcase_row() to public; grant execute on function public.post_showcase_row() to anon; grant execute on function public.post_showcase_row() to authenticated; grant execute on function public.post_showcase_row() to service_role;

revoke all on function public.preview_workspace_invite(p_token text) from public, anon, authenticated, service_role; grant execute on function public.preview_workspace_invite(p_token text) to public; grant execute on function public.preview_workspace_invite(p_token text) to anon; grant execute on function public.preview_workspace_invite(p_token text) to authenticated; grant execute on function public.preview_workspace_invite(p_token text) to service_role;

revoke all on function public.propagate_page_teamspace_id() from public, anon, authenticated, service_role; grant execute on function public.propagate_page_teamspace_id() to public; grant execute on function public.propagate_page_teamspace_id() to anon; grant execute on function public.propagate_page_teamspace_id() to authenticated; grant execute on function public.propagate_page_teamspace_id() to service_role;

revoke all on function public.published_root_of(p_id text) from public, anon, authenticated, service_role; grant execute on function public.published_root_of(p_id text) to service_role;

revoke all on function public.reassign_current_workspace(person text) from public, anon, authenticated, service_role; grant execute on function public.reassign_current_workspace(person text) to public; grant execute on function public.reassign_current_workspace(person text) to anon; grant execute on function public.reassign_current_workspace(person text) to authenticated; grant execute on function public.reassign_current_workspace(person text) to service_role;

revoke all on function public.regenerate_workspace_invite_link(ws text) from public, anon, authenticated, service_role; grant execute on function public.regenerate_workspace_invite_link(ws text) to public; grant execute on function public.regenerate_workspace_invite_link(ws text) to anon; grant execute on function public.regenerate_workspace_invite_link(ws text) to authenticated; grant execute on function public.regenerate_workspace_invite_link(ws text) to service_role;

revoke all on function public.remove_teamspace_member(p_ts text, p_person text) from public, anon, authenticated, service_role; grant execute on function public.remove_teamspace_member(p_ts text, p_person text) to public; grant execute on function public.remove_teamspace_member(p_ts text, p_person text) to anon; grant execute on function public.remove_teamspace_member(p_ts text, p_person text) to authenticated; grant execute on function public.remove_teamspace_member(p_ts text, p_person text) to service_role;

revoke all on function public.remove_workspace_member(ws text, person text) from public, anon, authenticated, service_role; grant execute on function public.remove_workspace_member(ws text, person text) to public; grant execute on function public.remove_workspace_member(ws text, person text) to anon; grant execute on function public.remove_workspace_member(ws text, person text) to authenticated; grant execute on function public.remove_workspace_member(ws text, person text) to service_role;

revoke all on function public.revoke_teamspace_invite(p_invite text) from public, anon, authenticated, service_role; grant execute on function public.revoke_teamspace_invite(p_invite text) to public; grant execute on function public.revoke_teamspace_invite(p_invite text) to anon; grant execute on function public.revoke_teamspace_invite(p_invite text) to authenticated; grant execute on function public.revoke_teamspace_invite(p_invite text) to service_role;

revoke all on function public.revoke_workspace_invite(p_invite text) from public, anon, authenticated, service_role; grant execute on function public.revoke_workspace_invite(p_invite text) to public; grant execute on function public.revoke_workspace_invite(p_invite text) to anon; grant execute on function public.revoke_workspace_invite(p_invite text) to authenticated; grant execute on function public.revoke_workspace_invite(p_invite text) to service_role;

revoke all on function public.room_block_refs(p_room text) from public, anon, authenticated, service_role; grant execute on function public.room_block_refs(p_room text) to public; grant execute on function public.room_block_refs(p_room text) to anon; grant execute on function public.room_block_refs(p_room text) to authenticated; grant execute on function public.room_block_refs(p_room text) to service_role;

revoke all on function public.room_row_refs(p_room text) from public, anon, authenticated, service_role; grant execute on function public.room_row_refs(p_room text) to public; grant execute on function public.room_row_refs(p_room text) to anon; grant execute on function public.room_row_refs(p_room text) to authenticated; grant execute on function public.room_row_refs(p_room text) to service_role;

revoke all on function public.send_block_message(p_id text, p_room text, p_body text, p_reply_to text, p_page text, p_block text, p_snapshot text) from public, anon, authenticated, service_role; grant execute on function public.send_block_message(p_id text, p_room text, p_body text, p_reply_to text, p_page text, p_block text, p_snapshot text) to public; grant execute on function public.send_block_message(p_id text, p_room text, p_body text, p_reply_to text, p_page text, p_block text, p_snapshot text) to anon; grant execute on function public.send_block_message(p_id text, p_room text, p_body text, p_reply_to text, p_page text, p_block text, p_snapshot text) to authenticated; grant execute on function public.send_block_message(p_id text, p_room text, p_body text, p_reply_to text, p_page text, p_block text, p_snapshot text) to service_role;

revoke all on function public.send_chat_message(p_id text, p_room text, p_body text, p_reply_to text, p_attachments jsonb) from public, anon, authenticated, service_role; grant execute on function public.send_chat_message(p_id text, p_room text, p_body text, p_reply_to text, p_attachments jsonb) to public; grant execute on function public.send_chat_message(p_id text, p_room text, p_body text, p_reply_to text, p_attachments jsonb) to anon; grant execute on function public.send_chat_message(p_id text, p_room text, p_body text, p_reply_to text, p_attachments jsonb) to authenticated; grant execute on function public.send_chat_message(p_id text, p_room text, p_body text, p_reply_to text, p_attachments jsonb) to service_role;

revoke all on function public.set_page_edited_by() from public, anon, authenticated, service_role; grant execute on function public.set_page_edited_by() to public; grant execute on function public.set_page_edited_by() to anon; grant execute on function public.set_page_edited_by() to authenticated; grant execute on function public.set_page_edited_by() to service_role;

revoke all on function public.set_page_published(p_id text, p_published boolean, p_subpages boolean) from public, anon, authenticated, service_role; grant execute on function public.set_page_published(p_id text, p_published boolean, p_subpages boolean) to public; grant execute on function public.set_page_published(p_id text, p_published boolean, p_subpages boolean) to anon; grant execute on function public.set_page_published(p_id text, p_published boolean, p_subpages boolean) to authenticated; grant execute on function public.set_page_published(p_id text, p_published boolean, p_subpages boolean) to service_role;

revoke all on function public.set_page_teamspace_id() from public, anon, authenticated, service_role; grant execute on function public.set_page_teamspace_id() to public; grant execute on function public.set_page_teamspace_id() to anon; grant execute on function public.set_page_teamspace_id() to authenticated; grant execute on function public.set_page_teamspace_id() to service_role;

revoke all on function public.set_room_showcase(p_room text, p_page text) from public, anon, authenticated, service_role; grant execute on function public.set_room_showcase(p_room text, p_page text) to anon; grant execute on function public.set_room_showcase(p_room text, p_page text) to authenticated; grant execute on function public.set_room_showcase(p_room text, p_page text) to service_role;

revoke all on function public.set_teamspace_defaults() from public, anon, authenticated, service_role; grant execute on function public.set_teamspace_defaults() to public; grant execute on function public.set_teamspace_defaults() to anon; grant execute on function public.set_teamspace_defaults() to authenticated; grant execute on function public.set_teamspace_defaults() to service_role;

revoke all on function public.set_teamspace_owner(p_ts text, p_person text, p_owner boolean) from public, anon, authenticated, service_role; grant execute on function public.set_teamspace_owner(p_ts text, p_person text, p_owner boolean) to public; grant execute on function public.set_teamspace_owner(p_ts text, p_person text, p_owner boolean) to anon; grant execute on function public.set_teamspace_owner(p_ts text, p_person text, p_owner boolean) to authenticated; grant execute on function public.set_teamspace_owner(p_ts text, p_person text, p_owner boolean) to service_role;

revoke all on function public.set_teamspace_pin(ts_id text, page_id text, pinned boolean) from public, anon, authenticated, service_role; grant execute on function public.set_teamspace_pin(ts_id text, page_id text, pinned boolean) to public; grant execute on function public.set_teamspace_pin(ts_id text, page_id text, pinned boolean) to anon; grant execute on function public.set_teamspace_pin(ts_id text, page_id text, pinned boolean) to authenticated; grant execute on function public.set_teamspace_pin(ts_id text, page_id text, pinned boolean) to service_role;

revoke all on function public.set_workspace_invite_link_enabled(ws text, p_enabled boolean) from public, anon, authenticated, service_role; grant execute on function public.set_workspace_invite_link_enabled(ws text, p_enabled boolean) to public; grant execute on function public.set_workspace_invite_link_enabled(ws text, p_enabled boolean) to anon; grant execute on function public.set_workspace_invite_link_enabled(ws text, p_enabled boolean) to authenticated; grant execute on function public.set_workspace_invite_link_enabled(ws text, p_enabled boolean) to service_role;

revoke all on function public.set_workspace_member_role(ws text, person text, new_role text) from public, anon, authenticated, service_role; grant execute on function public.set_workspace_member_role(ws text, person text, new_role text) to public; grant execute on function public.set_workspace_member_role(ws text, person text, new_role text) to anon; grant execute on function public.set_workspace_member_role(ws text, person text, new_role text) to authenticated; grant execute on function public.set_workspace_member_role(ws text, person text, new_role text) to service_role;

revoke all on function public.start_study_session(p_room text, p_focus integer, p_break integer, p_rounds integer) from public, anon, authenticated, service_role; grant execute on function public.start_study_session(p_room text, p_focus integer, p_break integer, p_rounds integer) to public; grant execute on function public.start_study_session(p_room text, p_focus integer, p_break integer, p_rounds integer) to anon; grant execute on function public.start_study_session(p_room text, p_focus integer, p_break integer, p_rounds integer) to authenticated; grant execute on function public.start_study_session(p_room text, p_focus integer, p_break integer, p_rounds integer) to service_role;

revoke all on function public.stop_study_session(p_session text) from public, anon, authenticated, service_role; grant execute on function public.stop_study_session(p_session text) to public; grant execute on function public.stop_study_session(p_session text) to anon; grant execute on function public.stop_study_session(p_session text) to authenticated; grant execute on function public.stop_study_session(p_session text) to service_role;

revoke all on function public.study_session_is_open(s public.chat_study_sessions) from public, anon, authenticated, service_role; grant execute on function public.study_session_is_open(s public.chat_study_sessions) to public; grant execute on function public.study_session_is_open(s public.chat_study_sessions) to anon; grant execute on function public.study_session_is_open(s public.chat_study_sessions) to authenticated; grant execute on function public.study_session_is_open(s public.chat_study_sessions) to service_role;

revoke all on function public.study_session_total_ms(f integer, b integer, r integer) from public, anon, authenticated, service_role; grant execute on function public.study_session_total_ms(f integer, b integer, r integer) to public; grant execute on function public.study_session_total_ms(f integer, b integer, r integer) to anon; grant execute on function public.study_session_total_ms(f integer, b integer, r integer) to authenticated; grant execute on function public.study_session_total_ms(f integer, b integer, r integer) to service_role;

revoke all on function public.switch_workspace(target_ws_id text) from public, anon, authenticated, service_role; grant execute on function public.switch_workspace(target_ws_id text) to public; grant execute on function public.switch_workspace(target_ws_id text) to anon; grant execute on function public.switch_workspace(target_ws_id text) to authenticated; grant execute on function public.switch_workspace(target_ws_id text) to service_role;

revoke all on function public.teamspace_effective_members(ts_id text) from public, anon, authenticated, service_role; grant execute on function public.teamspace_effective_members(ts_id text) to public; grant execute on function public.teamspace_effective_members(ts_id text) to anon; grant execute on function public.teamspace_effective_members(ts_id text) to authenticated; grant execute on function public.teamspace_effective_members(ts_id text) to service_role;

revoke all on function public.teamspace_grants_access(ts_id text, page_ws_id text) from public, anon, authenticated, service_role; grant execute on function public.teamspace_grants_access(ts_id text, page_ws_id text) to public; grant execute on function public.teamspace_grants_access(ts_id text, page_ws_id text) to anon; grant execute on function public.teamspace_grants_access(ts_id text, page_ws_id text) to authenticated; grant execute on function public.teamspace_grants_access(ts_id text, page_ws_id text) to service_role;

revoke all on function public.teamspace_grants_access_to_page(pid text) from public, anon, authenticated, service_role; grant execute on function public.teamspace_grants_access_to_page(pid text) to public; grant execute on function public.teamspace_grants_access_to_page(pid text) to anon; grant execute on function public.teamspace_grants_access_to_page(pid text) to authenticated; grant execute on function public.teamspace_grants_access_to_page(pid text) to service_role;

revoke all on function public.workspace_people(ws text) from public, anon, authenticated, service_role; grant execute on function public.workspace_people(ws text) to public; grant execute on function public.workspace_people(ws text) to anon; grant execute on function public.workspace_people(ws text) to authenticated; grant execute on function public.workspace_people(ws text) to service_role;

revoke all on function public.workspace_role_of(ws text, person text) from public, anon, authenticated, service_role; grant execute on function public.workspace_role_of(ws text, person text) to public; grant execute on function public.workspace_role_of(ws text, person text) to anon; grant execute on function public.workspace_role_of(ws text, person text) to authenticated; grant execute on function public.workspace_role_of(ws text, person text) to service_role;

alter publication supabase_realtime add table public.chat_attachments;

alter publication supabase_realtime add table public.chat_messages;

alter publication supabase_realtime add table public.chat_reactions;

alter publication supabase_realtime add table public.chat_study_participants;

alter publication supabase_realtime add table public.chat_study_sessions;

alter publication supabase_realtime add table public.notifications;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('chat-attachments', 'chat-attachments', 'f', 26214400, null) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('uploads', 'uploads', 't', 26214400, null) on conflict (id) do nothing;


-- ── Seed data ─────────────────────────────────────────────────────────────
-- Plan tiers (from migration 009).
insert into public.plan_limits (plan, max_members, max_teamspaces, max_workspaces, version_history)
values
  ('free', 20,   2,    4,    false),
  ('pro',  null, null, null, true)
on conflict (plan) do nothing;

-- The first person to sign up becomes the owner of this workspace
-- (see public.handle_new_user). Everyone after gets a workspace of their own.
insert into public.workspaces (id, name)
values ('workspace_default', 'My Workspace')
on conflict (id) do nothing;
