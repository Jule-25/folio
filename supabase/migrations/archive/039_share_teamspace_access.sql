-- ── Share: "Everyone in the teamspace" actually grants access ─────────────
-- The share panel offers general access "Everyone in the teamspace", and it
-- saved — but page_effective_role only handled 'workspace' and 'public', so
-- it granted nothing. This re-creates the function (identical to 022) with a
-- 'teamspace' branch: members of the page's teamspace get the chosen role.
-- Idempotent.

create or replace function public.page_effective_role(p_id text, person text)
returns public.page_role
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
$function$;
