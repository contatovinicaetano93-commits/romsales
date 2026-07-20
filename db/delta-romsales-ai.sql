-- Uso diário da IA do Assistente (plano Free).

alter table romsales_pro_profiles
  add column if not exists ai_used_today integer not null default 0,
  add column if not exists ai_quota_day date;
