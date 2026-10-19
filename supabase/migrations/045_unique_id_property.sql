-- 045: the Unique ID property (#161). Every row of a database gets a number
-- for each "unique_id" property, handed out HERE, so two people adding rows
-- at the same moment never get the same one:
--
--   • a new row takes the next number — data_sources.unique_id_counters
--     keeps the last one given, per property;
--   • a row keeps its number for good: an update can't change or drop it
--     (a client writing a row's values from a stale copy can't lose it);
--   • adding the property, or changing a property into it, numbers the rows
--     already there, oldest first.
--
-- Numbers are never reused: deleting a row leaves a gap. Template pages are
-- not rows and get no number. A copied database numbers its own rows from 1.
-- The prefix ("TASK" → TASK-12) is the property's and only added on display.
-- Idempotent.

alter table public.data_sources
  add column if not exists unique_id_counters jsonb default '{}'::jsonb not null;

-- ── Rows: a number on insert, kept on update ────────────────────────────────
create or replace function public.assign_page_unique_ids()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  props jsonb;
  counters jsonb;
  prop jsonb;
  pid text;
  n bigint;
  locked boolean := false;
begin
  -- The numbering in number_unique_id_rows() sets the values itself: let it
  -- through, and keep "last edited by" as it was (numbering isn't an edit;
  -- trg_set_page_edited_by runs before this trigger).
  if coalesce(current_setting('folio.unique_id_internal', true), '') = 'on' then
    if tg_op = 'UPDATE' then
      new.edited_by := old.edited_by;
    end if;
    return new;
  end if;

  if new.source_id is null or new.category = 'Template' then
    return new;
  end if;

  select ds.properties into props
  from public.data_sources ds
  where ds.id = new.source_id;

  if props is null then
    return new;
  end if;

  for prop in select value from jsonb_array_elements(props) loop
    continue when prop->'config'->>'type' is distinct from 'unique_id';
    pid := prop->>'id';

    -- A row that has its number keeps it.
    if tg_op = 'UPDATE'
       and old.source_id is not distinct from new.source_id
       and jsonb_typeof(old."values"->pid) = 'number' then
      new."values" := jsonb_set(
        coalesce(new."values", '{}'::jsonb), array[pid], old."values"->pid
      );
      continue;
    end if;

    -- Otherwise (a new row, a copy, a row that just joined): the next one.
    -- The lock makes concurrent inserts take turns.
    if not locked then
      select ds.unique_id_counters into counters
      from public.data_sources ds
      where ds.id = new.source_id
      for update;
      locked := true;
    end if;

    n := coalesce((counters->>pid)::bigint, 0) + 1;
    counters := jsonb_set(coalesce(counters, '{}'::jsonb), array[pid], to_jsonb(n));
    new."values" := jsonb_set(
      coalesce(new."values", '{}'::jsonb), array[pid], to_jsonb(n)
    );
  end loop;

  if locked then
    perform set_config('folio.unique_id_internal', 'on', true);
    update public.data_sources
      set unique_id_counters = counters
      where id = new.source_id;
    perform set_config('folio.unique_id_internal', 'off', true);
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_unique_id_on_page on public.pages;
create trigger trg_unique_id_on_page
  before insert or update of "values", source_id, category on public.pages
  for each row execute function public.assign_page_unique_ids();

-- ── Databases: number the existing rows when the property appears ───────────
create or replace function public.number_unique_id_rows()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  counters jsonb;
  ids text[];
  pid text;
  n bigint;
begin
  if tg_op = 'INSERT' then
    -- A copied database starts its own count; its rows are numbered as
    -- they're inserted.
    new.unique_id_counters := '{}'::jsonb;
    return new;
  end if;

  -- The counters' own update, from assign_page_unique_ids().
  if coalesce(current_setting('folio.unique_id_internal', true), '') = 'on' then
    return new;
  end if;

  -- Clients never write the counters, even when they send the whole row.
  counters := coalesce(old.unique_id_counters, '{}'::jsonb);

  if new.properties is distinct from old.properties then
    select coalesce(array_agg(p->>'id'), '{}')
      into ids
      from jsonb_array_elements(new.properties) p
      where p->'config'->>'type' = 'unique_id';

    -- Forget properties that are gone or no longer IDs: if one becomes an ID
    -- again, its rows are numbered afresh.
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into counters
      from jsonb_each(counters)
      where key = any(ids);

    foreach pid in array ids loop
      continue when counters ? pid;

      perform set_config('folio.unique_id_internal', 'on', true);
      with numbered as (
        select pg.id, row_number() over (order by pg.created_at, pg.id) as num
        from public.pages pg
        where pg.source_id = new.id and pg.category <> 'Template'
      )
      update public.pages pg
        set "values" = jsonb_set(
          coalesce(pg."values", '{}'::jsonb), array[pid], to_jsonb(numbered.num)
        )
        from numbered
        where pg.id = numbered.id;
      get diagnostics n = row_count;
      perform set_config('folio.unique_id_internal', 'off', true);

      counters := jsonb_set(counters, array[pid], to_jsonb(n));
    end loop;
  end if;

  new.unique_id_counters := counters;
  return new;
end;
$function$;

drop trigger if exists trg_number_unique_id_rows on public.data_sources;
create trigger trg_number_unique_id_rows
  before insert or update on public.data_sources
  for each row execute function public.number_unique_id_rows();
