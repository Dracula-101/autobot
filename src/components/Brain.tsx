import { useEffect, useRef } from 'react'
import { live, logicalDay, missionProgress, type LogEntry, type Mission } from '@core/index.ts'
import { useApp, useRows, useSyncStatus } from '../lib/app'
import { useNow } from '../lib/clock'
import { useActions } from '../lib/useActions'
import { api } from '../lib/api'
import type { SyncRow } from '../lib/sync'
import { cheer } from './Autobot'

/**
 * Autobot's proactive side, running whenever the app is open:
 * checks you in (the "woke up" signal for reminders), plans the day,
 * auto-completes missions as real progress lands, and fetches the day's note.
 */
export function Brain() {
  const { store, settings, cloud, user } = useApp()
  const { hydrated } = useSyncStatus()
  const actions = useActions()
  const now = useNow(60_000)
  const date = logicalDay(now, settings.rolloverHour)
  const missions = useRows<Mission>('missions')
  const logs = useRows<LogEntry>('logs')
  const seen = useRef<Map<string, number> | null>(null)

  useEffect(() => {
    if (!hydrated) return
    const run = () => {
      if (document.visibilityState !== 'visible') return
      actions.checkIn()
      actions.ensurePlan()
    }
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [hydrated, date, actions])

  // Autofill: a target mission finishes itself when enough progress is logged
  // (from Hunt, Prep, chat, or the other device) while the app is open.
  useEffect(() => {
    if (!hydrated || !store) return
    const todays = live(missions).filter((m) => m.day === date)
    const progress = missionProgress(todays, logs, date)
    const before = seen.current
    seen.current = progress
    if (!before) return
    let completed = 0
    for (const m of todays) {
      if (!m.target_key || (m.status !== 'todo' && m.status !== 'doing')) continue
      const was = before.get(m.id) ?? 0
      const is = progress.get(m.id) ?? 0
      if (was < m.amount && is >= m.amount) {
        store.patch<Mission>('missions', m.id, { status: 'done', done_at: new Date().toISOString() })
        store.upsert('activity', {
          id: crypto.randomUUID(),
          actor: 'autobot',
          kind: 'mission.auto',
          summary: `Auto-completed: ${m.title}`,
          ref_table: 'missions',
          ref_id: m.id,
          data: {},
        } as SyncRow)
        completed++
      }
    }
    if (completed) cheer()
  }, [missions, logs, date, hydrated, store])

  useEffect(() => {
    if (!cloud || !user || !hydrated || !store) return
    const key = `autobot:brief:${date}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      return
    }
    api
      .brief()
      .then((r) => r.reply && store.ingest('chat_messages', [r.reply as unknown as SyncRow]))
      .catch(() => localStorage.removeItem(key))
  }, [cloud, user, hydrated, store, date])

  return null
}
