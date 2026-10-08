-- 043: fix sign-up for everyone after the first person.
--
-- Since 041, handle_new_user created the new person's workspace with
-- owner_id already set, before that person's people row existed. owner_id
-- references people(id), so the insert failed and Supabase answered every
-- new sign-up (except the very first one) with "Database error saving new
-- user".
--
-- Now: create the workspace without an owner, then the person, then the
-- membership, then set the owner. Otherwise the same as 041.
-- Idempotent.

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

    -- 1. The workspace, without an owner yet (the person doesn't exist).
    insert into public.workspaces (id, name)
    values (new_ws_id, display || '''s Space');

    -- 2. The person, in that workspace.
    insert into public.people (id, workspace_id, name, email, avatar_url, role)
    values (
      new.id::text, new_ws_id, display, new.email,
      new.raw_user_meta_data ->> 'avatar_url', 'owner'
    )
    on conflict (id) do nothing;

    -- 3. Their membership, then ownership, now that the person exists.
    insert into public.workspace_members (workspace_id, person_id, role)
    values (new_ws_id, new.id::text, 'owner')
    on conflict (workspace_id, person_id) do nothing;

    update public.workspaces
    set owner_id = new.id::text
    where id = new_ws_id;
  end if;

  return new;
end;
$$;
