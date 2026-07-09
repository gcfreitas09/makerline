-- Makerline landing / eventos do tracker (views, cliques, formulario, leads)
-- Guarda cada evento bruto do tracker da landing. O payload completo fica em
-- jsonb; algumas colunas ficam soltas so para permitir filtro/index rapido.
-- Isso substitui storage/landing_insights.json como fonte de verdade, que
-- se perdia toda vez que o servidor era redeployado (arquivo nao versionado
-- de proposito, por conter apenas dado de analytics, nao segredo).

create table if not exists public.landing_insights_events (
  id text primary key,
  event_name text not null,
  visitor_id text,
  session_id text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists landing_insights_events_created_at_idx
  on public.landing_insights_events (created_at desc);

create index if not exists landing_insights_events_event_name_idx
  on public.landing_insights_events (event_name);

create index if not exists landing_insights_events_visitor_id_idx
  on public.landing_insights_events (visitor_id);

create index if not exists landing_insights_events_is_test_idx
  on public.landing_insights_events (is_test);

alter table public.landing_insights_events enable row level security;

grant select, insert, update, delete on public.landing_insights_events to anon;
grant select, insert, update, delete on public.landing_insights_events to authenticated;

drop policy if exists landing_insights_events_backend_insert on public.landing_insights_events;
create policy landing_insights_events_backend_insert
  on public.landing_insights_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists landing_insights_events_backend_update on public.landing_insights_events;
create policy landing_insights_events_backend_update
  on public.landing_insights_events
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists landing_insights_events_backend_select on public.landing_insights_events;
create policy landing_insights_events_backend_select
  on public.landing_insights_events
  for select
  to anon, authenticated
  using (true);

drop policy if exists landing_insights_events_backend_delete_tests on public.landing_insights_events;
create policy landing_insights_events_backend_delete_tests
  on public.landing_insights_events
  for delete
  to anon, authenticated
  using (is_test = true);
