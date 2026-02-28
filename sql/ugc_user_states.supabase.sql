-- Makerline / UGC Quest - user states (Supabase / Postgres)
-- Paste this SQL in Supabase "SQL Editor".

create table if not exists public.ugc_user_states (
  user_id text primary key,
  updated_at text not null,
  state jsonb not null
);

create index if not exists ugc_user_states_updated_at_idx on public.ugc_user_states(updated_at);

