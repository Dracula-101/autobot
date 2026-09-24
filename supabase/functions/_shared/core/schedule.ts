import type {
  ClassBlock,
  DayType,
  LogEntry,
  LogKind,
  Mission,
  Moment,
  Routine,
  RoutineLog,
  Settings,
} from './types.ts'
import {
  addDays,
  DAY_KEYS,
  hhmmToDayMinutes,
  weekDates,
  weekdayOf,
  weekStart,
  type DayKey,
} from './time.ts'

export const live = <T extends { deleted_at?: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !r.deleted_at)

// ── Classes

export function classesOn(date: string, settings: Settings): ClassBlock[] {
  const wd = weekdayOf(date)
  return settings.classes
    .filter((c) => c.days.includes(wd) && date >= c.from && date <= c.until)
    .sort((a, b) => a.start.localeCompare(b.start))
}

export function semesterActive(date: string, settings: Settings): boolean {
  return settings.classes.some((c) => date >= c.from && date <= c.until)
}

export type ClassPhase = 'upcoming' | 'live' | 'ended'

export function classPhase(c: ClassBlock, nowMins: number): ClassPhase {
  const start = hhmmToDayMinutes(c.start)
  const end = hhmmToDayMinutes(c.end)
  if (nowMins < start) return 'upcoming'
  if (nowMins < end) return 'live'
  return 'ended'
}

// ── Day types

/** Dates on which a racket session was logged. */
export function racketDates(logs: LogEntry[]): Set<string> {
  return new Set(
    live(logs)
      .filter((l) => l.kind === 'workout' && (l.note ?? '').toLowerCase().includes('racket'))
      .map((l) => l.day),
  )
}

export function dayType(date: string, settings: Settings, racketDays: Set<string> = new Set()): DayType {
  if (classesOn(date, settings).length) return 'class'
  const wd = weekdayOf(date)
  if (settings.sportDays.includes(wd)) {
    // Racket floats between the sport days: if it already happened on the
    // previous sport day, today goes back to being a full campus day.
    const prev = addDays(date, -1)
    if (settings.sportDays.includes(weekdayOf(prev)) && racketDays.has(prev)) return 'free'
    return 'sport'
  }
  return 'free'
}

export const CAPACITY: Record<DayType, number> = { free: 3, sport: 2, class: 1.5 }

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  class: 'Class day',
  free: 'Free day',
  sport: 'Racket day',
}

// ── Moments

export const MOMENT_ORDER: Moment[] = ['wake', 'out', 'evening', 'night', 'bed', 'anytime']

export function momentLabel(m: Moment, type: DayType): string {
  switch (m) {
    case 'wake':
      return 'After waking'
    case 'out':
      return type === 'class' ? 'Around class' : 'Out of the room'
    case 'evening':
      return 'Evening'
    case 'night':
      return 'Night-owl hours'
    case 'bed':
      return 'Before bed'
    default:
      return 'Anytime'
  }
}

export function momentHint(m: Moment, type: DayType): string {
  switch (m) {
    case 'wake':
      return 'Up, stack done, out the door'
    case 'out':
      return type === 'class' ? 'Gaps between lectures count' : 'Campus or library — never your room'
    case 'evening':
      return 'Move, eat, one more push'
    case 'night':
      return 'Your sharp hours — one focused thing'
    case 'bed':
      return 'Night stack, screens down'
    default:
      return ''
  }
}

export interface MomentContext {
  nowMins: number
  settings: Settings
  type: DayType
  wakeMins?: number | null
  lastClassEnd?: number | null
}

export function currentMoment(ctx: MomentContext): Moment {
  const bed = hhmmToDayMinutes(ctx.settings.sleep.bed, ctx.settings.rolloverHour)
  const wake = ctx.wakeMins ?? hhmmToDayMinutes(ctx.settings.sleep.wake, ctx.settings.rolloverHour)
  const n = ctx.nowMins
  if (n >= bed - 60) return 'bed'
  if (n >= 22 * 60) return 'night'
  if (n < wake + 60) return 'wake'
  const outUntil = ctx.type === 'class' ? (ctx.lastClassEnd ?? 18 * 60 + 15) : 18 * 60
  if (n < outUntil) return 'out'
  return 'evening'
}

function momentRank(m: Moment, current: Moment): number {
  if (m === 'anytime') return 0
  const cur = MOMENT_ORDER.indexOf(current)
  const idx = MOMENT_ORDER.indexOf(m)
  // Now and later first, then anything left over from earlier in the day.
  return idx >= cur ? idx - cur : 10 + idx
}

export function sortMissions(missions: Mission[], current: Moment): Mission[] {
  return [...missions].sort(
    (a, b) =>
      momentRank(a.moment, current) - momentRank(b.moment, current) || a.sort - b.sort,
  )
}

/** The single thing Autobot spotlights. */
export function pickNextUp(missions: Mission[], current: Moment, skip: string[] = []): Mission | null {
  const open = live(missions).filter(
    (m) => (m.status === 'todo' || m.status === 'doing') && !skip.includes(m.id),
  )
  const doing = open.find((m) => m.status === 'doing')
  if (doing) return doing
  return sortMissions(open, current)[0] ?? null
}

// ── Week totals

export function weekTotals(logs: LogEntry[], date: string, opts: { before?: string } = {}): Record<LogKind, number> {
  const ws = weekStart(date)
  const end = addDays(ws, 7)
  const totals: Record<LogKind, number> = {
    referral: 0,
    application: 0,
    followup: 0,
    leetcode: 0,
    workout: 0,
    scalp: 0,
    other: 0,
  }
  for (const l of live(logs)) {
    if (l.day < ws || l.day >= end) continue
    if (opts.before && l.day >= opts.before) continue
    totals[l.kind] = (totals[l.kind] ?? 0) + l.amount
  }
  return totals
}

/**
 * How much real progress counts toward each target mission today. Logs tied
 * to a mission go to it first; the rest of the day's pool fills missions of
 * the same kind in order. So "Send 2 referral messages" completes itself when
 * two referrals get logged from the Hunt page.
 */
export function missionProgress(missions: Mission[], logs: LogEntry[], date: string): Map<string, number> {
  const out = new Map<string, number>()
  const todays = live(logs).filter((l) => l.day === date)
  const targeted = live(missions)
    .filter((m) => m.day === date && m.target_key)
    .sort((a, b) => a.sort - b.sort)
  const pool: Partial<Record<LogKind, number>> = {}
  for (const l of todays) {
    const owner = l.ref_id ? targeted.find((m) => m.id === l.ref_id) : undefined
    if (owner) out.set(owner.id, (out.get(owner.id) ?? 0) + l.amount)
    else pool[l.kind] = (pool[l.kind] ?? 0) + l.amount
  }
  for (const m of targeted) {
    const kind = m.target_key!
    const have = out.get(m.id) ?? 0
    const take = Math.max(0, Math.min(m.amount - have, pool[kind] ?? 0))
    pool[kind] = (pool[kind] ?? 0) - take
    out.set(m.id, Math.min(m.amount, have + take))
  }
  return out
}

export function logsOn(logs: LogEntry[], date: string, kind?: LogKind): number {
  return live(logs)
    .filter((l) => l.day === date && (!kind || l.kind === kind))
    .reduce((sum, l) => sum + l.amount, 0)
}

// ── Routines

export function routinesFor(date: string, routines: Routine[]): Routine[] {
  const wd = weekdayOf(date)
  return live(routines)
    .filter((r) => r.active && (r.per_week ? true : r.days.includes(wd)))
    .sort((a, b) => a.sort - b.sort)
}

export function routineDone(routineId: string, date: string, logs: RoutineLog[]): boolean {
  return live(logs).some((l) => l.routine_id === routineId && l.day === date)
}

export function routineWeekCount(routineId: string, date: string, logs: RoutineLog[]): number {
  const dates = new Set(weekDates(weekStart(date)))
  return live(logs).filter((l) => l.routine_id === routineId && dates.has(l.day)).length
}

/** Expected count of an x-per-week routine by the end of `date`. */
export function perWeekExpected(perWeek: number, date: string): number {
  const idx = DAY_KEYS.indexOf(weekdayOf(date)) + 1
  return Math.ceil((perWeek * idx) / 7)
}

export interface StackItem {
  routine: Routine
  done: boolean
}

export function stackItems(
  stack: 'morning' | 'night',
  date: string,
  routines: Routine[],
  logs: RoutineLog[],
): StackItem[] {
  return routinesFor(date, routines)
    .filter((r) => r.stack === stack)
    .map((routine) => ({ routine, done: routineDone(routine.id, date, logs) }))
}

export function weekdayShort(d: DayKey): string {
  return d.charAt(0).toUpperCase() + d.slice(1)
}
