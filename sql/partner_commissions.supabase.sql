-- Makerline / UGC Quest - parceiros, links e comissões (Supabase / Postgres)
-- Cole este SQL no "SQL Editor" do Supabase.

create table if not exists public.partner_affiliates (
  partner_code text primary key,
  partner_name text not null,
  partner_email text not null,
  commission_percent numeric(5,2) not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_referral_links (
  referral_code text primary key,
  partner_code text not null references public.partner_affiliates(partner_code) on update cascade,
  url_slug text not null unique,
  trial_days integer not null default 15,
  commission_percent numeric(5,2) not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_commissions (
  id text primary key,
  event_id text not null unique,
  invoice_id text null,
  subscription_id text null,
  customer_id text null,
  user_id text null,
  user_email text null,

  partner_code text not null references public.partner_affiliates(partner_code) on update cascade,
  referral_code text not null references public.partner_referral_links(referral_code) on update cascade,
  partner_name text not null,
  partner_email text not null,

  plan_code text null,
  billing_interval text null,
  price_id text null,
  product_id text null,

  amount_paid_cents integer not null,
  commission_percent numeric(5,2) not null,
  commission_amount_cents integer not null,
  currency text not null default 'brl',

  stripe_created_at timestamptz null,
  paid_at timestamptz not null default now(),
  payout_status text not null default 'pending',
  payout_month date not null default (date_trunc('month', now())::date),

  raw_invoice jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_commissions_invoice_uidx
  on public.partner_commissions(invoice_id)
  where invoice_id is not null;

create index if not exists partner_commissions_partner_month_idx
  on public.partner_commissions(partner_code, payout_month);

create index if not exists partner_commissions_referral_code_idx
  on public.partner_commissions(referral_code);

insert into public.partner_affiliates
  (partner_code, partner_name, partner_email, commission_percent, status)
values
  ('keilabragante', 'Keila Bragante', 'contatokeilabragante@gmail.com', 25, 'active')
on conflict (partner_code) do update set
  partner_name = excluded.partner_name,
  partner_email = excluded.partner_email,
  commission_percent = excluded.commission_percent,
  status = excluded.status,
  updated_at = now();

insert into public.partner_referral_links
  (referral_code, partner_code, url_slug, trial_days, commission_percent, status)
values
  ('keilabragante-1', 'keilabragante', 'KeilaBragante_1', 15, 25, 'active'),
  ('keilabragante-2', 'keilabragante', 'KeilaBragante_2', 30, 25, 'active')
on conflict (referral_code) do update set
  partner_code = excluded.partner_code,
  url_slug = excluded.url_slug,
  trial_days = excluded.trial_days,
  commission_percent = excluded.commission_percent,
  status = excluded.status,
  updated_at = now();

create or replace view public.partner_commissions_monthly as
select
  payout_month,
  partner_code,
  partner_name,
  partner_email,
  count(distinct user_id) as paying_clients,
  count(*) as paid_invoices,
  sum(amount_paid_cents) as gross_amount_cents,
  round(sum(amount_paid_cents)::numeric / 100, 2) as gross_amount_brl,
  sum(commission_amount_cents) as commission_amount_cents,
  round(sum(commission_amount_cents)::numeric / 100, 2) as commission_amount_brl,
  (sum(amount_paid_cents) - sum(commission_amount_cents)) as platform_net_amount_cents,
  round((sum(amount_paid_cents) - sum(commission_amount_cents))::numeric / 100, 2) as platform_net_amount_brl,
  min(paid_at) as first_payment_at,
  max(paid_at) as last_payment_at
from public.partner_commissions
where payout_status <> 'void'
group by payout_month, partner_code, partner_name, partner_email;

create or replace view public.keila_bragante_commissions_monthly as
select *
from public.partner_commissions_monthly
where partner_code = 'keilabragante';

delete from public.partner_referral_links
where partner_code = 'rickolavo'
   or referral_code = 'rickolavo';

delete from public.partner_affiliates
where partner_code = 'rickolavo';

drop view if exists public.rick_olavo_commissions_monthly;

-- Consulta rápida de fechamento mensal:
-- select * from public.partner_commissions_monthly order by payout_month desc, partner_name;
-- Use commission_amount_cents para o saldo dos parceiros.
-- Use platform_net_amount_cents como base separada para a divisao entre os socios.
