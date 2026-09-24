import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { seedRoutines, withDefaults, type Settings } from '@core/index.ts'
import { supabase, supabaseConfigured } from './supabase'
import { SyncStore, type Profile, type SyncRow, type SyncStatus, type Table } from './sync'
import { loadDemo } from './demo'

interface AppValue {
  cloud: boolean
  /** Auth has been checked (signed in or not) */
  ready: boolean
  session: Session | null
  user: User | null
  store: SyncStore | null
  profile: Profile | null
  settings: Settings
  name: string
  updateSettings: (patch: Partial<Settings>) => void
  updateProfile: (patch: Partial<Profile>) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; confirm: boolean }>
  signOut: () => Promise<void>
}

const AppContext = createContext<AppValue | null>(null)
const noop = () => () => {}

async function bootstrap(store: SyncStore) {
  // Starter knowledge kept privately in the database, never in the repo.
  if (supabase) {
    const { data } = await supabase.rpc('claim_memory_inbox')
    if (typeof data === 'number' && data > 0) {
      await store.refresh()
      store.upsert('activity', {
        id: crypto.randomUUID(),
        actor: 'autobot',
        kind: 'memory.import',
        summary: `Learned ${data} things about you from your setup notes`,
        data: { count: data },
      } as SyncRow)
    }
  }
  if (!store.profile?.seeded_at) {
    store.upsert('routines', seedRoutines(store.userId), { ignoreDuplicates: true })
    store.updateProfile({
      seeded_at: new Date().toISOString(),
      settings: withDefaults(store.profile?.settings as Partial<Settings>) as unknown as Record<string, unknown>,
    })
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabaseConfigured)
  const [store, setStore] = useState<SyncStore | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = supabaseConfigured ? (session?.user.id ?? null) : 'local'

  useEffect(() => {
    if (!userId) {
      setStore(null)
      return
    }
    const next = new SyncStore(supabase, userId)
    setStore(next)
    void (async () => {
      await next.start()
      if (!supabase && new URLSearchParams(location.search).has('demo')) loadDemo(next)
      await bootstrap(next)
    })()
    return () => next.dispose()
  }, [userId])

  const profile = useSyncExternalStore(store?.subscribe ?? noop, () => store?.profile ?? null)
  const settings = useMemo(() => withDefaults(profile?.settings as Partial<Settings> | undefined), [profile])

  useEffect(() => {
    try {
      localStorage.setItem('autobot:theme', JSON.stringify(settings.theme))
    } catch {
      // private mode
    }
  }, [settings.theme])

  const updateProfile = useCallback((patch: Partial<Profile>) => store?.updateProfile(patch), [store])
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      if (!store) return
      const current = withDefaults(store.profile?.settings as Partial<Settings> | undefined)
      store.updateProfile({ settings: { ...current, ...patch } as unknown as Record<string, unknown> })
    },
    [store],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Cloud sync isn’t configured on this build.'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!supabase) return { error: 'Cloud sync isn’t configured on this build.', confirm: false }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        // The confirmation link lands back in the app (must be an allowed redirect URL in Supabase Auth).
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    })
    if (error) return { error: error.message, confirm: false }
    return { error: null, confirm: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  const user = session?.user ?? null
  const name = (profile?.display_name || user?.email?.split('@')[0] || 'friend').split(' ')[0]

  const value: AppValue = {
    cloud: supabaseConfigured,
    ready,
    session,
    user,
    store,
    profile,
    settings,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    updateSettings,
    updateProfile,
    signIn,
    signUp,
    signOut,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

const EMPTY: never[] = []

/** Live rows of a synced table; re-renders only when that table changes. */
export function useRows<T extends SyncRow>(table: Table): T[] {
  const { store } = useApp()
  return useSyncExternalStore(store?.subscribe ?? noop, () => (store ? store.rows<T>(table) : EMPTY))
}

export function useSyncStatus(): { status: SyncStatus; pending: number; error: string | null; hydrated: boolean } {
  const { store } = useApp()
  useSyncExternalStore(store?.subscribe ?? noop, () => store?.version ?? 0)
  return {
    status: store?.status ?? 'local',
    pending: store?.pendingCount ?? 0,
    error: store?.lastError ?? null,
    hydrated: store?.hydrated ?? false,
  }
}
