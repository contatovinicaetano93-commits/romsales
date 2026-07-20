-- Hardening: nome de agenda único por unidade (quando conectado).

create unique index if not exists romsales_pro_profiles_panel_name_uniq
  on romsales_pro_profiles (panel, lower(professional_name))
  where professional_name is not null;
