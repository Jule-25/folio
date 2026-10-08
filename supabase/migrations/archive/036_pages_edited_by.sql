-- 036: who last edited a page (the "Edited by" database property).
--
-- The column is set by a trigger, never by the client: on insert, and on
-- updates that change what a person sees (title, cell values, cover,
-- settings, content), it takes the signed-in user. Updates made without a
-- user (the collaboration server, other triggers like the teamspace
-- propagation) leave it as it was.

alter table public.pages
  add column if not exists edited_by text
    references public.people(id) on delete set null;

-- Existing pages: the owner is the best guess.
update public.pages
set edited_by = owner_id
where edited_by is null
  and owner_id is not null
  and exists (select 1 from public.people where id = owner_id);

create or replace function public.set_page_edited_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists trg_set_page_edited_by on public.pages;
create trigger trg_set_page_edited_by
  before insert or update of title, "values", cover, settings, content
  on public.pages
  for each row
  execute function public.set_page_edited_by();
