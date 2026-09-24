import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Pause, Play, Shuffle, TimerReset } from 'lucide-react'
import {
  addDays,
  classPhase,
  formatClock,
  formatDuration,
  hhmmToDayMinutes,
  MOMENT_ORDER,
  momentLabel,
  STACK_LABEL,
  type ClassBlock,
  type DayType,
  type LogKind,
  type Mission,
  type Moment,
  type Settings,
  type StackItem,
} from '@core/index.ts'
import { useActions } from '../lib/useActions'
import type { PerWeekRoutine } from '../lib/today'
import { AREA, AreaIcon, Progress, SizeBadge } from './ui'
import { Autobot, cheer } from './Autobot'
import { useToast } from './Toast'

const AREA_LINK: Partial<Record<Mission['area'], { to: string; label: string }>> = {
  hunt: { to: '/hunt', label: 'Open Hunt' },
  prep: { to: '/prep', label: 'Open Prep' },
  body: { to: '/body', label: 'Open Body' },
}

function Elapsed({ since }: { since: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  return <span className="num">{formatDuration((Date.now() - new Date(since).getTime()) / 60_000)}</span>
}

export function NextUpCard({
  mission,
  progress,
  type,
  moment,
  weekCount,
  weekTarget,
  onSwap,
  total,
}: {
  mission: Mission | null
  progress: number
  type: DayType
  moment: Moment
  weekCount?: number
  weekTarget?: number
  onSwap: () => void
  total: number
}) {
  const actions = useActions()
  const toast = useToast()

  if (!mission) {
    if (!total) return null
    return (
      <section className="card flex items-center gap-4 p-5">
        <Autobot mood="proud" size={64} />
        <div className="min-w-0">
          <p className="text-[18px] font-black text-ink">Board’s clear.</p>
          <p className="text-[14px] font-semibold text-ink-3">
            Real progress today. Want a bonus? <Link to="/prep" className="font-extrabold text-sky">Re-solve an old problem</Link>{' '}
            — or rest, guilt-free.
          </p>
        </div>
      </section>
    )
  }

  const doing = mission.status === 'doing'
  const link = AREA_LINK[mission.area]
  const laterMoment = MOMENT_ORDER[Math.min(MOMENT_ORDER.indexOf(moment) + 1, 4)]
  const pushLater = () => {
    const tonight = moment === 'night' || moment === 'bed'
    const undo = tonight
      ? actions.moveMission(mission, { day: addDays(mission.day, 1) })
      : actions.moveMission(mission, { moment: laterMoment === mission.moment ? 'night' : laterMoment })
    toast(tonight ? 'Moved to tomorrow' : 'Pushed a little later', { undo })
  }

  return (
    <section className="card relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${AREA[mission.area].fill}`} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-black uppercase tracking-[0.1em] text-accent">
          {doing ? 'In progress' : 'Next up'} · {momentLabel(mission.moment === 'anytime' ? moment : mission.moment, type)}
        </p>
        <SizeBadge size={mission.size} />
      </div>
      <div className="mt-2.5 flex items-start gap-3">
        <AreaIcon area={mission.area} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[21px] font-black leading-tight tracking-[-0.015em] text-ink">{mission.title}</h2>
          <p className="mt-1 text-[13px] font-bold text-ink-3">
            {doing && mission.started_at ? (
              <>
                Going for <Elapsed since={mission.started_at} />
              </>
            ) : mission.target_key && weekTarget ? (
              <>
                {mission.amount > 1 && (
                  <span className="num">
                    {Math.min(progress, mission.amount)}/{mission.amount} today ·{' '}
                  </span>
                )}
                <span className="num">
                  {weekCount}/{weekTarget}
                </span>{' '}
                this week
              </>
            ) : (
              AREA[mission.area].label
            )}
          </p>
        </div>
      </div>
      {mission.target_key && mission.amount > 1 && (
        <div className="mt-3">
          <Progress value={progress} max={mission.amount} className={AREA[mission.area].fill} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {doing ? (
          <>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                const undo = actions.toggleMission(mission)
                cheer()
                toast('That’s one. Proud of you.', { undo })
              }}
            >
              <Check className="h-5 w-5" strokeWidth={3} /> Done
            </button>
            <button type="button" className="btn-soft" onClick={() => actions.setMissionStatus(mission, 'todo')}>
              <Pause className="h-4 w-4" /> Pause
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                actions.setMissionStatus(mission, 'doing')
                toast('Started. Phone down, go.')
              }}
            >
              <Play className="h-4 w-4" fill="currentColor" /> Start
            </button>
            <button
              type="button"
              className="btn-soft"
              aria-label="Mark done"
              onClick={() => {
                const undo = actions.toggleMission(mission)
                cheer()
                toast('Checked off.', { undo })
              }}
            >
              <Check className="h-5 w-5" strokeWidth={3} />
            </button>
          </>
        )}
        <button type="button" className="btn-soft" onClick={onSwap} aria-label="Show a different mission">
          <Shuffle className="h-4 w-4" />
        </button>
        <button type="button" className="btn-soft" onClick={pushLater} aria-label="Do this later">
          <TimerReset className="h-4 w-4" />
        </button>
      </div>
      {link && (
        <Link to={link.to} className="mt-3 inline-flex items-center gap-1 text-[13px] font-extrabold text-sky">
          {link.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  )
}

/** After lights-out time, the only mission is sleep. */
export function BedtimeCard({ nowMins, bedMins, open, tomorrow }: { nowMins: number; bedMins: number; open: number; tomorrow: string }) {
  const late = nowMins >= bedMins
  return (
    <section className="card flex items-center gap-4 p-5">
      <Autobot mood="sleepy" size={64} />
      <div className="min-w-0">
        <p className="text-[18px] font-black text-ink">{late ? 'Past lights-out. Sleep wins.' : `Lights out by ${formatClock(bedMins)}`}</p>
        <p className="mt-0.5 text-[14px] font-semibold text-ink-3">
          {open > 0
            ? `${open} ${open === 1 ? 'mission' : 'missions'} left — they roll into the rest of the week, no guilt. `
            : 'Everything’s handled. '}
          {tomorrow}
        </p>
      </div>
    </section>
  )
}

export function StackCard({ stack, items }: { stack: 'morning' | 'night'; items: StackItem[] }) {
  const actions = useActions()
  const toast = useToast()
  if (!items.length) return null
  const allDone = items.every((i) => i.done)
  return (
    <section className={`card p-4 ${allDone ? 'opacity-80' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-black text-ink">{STACK_LABEL[stack]}</h3>
        <span className="text-[12px] font-bold text-ink-3">{allDone ? 'All done ✓' : 'Tap each one'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map(({ routine, done }) => (
          <button
            key={routine.id}
            type="button"
            aria-pressed={done}
            onClick={() => {
              const undo = actions.markRoutine(routine, !done)
              if (!done) {
                if (items.filter((i) => !i.done).length === 1) cheer()
                toast(`${routine.emoji} ${routine.name} ✓`, { undo })
              }
            }}
            className={[
              'flex min-h-[56px] items-center gap-2.5 rounded-2xl px-3 text-left transition active:scale-[0.97]',
              done ? 'bg-mint/15 text-ink' : 'bg-surface-2 text-ink hover:bg-surface-3',
            ].join(' ')}
          >
            <span className="text-[22px]" aria-hidden>
              {routine.emoji}
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-extrabold leading-tight">{routine.name}</span>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-mint text-white' : 'border-2 border-line-2'}`}
            >
              {done && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function PerWeekChips({ items }: { items: PerWeekRoutine[] }) {
  const actions = useActions()
  const toast = useToast()
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ routine, count, doneToday }) => (
        <button
          key={routine.id}
          type="button"
          aria-pressed={doneToday}
          onClick={() => {
            const undo = actions.markRoutine(routine, !doneToday)
            if (!doneToday) toast(`${routine.emoji} ${routine.name} logged`, { undo })
          }}
          className={`chip min-h-[36px] px-3 text-[13px] ${doneToday ? 'bg-mint/15 text-ink' : 'bg-surface text-ink-2 shadow-card'}`}
        >
          <span aria-hidden>{routine.emoji}</span> {routine.name}
          <span className="num text-ink-3">
            {count}/{routine.per_week}
          </span>
          {doneToday && <Check className="h-3.5 w-3.5 text-mint" strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}

export function ClassTimeline({ lectures, nowMins }: { lectures: ClassBlock[]; nowMins: number }) {
  if (!lectures.length) return null
  return (
    <section className="card p-4">
      <h3 className="text-[15px] font-black text-ink">Classes today</h3>
      <ol className="mt-3 space-y-2">
        {lectures.map((c) => {
          const phase = classPhase(c, nowMins)
          const start = hhmmToDayMinutes(c.start)
          const end = hhmmToDayMinutes(c.end)
          return (
            <li
              key={c.id}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${phase === 'live' ? 'bg-a-class/15' : 'bg-surface-2/70'} ${
                phase === 'ended' ? 'opacity-55' : ''
              }`}
            >
              <span className="num w-[62px] shrink-0 text-[12px] font-bold text-ink-3">{formatClock(start)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold text-ink">{c.name}</p>
                <p className="text-[12px] font-bold text-ink-3">
                  {c.room} · until {formatClock(end)}
                </p>
              </div>
              {phase === 'live' && <span className="chip bg-a-class text-white">Live</span>}
              {phase === 'upcoming' && start - nowMins <= 90 && (
                <span className="chip bg-accent/15 text-accent">in {formatDuration(start - nowMins)}</span>
              )}
              {phase === 'ended' && <Check className="h-4 w-4 text-ink-3" />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const PULSE: { key: LogKind & keyof Settings['targets']; label: string; area: Mission['area'] }[] = [
  { key: 'referral', label: 'Referral asks', area: 'hunt' },
  { key: 'application', label: 'Applications', area: 'hunt' },
  { key: 'leetcode', label: 'LeetCode', area: 'prep' },
  { key: 'workout', label: 'Workouts', area: 'body' },
]

export function WeekPulse({ totals, targets, daysLeft }: { totals: Record<LogKind, number>; targets: Settings['targets']; daysLeft: number }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-black text-ink">This week</h3>
        <span className="text-[12px] font-bold text-ink-3">
          {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PULSE.map(({ key, label, area }) => {
          const v = totals[key] ?? 0
          const t = targets[key]
          return (
            <div key={key}>
              <div className="mb-1 flex items-baseline justify-between text-[13px] font-bold">
                <span className="text-ink-2">{label}</span>
                <span className={`num ${v >= t ? 'text-mint' : 'text-ink-3'}`}>
                  {v}/{t}
                </span>
              </div>
              <Progress value={v} max={t} className={AREA[area].fill} />
            </div>
          )
        })}
      </div>
    </section>
  )
}
