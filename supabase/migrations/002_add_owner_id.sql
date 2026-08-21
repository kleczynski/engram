-- Add owner_id to pages and edges for future multi-user support.
-- Nullable by design — no NOT NULL constraint yet.

alter table pages
  add column if not exists owner_id uuid references auth.users default auth.uid();

alter table edges
  add column if not exists owner_id uuid references auth.users default auth.uid();

-- Backfill existing rows with the current sole owner.
update pages set owner_id = '6e75af6a-3e6c-48af-a7a6-fb70ed7a764a' where owner_id is null;
update edges set owner_id = '6e75af6a-3e6c-48af-a7a6-fb70ed7a764a' where owner_id is null;
