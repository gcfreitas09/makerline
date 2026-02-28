-- Makerline / UGC Quest - tabela de usuários (Supabase / Postgres)
-- Cole este SQL no "SQL Editor" do Supabase.

create table if not exists public.ugc_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password text not null,
  created_at text not null,

  weekly_summary boolean not null default false,

  access_count integer not null default 0,
  time_spent_seconds integer not null default 0,

  last_login_at text null,
  last_seen_at text null,
  last_access_at text null,

  session_token_hash text null,
  session_token_expires bigint null,

  reset_token_hash text null,
  reset_token_expires bigint null,

  reset_code_hash text null,
  reset_code_expires bigint null
);

-- Dica:
-- - Se você for usar a "service_role_key" no backend (PHP), não precisa mexer em RLS.
-- - Se quiser usar anon key + RLS, aí precisa criar policies (não recomendo pro MVP agora).

