# Romsales — app do profissional (ROM Club)

Produto **independente**, no mesmo modelo do Vitrini: **outro acesso**, **outro login**, **outra URL**.

Não é aba nem rota dentro do ROM Brasil (`rom-club`) nem do ROM Iguatemi.

- App do profissional: `/` → `/login` → `/pro/conectar` → `/pro/hoje`
- Sessão própria: cookie `romsales_pro_session`
- Cadastro **Free** — sem Stripe, planos ou paywall
- Sem marca HairSales / Vitrini
- Deploy Romsales é **pro-only**: UI de equipe redireciona para `/` e APIs de equipe retornam 404 no middleware.
- Painel da equipe continua só em `rom-club.vercel.app` / `rom-iguatemi.vercel.app`

## Arquitetura (estado atual)

```
Romsales (Vercel) ──► Neon próprio
   │
   ├─ Identidade pro: romsales_pro_users / romsales_pro_profiles
   ├─ UI/API pro: /pro/* + /api/pro/* + /api/me/*
   │
   └─ Dados de agenda/carteira + dossiê do cliente:
        sync Avec da UNIDADE (Lake ou REST + cron /api/avec/sync)
        → client_services / client_visits / client_product_uses / contacts
        → filtrados por professional_name
        → detalhe: GET /api/pro/clientes/[id] (ver docs/CLIENT_DOSSIER_SYNC.md)
```

Gaps estruturais conhecidos (detalhe em `ARCHITECTURE.md`):

1. O token Avec no Conectar **valida** o acesso, mas o Hoje lê o **sync da unidade** (`dataPlane: unit-sync`).
2. O repo ainda contém páginas/APIs do painel da equipe por segurança de build, mas o deploy Romsales é pro-only no boundary.
3. WhatsApp Cloud: credenciais salvas; envio ainda não ativo. Telegram: webhook pro em `/api/webhooks/telegram-pro`.
4. Infra pública pro-only: `/api/health`, `/api/webhooks/avec`, `/api/webhooks/telegram-pro` (+ cron Avec/LGPD/migrations). Webhooks de equipe → 404.
5. Envs de equipe (`ROM_ADMIN_*`, `ROM_STAFF_*`, etc.) são leftovers; o produto pro só precisa de pro + Avec + IA + cron.

## Isolamento

| Recurso | Romsales Brasil | Romsales Iguatemi |
|---------|-----------------|-------------------|
| Projeto Vercel | `romsales-brasil` | `romsales-iguatemi` |
| Neon | banco próprio | banco próprio |
| `ROM_PANEL` | `brasil` | `iguatemi` |
| Domínio | próprio (ex.: `romsales-brasil.vercel.app`) | próprio |

**Não** reutilizar projeto Vercel, Neon, cookies ou domínio do painel da equipe nem do Gabriel Vitrini / HairSales.

## 1) Neon

1. Crie um projeto Neon novo (ex.: `romsales-brasil`) — **não compartilhe** o Neon do painel equipe
2. Copie `DATABASE_URL`
3. Rode migrations:

```bash
DATABASE_URL=... ROM_PANEL=brasil npm run db:migrate
```

Migrations relevantes ao pro: `019_romsales_pro` (contas), `025_client_dossier` (visitas/produtos/anamnese),
`026_pro_name_key` (chave de conferência do Conectar).

Se o login falhar com **HTTP 402 / data transfer quota**, o Neon estourou a cota — upgrade do plano
ou projeto Neon novo + trocar `DATABASE_URL` na Vercel. Sem isso, login/sync/Conectar não sobem.

## 2) Vercel

1. **Add New Project** → importe o repo `romsales`
2. Nome sugerido: `romsales-brasil` ou `romsales-iguatemi`
3. Env: use `deploy/vercel-romsales-brasil.env` ou `deploy/vercel-romsales-iguatemi.env`
4. Deploy

## 3) Variáveis essenciais

```
DATABASE_URL=
ROM_PANEL=brasil
NEXT_PUBLIC_ROM_PANEL=brasil
ROM_SEED_PRESET=brasil
ROMSALES_PRO_ONLY=1
ROMSALES_PRO_SESSION_SECRET=   # openssl rand -hex 32
ROMSALES_CONNECTOR_SECRET=     # openssl rand -hex 32 (criptografa tokens Avec/WhatsApp)
CRON_SECRET=
AVEC_API_TOKEN=                # sync REST (opcional se usar Lake)
AVEC_UNIT_ID=                  # salao_id no Lake (40613 Brasil / 99801 Iguatemi)
AVEC_DATA_SOURCE=auto          # auto | lake | rest
AVEC_LAKE_ACCESS_KEY_ID=       # Access Key AvecLake (AKIA…)
AVEC_LAKE_SECRET_ACCESS_KEY=   # Secret AvecLake
AVEC_LAKE_REGION=us-west-2
AVEC_LAKE_DATABASE=avec_lake_db
AVEC_LAKE_WORKGROUP=avec_daas
```

Sem token REST, use **AvecLake**: `AVEC_LAKE_*` + `AVEC_UNIT_ID` (salao_id numérico; Brasil `40613`,
Iguatemi `99801`). No Conectar o profissional cola `AKIA…|secret` (ou `lake` / só a Access Key se
as envs da unidade já estão na Vercel). O secret **não** é persistido no perfil — só validação Athena.

Deploy dedicado Iguatemi (`ROM_PANEL=iguatemi`): use `DATABASE_URL` + `AVEC_UNIT_ID=99801` (+ Lake keys).
Deploy multi-unidade no mesmo projeto: aí sim `AVEC_UNIT_ID_IGUATEMI` + `DATABASE_URL_IGUATEMI`.

**Conectar / conferência:** o nome precisa bater no portfólio ROM Central (`professionals.brasil.ts` /
`professionals.iguatemi.ts`). O roster Iguatemi ainda está **vazio** — Conectar IG falha até preencher
como no Brasil.

Cron: fast `*/5`; full a cada 6h. Se o full estourar 300s, `AVEC_SYNC_DOSSIER=0` pula o dossiê.

`ROMSALES_CONNECTOR_SECRET` é obrigatório em produção. Não há migration de schema:
`avec_api_token` e `wa_access_token` continuam `text`, e o ciphertext `v1:<iv>:<ciphertext>:<tag>` cabe nas colunas atuais.

Para rotacionar `ROMSALES_CONNECTOR_SECRET`, mantenha o segredo antigo disponível enquanto regrava
os tokens (decrypt com o antigo, encrypt com o novo) ou peça que os profissionais reconectem Avec/WhatsApp.
Valores legados sem prefixo `v1:` são tratados como plaintext na leitura para permitir migração gradual.

## Bot Telegram Romsales

Crie um bot no [@BotFather](https://t.me/BotFather) (ex.: `@romsales_brasil_bot`), depois:

```
TELEGRAM_PRO_BOT_TOKEN=
TELEGRAM_PRO_WEBHOOK_SECRET=   # openssl rand -hex 32
TELEGRAM_PRO_BOT_USERNAME=romsales_brasil_bot   # opcional — deep link no Conectar
```

Configure webhook + menu de comandos:

```bash
TELEGRAM_PRO_BOT_TOKEN=... \
TELEGRAM_PRO_WEBHOOK_SECRET=... \
ROMSALES_PUBLIC_URL=https://romsales-brasil.vercel.app \
npm run bot:setup
```

Comandos: `/start <código>`, `/hoje`, `/meta`, `/clientes`, `/briefing`, `/ajuda`  
Webhook: `https://<host>/api/webhooks/telegram-pro`  
Perguntas livres usam a mesma cota da Assistente do app.

## 4) Fluxo smoke

1. Abra a URL do **Romsales** (não a do painel da equipe)
2. `/` → **Criar conta**
3. Cadastro Free → `/pro/conectar`
4. Associe o nome Avec → `/pro/hoje`

## 5) Multi-unidade

Dois deploys do **mesmo** código:

- Brasil: `ROM_PANEL=brasil`
- Iguatemi: `ROM_PANEL=iguatemi`

Branding via `src/lib/brand.ts` + `getRomsalesProduct()`.
