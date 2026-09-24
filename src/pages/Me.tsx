import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BatteryCharging, Brain, ChevronRight, History, LogOut, Plus, Trash2 } from 'lucide-react'
import {
  DAY_KEYS,
  DAY_NAMES,
  formatClock,
  hhmmToDayMinutes,
  live,
  STACK_LABEL,
  type ClassBlock,
  type DayKey,
  type Routine,
  type Settings,
  type ThemePref,
  type Voice,
} from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { useActions } from '../lib/useActions'
import type { SyncRow } from '../lib/sync'
import { Autobot } from '../components/Autobot'
import { NotificationSettings } from '../components/Notifications'
import { PageHeader, SyncBadge } from '../components/Shell'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Segmented, SectionTitle } from '../components/ui'

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <SectionTitle title={title} hint={hint} />
      <div className="card p-4">{children}</div>
    </section>
  )
}

function routineWhen(r: Routine): string {
  if (r.stack) return STACK_LABEL[r.stack]
  if (r.per_week) return `${r.per_week}× a week${r.at_time ? ` · nudge ${formatClock(hhmmToDayMinutes(r.at_time))}` : ''}`
  if (r.at_time) return `Daily at ${formatClock(hhmmToDayMinutes(r.at_time))}`
  return 'Daily'
}

type RoutineKind = 'morning' | 'night' | 'time' | 'weekly'

function RoutineSheet({ routine, open, onClose }: { routine: Routine | null; open: boolean; onClose: () => void }) {
  const actions = useActions()
  const [name, setName] = useState(routine?.name ?? '')
  const [emoji, setEmoji] = useState(routine?.emoji ?? '✨')
  const [kind, setKind] = useState<RoutineKind>(
    routine?.stack ?? (routine?.per_week ? 'weekly' : routine ? 'time' : 'morning'),
  )
  const [time, setTime] = useState(routine?.at_time ?? '20:00')
  const [perWeek, setPerWeek] = useState(routine?.per_week ?? 3)

  const save = () => {
    if (!name.trim()) return
    actions.saveRoutine({
      ...(routine ?? {}),
      name: name.trim(),
      emoji: emoji || '✨',
      stack: kind === 'morning' || kind === 'night' ? kind : null,
      anchor: kind === 'morning' ? 'wake' : kind === 'night' ? 'bed' : 'time',
      offset_min: kind === 'morning' ? 15 : kind === 'night' ? 45 : 0,
      at_time: kind === 'morning' ? '11:30' : kind === 'night' ? null : time,
      per_week: kind === 'weekly' ? perWeek : null,
    })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={routine ? 'Edit routine' : 'New routine'}
      footer={
        <button type="button" className="btn-primary flex-1" onClick={save} disabled={!name.trim()}>
          Save
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            className="field w-16 text-center text-[22px]"
            value={emoji}
            onChange={(e) => setEmoji([...e.target.value].slice(-1).join(''))}
            aria-label="Emoji"
          />
          <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vitamin D" aria-label="Name" />
        </div>
        <div>
          <p className="label">When</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['morning', 'With morning stack'],
                ['night', 'With night stack'],
                ['time', 'At a set time'],
                ['weekly', 'A few times a week'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`btn-sm rounded-xl font-extrabold ${kind === k ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {(kind === 'time' || kind === 'weekly') && (
          <label className="block">
            <span className="label">{kind === 'weekly' ? 'Nudge me around' : 'Time'}</span>
            <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
        {kind === 'weekly' && (
          <label className="block">
            <span className="label">Times per week</span>
            <select className="field" value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-[13px] font-semibold text-ink-3">
          Stacks send one reminder for everything in them — after you first open Autobot in the morning, and before your
          bedtime at night.
        </p>
      </div>
    </Sheet>
  )
}

function ClassEditor({ settings, onChange }: { settings: Settings; onChange: (classes: ClassBlock[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<ClassBlock>({
    id: '',
    name: '',
    short: '',
    room: '',
    days: ['tue', 'thu'],
    start: '12:30',
    end: '13:45',
    from: '2027-01-11',
    until: '2027-05-07',
  })
  const save = () => {
    if (!draft.name.trim()) return
    onChange([...settings.classes, { ...draft, id: crypto.randomUUID(), short: draft.short || draft.name.split(' ')[0] }])
    setAdding(false)
  }
  return (
    <div className="space-y-2">
      {settings.classes.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold text-ink">{c.name}</p>
            <p className="text-[12px] font-bold text-ink-3">
              {c.days.map((d) => DAY_NAMES[d].slice(0, 3)).join('/')} {formatClock(hhmmToDayMinutes(c.start))}–
              {formatClock(hhmmToDayMinutes(c.end))} · {c.room} · until {c.until}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm h-9 w-9 px-0 text-rose"
            onClick={() => onChange(settings.classes.filter((x) => x.id !== c.id))}
            aria-label={`Remove ${c.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {adding ? (
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <input className="field" placeholder="Course name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="field" placeholder="Short name" value={draft.short} onChange={(e) => setDraft({ ...draft, short: e.target.value })} />
            <input className="field" placeholder="Room" value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} />
            <input type="time" className="field" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} aria-label="Starts" />
            <input type="time" className="field" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} aria-label="Ends" />
            <input type="date" className="field" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} aria-label="First day" />
            <input type="date" className="field" value={draft.until} onChange={(e) => setDraft({ ...draft, until: e.target.value })} aria-label="Last day" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_KEYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setDraft({ ...draft, days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d] })
                }
                className={`chip min-h-[34px] px-3 ${draft.days.includes(d) ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
              >
                {DAY_NAMES[d].slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary btn-sm flex-1" onClick={save}>
              Add class
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-soft btn-sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add a class (next semester too)
        </button>
      )}
    </div>
  )
}

export function MePage() {
  const { name, user, settings, updateSettings, updateProfile, signOut, profile, cloud } = useApp()
  const actions = useActions()
  const toast = useToast()
  const memories = useRows<SyncRow>('memories')
  const routines = live(useRows<Routine>('routines')).sort((a, b) => a.sort - b.sort)
  const [routineSheet, setRoutineSheet] = useState<{ routine: Routine | null } | null>(null)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? name)

  return (
    <div className="page">
      <PageHeader title="You" subtitle={<SyncBadge />} />

      <div className="card flex items-center gap-4 p-5">
        <Autobot size={72} mood="love" track reactive />
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-black text-ink">Hey, {name}</p>
          <p className="text-[14px] font-semibold text-ink-3">
            I know {memories.length} things about you. Every change is saved and synced{cloud ? '' : ' on this device'}.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/me/memory" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet/15 text-violet">
            <Brain className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-ink">What I know about you</span>
            <span className="block text-[13px] font-semibold text-ink-3">Edit, pin, or make me forget</span>
          </span>
          <ChevronRight className="h-5 w-5 text-ink-3" />
        </Link>
        <Link to="/me/changes" className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky/15 text-sky">
            <History className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-ink">Every change</span>
            <span className="block text-[13px] font-semibold text-ink-3">Yours, mine, and reminders sent</span>
          </span>
          <ChevronRight className="h-5 w-5 text-ink-3" />
        </Link>
      </div>

      <Card title="Notifications" hint="How I tap you on the shoulder when the app is closed">
        <NotificationSettings />
      </Card>

      <Card title="Routines" hint="Pills, serum, and anything else that repeats">
        <ul className="divide-y divide-line">
          {routines.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="text-[22px]" aria-hidden>
                {r.emoji}
              </span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setRoutineSheet({ routine: r })}>
                <span className="block truncate text-[15px] font-extrabold text-ink">{r.name}</span>
                <span className="block text-[12px] font-bold text-ink-3">{routineWhen(r)}</span>
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm h-9 w-9 px-0 text-rose"
                aria-label={`Remove ${r.name}`}
                onClick={() => {
                  const undo = actions.deleteRoutine(r)
                  toast('Routine removed', { undo })
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-soft btn-sm mt-2" onClick={() => setRoutineSheet({ routine: null })}>
          <Plus className="h-4 w-4" /> Add a routine
        </button>
      </Card>

      <Card title="Power cells" hint="How Autobot tracks progress — no quotas">
        <div className="flex gap-3">
          <BatteryCharging className="mt-0.5 h-6 w-6 shrink-0 text-mint" aria-hidden />
          <ul className="space-y-1.5 text-[14px] font-semibold text-ink-2">
            <li>Anything you log charges a cell — Hunt, Prep, or Body. One thing or ten.</li>
            <li>Cells drain a little each day, so one action a day keeps a cell full.</li>
            <li>Big days overflow into “supercharged” and carry you through lighter ones.</li>
            <li>Each morning you tell me your battery; I size the day to match.</li>
          </ul>
        </div>
      </Card>

      <Card title="Schedule" hint="Only classes have clock times. Everything else flexes.">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Lights out</span>
              <input
                type="time"
                className="field"
                defaultValue={settings.sleep.bed}
                onBlur={(e) => e.target.value && updateSettings({ sleep: { ...settings.sleep, bed: e.target.value } })}
              />
            </label>
            <label className="block">
              <span className="label">Up by</span>
              <input
                type="time"
                className="field"
                defaultValue={settings.sleep.wake}
                onBlur={(e) => e.target.value && updateSettings({ sleep: { ...settings.sleep, wake: e.target.value } })}
              />
            </label>
          </div>
          <div>
            <p className="label">Racket happens on</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_KEYS.map((d) => {
                const on = settings.sportDays.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        sportDays: on ? settings.sportDays.filter((x) => x !== d) : ([...settings.sportDays, d] as DayKey[]),
                      })
                    }
                    className={`chip min-h-[34px] px-3 ${on ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
                  >
                    {DAY_NAMES[d].slice(0, 3)}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-[12px] font-bold text-ink-3">If you play on the first day, the next one turns back into a full campus day.</p>
          </div>
          <div>
            <p className="label">Classes</p>
            <ClassEditor settings={settings} onChange={(classes) => updateSettings({ classes })} />
          </div>
        </div>
      </Card>

      <Card title="Autobot’s voice">
        <Segmented
          value={settings.voice}
          onChange={(v: Voice) => updateSettings({ voice: v })}
          options={[
            { value: 'gentle', label: 'Gentle' },
            { value: 'firm', label: 'Firm friend' },
            { value: 'strict', label: 'Strict' },
          ]}
        />
      </Card>

      <Card title="Sky" hint="Auto follows the real Boulder sunrise and sunset">
        <Segmented
          value={settings.theme}
          onChange={(v: ThemePref) => updateSettings({ theme: v })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'day', label: 'Always day' },
            { value: 'night', label: 'Always night' },
          ]}
        />
      </Card>

      <Card title="Account">
        <div className="space-y-3">
          <label className="block">
            <span className="label">What should I call you?</span>
            <input
              className="field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => displayName.trim() && updateProfile({ display_name: displayName.trim() })}
            />
          </label>
          {user && <p className="text-[14px] font-semibold text-ink-3">Signed in as {user.email}</p>}
          {cloud && user && (
            <button type="button" className="btn-soft w-full" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>
      </Card>

      {routineSheet && (
        <RoutineSheet
          key={routineSheet.routine?.id ?? 'new'}
          routine={routineSheet.routine}
          open
          onClose={() => setRoutineSheet(null)}
        />
      )}
    </div>
  )
}
