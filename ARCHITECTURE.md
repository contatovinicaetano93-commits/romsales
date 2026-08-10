# Romsales — arquitetura e gaps

## Intent

App **standalone** do profissional (modelo Vitrini/HairSales): URL, login e sessão próprios.
Não é rota dentro do painel da equipe (`rom-club` / `rom-iguatemi`).
O deploy Romsales é **pro-only** no boundary: superfície de equipe redireciona/404 antes de chegar nas páginas/APIs.

## Plano de dados atual

```
Avec UNIDADE:
  REST  AVEC_API_TOKEN  → api.avec.beauty/reports/*
  ou
  Lake  AVEC_LAKE_*     → Athena (avec_lake_db / workgroup avec_daas)
  → cron /api/avec/sync (+ webhook /api/webhooks/avec)
  → contacts / client_services / client_visits / client_product_uses
  → salon_p1_daily (KPIs)
  → src/lib/pro/data-plane.ts + dossier.ts (unit-sync)
  → Hoje / Assistente / Clientes (/api/pro/clientes/[id])
       filtrados por professional_name do perfil pro
```

Dossiê do cliente (última visita, prefs, produtos, anamnese): `docs/CLIENT_DOSSIER_SYNC.md`.

Lake (Athena) mapeia: clientes `0004`, reservas `0051`, cancelamentos `0052`, comandas
`0002`/`0031` (serviços), produtos em comanda `0246`, faturamento `0021`, top serviços `0032`,
revenue `0036`/`0020`. Modo `auto`/`lake` usa Athena nos mapeados e cai no REST nos demais;
sem REST, P2/P3/estoque/anamnese `0115` viram **warning** (não derrubam o cron).
No Lake, cada relatório = **1** query Athena (sem loop OFFSET); o full **pula** o catálogo
`0004` (contatos vêm de 0051/0002) para caber no timeout de 300s da Vercel.

Sync full em camadas: (1) fast dia → `client_services` + `client_visits`; (2) dossiê
`0031`/`0246` 90d + `0115` REST; (3) soft KPIs P1/P2/P3.

Hoje lê `client_services` do sync **do dia** (0051/0002). `salon_p1_daily` (0021, janela ~30d)
só entra se a leitura do dia falhar — não sobrescreve KPIs diários.

O Conectar valida Lake com ping Athena e grava só fingerprint (`lake:AKIA…` / `lake:unit`) —
nunca o secret AWS. O token pessoal **não** alimenta o read-model (`dataPlane: unit-sync`).

## Superfície do produto

| Camada | Caminho | Auth |
|--------|---------|------|
| Landing / login | `/`, `/login` | público |
| UI pro | `/pro/*` | `romsales_pro_session` + painel |
| API pro | `/api/pro/*`, `/api/me/*` | idem |
| Sync/cron | `/api/avec/sync`, `/api/lgpd/purge`, `/api/admin/migrations` | `CRON_SECRET` |
| Webhooks | `/api/webhooks/avec`, `/api/webhooks/telegram-pro` | secrets por canal |
| UI/API equipe | `/hoje`, `/dashboard`, `/api/auth/*`, webhooks de equipe, … | bloqueados (UI → `/`, API → 404) |

## Gaps conhecidos

1. **Fork com arquivos de equipe no tree** — ainda compilam; boundary no middleware (não remoção física).
2. **Avec pessoal ≠ pipeline de dados** — token no Conectar valida/salva criptografado; Hoje usa sync da unidade. `decryptSecret` ainda sem consumer de sync.
3. **WhatsApp Cloud** — só `credentials-saved`; `linked`/`messagingReady` ficam false até haver adapter.
4. **Dual auth no código** — `rom_session` (equipe) ainda existe, mas APIs de equipe retornam 404.
5. **Ações** — página placeholder; filtros de clientes são shells.
6. **Deploy** — sem `AVEC_*` o data-plane fica correto e vazio.

## Fechado (ondas paralelas)

- Data-plane explícito: `src/lib/pro/data-plane.ts` (`getProDaySummary` / `getProClients`).
- Boundary pro-only: `src/lib/pro/product-boundary.ts` + middleware.
- Conectores tipados: `src/lib/pro/connectors.ts` (estados agenda/telegram/whatsapp).
- Secrets: AES-GCM em `src/lib/pro/secrets.ts` (`ROMSALES_CONNECTOR_SECRET`).
- Bot Telegram Romsales: `/start`, `/hoje`, `/meta`, `/clientes`, `/briefing`, `/ajuda` + perguntas livres (cota IA).
- Sessão rejeita cookie de outro `ROM_PANEL`.

## Próximas decisões (não implementar as duas)

**A)** Manter unit-sync: configurar `AVEC_*` no Vercel Romsales; token pessoal só prova acesso.  
**B)** Sync pessoal: job que usa `avec_api_token` do perfil e read-model próprio.

Até escolher, a UI deve continuar explícita sobre unit-sync.
