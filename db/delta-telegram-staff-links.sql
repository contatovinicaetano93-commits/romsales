-- Bot Telegram de funcionários (@Brasilrombot) — vínculo chat_id ↔ profissional.
create table if not exists telegram_staff_links (
  chat_id text primary key,
  professional_name text not null,
  created_at timestamptz not null default now()
);

insert into telegram_staff_links (chat_id, professional_name)
values ('5508181160', 'VC')
on conflict (chat_id) do nothing;
