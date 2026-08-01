-- Makerline / painel do tracker - atualizacoes semanais da equipe
-- Cole este SQL no "SQL Editor" do Supabase.

create table if not exists public.team_updates (
  id text primary key,
  author_email text not null,
  author_name text not null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_updates_created_at_idx
  on public.team_updates (created_at desc);

alter table public.team_updates enable row level security;

grant select, insert, update, delete on public.team_updates to anon;
grant select, insert, update, delete on public.team_updates to authenticated;

drop policy if exists team_updates_backend_all on public.team_updates;
create policy team_updates_backend_all
  on public.team_updates
  for all
  to anon, authenticated
  using (true)
  with check (true);
