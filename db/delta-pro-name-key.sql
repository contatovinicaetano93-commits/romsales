-- Chave de conferência (normalizeProKey) — claim único sem colisão José/Jose.
alter table romsales_pro_profiles add column if not exists professional_name_key text;

create unique index if not exists romsales_pro_profiles_panel_name_key_uniq
  on romsales_pro_profiles (panel, professional_name_key)
  where professional_name_key is not null;

-- Backfill a partir do nome canônico já salvo.
update romsales_pro_profiles
set professional_name_key = lower(
  regexp_replace(
    regexp_replace(
      translate(
        professional_name,
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      ),
      '[^a-zA-Z0-9]+',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  )
)
where professional_name is not null
  and professional_name_key is null;
