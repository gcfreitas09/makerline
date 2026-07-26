-- Makerline - inscricoes de notificacao push (Web Push / VAPID)
-- Cole este SQL no "SQL Editor" do Supabase.

create table if not exists public.push_subscriptions (
  id text primary key,
  user_id text not null,
  user_email text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  -- preferencias por tipo de aviso
  notify_deadlines boolean not null default true,
  notify_payments boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_service" on public.push_subscriptions;
create policy "push_subscriptions_service"
  on public.push_subscriptions
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Registro do que ja foi enviado, pra nao notificar a mesma coisa duas vezes.
create table if not exists public.push_sent_log (
  id text primary key,
  user_id text not null,
  dedupe_key text not null,
  sent_at timestamptz not null default now()
);

create unique index if not exists push_sent_log_dedupe_idx on public.push_sent_log (user_id, dedupe_key);

alter table public.push_sent_log enable row level security;

drop policy if exists "push_sent_log_service" on public.push_sent_log;
create policy "push_sent_log_service"
  on public.push_sent_log
  for all
  to anon, authenticated
  using (true)
  with check (true);
