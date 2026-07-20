-- Ações e Clientes do Romsales (src/lib/pro/actions.ts, src/lib/pro/data-plane.ts) filtram
-- client_services por lower(professional_name) a cada carregamento das telas — sem índice,
-- isso é sequential scan crescendo com o histórico de serviços.
create index if not exists client_services_professional_name_idx
  on client_services (lower(professional_name))
  where active = true and professional_name is not null;
