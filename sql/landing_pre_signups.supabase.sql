-- Makerline landing / pre-cadastros
-- Tabela limpa para operacao: um nome, um WhatsApp, um Instagram.
-- Campos tecnicos/normalizados ficam dentro de payload.

create table if not exists public.landing_pre_signups (
  id text primary key,
  name text not null,
  whatsapp text not null,
  instagram text not null,
  lead_status text not null default 'new',
  is_test boolean not null default false,
  source text not null default 'landing',
  origin_label text,
  referral_code text,
  partner_code text,
  partner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

-- Migra tabela criada na versao anterior, removendo duplicidades visuais.
delete from public.landing_pre_signups
where is_test = true
   or name ilike 'Teste %'
   or instagram ilike '@teste_%'
   or instagram ilike '@testeml_%'
   or id like 'rls_probe_%';

drop index if exists public.landing_pre_signups_instagram_handle_idx;
drop index if exists public.landing_pre_signups_whatsapp_digits_idx;

alter table public.landing_pre_signups
  alter column name set not null,
  alter column whatsapp set not null,
  alter column instagram set not null;

alter table public.landing_pre_signups
  drop column if exists whatsapp_digits,
  drop column if exists phone,
  drop column if exists phone_digits,
  drop column if exists instagram_handle,
  drop column if exists instagram_url;

create index if not exists landing_pre_signups_instagram_idx
  on public.landing_pre_signups (instagram);

create index if not exists landing_pre_signups_created_at_idx
  on public.landing_pre_signups (created_at desc);

create index if not exists landing_pre_signups_referral_code_idx
  on public.landing_pre_signups (referral_code);

create index if not exists landing_pre_signups_partner_code_idx
  on public.landing_pre_signups (partner_code);

alter table public.landing_pre_signups enable row level security;

grant select, insert, update, delete on public.landing_pre_signups to anon;
grant select, insert, update, delete on public.landing_pre_signups to authenticated;

drop policy if exists landing_pre_signups_backend_insert on public.landing_pre_signups;
create policy landing_pre_signups_backend_insert
  on public.landing_pre_signups
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists landing_pre_signups_backend_update on public.landing_pre_signups;
create policy landing_pre_signups_backend_update
  on public.landing_pre_signups
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists landing_pre_signups_backend_select on public.landing_pre_signups;
create policy landing_pre_signups_backend_select
  on public.landing_pre_signups
  for select
  to anon, authenticated
  using (true);

drop policy if exists landing_pre_signups_backend_select_tests on public.landing_pre_signups;

drop policy if exists landing_pre_signups_backend_delete_tests on public.landing_pre_signups;
create policy landing_pre_signups_backend_delete_tests
  on public.landing_pre_signups
  for delete
  to anon, authenticated
  using (is_test = true);
