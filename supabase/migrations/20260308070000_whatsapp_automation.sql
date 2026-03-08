create extension if not exists pgcrypto;

alter table public.users
  add column if not exists phone text;

create unique index if not exists users_phone_unique_idx
  on public.users (phone)
  where phone is not null;

alter table public.transactions
  add column if not exists source text default 'manual',
  add column if not exists origin_message_id uuid,
  add column if not exists confidence numeric(5,4),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.incoming_messages (
  id uuid primary key default gen_random_uuid(),
  user_id bigint references public.users(id) on delete set null,
  phone text not null,
  provider_message_id text,
  message_text text not null,
  raw_payload jsonb,
  source text not null default 'whatsapp',
  processing_status text not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists incoming_messages_provider_message_id_uidx
  on public.incoming_messages (provider_message_id)
  where provider_message_id is not null;

create index if not exists incoming_messages_user_id_idx
  on public.incoming_messages (user_id, created_at desc);

create table if not exists public.message_interpretations (
  id uuid primary key default gen_random_uuid(),
  incoming_message_id uuid not null references public.incoming_messages(id) on delete cascade,
  detected_type text,
  detected_amount numeric(12,2),
  detected_category text,
  detected_description text,
  detected_date date,
  confidence numeric(5,4),
  used_ai boolean not null default false,
  raw_ai_output jsonb,
  decision_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_interpretations_incoming_message_id_idx
  on public.message_interpretations (incoming_message_id, created_at desc);

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  user_id bigint references public.users(id) on delete set null,
  incoming_message_id uuid references public.incoming_messages(id) on delete set null,
  phone text not null,
  message_text text not null,
  provider_message_id text,
  delivery_status text not null default 'queued',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists outbound_messages_user_id_idx
  on public.outbound_messages (user_id, created_at desc);

create table if not exists public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  context text not null,
  level text not null default 'info',
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_logs_context_created_at_idx
  on public.integration_logs (context, created_at desc);
