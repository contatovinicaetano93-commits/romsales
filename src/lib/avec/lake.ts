/**
 * Cliente AvecLake (AWS Athena + Glue) — alternativa à API REST de relatórios.
 *
 * Credenciais: Access Key ID (AKIA…) + Secret, workgroup Athena `avec_daas`,
 * database `avec_lake_db` na região `us-west-2` (padrão Avec).
 *
 * Env:
 *   AVEC_LAKE_ACCESS_KEY_ID
 *   AVEC_LAKE_SECRET_ACCESS_KEY
 *   AVEC_LAKE_REGION (default us-west-2)
 *   AVEC_LAKE_DATABASE (default avec_lake_db)
 *   AVEC_LAKE_WORKGROUP (default avec_daas)
 *   AVEC_UNIT_ID = salao_id (ex.: 40613 Brasil, 99801 Iguatemi)
 *   AVEC_DATA_SOURCE = lake | rest | auto (default auto)
 */

import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  StartQueryExecutionCommand,
  type Row,
} from '@aws-sdk/client-athena'
import { getUnitEnvOverride } from '@/lib/unit-context'

export interface AvecLakeReportParams {
  page?: number
  limit?: number
  inicio?: string
  fim?: string
  site?: string
  [key: string]: string | number | undefined
}

export interface AvecLakeReportFetchResult {
  rows: Record<string, unknown>[]
  truncated: boolean
  pagesFetched: number
  maxPages: number
  limit: number
}

const LAKE_PAGE_LIMIT = 250
const LAKE_MAX_PAGES_DEFAULT = 200

/** Relatórios com SQL Athena — demais usam REST (hybrid) ou skip limpo. */
const LAKE_SUPPORTED_REPORTS = new Set([
  '0004',
  '0051',
  '0002',
  '0052',
  '0021',
  '0032',
  // Dossiê pro — histórico de serviços + produtos em comanda
  '0031',
  '0246',
  'revenue',
  '0036',
  '0020',
])

function getLakeMaxPages() {
  const raw = process.env.AVEC_SYNC_MAX_PAGES?.trim()
  if (!raw) return LAKE_MAX_PAGES_DEFAULT
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return LAKE_MAX_PAGES_DEFAULT
  return Math.min(Math.floor(n), 500)
}

export const AVEC_LAKE_DEFAULT_REGION = 'us-west-2'
export const AVEC_LAKE_DEFAULT_DATABASE = 'avec_lake_db'
export const AVEC_LAKE_DEFAULT_WORKGROUP = 'avec_daas'

export interface AvecLakeCredentials {
  accessKeyId: string
  secretAccessKey: string
  region: string
  database: string
  workgroup: string
}

export function parseAvecLakeToken(raw: string): { accessKeyId: string; secretAccessKey?: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // AKIA…|secret  ou  AKIA…:secret  ou duas linhas (sem flag /s — target ES2017)
  const pipe = trimmed.match(/^(AKIA[0-9A-Z]{16})\s*[|:\n]\s*([\s\S]+)$/)
  if (pipe) {
    return { accessKeyId: pipe[1]!, secretAccessKey: pipe[2]!.trim() }
  }

  if (/^AKIA[0-9A-Z]{16}$/.test(trimmed)) {
    return { accessKeyId: trimmed }
  }

  return null
}

/** Valor persistido no perfil — nunca guarda o secret AWS. */
export function lakeTokenForStorage(raw: string): string | null {
  const trimmed = raw.trim()
  if (/^lake$/i.test(trimmed)) return 'lake:unit'
  const parsed = parseAvecLakeToken(trimmed)
  if (!parsed) return null
  return `lake:${parsed.accessKeyId}`
}

export function getAvecLakeCredentials(): AvecLakeCredentials | null {
  const override = getUnitEnvOverride()
  const accessKeyId = (override?.avecLakeAccessKeyId ?? process.env.AVEC_LAKE_ACCESS_KEY_ID)?.trim()
  const secretAccessKey = (
    override?.avecLakeSecretAccessKey ?? process.env.AVEC_LAKE_SECRET_ACCESS_KEY
  )?.trim()
  if (!accessKeyId || !secretAccessKey) return null

  return {
    accessKeyId,
    secretAccessKey,
    region: (process.env.AVEC_LAKE_REGION?.trim() || AVEC_LAKE_DEFAULT_REGION).replace(/\/$/, ''),
    database: process.env.AVEC_LAKE_DATABASE?.trim() || AVEC_LAKE_DEFAULT_DATABASE,
    workgroup: process.env.AVEC_LAKE_WORKGROUP?.trim() || AVEC_LAKE_DEFAULT_WORKGROUP,
  }
}

export function isAvecLakeConfigured(): boolean {
  return getAvecLakeCredentials() != null
}

/** Lake pronto pra sync: chaves + salao_id + DB (mesmo critério de isAvecUnitConfigured). */
export function isAvecLakeReady(): boolean {
  if (!isAvecLakeConfigured()) return false
  const override = getUnitEnvOverride()
  const hasUnitId = Boolean((override ? override.avecUnitId : process.env.AVEC_UNIT_ID)?.trim())
  const hasDb = Boolean((override ? override.databaseUrl : process.env.DATABASE_URL)?.trim())
  return hasUnitId && hasDb
}

export function isAvecLakeReportSupported(reportId: string): boolean {
  return LAKE_SUPPORTED_REPORTS.has(reportId)
}

/**
 * auto: Athena só se Lake estiver completo (keys + unit id + DB) — senão REST pode atender.
 * lake: força Athena (erro no fetch se faltar).
 * rest: nunca.
 */
export function shouldUseAvecLake(): boolean {
  const mode = (process.env.AVEC_DATA_SOURCE?.trim() || 'auto').toLowerCase()
  if (mode === 'rest') return false
  if (mode === 'lake') return true
  return isAvecLakeReady()
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** Converte dd/mm/yyyy (periodRange) → yyyy-mm-dd para Athena DATE. */
export function brDateToIso(br: string): string | null {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const dd = m[1]!.padStart(2, '0')
  const mm = m[2]!.padStart(2, '0')
  return `${m[3]}-${mm}-${dd}`
}

function resolveDateBounds(params: AvecLakeReportParams): { inicio: string; fim: string } | null {
  const inicioRaw = params.inicio != null ? String(params.inicio) : ''
  const fimRaw = params.fim != null ? String(params.fim) : ''
  const inicio = brDateToIso(inicioRaw) ?? (/^\d{4}-\d{2}-\d{2}$/.test(inicioRaw) ? inicioRaw : null)
  const fim = brDateToIso(fimRaw) ?? (/^\d{4}-\d{2}-\d{2}$/.test(fimRaw) ? fimRaw : null)
  if (!inicio || !fim) return null
  return { inicio, fim }
}

function resolveSalaoId(params: AvecLakeReportParams): string | null {
  const fromParam = params.site != null ? String(params.site).trim() : ''
  const override = getUnitEnvOverride()
  const raw = fromParam || (override ? override.avecUnitId?.trim() || '' : process.env.AVEC_UNIT_ID?.trim() || '')
  if (!raw) return null
  if (!/^\d+$/.test(raw)) {
    throw new Error(`AVEC_UNIT_ID inválido (esperado salao_id numérico): ${raw}`)
  }
  return raw
}

function createAthenaClient(creds: AvecLakeCredentials): AthenaClient {
  return new AthenaClient({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  })
}

async function waitQuery(client: AthenaClient, queryExecutionId: string, timeoutMs = 90_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const out = await client.send(new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }))
    const state = out.QueryExecution?.Status?.State
    if (state === 'SUCCEEDED') return
    if (state === 'FAILED' || state === 'CANCELLED') {
      const reason = out.QueryExecution?.Status?.StateChangeReason ?? state
      throw new Error(`Athena ${state}: ${reason}`)
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('Athena timeout aguardando query')
}

function cellValue(row: Row | undefined, index: number): string | null {
  const datum = row?.Data?.[index]
  if (!datum || datum.VarCharValue === undefined || datum.VarCharValue === null) return null
  return datum.VarCharValue
}

async function fetchAllRows(client: AthenaClient, queryExecutionId: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let nextToken: string | undefined
  let headers: string[] | null = null

  do {
    const page = await client.send(
      new GetQueryResultsCommand({
        QueryExecutionId: queryExecutionId,
        NextToken: nextToken,
        MaxResults: 1000,
      })
    )
    const resultRows = page.ResultSet?.Rows ?? []
    let start = 0
    if (!headers) {
      headers = (resultRows[0]?.Data ?? []).map((d, i) => d.VarCharValue ?? `col_${i}`)
      start = 1
    }
    for (let i = start; i < resultRows.length; i++) {
      const record: Record<string, unknown> = {}
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c]!
        const raw = cellValue(resultRows[i], c)
        record[key] = raw
      }
      rows.push(record)
    }
    nextToken = page.NextToken
  } while (nextToken)

  return rows
}

export async function runAvecLakeQuery(
  sql: string,
  creds: AvecLakeCredentials = getAvecLakeCredentials()!
): Promise<Record<string, unknown>[]> {
  if (!creds) throw new Error('AvecLake não configurado')
  const client = createAthenaClient(creds)
  try {
    const started = await client.send(
      new StartQueryExecutionCommand({
        QueryString: sql,
        QueryExecutionContext: { Database: creds.database },
        WorkGroup: creds.workgroup,
      })
    )
    const qid = started.QueryExecutionId
    if (!qid) throw new Error('Athena não retornou QueryExecutionId')
    await waitQuery(client, qid)
    return fetchAllRows(client, qid)
  } finally {
    client.destroy()
  }
}

/** Ping leve — valida credenciais + workgroup. */
export async function verifyAvecLakeCredentials(creds: AvecLakeCredentials): Promise<void> {
  const rows = await runAvecLakeQuery('SELECT 1 AS ok', creds)
  if (!rows.length) throw new Error('AvecLake respondeu sem linhas')
}

const INACTIVE_RESERVA_SQL = `
  upper(COALESCE(r.status, '')) LIKE '%CANCEL%'
  OR upper(COALESCE(r.status, '')) LIKE '%FALTA%'
  OR upper(COALESCE(r.status, '')) LIKE '%NO-SHOW%'
  OR upper(COALESCE(r.status, '')) LIKE '%NOSHOW%'
  OR upper(COALESCE(r.status, '')) LIKE '%EXCLU%'
`

function sqlForReport(
  reportId: string,
  params: AvecLakeReportParams,
  offset: number,
  limit: number
): string {
  const salaoId = resolveSalaoId(params)
  if (!salaoId) {
    throw new Error('AVEC_UNIT_ID (salao_id) é obrigatório para sync AvecLake')
  }
  const salaoLit = sqlString(salaoId)
  const bounds = resolveDateBounds(params)

  if (reportId === '0004') {
    return `
SELECT
  CAST(id AS varchar) AS id,
  CAST(cliente_id AS varchar) AS cliente_id,
  nome,
  email,
  celular,
  telefone
FROM salao_cliente
WHERE CAST(salao_id AS varchar) = ${salaoLit}
ORDER BY id
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  if (reportId === '0051') {
    if (!bounds) throw new Error('Relatório 0051 (reservas) exige inicio/fim')
    return `
SELECT
  CAST(r.salao_cliente_id AS varchar) AS cliente_id,
  r.cliente_nome,
  r.cliente_telefone AS celular,
  -- dd/mm/yyyy (não ISO) — parseAvecDateTime trata como parede America/Sao_Paulo
  date_format(r.data_reserva, '%d/%m/%Y') AS data,
  regexp_replace(COALESCE(r.hora_inicial, '10:00'), ' h$', '') AS hora,
  s.servico AS servico,
  p.nome AS profissional,
  r.valor,
  r.status
FROM reservas r
LEFT JOIN salao_servicos s
  ON s.id = r.servico_id AND CAST(s.salao_id AS varchar) = CAST(r.salao_id AS varchar)
LEFT JOIN profissionais p
  ON p.id = r.profissional_id AND CAST(p.salao_id AS varchar) = CAST(r.salao_id AS varchar)
WHERE CAST(r.salao_id AS varchar) = ${salaoLit}
  AND r.data_reserva BETWEEN DATE ${sqlString(bounds.inicio)} AND DATE ${sqlString(bounds.fim)}
  AND NOT (${INACTIVE_RESERVA_SQL})
ORDER BY r.data_reserva, r.hora_inicial_minutos, r.id
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  if (reportId === '0052') {
    if (!bounds) throw new Error('Relatório 0052 (cancelamentos) exige inicio/fim')
    return `
SELECT
  CAST(r.salao_cliente_id AS varchar) AS cliente_id,
  r.cliente_nome AS cliente_nome,
  date_format(r.data_reserva, '%d/%m/%Y') AS data,
  r.status
FROM reservas r
WHERE CAST(r.salao_id AS varchar) = ${salaoLit}
  AND r.data_reserva BETWEEN DATE ${sqlString(bounds.inicio)} AND DATE ${sqlString(bounds.fim)}
  AND (${INACTIVE_RESERVA_SQL})
ORDER BY r.data_reserva, r.id
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  // 0002 (fast/hoje) e 0031 (dossiê — mesma base de itens de serviço)
  if (reportId === '0002' || reportId === '0031') {
    if (!bounds) throw new Error(`Relatório ${reportId} (comandas/serviços) exige inicio/fim`)
    return `
SELECT
  CAST(c.salao_cliente_id AS varchar) AS cliente_id,
  cl.nome AS cliente_nome,
  cl.celular,
  ci.item AS servico,
  date_format(c.data, '%d/%m/%Y') AS data,
  '12:00' AS hora,
  p.nome AS profissional,
  ci.valor,
  c.status,
  CAST(c.id AS varchar) AS comanda_id
FROM comanda_itens ci
JOIN comandas c ON c.id = ci.comanda_id
LEFT JOIN salao_cliente cl ON cl.id = c.salao_cliente_id
LEFT JOIN profissionais p
  ON p.id = ci.profissional_id AND CAST(p.salao_id AS varchar) = CAST(c.salao_id AS varchar)
WHERE CAST(c.salao_id AS varchar) = ${salaoLit}
  AND c.data BETWEEN DATE ${sqlString(bounds.inicio)} AND DATE ${sqlString(bounds.fim)}
  AND c.status = 'FINALIZADA'
  AND ci.tipo = 'salao_servicos'
ORDER BY c.data, ci.id
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  // 0246 — produtos na comanda (uso/venda). tipo ≠ serviço.
  if (reportId === '0246') {
    if (!bounds) throw new Error('Relatório 0246 (produtos em comanda) exige inicio/fim')
    return `
SELECT
  CAST(c.salao_cliente_id AS varchar) AS cliente_id,
  cl.nome AS cliente_nome,
  cl.celular,
  ci.item AS produto,
  ci.tipo,
  date_format(c.data, '%d/%m/%Y') AS data,
  '12:00' AS hora,
  p.nome AS profissional,
  ci.valor,
  CAST(ci.quantidade AS varchar) AS quantidade,
  CAST(c.id AS varchar) AS comanda_id
FROM comanda_itens ci
JOIN comandas c ON c.id = ci.comanda_id
LEFT JOIN salao_cliente cl ON cl.id = c.salao_cliente_id
LEFT JOIN profissionais p
  ON p.id = ci.profissional_id AND CAST(p.salao_id AS varchar) = CAST(c.salao_id AS varchar)
WHERE CAST(c.salao_id AS varchar) = ${salaoLit}
  AND c.data BETWEEN DATE ${sqlString(bounds.inicio)} AND DATE ${sqlString(bounds.fim)}
  AND c.status = 'FINALIZADA'
  AND ci.tipo IS NOT NULL
  AND ci.tipo <> 'salao_servicos'
  AND ci.item IS NOT NULL
ORDER BY c.data, ci.id
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  // 0021 — faturamento / atendimentos por profissional (salon_p1_daily; Hoje usa client_services do dia)
  if (reportId === '0021') {
    if (!bounds) throw new Error('Relatório 0021 exige inicio/fim')
    return `
SELECT
  p.nome AS profissional,
  CAST(SUM(ci.valor) AS varchar) AS faturamento,
  CAST(COUNT(*) AS varchar) AS atendimentos
FROM comanda_itens ci
JOIN comandas c ON c.id = ci.comanda_id
JOIN profissionais p
  ON p.id = ci.profissional_id AND CAST(p.salao_id AS varchar) = CAST(c.salao_id AS varchar)
WHERE CAST(c.salao_id AS varchar) = ${salaoLit}
  AND c.data BETWEEN DATE ${sqlString(bounds.inicio)} AND DATE ${sqlString(bounds.fim)}
  AND c.status = 'FINALIZADA'
  AND ci.tipo = 'salao_servicos'
  AND p.nome IS NOT NULL
GROUP BY p.nome
ORDER BY SUM(ci.valor) DESC
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  // 0032 — top serviços
  if (reportId === '0032') {
    if (!bounds) throw new Error('Relatório 0032 exige inicio/fim')
    return `
SELECT
  ci.item AS servico,
  CAST(COUNT(*) AS varchar) AS quantidade,
  CAST(SUM(ci.valor) AS varchar) AS faturamento
FROM comanda_itens ci
JOIN comandas c ON c.id = ci.comanda_id
WHERE CAST(c.salao_id AS varchar) = ${salaoLit}
  AND c.data BETWEEN DATE ${sqlString(bounds.inicio)} AND DATE ${sqlString(bounds.fim)}
  AND c.status = 'FINALIZADA'
  AND ci.tipo = 'salao_servicos'
  AND ci.item IS NOT NULL
GROUP BY ci.item
ORDER BY SUM(ci.valor) DESC
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  if (reportId === 'revenue' || reportId === '0036' || reportId === '0020') {
    if (!bounds) throw new Error(`Relatório ${reportId} exige inicio/fim`)
    return `
SELECT
  CAST(data AS varchar) AS data,
  CAST(SUM(total) AS varchar) AS valor,
  CAST(COUNT(*) AS varchar) AS atendimentos
FROM comandas
WHERE CAST(salao_id AS varchar) = ${salaoLit}
  AND data BETWEEN DATE ${sqlString(bounds.inicio)} AND DATE ${sqlString(bounds.fim)}
  AND status = 'FINALIZADA'
GROUP BY data
ORDER BY data
OFFSET ${offset}
LIMIT ${limit}
`.trim()
  }

  throw new Error(`AvecLake ainda não mapeia o relatório ${reportId}`)
}

export async function fetchAllAvecLakeReport(
  reportId: string,
  params: AvecLakeReportParams = {},
  maxPages = getLakeMaxPages()
): Promise<AvecLakeReportFetchResult> {
  const creds = getAvecLakeCredentials()
  if (!creds) throw new Error('AvecLake não configurado (AVEC_LAKE_ACCESS_KEY_ID / SECRET)')

  const pageLimit = params.limit ?? LAKE_PAGE_LIMIT
  // Uma única StartQuery por relatório. Loop OFFSET×Athena estourava o timeout
  // Vercel (300s) — dezenas de queries sequenciais no catálogo/agenda.
  const maxRows = Math.min(Math.max(pageLimit, 1) * Math.max(maxPages, 1), 50_000)
  const sql = sqlForReport(reportId, params, 0, maxRows)
  const rows = await runAvecLakeQuery(sql, creds)
  const truncated = rows.length >= maxRows

  return {
    rows,
    truncated,
    pagesFetched: 1,
    maxPages: 1,
    limit: maxRows,
  }
}
