import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.49.8'

const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export type Db = SupabaseClient

/** Service-role client: bypasses RLS. Only for secrets and the cron. */
export function adminClient(): Db {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** A client that acts as the caller, so every write goes through RLS. */
export async function userFromRequest(req: Request): Promise<{ db: Db; user: User } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const db = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return null
  return { db, user: data.user }
}

const secretCache = new Map<string, string | null>()

/** Env var first, then Supabase Vault (via a service-role-only RPC). */
export async function secret(name: string, vaultName = name.toLowerCase()): Promise<string | null> {
  const env = Deno.env.get(name)
  if (env) return env
  if (secretCache.has(vaultName)) return secretCache.get(vaultName)!
  const { data, error } = await adminClient().rpc('app_secret', { secret_name: vaultName })
  const value = error ? null : ((data as string | null) ?? null)
  if (!error) secretCache.set(vaultName, value)
  return value
}

/** Only these accounts may spend the Gemini key (comma-separated emails). */
export async function isAllowed(user: User): Promise<boolean> {
  const list = (await secret('ALLOWED_EMAILS', 'allowed_emails')) ?? ''
  const allowed = list
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!allowed.length) return true
  return allowed.includes((user.email ?? '').toLowerCase())
}
