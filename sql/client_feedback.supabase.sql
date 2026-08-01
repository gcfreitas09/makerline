create table if not exists public.client_feedback (
  id text primary key,
  user_email text not null,
  user_name text not null,
  message text not null,
  page text,
  images jsonb,
  created_at timestamptz not null default now()
);

alter table public.client_feedback add column if not exists images jsonb;

create index if not exists client_feedback_created_at_idx on public.client_feedback (created_at desc);

alter table public.client_feedback enable row level security;

grant select, insert, update, delete on public.client_feedback to anon;
grant select, insert, update, delete on public.client_feedback to authenticated;

drop policy if exists client_feedback_backend_all on public.client_feedback;
create policy client_feedback_backend_all on public.client_feedback for all to anon, authenticated using (true) with check (true);
