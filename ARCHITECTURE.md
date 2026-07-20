# Romsales — arquitetura e gaps

## Intent

App **standalone** do profissional (modelo Vitrini/HairSales): URL, login e sessão próprios.
Não é rota dentro do painel da equipe (`rom-club` / `rom-iguatemi`).
O deploy Romsales é **pro-only** no boundary: superfície de equipe redireciona/404 antes de chegar nas páginas/APIs.

## Plano de dados atual

```
Avec (token da UNIDADE: AVEC_API_TOKEN)
  → cron /api/avec/sync (+ webhook /api/webhooks/avec)
  → salon_p1_daily / contacts (Neon do deploy Romsales)
  → src/lib/pro/data-plane.ts (unit-sync)
  → Hoje / Assistente / Clientes
       filtrados por professional_name do perfil pro
```

O Conectar grava `avec_api_token` no perfil **após ping de validação**. Esse token
**não** alimenta o read-model do Hoje/Assistente/Clientes ainda (`dataPlane: unit-sync`).

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
