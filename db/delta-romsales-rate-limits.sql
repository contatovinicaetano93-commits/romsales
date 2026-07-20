-- Rate limit de login/registro do Romsales (Neon).

create table if not exists romsales_rate_limits (
  key text primary key,
  hits integer not null default 0,
  window_start timestamptz not null default now()
);
