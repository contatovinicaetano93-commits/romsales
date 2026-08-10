# Dossiê do cliente — sync Avec → Romsales (pro)

Romsales é a ferramenta **do profissional** que realiza o serviço. O dossiê
precisa chegar na cadeira com o contexto certo — não é dashboard de equipe.

## O que o pro precisa

| Necessidade | Fonte Avec | Caminho Romsales |
|-------------|------------|------------------|
| Última visita | `0002` (fast) + histórico `0031` / Lake comandas | `client_visits` + espelho em `client_services.last_done_at` |
| Serviços já realizados | `0002`, `0031`, Lake `comanda_itens` tipo serviço | `client_visits` (append-only) |
| Manicure / cabeleireiro preferido | **Não existe campo nativo** | Derivado: profissional mais frequente em unha/cabelo (`0002`/`0031`/`0051`) → `contacts.preferred_*` |
| Produtos usados (tintura, shampoo, creme…) | REST `0246` (uso em serviço); `0147` exige `profissional_id` | `client_product_uses` via Lake (`tipo <> salao_servicos`) ou REST `0246` |
| Anamnese / prontuário | REST `0115`, `0116` (sem Lake hoje) | `contact_clinical` — soft-skip sem token REST |
| Agenda do dia | `0051` | `client_services.scheduled_at` |

Docs oficiais: [API Avec](https://documenter.getpostman.com/view/12527228/2sA2xmUWJo) · [llms.txt](https://doc.api.avec.beauty/llms.txt).

## Arquitetura em 3 camadas

```
┌─────────────────────────────────────────────────────────────┐
│ 1. FAST (cron ~horário) — cadeira hoje                      │
│    0051 agenda · 0002 atendidos do dia · revenue/cancel     │
│    → client_services + client_visits (do dia)               │
├─────────────────────────────────────────────────────────────┤
│ 2. DOSSIER (full / diário) — memória do cliente             │
│    0031 serviços 90d · 0246 produtos 90d · 0115/0116 REST   │
│    Lake: 0031 + 0246 mapeados em comanda_itens              │
│    → client_visits · client_product_uses · contact_clinical │
│    → recompute preferred_manicurist / preferred_hairstylist │
├─────────────────────────────────────────────────────────────┤
│ 3. SOFT KPIs (full) — P1/P2/P3 / estoque                    │
│    warnings se Lake-only; não bloqueiam o dossiê            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
   Neon (unit-sync)  →  data-plane pro  →  Hoje / lista Clientes
                                         →  API dossiê (UI detalhe ainda não)
```

**Decisão A (atual):** unit-sync continua fonte da verdade. Conectar
**confere** o nome com o portfólio ROM Central (`match-pro` + roster BR/IG)
e grava o nome canônico. Token pessoal não puxa dossiê sozinho.

## API direta vs caminhos alternativos

### Via API / Lake (implementável agora)

- **Histórico de serviços** — Lake `0031` (= SQL de comandas de serviço) ou REST `0031`/`0002` janela 90d.
- **Produtos na comanda** — Lake `0246` (`comanda_itens` onde `tipo <> 'salao_servicos'`) ou REST `0246`. Preferir `0246` a `0147` (este exige `profissional_id` e não escala no sync da unidade).
- **Prefs** — heurística por categoria de serviço (já usada no sync de atendimentos; reforçada no dossiê).

### Só REST (soft-skip no Lake-only)

- **0115** anamnese por cliente (`idStart` cursor).
- **0116** prontuário por período.
- Relatórios de estoque/comercial sem mapa Athena.

### Fora da API (para melhor experiência)

1. **Notas do profissional** em Romsales (`contacts.notes` + eventos) — preferências subjetivas que a Avec não guarda (“gosta de café”, “sensível a cheiro”).
2. **Webhook Avec** (`/api/webhooks/avec`) — invalidar/atualizar dossiê perto do real-time quando a unidade enviar eventos.
3. **Snapshot + reprocess** — `avec_report_snapshots` já existe; mappers novos podem reprocessar sem re-bater a API.
4. **Não inventar** campo “preferido” na Avec — só derivar ou editar no app.

## Regras de timeout (Vercel 300s)

- Uma StartQuery Athena por relatório (sem loop OFFSET).
- Dossiê: janela **90 dias** no full (não dump histórico infinito).
- Catálogo `0004` continua skip/cuidado no Lake full.
- Erros de relatório não mapeado → `warnings`, não derrubam o cron.

## Read-model pro

| Peça | Estado |
|------|--------|
| Lista `getProClients` | Pronto |
| API `GET /api/pro/clientes/[id]` + `getProClientDossier` | Pronto (escopo carteira) |
| UI detalhe `/pro/clientes/[id]` | Pronto |
| Assistente / Telegram com dossiê | Resumo dos top 3 + perguntas de carteira |

## Envs

| Env | Papel |
|-----|--------|
| `AVEC_DATA_SOURCE=lake\|auto\|rest` | Hybrid |
| `AVEC_LAKE_*` + `AVEC_UNIT_ID` | Histórico serviços/produtos sem token REST |
| `AVEC_API_TOKEN` | Anamnese 0115/0116 + fallback REST |
| `AVEC_SYNC_DOSSIER=0` | Pula dossiê no full (timeout) |
| `CRON_SECRET` | `/api/avec/sync?mode=full` |
