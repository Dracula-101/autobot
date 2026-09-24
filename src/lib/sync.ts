// Offline-first sync between this device and Supabase.
//
// Every table is a map of rows keyed by id. Writes apply locally at once and
// queue for upload; realtime events and focus pulls bring in changes made on
// other devices. Deletes are soft (deleted_at) so they sync like any update.
// While a row has an unsent local change, the local copy wins.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

export const TABLES = [
  'routines',
  'missions',
  'routine_logs',
  'logs',
  'memories',
  'contacts',
  'leads',
  'jobs',
  'problems',
  'reviews',
  'chat_messages',
  'activity',
  'day_checkins',
  'assignments',
] as const
export type Table = (typeof TABLES)[number]

export interface SyncRow {
  id: string
  user_id?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Profile {
  id: string
  display_name: string
  reminder_email?: string
  settings: Record<string, unknown>
  seeded_at?: string | null
  updated_at?: string
}

export type SyncStatus = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error'

interface Pending {
  table: Table
  row: SyncRow
  seq: number
  ignoreDuplicates: boolean
}

/** Feeds that only keep a recent window locally */
const WINDOW: Partial<Record<Table, number>> = { chat_messages: 500, activity: 300 }

const nowIso = () => new Date().toISOString()

function isOffline(error: { message?: string } | null): boolean {
  const msg = error?.message ?? ''
  return !navigator.onLine || /fetch|network|Failed to fetch|Load failed/i.test(msg)
}

export class SyncStore {
  private data = new Map<Table, Map<string, SyncRow>>(TABLES.map((t) => [t, new Map()]))
  private cursors: Partial<Record<Table, string>> = {}
  private pending = new Map<string, Pending>()
  private seq = 0
  private listeners = new Set<() => void>()
  private views = new Map<Table, SyncRow[]>()
  private channel: RealtimeChannel | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private retryDelay = 2000
  private flushing = false
  private disposed = false
  private cleanup: (() => void)[] = []
  private profilePatch: Partial<Profile> | null = null

  profile: Profile | null = null
  status: SyncStatus = 'local'
  lastError: string | null = null
  /** True once the first server pull finished (safe to generate plans) */
  hydrated = false
  version = 0

  constructor(
    private sb: SupabaseClient | null,
    readonly userId: string,
  ) {
    this.load()
    if (!sb) this.hydrated = true
  }

  private get storageKey() {
    return `autobot:v2:${this.userId}`
  }

  // ── local persistence

  private load() {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return
      const saved = JSON.parse(raw) as {
        data: Record<string, SyncRow[]>
        cursors: Partial<Record<Table, string>>
        pending: Pending[]
        profile: Profile | null
        profilePatch: Partial<Profile> | null
      }
      for (const t of TABLES) {
        const map = this.data.get(t)!
        for (const r of saved.data?.[t] ?? []) map.set(r.id, r)
      }
      this.cursors = saved.cursors ?? {}
      for (const p of saved.pending ?? []) this.pending.set(`${p.table}:${p.row.id}`, { ...p, seq: ++this.seq })
      this.profile = saved.profile ?? null
      this.profilePatch = saved.profilePatch ?? null
    } catch {
      // Corrupt cache: start clean, the server has everything.
    }
  }

  private save() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      try {
        const data: Record<string, SyncRow[]> = {}
        for (const t of TABLES) {
          let rows = [...this.data.get(t)!.values()]
          const cap = WINDOW[t]
          if (cap && rows.length > cap) {
            rows = rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, cap)
          }
          data[t] = rows
        }
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({
            data,
            cursors: this.cursors,
            pending: [...this.pending.values()],
            profile: this.profile,
            profilePatch: this.profilePatch,
          }),
        )
      } catch {
        // Storage full or blocked; the server copy is still safe.
      }
    }, 300)
  }

  // ── React subscription

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit(tables: readonly Table[] = TABLES) {
    this.version++
    for (const t of tables) this.views.delete(t)
    for (const fn of this.listeners) fn()
  }

  /** Live (non-deleted) rows; stable array identity until the table changes. */
  rows<T extends SyncRow>(table: Table): T[] {
    let view = this.views.get(table)
    if (!view) {
      view = [...this.data.get(table)!.values()].filter((r) => !r.deleted_at)
      this.views.set(table, view)
    }
    return view as T[]
  }

  /** Every row including soft-deleted ones. */
  all<T extends SyncRow>(table: Table): T[] {
    return [...this.data.get(table)!.values()] as T[]
  }

  get<T extends SyncRow>(table: Table, id: string): T | undefined {
    return this.data.get(table)!.get(id) as T | undefined
  }

  get pendingCount() {
    return this.pending.size + (this.profilePatch ? 1 : 0)
  }

  // ── writes

  upsert<T extends SyncRow>(table: Table, input: T | T[], opts: { ignoreDuplicates?: boolean } = {}) {
    const list = Array.isArray(input) ? input : [input]
    if (!list.length) return
    const map = this.data.get(table)!
    for (const row of list) {
      const existing = map.get(row.id)
      if (opts.ignoreDuplicates && existing) continue
      const merged: SyncRow = {
        created_at: existing?.created_at ?? nowIso(),
        ...existing,
        ...row,
        user_id: this.userId,
        updated_at: nowIso(),
      }
      map.set(row.id, merged)
      this.pending.set(`${table}:${row.id}`, {
        table,
        row: merged,
        seq: ++this.seq,
        ignoreDuplicates: Boolean(opts.ignoreDuplicates),
      })
    }
    this.emit([table])
    this.save()
    this.scheduleFlush(40)
  }

  patch<T extends SyncRow>(table: Table, id: string, patch: Partial<T>) {
    const existing = this.get<T>(table, id)
    if (!existing) return
    this.upsert(table, { ...existing, ...patch } as T)
  }

  remove(table: Table, id: string) {
    this.patch(table, id, { deleted_at: nowIso() })
  }

  /** Accept rows that came from the server (e.g. an Edge Function response). */
  ingest(table: Table, rows: SyncRow[]) {
    this.merge(table, rows, true)
  }

  updateProfile(patch: Partial<Profile>) {
    if (!this.profile) this.profile = { id: this.userId, display_name: '', settings: {} }
    this.profile = { ...this.profile, ...patch }
    this.profilePatch = { ...(this.profilePatch ?? {}), ...patch }
    this.emit([])
    this.save()
    this.scheduleFlush(40)
  }

  // ── network

  async start() {
    if (!this.sb) {
      this.status = 'local'
      this.emit([])
      return
    }
    this.status = 'connecting'
    this.emit([])
    const onOnline = () => void this.refresh()
    const onOffline = () => this.setStatus('offline')
    const onVisible = () => {
      if (document.visibilityState === 'visible') void this.refresh()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    this.cleanup.push(
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('offline', onOffline),
      () => document.removeEventListener('visibilitychange', onVisible),
    )
    await this.refresh()
    this.hydrated = true
    this.emit([])
    this.listen()
  }

  dispose() {
    this.disposed = true
    for (const fn of this.cleanup) fn()
    if (this.channel && this.sb) void this.sb.removeChannel(this.channel)
    if (this.flushTimer) clearTimeout(this.flushTimer)
  }

  /** Push local changes, then pull anything newer from the server. */
  async refresh() {
    if (!this.sb || this.disposed) return
    await this.flush()
    try {
      this.setStatus('syncing')
      await Promise.all([this.pullProfile(), ...TABLES.map((t) => this.pull(t))])
      this.lastError = null
      this.setStatus(this.pending.size ? 'syncing' : 'synced')
    } catch (e) {
      this.fail(e)
    }
  }

  private setStatus(status: SyncStatus) {
    if (this.status === status) return
    this.status = status
    this.emit([])
  }

  private fail(e: unknown) {
    const err = e as { message?: string }
    if (isOffline(err)) this.setStatus('offline')
    else {
      this.lastError = err?.message ?? String(e)
      this.setStatus('error')
    }
  }

  private async pullProfile() {
    const { data, error } = await this.sb!.from('profiles').select('*').eq('id', this.userId).maybeSingle()
    if (error) throw error
    if (data && !this.profilePatch) {
      this.profile = data as Profile
      this.emit([])
    }
  }

  private async pull(table: Table) {
    const since = this.cursors[table]
    let query = this.sb!.from(table).select('*').eq('user_id', this.userId)
    if (since) {
      // Overlap a minute: commits can land slightly out of timestamp order.
      const overlap = new Date(new Date(since).getTime() - 60_000).toISOString()
      query = query.gt('updated_at', overlap).order('updated_at', { ascending: true }).limit(1000)
    } else if (WINDOW[table]) {
      query = query.order('created_at', { ascending: false }).limit(WINDOW[table]!)
    } else {
      query = query.order('updated_at', { ascending: true }).limit(5000)
    }
    const { data, error } = await query
    if (error) throw error
    this.merge(table, (data ?? []) as SyncRow[])
  }

  /**
   * `force` = these rows are the server's answer to our own write, so they
   * replace the local copy even if this device's clock runs ahead.
   */
  private merge(table: Table, rows: SyncRow[], force = false) {
    if (!rows.length) return
    const map = this.data.get(table)!
    let changed = false
    for (const r of rows) {
      if (r.updated_at && (!this.cursors[table] || r.updated_at > this.cursors[table]!)) {
        this.cursors[table] = r.updated_at
      }
      if (this.pending.has(`${table}:${r.id}`)) continue
      const current = map.get(r.id)
      if (!force && current?.updated_at && r.updated_at && current.updated_at > r.updated_at) continue
      map.set(r.id, r)
      changed = true
    }
    if (changed) {
      this.emit([table])
      this.save()
    }
  }

  private listen() {
    if (!this.sb || this.channel) return
    const channel = this.sb.channel(`autobot-sync-${this.userId}`)
    for (const table of TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${this.userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            if (id && this.data.get(table)!.delete(id)) this.emit([table])
            return
          }
          this.merge(table, [payload.new as SyncRow])
        },
      )
    }
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${this.userId}` },
      (payload) => {
        if (!this.profilePatch) {
          this.profile = payload.new as Profile
          this.emit([])
          this.save()
        }
      },
    )
    channel.subscribe((status) => {
      // After a reconnect, catch up on anything missed while the socket was down.
      if (status === 'SUBSCRIBED' && this.hydrated) void this.refresh()
    })
    this.channel = channel
  }

  private scheduleFlush(delay: number) {
    if (!this.sb || this.disposed) return
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => void this.flush(), delay)
  }

  async flush() {
    if (!this.sb || this.flushing || this.disposed) return
    if (!this.pending.size && !this.profilePatch) return
    this.flushing = true
    this.setStatus('syncing')
    try {
      if (this.profilePatch) {
        const patch = this.profilePatch
        const { data, error } = await this.sb
          .from('profiles')
          .upsert({ id: this.userId, ...patch })
          .select()
          .single()
        if (error) throw error
        if (this.profilePatch === patch) {
          this.profilePatch = null
          this.profile = data as Profile
        }
      }

      const batch = [...this.pending.values()]
      for (const table of TABLES) {
        for (const ignoreDuplicates of [false, true]) {
          const ops = batch.filter((p) => p.table === table && p.ignoreDuplicates === ignoreDuplicates)
          if (!ops.length) continue
          const { data, error } = await this.sb
            .from(table)
            .upsert(
              ops.map((p) => p.row),
              { onConflict: 'id', ignoreDuplicates },
            )
            .select()
          if (error) throw error
          for (const op of ops) {
            const key = `${table}:${op.row.id}`
            if (this.pending.get(key)?.seq === op.seq) this.pending.delete(key)
          }
          const returned = (data ?? []) as SyncRow[]
          this.merge(table, returned, true)
          if (ignoreDuplicates) {
            // Rows another device created first: take the server's version.
            const got = new Set(returned.map((r) => r.id))
            const missing = ops.map((p) => p.row.id).filter((id) => !got.has(id))
            if (missing.length) {
              const res = await this.sb.from(table).select('*').in('id', missing)
              if (!res.error) this.merge(table, (res.data ?? []) as SyncRow[], true)
            }
          }
        }
      }
      this.retryDelay = 2000
      this.lastError = null
      this.setStatus(this.pending.size || this.profilePatch ? 'syncing' : 'synced')
    } catch (e) {
      this.fail(e)
      this.scheduleFlush(this.retryDelay)
      this.retryDelay = Math.min(this.retryDelay * 2, 60_000)
    } finally {
      this.flushing = false
      this.save()
      this.emit([])
      if ((this.pending.size || this.profilePatch) && this.status === 'syncing') this.scheduleFlush(250)
    }
  }
}
