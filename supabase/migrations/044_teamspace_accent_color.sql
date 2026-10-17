   -- 044: a teamspace can have its own colour. Null = automatic (its icon's
   -- colour, else a colour from its id). Owners set it through the existing
   -- teamspaces_update policy. Idempotent.
   alter table public.teamspaces
     add column if not exists accent_color text;