<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Romsales is a single Next.js 16 app (App Router, npm) for salon professionals. Full product/setup docs live in `README.md` and `SETUP.md`; standard scripts are in `package.json` (`dev`, `build`, `lint`, `test`, `db:migrate`). This section only captures non-obvious things for running/testing it here.

### The database is Neon-only — there is no local Postgres in the repo
`src/lib/db.ts` uses `@neondatabase/serverless`' `neon()` HTTP driver, which only talks to a Neon `/sql` HTTP endpoint. To run/test end-to-end you either point `DATABASE_URL` at a real Neon database, or use the committed local fallback:

```bash
bash scripts/dev-local-db.sh   # starts local Postgres + a Neon-HTTP proxy (idempotent)
```

That script prints the two env vars to use:
- `DATABASE_URL=postgresql://postgres@localhost/romsales` — the host is `localhost` (no dot) on purpose: the driver then targets `https://localhost/sql`, which the proxy answers.
- `NODE_EXTRA_CA_CERTS=<repo cert path>` — trusts the proxy's self-signed cert. This MUST be a real process env var (Node reads it at startup), so `export` it in the shell that runs `npm run dev` / `npm run db:migrate`; putting it only in `.env.local` is not enough.

The proxy binds `:443`, which needs sudo (the script handles it). Postgres + proxy are services, so they are NOT in the startup update script — run `scripts/dev-local-db.sh` when you need the DB.

### Env / running
- Put dev config in `.env.local` (gitignored). Minimum for the pro app: `DATABASE_URL`, `ROM_PANEL=brasil`, `NEXT_PUBLIC_ROM_PANEL=brasil`, `ROMSALES_PRO_ONLY=1`, `AVEC_MOCK=1`, plus `ROMSALES_PRO_SESSION_SECRET` / `ROMSALES_CONNECTOR_SECRET` (`openssl rand -hex 32`).
- Migrations auto-run on server boot (`src/instrumentation.ts`) when `DATABASE_URL` is set. To run them manually use `npm run db:migrate`, but note Node scripts do NOT load `.env.local` — pass `DATABASE_URL`, `ROM_PANEL`, and `NODE_EXTRA_CA_CERTS` inline.
- Dev server: `npm run dev` (port 3000).

### Seeding demo data without real Avec
With `AVEC_MOCK=1`, connect an agenda using the literal token `mock`. Populate the unit's synced data by calling the sync route with the cron secret (it is authorized by `CRON_SECRET`):
`curl -X POST "http://localhost:3000/api/avec/sync?mode=full" -H "Authorization: Bearer $CRON_SECRET"`.
Mock professionals are `Dani Mariniello` and `Walter`; their clients (e.g. `Carlos Mendes`) then show on `/pro/clientes`. Hello-world flow: `/` → Criar conta → `/pro/conectar` (name + token `mock`) → `/pro/hoje` / `/pro/clientes`.

### Lint / test caveats
- `npm run lint` currently reports pre-existing errors in the tree (mostly `no-explicit-any`); it is not caused by setup.
- `npm test` (Vitest) includes integration/smoke tests that require a running dev server at `localhost:3000` and `DATABASE_URL`/`CRON_SECRET` set; those fail with just `npm test`. The pure unit tests pass on their own.
