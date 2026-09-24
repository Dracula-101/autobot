// Imports Pratik's external sources into Autobot:
//   LinkedIn Targets project → leads      (linkedin_profiles)
//   assignment checker       → assignments (assignment_checks)
// Called by the app (signed-in user) and hourly by pg_cron. Only rows that
// changed are written, and his own fields (contact_id, hidden, done_at) are
// never touched.

import { json, preflight } from '../_shared/http.ts'
import { adminClient, isAllowed, secret, userFromRequest, type Db } from '../_shared/db.ts'
import {
  normalizeAssignment,
  normalizeProfile,
  stableId,
  type RawAssignment,
  type RawProfile,
} from '../_shared/core/index.ts'

interface SourceResult {
  source: 'linkedin' | 'checker'
  ok: boolean
  rows: number
  written: number
  removed: number
  message: string
}

async function fetchAll(url: string, key: string, table: string, select: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&order=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`)
    const page = (await res.json()) as Record<string, unknown>[]
    out.push(...page)
    if (page.length < 1000) break
  }
  return out
}

type Row = Record<string, unknown> & { id: string }

/**
 * Upsert only new/changed rows (compared on `fields`), revive rows that came
 * back, and soft-delete rows that disappeared from the source.
 */
async function reconcile(
  db: Db,
  table: 'leads' | 'assignments',
  userId: string,
  source: string,
  incoming: Row[],
  fields: string[],
  keepIfSet: string,
): Promise<{ written: number; removed: number }> {
  const { data: existing, error } = await db
    .from(table)
    .select(['id', 'deleted_at', keepIfSet, ...fields].join(','))
    .eq('user_id', userId)
    .eq('source', source)
  if (error) throw new Error(`${table}: ${error.message}`)
  const byId = new Map(((existing ?? []) as unknown as Row[]).map((r) => [r.id, r]))
  const changed = incoming.filter((row) => {
    const cur = byId.get(row.id)
    if (!cur || cur.deleted_at) return true
    return fields.some((f) => JSON.stringify(cur[f] ?? null) !== JSON.stringify(row[f] ?? null))
  })
  for (let i = 0; i < changed.length; i += 500) {
    const chunk = changed.slice(i, i + 500).map((r) => ({ ...r, deleted_at: null }))
    const { error: upErr } = await db.from(table).upsert(chunk, { onConflict: 'id' })
    if (upErr) throw new Error(`${table}: ${upErr.message}`)
  }
  const present = new Set(incoming.map((r) => r.id))
  const gone = [...byId.values()].filter((r) => !r.deleted_at && !present.has(r.id) && !r[keepIfSet]).map((r) => r.id)
  if (gone.length) {
    const { error: delErr } = await db.from(table).update({ deleted_at: new Date().toISOString() }).in('id', gone)
    if (delErr) throw new Error(`${table}: ${delErr.message}`)
  }
  return { written: changed.length, removed: gone.length }
}

const LEAD_FIELDS = ['name', 'url', 'headline', 'company', 'company_raw', 'role_kind', 'location', 'us', 'mutuals', 'mutual_names', 'clipped_at']
const ASSIGNMENT_FIELDS = ['title', 'course', 'due_at', 'url', 'source_status', 'checked_at']

async function importLeads(db: Db, userId: string): Promise<SourceResult> {
  const url = await secret('CONTACTS_SUPABASE_URL', 'contacts_supabase_url')
  const key = (await secret('CONTACTS_SERVICE_KEY', 'contacts_service_key')) ?? (await secret('CONTACTS_SUPABASE_KEY', 'contacts_supabase_key'))
  if (!url || !key) return { source: 'linkedin', ok: false, rows: 0, written: 0, removed: 0, message: 'Not connected' }
  const raw = await fetchAll(url, key, 'linkedin_profiles', 'id,url,name,headline,location,current_company,summary,clipped_at')
  const rows = raw.map((r) => {
    const lead = normalizeProfile(r as unknown as RawProfile)
    return { ...lead, id: stableId(`${userId}:lead:${lead.source_id}`), user_id: userId } as Row
  })
  const { written, removed } = await reconcile(db, 'leads', userId, 'linkedin', rows, LEAD_FIELDS, 'contact_id')
  return {
    source: 'linkedin',
    ok: true,
    rows: rows.length,
    written,
    removed,
    message: rows.length ? `${rows.length} profiles` : 'Connected, but no rows are visible with this key',
  }
}

async function importAssignments(db: Db, userId: string): Promise<SourceResult> {
  const url = await secret('ASSIGNMENTS_SUPABASE_URL', 'assignments_supabase_url')
  const service = await secret('ASSIGNMENTS_SERVICE_KEY', 'assignments_service_key')
  const key = service ?? (await secret('ASSIGNMENTS_SUPABASE_KEY', 'assignments_supabase_key'))
  if (!url || !key) return { source: 'checker', ok: false, rows: 0, written: 0, removed: 0, message: 'Not connected' }
  const raw = await fetchAll(url, key, 'assignment_checks', 'id,assignment_name,course_name,due_at,url,status,checked_at')
  const rows = raw.map((r) => {
    const a = normalizeAssignment(r as unknown as RawAssignment)
    return { ...a, id: stableId(`${userId}:assignment:${a.source_id}`), user_id: userId } as Row
  })
  // With only a publishable key, RLS can hide every row; don't wipe what we have.
  if (!rows.length && !service) {
    return {
      source: 'checker',
      ok: false,
      rows: 0,
      written: 0,
      removed: 0,
      message: 'No rows visible — the checker project needs its secret key (ASSIGNMENTS_SERVICE_KEY)',
    }
  }
  const { written, removed } = await reconcile(db, 'assignments', userId, 'checker', rows, ASSIGNMENT_FIELDS, 'done_at')
  return { source: 'checker', ok: true, rows: rows.length, written, removed, message: `${rows.length} assignments` }
}

async function runFor(db: Db, userId: string): Promise<SourceResult[]> {
  const results: SourceResult[] = []
  for (const run of [importLeads, importAssignments]) {
    let result: SourceResult
    try {
      result = await run(db, userId)
    } catch (e) {
      result = {
        source: run === importLeads ? 'linkedin' : 'checker',
        ok: false,
        rows: 0,
        written: 0,
        removed: 0,
        message: (e as Error).message.slice(0, 300),
      }
    }
    const now = new Date().toISOString()
    await db.from('source_syncs').upsert(
      { user_id: userId, source: result.source, last_run: now, ...(result.ok ? { last_ok: now, rows: result.rows } : {}), message: result.message },
      { onConflict: 'user_id,source' },
    )
    results.push(result)
  }
  return results
}

async function ownerIds(db: Db): Promise<string[]> {
  const list = ((await secret('ALLOWED_EMAILS', 'allowed_emails')) ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(error.message)
  return data.users.filter((u) => !list.length || list.includes((u.email ?? '').toLowerCase())).map((u) => u.id)
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const db = adminClient()

  const cronHeader = req.headers.get('x-autobot-cron')
  if (cronHeader) {
    const expected = await secret('AUTOBOT_CRON_SECRET', 'autobot_cron_secret')
    if (!expected || !sameSecret(cronHeader, expected)) return json({ error: 'Forbidden' }, 403)
    const report: Record<string, SourceResult[]> = {}
    for (const id of await ownerIds(db)) report[id.slice(0, 8)] = await runFor(db, id)
    return json({ report })
  }

  const auth = await userFromRequest(req)
  if (!auth) return json({ error: 'Sign in first.' }, 401)
  if (!(await isAllowed(auth.user))) return json({ error: 'This Autobot belongs to someone else.' }, 403)
  return json({ results: await runFor(db, auth.user.id) })
})
