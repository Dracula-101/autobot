// Autobot's power cells. There are no quotas: anything logged charges a cell,
// and cells drain a little each day. One action a day keeps a cell full; a big
// day overflows ("supercharged") and carries you through a lighter one.

import type { Cell, LogEntry, LogKind } from './types.ts'
import { addDays, daysBetween, weekDates, weekStart } from './time.ts'

export const CELLS: Cell[] = ['hunt', 'prep', 'body']

export const CELL_KINDS: Record<Cell, LogKind[]> = {
  hunt: ['referral', 'application', 'followup'],
  prep: ['leetcode'],
  body: ['workout'],
}

export const CELL_LABEL: Record<Cell, string> = { hunt: 'Hunt', prep: 'Prep', body: 'Body' }

/** The smallest thing that tops each cell up — used in copy, never as a quota. */
export const CELL_NUDGE: Record<Cell, string> = {
  hunt: 'one message tops it up',
  prep: 'one problem tops it up',
  body: 'a walk tops it up',
}

export function cellOf(kind: string | null | undefined): Cell | null {
  if (!kind) return null
  for (const cell of CELLS) if ((CELL_KINDS[cell] as string[]).includes(kind)) return cell
  return null
}

/** Share of charge a cell keeps from one day to the next. */
export const DRAIN_KEEP = 0.72
/** Charge from the first action of a day; later actions add half as much again each. */
const FIRST_ACTION = 0.3
/** Room above "full" for big days. */
const MAX_LEVEL = 1.5
/** Fresh batteries on day one. */
const START_LEVEL = 0.6

export function dayGain(units: number): number {
  if (units <= 0) return 0
  return FIRST_ACTION * 2 * (1 - 0.5 ** units)
}

export type CellStatus = 'drained' | 'low' | 'good' | 'full' | 'super'

export function cellStatus(level: number): CellStatus {
  if (level >= 1.15) return 'super'
  if (level >= 0.9) return 'full'
  if (level >= 0.55) return 'good'
  if (level >= 0.25) return 'low'
  return 'drained'
}

export const STATUS_LABEL: Record<CellStatus, string> = {
  drained: 'Drained',
  low: 'Low',
  good: 'Good',
  full: 'Full',
  super: 'Supercharged',
}

export interface CellState {
  cell: Cell
  /** 0 … 1.5 — above 1 is overflow from big days */
  level: number
  status: CellStatus
  /** Actions logged today */
  today: number
  /** Active on each day of this week, Monday first */
  week: boolean[]
  /** Days in a row with at least one action (ending today, or yesterday if today is still open) */
  streak: number
  lastActive: string | null
}

function unitsByDay(logs: LogEntry[], cell: Cell): Map<string, number> {
  const kinds = CELL_KINDS[cell] as string[]
  const map = new Map<string, number>()
  for (const l of logs) {
    if (l.deleted_at || !kinds.includes(l.kind)) continue
    map.set(l.day, (map.get(l.day) ?? 0) + l.amount)
  }
  return map
}

/**
 * Charge of every cell as of `today`. `since` is the first day we know about
 * (e.g. first check-in) — cells start "fresh" there instead of empty.
 */
export function cellStates(logs: LogEntry[], today: string, since?: string | null): Record<Cell, CellState> {
  const firstLog = logs.reduce<string | null>((min, l) => (!l.deleted_at && (!min || l.day < min) ? l.day : min), null)
  const known = [since, firstLog].filter((d): d is string => Boolean(d)).sort()[0] ?? today
  const start = daysBetween(known, today) > 60 ? addDays(today, -60) : known
  const week = weekDates(weekStart(today))

  const out = {} as Record<Cell, CellState>
  for (const cell of CELLS) {
    const units = unitsByDay(logs, cell)
    let level = START_LEVEL
    for (let d = start; d <= today; d = addDays(d, 1)) {
      level = Math.min(MAX_LEVEL, level * DRAIN_KEEP + dayGain(Math.max(0, units.get(d) ?? 0)))
    }
    const active = (d: string) => (units.get(d) ?? 0) > 0
    let streak = 0
    for (let d = active(today) ? today : addDays(today, -1); active(d) && streak < 365; d = addDays(d, -1)) streak++
    const days = [...units.keys()].filter((d) => d <= today && active(d)).sort()
    out[cell] = {
      cell,
      level,
      status: cellStatus(level),
      today: Math.max(0, units.get(today) ?? 0),
      week: week.map((d) => d <= today && active(d)),
      streak,
      lastActive: days[days.length - 1] ?? null,
    }
  }
  return out
}

/** Cells ordered from most to least in need of a charge. */
export function neediestCells(states: Record<Cell, CellState>): Cell[] {
  return [...CELLS].sort((a, b) => states[a].level - states[b].level)
}

/** Overall power, 0 … 1 (overflow doesn't count twice). */
export function robotPower(states: Record<Cell, CellState>): number {
  return CELLS.reduce((sum, c) => sum + Math.min(1, states[c].level), 0) / CELLS.length
}

export function describeCells(states: Record<Cell, CellState>): string {
  return CELLS.map((c) => `${CELL_LABEL[c]} ${STATUS_LABEL[states[c].status].toLowerCase()}`).join(' · ')
}
