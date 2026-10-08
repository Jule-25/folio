-- Suggested edits on inline comment threads.
-- A suggestion thread carries { original, text, state } where state is
-- 'pending' | 'accepted' | 'rejected'. Plain comment threads leave it null.
alter table public.threads
  add column if not exists suggestion jsonb;

alter table public.threads
  drop constraint if exists threads_suggestion_shape;

alter table public.threads
  add constraint threads_suggestion_shape check (
    suggestion is null
    or (
      jsonb_typeof(suggestion) = 'object'
      and jsonb_typeof(suggestion -> 'original') = 'string'
      and jsonb_typeof(suggestion -> 'text') = 'string'
      and suggestion ->> 'state' in ('pending', 'accepted', 'rejected')
    )
  );