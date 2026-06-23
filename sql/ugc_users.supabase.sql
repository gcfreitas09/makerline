-- Makerline / UGC Quest - tabela de usuários (Supabase / Postgres)
-- Cole este SQL no "SQL Editor" do Supabase.

create table if not exists public.ugc_users (
  id text primary key,
  name text not null,
  email text not null unique,
<<<<<<< HEAD
  instagram text null,
  referral_code text null,
  referred_by text null,
=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
  password text not null,
  created_at text not null,

  weekly_summary boolean not null default false,

  access_count integer not null default 0,
  time_spent_seconds integer not null default 0,

  last_login_at text null,
  last_seen_at text null,
  last_access_at text null,

<<<<<<< HEAD
  stripe_customer_id text null,
  stripe_subscription_id text null,
  stripe_price_id text null,
  stripe_product_id text null,
  billing_status text null,
  billing_interval text null,
  billing_current_period_end text null,
  billing_cancel_at_period_end boolean not null default false,
  billing_last_event_id text null,
  billing_last_synced_at text null,

  cpf_hash text null unique,
  cpf_last4 text null,
  trial_started_at text null,
  trial_ends_at text null,

=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
  session_token_hash text null,
  session_token_expires bigint null,

  reset_token_hash text null,
  reset_token_expires bigint null,

  reset_code_hash text null,
  reset_code_expires bigint null
);

<<<<<<< HEAD
alter table if exists public.ugc_users add column if not exists referral_code text null;
alter table if exists public.ugc_users add column if not exists instagram text null;
alter table if exists public.ugc_users add column if not exists referred_by text null;
alter table if exists public.ugc_users add column if not exists stripe_customer_id text null;
alter table if exists public.ugc_users add column if not exists stripe_subscription_id text null;
alter table if exists public.ugc_users add column if not exists stripe_price_id text null;
alter table if exists public.ugc_users add column if not exists stripe_product_id text null;
alter table if exists public.ugc_users add column if not exists billing_status text null;
alter table if exists public.ugc_users add column if not exists billing_interval text null;
alter table if exists public.ugc_users add column if not exists billing_current_period_end text null;
alter table if exists public.ugc_users add column if not exists billing_cancel_at_period_end boolean not null default false;
alter table if exists public.ugc_users add column if not exists billing_last_event_id text null;
alter table if exists public.ugc_users add column if not exists billing_last_synced_at text null;
alter table if exists public.ugc_users add column if not exists cpf_hash text null;
alter table if exists public.ugc_users add column if not exists cpf_last4 text null;
alter table if exists public.ugc_users add column if not exists trial_started_at text null;
alter table if exists public.ugc_users add column if not exists trial_ends_at text null;

create unique index if not exists ugc_users_cpf_hash_uidx on public.ugc_users(cpf_hash) where cpf_hash is not null;
create unique index if not exists ugc_users_instagram_uidx on public.ugc_users(instagram) where instagram is not null;

-- Dica:
-- - Se você for usar a "service_role_key" no backend (PHP), não precisa mexer em RLS.
-- - Se quiser usar anon key + RLS, aí precisa criar policies (não recomendo pro MVP agora).
=======
-- Dica:
-- - Se você for usar a "service_role_key" no backend (PHP), não precisa mexer em RLS.
-- - Se quiser usar anon key + RLS, aí precisa criar policies (não recomendo pro MVP agora).

>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
