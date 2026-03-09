alter table if exists public.transactions
add column if not exists financial_scope text not null default 'pf';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'transactions_financial_scope_check'
    ) then
        alter table public.transactions
        add constraint transactions_financial_scope_check
        check (financial_scope in ('pf', 'pj'));
    end if;
end $$;

create index if not exists transactions_user_scope_date_idx
on public.transactions (user_id, financial_scope, date desc);

create table if not exists public.business_profiles (
    id bigserial primary key,
    user_id bigint not null references public.users(id) on delete cascade,
    company_name text not null,
    trade_name text,
    cnpj text,
    tax_regime text,
    business_email text,
    business_phone text,
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (user_id)
);

create index if not exists business_profiles_user_id_idx
on public.business_profiles (user_id);
