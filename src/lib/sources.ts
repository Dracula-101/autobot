// Status of the external sources (LinkedIn Targets, assignment checker) and a
// manual "sync now". The server also imports them every hour.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { api, type SourceResult } from './api'
import { useApp } from './app'

export interface SourceSync {
  source: 'linkedin' | 'checker'
  last_run: string | null
  last_ok: string | null
  rows: number
  message: string | null
}

export const IMPORT_KEY = 'autobot:import:last'

/** "just now", "12 min ago", "3h ago", "2 days ago" */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** The latest run succeeded. */
export const healthy = (s: SourceSync | undefined) => Boolean(s?.last_ok && s.last_ok === s.last_run)

export function useSources() {
  const { store, cloud, user } = useApp()
  const [syncs, setSyncs] = useState<SourceSync[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    const { data } = await supabase.from('source_syncs').select('source,last_run,last_ok,rows,message')
    setSyncs((data ?? []) as SourceSync[])
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const syncNow = useCallback(async (): Promise<SourceResult[] | string> => {
    setBusy(true)
    try {
      const { results } = await api.importSources()
      try {
        localStorage.setItem(IMPORT_KEY, String(Date.now()))
      } catch {
        // private mode
      }
      await store?.refresh()
      await load()
      return results
    } catch (e) {
      return e instanceof Error ? e.message : 'Sync failed'
    } finally {
      setBusy(false)
    }
  }, [store, load])

  return {
    available: cloud && Boolean(user),
    busy,
    syncNow,
    linkedin: syncs.find((s) => s.source === 'linkedin'),
    checker: syncs.find((s) => s.source === 'checker'),
  }
}
