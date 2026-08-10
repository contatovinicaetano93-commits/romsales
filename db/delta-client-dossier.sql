-- Dossiê do cliente (pro) — histórico append-only + uso de produto + anamnese.
-- client_services continua sendo o "último estado" por serviço; estas tabelas
-- guardam a linha do tempo que o profissional precisa na cadeira.

create table if not exists client_visits (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  avec_client_id text,
  avec_comanda_id text,
  service_name text not null,
  category text,
  professional_name text,
  price numeric(12, 2),
  done_at timestamptz not null,
  source text not null default 'avec',
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists client_visits_contact_done_idx
  on client_visits (contact_id, done_at desc);

create index if not exists client_visits_pro_done_idx
  on client_visits (professional_name, done_at desc)
  where professional_name is not null;

create unique index if not exists client_visits_dedupe_idx
  on client_visits (dedupe_key);

create table if not exists client_product_uses (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  avec_client_id text,
  avec_comanda_id text,
  product_name text not null,
  brand text,
  product_kind text,
  quantity numeric(12, 3),
  professional_name text,
  used_at timestamptz not null,
  kind text not null default 'consumo'
    check (kind in ('consumo', 'venda', 'outro')),
  source text not null default 'avec',
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists client_product_uses_contact_used_idx
  on client_product_uses (contact_id, used_at desc);

create unique index if not exists client_product_uses_dedupe_idx
  on client_product_uses (dedupe_key);

create table if not exists contact_clinical (
  contact_id uuid primary key references contacts (id) on delete cascade,
  anamnese jsonb not null default '{}'::jsonb,
  prontuario jsonb not null default '[]'::jsonb,
  source text not null default 'avec',
  updated_at timestamptz not null default now()
);
