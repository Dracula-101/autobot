import { useEffect, useMemo, useState } from 'react'
import { Bell, BellOff, Send, Share } from 'lucide-react'
import {
  formatClock,
  upcomingReminders,
  logicalDay,
  type Assignment,
  type Checkin,
  type Contact,
  type LogEntry,
  type Mission,
  type NotifyPrefs,
  type Routine,
  type RoutineLog,
} from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { api } from '../lib/api'
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported } from '../lib/push'
import { useToast } from './Toast'
import { Toggle } from './ui'

const PREFS: { key: Exclude<keyof NotifyPrefs, 'classLead'>; label: string; hint: string }[] = [
  { key: 'routines', label: 'Pills, serum & routines', hint: 'Morning stack after you wake, night stack before bed' },
  { key: 'classes', label: 'Classes', hint: 'Before your first lecture on class days' },
  { key: 'bedtime', label: 'Bedtime', hint: '15 minutes before lights out' },
  { key: 'followups', label: 'Referral follow-ups', hint: 'When someone hasn’t replied in 5 days' },
  { key: 'deadlines', label: 'Assignment deadlines', hint: 'The day before it’s due, and 3 hours before' },
  { key: 'nudges', label: 'Firm-friend nudges', hint: 'Only when the day stalls — max twice a day' },
  { key: 'weekly', label: 'Sunday week wrap', hint: 'Scoreboard and review' },
]

export function NotificationSettings() {
  const { settings, updateSettings, user, cloud } = useApp()
  const toast = useToast()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const routines = useRows<Routine>('routines')
  const routineLogs = useRows<RoutineLog>('routine_logs')
  const checkins = useRows<Checkin>('day_checkins')
  const missions = useRows<Mission>('missions')
  const contacts = useRows<Contact>('contacts')
  const logs = useRows<LogEntry>('logs')
  const assignments = useRows<Assignment>('assignments')

  useEffect(() => {
    void currentSubscription().then((s) => setEnabled(Boolean(s) && Notification.permission === 'granted'))
  }, [])

  const upcoming = useMemo(() => {
    const now = new Date()
    const today = logicalDay(now, settings.rolloverHour)
    return upcomingReminders({
      now,
      settings,
      routines,
      routineLogs,
      checkin: checkins.find((c) => c.date === today) ?? null,
      missions,
      contacts,
      logs,
      assignments,
      sentKeys: new Set(),
    })
  }, [settings, routines, routineLogs, checkins, missions, contacts, logs, assignments])

  const needsInstall = isIOS() && !isStandalone()

  const turnOn = async () => {
    if (!user) return
    setBusy(true)
    const error = await enablePush(user.id)
    setBusy(false)
    if (error) toast(error)
    else {
      setEnabled(true)
      toast('Notifications on for this device')
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      const r = await api.testPush()
      toast(r.delivered ? `Sent to ${r.delivered} ${r.delivered === 1 ? 'device' : 'devices'}` : `Didn’t go through: ${r.errors[0] ?? 'unknown'}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {!cloud || !user ? (
        <p className="text-[14px] font-semibold text-ink-3">Sign in to get reminders on your phone.</p>
      ) : needsInstall ? (
        <div className="rounded-2xl bg-sky/10 p-4 text-[14px] font-semibold text-ink-2">
          <p className="font-extrabold text-ink">One step on iPhone</p>
          <p className="mt-1">
            Tap <Share className="inline h-4 w-4 align-[-2px]" aria-label="Share" /> in Safari, then <b>Add to Home Screen</b>. Open
            Autobot from your home screen and come back here to turn on notifications.
          </p>
        </div>
      ) : !pushSupported() ? (
        <p className="text-[14px] font-semibold text-ink-3">This browser can’t receive push notifications.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {enabled ? (
            <>
              <span className="chip min-h-[36px] bg-mint/15 px-3 text-mint">
                <Bell className="h-4 w-4" /> On for this device
              </span>
              <button type="button" className="btn-soft btn-sm" onClick={() => void test()} disabled={busy}>
                <Send className="h-4 w-4" /> Send a test
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  void disablePush().then(() => setEnabled(false))
                }}
              >
                <BellOff className="h-4 w-4" /> Turn off here
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void turnOn()} disabled={busy}>
              <Bell className="h-4 w-4" /> Turn on notifications
            </button>
          )}
        </div>
      )}

      <div className="divide-y divide-line">
        {PREFS.map((p) => (
          <Toggle
            key={p.key}
            label={p.label}
            hint={p.hint}
            checked={settings.notify[p.key]}
            onChange={(v) => updateSettings({ notify: { ...settings.notify, [p.key]: v } })}
          />
        ))}
        <label className="flex items-center justify-between gap-4 py-2.5">
          <span>
            <span className="block text-[15px] font-bold text-ink">Class heads-up</span>
            <span className="block text-[13px] font-semibold text-ink-3">How long before the first lecture</span>
          </span>
          <select
            className="field w-auto py-2"
            value={settings.notify.classLead}
            onChange={(e) => updateSettings({ notify: { ...settings.notify, classLead: Number(e.target.value) } })}
          >
            {[45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      {upcoming.length > 0 && (
        <div className="rounded-2xl bg-surface-2/70 p-3">
          <p className="text-[12px] font-black uppercase tracking-[0.08em] text-ink-3">Still coming today</p>
          <ul className="mt-2 space-y-1">
            {upcoming.map((u) => (
              <li key={u.key} className="flex items-center justify-between gap-3 text-[13px] font-bold text-ink-2">
                <span>{u.label}</span>
                <span className="num text-ink-3">{formatClock(u.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
