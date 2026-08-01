#!/usr/bin/env bash
# Local development database for Romsales (NOT for production).
#
# Romsales talks to Neon (serverless Postgres) over an HTTP "/sql" endpoint via
# @neondatabase/serverless. There is no local Postgres in the repo. This script
# stands up an equivalent local stack so the app runs fully offline:
#
#   1. a local Postgres cluster (under $HOME/.local/romsales-pgdata)
#   2. a tiny Neon-HTTP proxy (scripts/devdb/neon-http-proxy.mjs) on https://localhost:443
#
# Because the driver maps a `localhost` host to `https://localhost/sql`, pointing
# DATABASE_URL at localhost + trusting the proxy cert via NODE_EXTRA_CA_CERTS is
# all that's required — no application code changes.
#
# Idempotent: safe to run repeatedly. Prints the env vars to use afterwards.
set -euo pipefail

PGDATA="${PGDATA:-$HOME/.local/romsales-pgdata}"
PGPORT="${PGPORT:-5432}"
DEVDIR="$HOME/.local/romsales-devdb"
CERT="$DEVDIR/localhost-cert.pem"
KEY="$DEVDIR/localhost-key.pem"
PROXY_PORT="${PROXY_PORT:-443}"
DBNAME="romsales"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\033[0;36m[dev-local-db]\033[0m %s\n' "$*"; }

# --- Postgres binaries -------------------------------------------------------
if ! command -v initdb >/dev/null 2>&1; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [ -z "${PGBIN:-}" ]; then
    log "Postgres not found — installing via apt (needs sudo)"
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
    PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
  fi
  export PATH="$PGBIN:$PATH"
fi

# --- Cluster init ------------------------------------------------------------
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  log "Initializing Postgres cluster at $PGDATA"
  mkdir -p "$PGDATA"
  initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi

# --- Start Postgres ----------------------------------------------------------
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  log "Starting Postgres on port $PGPORT"
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -k /tmp" -l "$PGDATA/server.log" -w start >/dev/null
else
  log "Postgres already running"
fi

# --- Ensure database ---------------------------------------------------------
if ! psql -h /tmp -p "$PGPORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" | grep -q 1; then
  log "Creating database $DBNAME"
  psql -h /tmp -p "$PGPORT" -U postgres -c "CREATE DATABASE $DBNAME" >/dev/null
fi

# --- TLS cert for the proxy --------------------------------------------------
mkdir -p "$DEVDIR"
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  log "Generating self-signed cert for localhost"
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$KEY" -out "$CERT" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
fi

# --- Proxy dependencies ------------------------------------------------------
if [ ! -d "$REPO_ROOT/scripts/devdb/node_modules/pg" ]; then
  log "Installing proxy dependencies (pg)"
  (cd "$REPO_ROOT/scripts/devdb" && npm install --silent)
fi

# Returns 0 only when the Neon HTTP proxy answers /sql with its JSON shape.
proxy_ok() {
  local body
  body="$(curl -sk --max-time 2 \
    -X POST "https://127.0.0.1:${PROXY_PORT}/sql" \
    -H 'content-type: application/json' \
    -d '{"query":"SELECT 1","params":[]}' 2>/dev/null)" || return 1
  printf '%s' "$body" | grep -q '"rows"' && printf '%s' "$body" | grep -q '"fields"'
}

# --- Start proxy -------------------------------------------------------------
if ! proxy_ok; then
  log "Starting Neon HTTP proxy on https://localhost:$PROXY_PORT (needs sudo for :443)"
  NODE_BIN="$(command -v node)"
  sudo PROXY_PORT="$PROXY_PORT" \
       PROXY_CERT="$CERT" PROXY_KEY="$KEY" \
       PROXY_DATABASE_URL="postgresql://postgres@127.0.0.1:$PGPORT/$DBNAME" \
       nohup "$NODE_BIN" "$REPO_ROOT/scripts/devdb/neon-http-proxy.mjs" \
       >"$DEVDIR/proxy.log" 2>&1 &
  sleep 2
  if ! proxy_ok; then
    log "ERROR: Neon HTTP proxy failed to start. See $DEVDIR/proxy.log"
    if [ -f "$DEVDIR/proxy.log" ]; then
      tail -n 20 "$DEVDIR/proxy.log" >&2 || true
    fi
    exit 1
  fi
fi

log "Ready. Local dev database is up."
echo
echo "  Add these to .env.local (or export before 'npm run dev' / 'npm run db:migrate'):"
echo "    DATABASE_URL=postgresql://postgres@localhost/$DBNAME"
echo "    NODE_EXTRA_CA_CERTS=$CERT"
echo
echo "  NODE_EXTRA_CA_CERTS must be a real process env var (Node reads it at startup),"
echo "  so export it in the shell — .env.local alone is not enough for the TLS trust."
