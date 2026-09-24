import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell } from 'lucide-react'
import { formatDate, live, relativeDay, wallClock, type Activity, type NotificationRow } from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Shell'
import { Autobot } from '../components/Autobot'
import { Empty } from '../components/ui'

type Filter = 'all' | 'you' | 'autobot' | 'system'

const ACTOR: Record<Activity['actor'], { label: string; tone: string }> = {
  you: { label: 'You', tone: 'bg-surface-2 text-ink-2' },
  autobot: { label: 'Autobot', tone: 'bg-violet/15 text-violet' },
  system: { label: 'Reminder', tone: 'bg-amber/15 text-amber' },
}

function time(iso?: string) {
  return iso
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
    : ''
}

export function ChangesPage() {
  const { user } = useApp()
  const rows = live(useRows<Activity>('activity'))
  const [filter, setFilter] = useState<Filter>('all')
  const [sent, setSent] = useState<NotificationRow[]>([])
  const today = wallClock().date

  useEffect(() => {
    if (!supabase || !user) return
    void supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(40)
      .then(({ data }) => setSent((data ?? []) as NotificationRow[]))
  }, [user])

  const groups = useMemo(() => {
    const list = rows
      .filter((a) => filter === 'all' || a.actor === filter)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    const byDay = new Map<string, Activity[]>()
    for (const a of list) {
      const d = a.created_at ? wallClock(new Date(a.created_at)).date : today
      byDay.set(d, [...(byDay.get(d) ?? []), a])
    }
    return [...byDay.entries()]
  }, [rows, filter, today])

  return (
    <div className="page">
      <Link to="/me" className="btn-ghost btn-sm -ml-2 mb-1">
        <ArrowLeft className="h-4 w-4" /> You
      </Link>
      <PageHeader title="Every change" subtitle="Everything you, Autobot, and the reminders did — on every device." />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['you', 'You'],
            ['autobot', 'Autobot'],
            ['system', 'Reminders'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`chip min-h-[34px] px-3.5 text-[13px] ${filter === value ? 'bg-primary text-primary-ink' : 'bg-surface text-ink-2 shadow-card'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filter === 'system' && sent.length > 0 && (
        <section className="card mb-4 px-4 py-2">
          <h2 className="py-2 text-[15px] font-black text-ink">Notifications sent</h2>
          <ul className="divide-y divide-line">
            {sent.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-2.5">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold text-ink">{n.title}</p>
                  <p className="text-[13px] font-semibold text-ink-3">{n.body}</p>
                </div>
                <span className="shrink-0 text-[12px] font-bold text-ink-3">
                  {relativeDay(wallClock(new Date(n.sent_at)).date, today)} {time(n.sent_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <Empty mood="idle" title="Nothing yet" body="Check something off or chat with Autobot — it all shows up here." />
        </div>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="mb-5">
            <h2 className="mb-2 px-1 text-[12px] font-black uppercase tracking-[0.08em] text-ink-3">
              {day === today ? 'Today' : relativeDay(day, today) === 'yesterday' ? 'Yesterday' : formatDate(day, { weekday: true })}
            </h2>
            <ol className="card divide-y divide-line px-4">
              {items.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  {a.actor === 'autobot' ? (
                    <Autobot size={24} mood="happy" float={false} className="mt-0.5" />
                  ) : (
                    <span className={`chip mt-0.5 shrink-0 px-2 py-0.5 text-[11px] ${ACTOR[a.actor].tone}`}>{ACTOR[a.actor].label}</span>
                  )}
                  <p className="min-w-0 flex-1 text-[14px] font-bold leading-snug text-ink">{a.summary}</p>
                  <span className="shrink-0 text-[12px] font-bold text-ink-3">{time(a.created_at)}</span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
