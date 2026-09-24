import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, MessageCircle, Moon, Sun } from 'lucide-react'
import {
  addDays,
  DAY_KEYS,
  formatClock,
  hhmmToDayMinutes,
  live,
  logicalDay,
  minutesOnDay,
  routinesFor,
  stackItems,
  weekDates,
  weekStart,
  weekTotals,
  type Checkin,
  type LogEntry,
  type Routine,
  type RoutineLog,
} from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { useActions } from '../lib/useActions'
import { PageHeader } from '../components/Shell'
import { PerWeekChips, StackCard } from '../components/TodayCards'
import { useToast } from '../components/Toast'
import { cheer } from '../components/Autobot'
import { Progress, SectionTitle } from '../components/ui'

const WORKOUTS = [
  { note: 'racket', label: 'Squash / badminton', emoji: '🏸' },
  { note: 'gym', label: 'Gym', emoji: '🏋️' },
  { note: 'run', label: 'Run', emoji: '🏃' },
  { note: 'walk', label: 'Long walk', emoji: '🚶' },
]

/** Consecutive days (ending today or yesterday) with every stack routine done. */
function stackStreak(routines: Routine[], logs: RoutineLog[], today: string): number {
  const done = new Set(live(logs).map((l) => `${l.routine_id}:${l.day}`))
  const complete = (day: string) => {
    const due = routinesFor(day, routines).filter((r) => r.stack)
    return due.length > 0 && due.every((r) => done.has(`${r.id}:${day}`))
  }
  let day = complete(today) ? today : addDays(today, -1)
  let streak = 0
  while (streak < 365 && complete(day)) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

export function BodyPage() {
  const { settings, updateSettings } = useApp()
  const actions = useActions()
  const toast = useToast()
  const routines = useRows<Routine>('routines')
  const routineLogs = useRows<RoutineLog>('routine_logs')
  const logs = useRows<LogEntry>('logs')
  const checkins = useRows<Checkin>('day_checkins')
  const today = logicalDay(new Date(), settings.rolloverHour)
  const morning = stackItems('morning', today, routines, routineLogs)
  const night = stackItems('night', today, routines, routineLogs)
  const perWeek = routinesFor(today, routines)
    .filter((r) => r.per_week)
    .map((routine) => ({
      routine,
      count: live(routineLogs).filter((l) => l.routine_id === routine.id && l.day >= weekStart(today)).length,
      doneToday: live(routineLogs).some((l) => l.routine_id === routine.id && l.day === today),
    }))
  const streak = useMemo(() => stackStreak(routines, routineLogs, today), [routines, routineLogs, today])
  const workouts = weekTotals(logs, today).workout
  const [bed, setBed] = useState(settings.sleep.bed)
  const [wake, setWake] = useState(settings.sleep.wake)

  const wakeups = weekDates(weekStart(today)).map((d) => {
    const c = checkins.find((x) => x.date === d)
    return { day: d, mins: c ? minutesOnDay(new Date(c.checked_in_at), d) : null }
  })
  const target = hhmmToDayMinutes(settings.sleep.wake, settings.rolloverHour)
  const seen = wakeups.filter((w) => w.mins != null) as { day: string; mins: number }[]
  const onTime = seen.filter((w) => Math.abs(w.mins - target) <= 60).length

  return (
    <div className="page">
      <PageHeader title="Body" subtitle="Hair, sleep, and getting fitter — the boring stuff that compounds." />

      <div className="grid gap-4 sm:grid-cols-2">
        <StackCard stack="morning" items={morning} />
        <StackCard stack="night" items={night} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="card flex items-center gap-3 px-4 py-3">
          <Flame className={`h-6 w-6 ${streak ? 'text-accent' : 'text-ink-3'}`} aria-hidden />
          <div>
            <p className="num text-[20px] font-bold leading-none text-ink">{streak}</p>
            <p className="text-[12px] font-extrabold text-ink-3">day stack streak</p>
          </div>
        </div>
        <PerWeekChips items={perWeek} />
      </div>

      <section className="mt-6">
        <SectionTitle
          title="Workouts"
          hint={`${workouts}/${settings.targets.workout} this week · racket counts`}
        />
        <div className="card p-4">
          <Progress value={workouts} max={settings.targets.workout} className="bg-a-body" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WORKOUTS.map((w) => (
              <button
                key={w.note}
                type="button"
                className="btn-soft flex-col gap-1 py-3"
                onClick={() => {
                  const undo = actions.logProgress('workout', 1, w.note)
                  cheer()
                  toast(`${w.emoji} ${w.label} logged`, { undo })
                }}
              >
                <span className="text-[22px]" aria-hidden>
                  {w.emoji}
                </span>
                <span className="text-[13px]">{w.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle title="Sleep" hint="Consistent beats short. Same window every night." />
        <div className="card p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label flex items-center gap-1.5">
                <Moon className="h-4 w-4" /> Lights out
              </span>
              <input
                type="time"
                className="field"
                value={bed}
                onChange={(e) => setBed(e.target.value)}
                onBlur={() => bed && bed !== settings.sleep.bed && updateSettings({ sleep: { ...settings.sleep, bed } })}
              />
            </label>
            <label className="block">
              <span className="label flex items-center gap-1.5">
                <Sun className="h-4 w-4" /> Up by
              </span>
              <input
                type="time"
                className="field"
                value={wake}
                onChange={(e) => setWake(e.target.value)}
                onBlur={() => wake && wake !== settings.sleep.wake && updateSettings({ sleep: { ...settings.sleep, wake } })}
              />
            </label>
          </div>
          <p className="mt-4 text-[13px] font-extrabold text-ink-2">
            When you opened Autobot this week {seen.length > 0 && `· ${onTime}/${seen.length} within an hour of your target`}
          </p>
          <div className="mt-2 grid grid-cols-7 gap-1.5 text-center">
            {wakeups.map((w, i) => {
              const off = w.mins != null ? Math.abs(w.mins - target) : null
              return (
                <div key={w.day} className="rounded-xl bg-surface-2/70 px-1 py-2">
                  <p className="text-[11px] font-extrabold uppercase text-ink-3">{DAY_KEYS[i].slice(0, 2)}</p>
                  <p
                    className={`num mt-1 text-[11px] font-bold ${
                      off == null ? 'text-ink-3' : off <= 60 ? 'text-mint' : off <= 120 ? 'text-amber' : 'text-rose'
                    }`}
                  >
                    {w.mins != null ? formatClock(w.mins).replace(' ', '') : '—'}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] font-bold text-ink-3">
            Autobot uses your first open of the day as “woke up” for the morning stack reminder.
          </p>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle title="Hair & scalp" />
        <div className="card space-y-3 p-4 text-[14px] font-semibold leading-relaxed text-ink-2">
          <p>
            Flakes plus stress-shedding is common, and it’s usually treatable. What tends to help, alongside your pills and
            serum:
          </p>
          <ul className="space-y-1.5">
            <li>• An anti-dandruff shampoo (ketoconazole, zinc pyrithione, or selenium sulfide) 2–3× a week — leave it on 3–5 minutes.</li>
            <li>• Sleep in a steady window. Stress and short sleep both push hair into shedding.</li>
            <li>• Enough protein and iron; ask a doctor before adding supplements.</li>
          </ul>
          <p className="text-[13px] text-ink-3">
            General info, not medical advice. If shedding lasts more than a couple of months or your scalp is itchy or red, see a
            dermatologist or CU’s campus health center.
          </p>
          <Link
            to="/chat"
            state={{ prefill: 'Help me set up a simple hair and scalp routine that fits my schedule.' }}
            className="btn-soft btn-sm"
          >
            <MessageCircle className="h-4 w-4" /> Plan it with Autobot
          </Link>
        </div>
      </section>
    </div>
  )
}
