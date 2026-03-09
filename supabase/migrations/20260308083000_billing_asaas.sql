create extension if not exists pgcrypto;

alter table public.users
    add column if not exists billing_exempt boolean not null default false,
    add column if not exists billing_provider text,
    add column if not exists asaas_customer_id text,
    add column if not exists subscription_status text not null default 'inactive',
    add column if not exists subscription_plan_code text,
    add column if not exists subscription_payment_method text,
    add column if not exists subscription_id text,
    add column if not exists subscription_next_due_date date,
    add column if not exists billing_last_payment_at timestamptz,
    add column if not exists billing_last_event_at timestamptz,
    add column if not exists updated_at timestamptz default now();

create table if not exists public.subscription_plans (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    description text,
    amount numeric(12,2) not null,
    currency text not null default 'BRL',
    interval text not null default 'month',
    interval_count integer not null default 1,
    active boolean not null default true,
    provider text not null default 'asaas',
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null references public.users(id) on delete cascade,
    provider text not null,
    provider_customer_id text,
    provider_subscription_id text,
    plan_code text not null,
    status text not null default 'pending',
    payment_method text not null,
    checkout_url text,
    invoice_url text,
    pix_payload text,
    pix_encoded_image text,
    current_period_start timestamptz,
    current_period_end timestamptz,
    next_due_date date,
    last_payment_id text,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_billing_subscriptions_user_id on public.billing_subscriptions(user_id, created_at desc);
create index if not exists idx_billing_subscriptions_provider_subscription_id on public.billing_subscriptions(provider_subscription_id);

create table if not exists public.billing_payments (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null references public.users(id) on delete cascade,
    billing_subscription_id uuid references public.billing_subscriptions(id) on delete set null,
    provider text not null,
    provider_payment_id text not null,
    provider_subscription_id text,
    status text not null,
    amount numeric(12,2) not null default 0,
    billing_type text,
    due_date date,
    paid_at timestamptz,
    invoice_url text,
    pix_payload text,
    pix_encoded_image text,
    raw_payload jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idx_billing_payments_provider_payment_id on public.billing_payments(provider_payment_id);
create index if not exists idx_billing_payments_user_id on public.billing_payments(user_id, created_at desc);

create table if not exists public.billing_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    provider_event_id text,
    event_type text not null,
    user_id bigint references public.users(id) on delete set null,
    provider_subscription_id text,
    provider_payment_id text,
    payload jsonb,
    processed boolean not null default false,
    created_at timestamptz not null default now()
);

create unique index if not exists idx_billing_events_provider_event_id on public.billing_events(provider_event_id) where provider_event_id is not null;

insert into public.subscription_plans (code, name, description, amount, currency, interval, interval_count, active, provider, metadata)
values (
    'pro_monthly',
    'Plano Pro Mensal',
    'Acesso mensal ao Horizonte Financeiro com cobrança recorrente.',
    29.90,
    'BRL',
    'month',
    1,
    true,
    'asaas',
    jsonb_build_object('recommended', true)
)
on conflict (code) do update
set
    name = excluded.name,
    description = excluded.description,
    amount = excluded.amount,
    currency = excluded.currency,
    interval = excluded.interval,
    interval_count = excluded.interval_count,
    active = excluded.active,
    provider = excluded.provider,
    metadata = excluded.metadata,
    updated_at = now();

update public.users
set billing_exempt = true,
    subscription_status = 'active',
    subscription_plan_code = coalesce(subscription_plan_code, 'super_admin_free')
where role = 'super_admin';
