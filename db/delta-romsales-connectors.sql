-- Conectores do profissional (Agenda Avec, metas, Telegram, WhatsApp) — Free, sem Stripe.

alter table romsales_pro_profiles
  add column if not exists agenda_source text,
  add column if not exists avec_api_token text,
  add column if not exists avec_unit_id text,
  add column if not exists daily_goal numeric,
  add column if not exists weekly_goal numeric,
  add column if not exists goals_saved_at timestamptz,
  add column if not exists telegram_link_code text,
  add column if not exists wa_phone_number_id text,
  add column if not exists wa_access_token text,
  add column if not exists wa_display_number text;

-- Estado fresco: ninguém “já conectado” com agenda/meta de demo.
update romsales_pro_profiles
set
  professional_name = null,
  connected_at = null,
  agenda_source = null,
  avec_api_token = null,
  avec_unit_id = null,
  daily_goal = null,
  weekly_goal = null,
  goals_saved_at = null,
  telegram_link_code = null,
  telegram_chat_id = null,
  wa_phone_number_id = null,
  wa_access_token = null,
  wa_display_number = null,
  updated_at = now();
