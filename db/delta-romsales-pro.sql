-- Romsales — app do profissional (auth própria, independente da equipe).
-- Um usuário = um profissional; dados filtrados pela agenda/nome Avec.

create table if not exists romsales_pro_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  created_at timestamptz not null default now(),
  constraint romsales_pro_users_email_uniq unique (email)
);

create index if not exists romsales_pro_users_email_idx
  on romsales_pro_users (lower(email));

create table if not exists romsales_pro_profiles (
  user_id uuid primary key references romsales_pro_users (id) on delete cascade,
  -- Nome canônico na Avec / roster da unidade (match por nome).
  professional_name text,
  panel text not null default 'brasil'
    check (panel in ('brasil', 'iguatemi')),
  telegram_chat_id text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists romsales_pro_profiles_professional_idx
  on romsales_pro_profiles (lower(professional_name))
  where professional_name is not null;
