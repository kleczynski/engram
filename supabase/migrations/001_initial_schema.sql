-- Engram initial schema
-- Notion is the content source of truth; this schema stores the derived graph.

create extension if not exists vector with schema extensions;

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique not null,
  title text not null,
  content_hash text,
  relation_hash text,
  parent_notion_id text,
  hub_score float default 1.0,
  lucid_url text,
  notion_url text,
  last_edited_time timestamptz,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  source_page_id uuid references pages(id) on delete cascade,
  target_page_id uuid references pages(id) on delete cascade,
  edge_type text not null check (edge_type in ('hierarchy', 'relation', 'ai_suggested', 'ai_approved')),
  created_at timestamptz default now(),
  unique(source_page_id, target_page_id, edge_type)
);

create table if not exists embeddings (
  page_id uuid primary key references pages(id) on delete cascade,
  embedding extensions.vector(1536),
  updated_at timestamptz default now()
);

create table if not exists link_suggestions (
  id uuid primary key default gen_random_uuid(),
  from_page_id uuid references pages(id) on delete cascade,
  to_page_id uuid references pages(id) on delete cascade,
  confidence float,
  reason text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create table if not exists rejected_links (
  from_page_id uuid references pages(id) on delete cascade,
  to_page_id uuid references pages(id) on delete cascade,
  rejected_at timestamptz default now(),
  primary key (from_page_id, to_page_id)
);

create table if not exists sync_log (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz default now(),
  pages_added int default 0,
  pages_changed int default 0
);

-- Foreign-key and lookup indexes (Postgres does not create these automatically).
create index if not exists pages_parent_notion_id_idx on pages (parent_notion_id);
create index if not exists edges_source_page_id_idx on edges (source_page_id);
create index if not exists edges_target_page_id_idx on edges (target_page_id);
create index if not exists edges_edge_type_idx on edges (edge_type);
create index if not exists link_suggestions_from_page_id_idx on link_suggestions (from_page_id);
create index if not exists link_suggestions_to_page_id_idx on link_suggestions (to_page_id);
create index if not exists link_suggestions_status_idx on link_suggestions (status);
create index if not exists rejected_links_to_page_id_idx on rejected_links (to_page_id);

-- Writes happen server-side with the service role key, which bypasses RLS.
-- Signed-in users get read-only access; anon gets nothing.
alter table pages enable row level security;
alter table edges enable row level security;
alter table embeddings enable row level security;
alter table link_suggestions enable row level security;
alter table rejected_links enable row level security;
alter table sync_log enable row level security;

create policy "pages_select_authenticated" on pages
  for select to authenticated using (true);

create policy "edges_select_authenticated" on edges
  for select to authenticated using (true);

create policy "embeddings_select_authenticated" on embeddings
  for select to authenticated using (true);

create policy "link_suggestions_select_authenticated" on link_suggestions
  for select to authenticated using (true);

create policy "rejected_links_select_authenticated" on rejected_links
  for select to authenticated using (true);

create policy "sync_log_select_authenticated" on sync_log
  for select to authenticated using (true);
