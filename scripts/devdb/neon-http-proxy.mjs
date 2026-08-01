#!/usr/bin/env node
// Local-only Neon HTTP proxy (development helper — NEVER used in production).
//
// @neondatabase/serverless' `neon()` driver talks to Neon over an HTTP "/sql"
// endpoint. For a connection string whose host is `localhost` (no dot), the
// driver targets `https://localhost/sql`. This tiny server answers that
// endpoint and forwards every query to a real local Postgres, so the app can
// run end-to-end offline without a hosted Neon database.
//
// Env:
//   PROXY_PORT           default 443 (the driver always uses https/443)
//   PROXY_DATABASE_URL   local Postgres connection string
//   PROXY_CERT / PROXY_KEY  self-signed TLS cert/key (trust via NODE_EXTRA_CA_CERTS)
import https from 'node:https'
import fs from 'node:fs'
import pg from 'pg'

const PORT = Number(process.env.PROXY_PORT || 443)
const DB = process.env.PROXY_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/romsales'
const CERT = process.env.PROXY_CERT
const KEY = process.env.PROXY_KEY

if (!CERT || !KEY) {
  console.error('PROXY_CERT and PROXY_KEY are required')
  process.exit(1)
}

// Neon HTTP requests raw text output; return every value untouched (as text)
// and let the client driver parse types from dataTypeID, exactly like Neon.
const rawText = { getTypeParser: () => (v) => v }

const pool = new pg.Pool({ connectionString: DB, max: 10 })

const ERROR_FIELDS = [
  'severity', 'code', 'detail', 'hint', 'position', 'internalPosition',
  'internalQuery', 'where', 'schema', 'table', 'column', 'dataType',
  'constraint', 'file', 'line', 'routine',
]

async function runQuery(client, q) {
  const res = await client.query({
    text: q.query,
    values: q.params || [],
    rowMode: 'array',
    types: rawText,
  })
  return {
    command: res.command,
    rowCount: res.rowCount,
    rows: res.rows,
    fields: (res.fields || []).map((f) => ({
      name: f.name,
      dataTypeID: f.dataTypeID,
      tableID: f.tableID,
      columnID: f.columnID,
      dataTypeSize: f.dataTypeSize,
      dataTypeModifier: f.dataTypeModifier,
      format: f.format,
    })),
  }
}

function sendJson(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj))
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length })
  res.end(b)
}

const tlsOpts = { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) }

async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'method not allowed' })
  let body = ''
  for await (const chunk of req) body += chunk
  let payload
  try {
    payload = JSON.parse(body || '{}')
  } catch {
    return sendJson(res, 400, { message: 'invalid json body' })
  }
  const isBatch = Array.isArray(payload.queries)
  let client
  try {
    client = await pool.connect()
    if (isBatch) {
      await client.query('BEGIN')
      const results = []
      for (const q of payload.queries) results.push(await runQuery(client, q))
      await client.query('COMMIT')
      sendJson(res, 200, { results })
    } else {
      sendJson(res, 200, await runQuery(client, payload))
    }
  } catch (e) {
    if (client && isBatch) {
      try { await client.query('ROLLBACK') } catch { /* ignore */ }
    }
    const errObj = { message: e.message }
    for (const f of ERROR_FIELDS) if (e[f] !== undefined) errObj[f] = e[f]
    sendJson(res, 400, errObj)
  } finally {
    if (client) client.release()
  }
}

// Loopback only — this proxy forwards arbitrary SQL with local trust auth.
for (const host of ['127.0.0.1', '::1']) {
  https.createServer(tlsOpts, handler).listen(PORT, host, () => {
    console.log(`neon-http-proxy listening on https://${host}:${PORT}/sql -> ${DB}`)
  })
}
