import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
/** VITE_FORCE_LOCAL=1 runs the whole app on this device only (dev/testing). */
const forceLocal = import.meta.env.VITE_FORCE_LOCAL === '1'

export const supabaseConfigured = Boolean(url && anon && !forceLocal)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
