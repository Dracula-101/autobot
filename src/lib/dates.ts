import {
  format,
  startOfWeek,
  addDays,
  parseISO,
  isBefore,
  isEqual,
} from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const TZ = 'America/Denver'

/** Current instant as a Date in America/Denver wall-clock fields */
export function nowInDenver(date = new Date()): Date {
  return toZonedTime(date, TZ)
}

/** YYYY-MM-DD for "today" in America/Denver */
export function todayKey(date = new Date()): string {
  return format(nowInDenver(date), 'yyyy-MM-dd')
}

/** Monday (weekStartsOn: 1) of the week containing date, as YYYY-MM-DD in Denver */
export function weekStartKey(date?: Date | string): string {
  const base =
    typeof date === 'string'
      ? parseISO(date.includes('T') ? date : date + 'T12:00:00')
      : date
        ? nowInDenver(date)
        : nowInDenver()
  const zoned = typeof date === 'string' ? base : nowInDenver(base)
  const mon = startOfWeek(zoned, { weekStartsOn: 1 })
  return format(mon, 'yyyy-MM-dd')
}

export function weekDays(weekStart: string): string[] {
  const start = parseISO(weekStart + 'T12:00:00')
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr + 'T12:00:00')
  const js = d.getDay()
  const monIndex = js === 0 ? 6 : js - 1
  return DAY_LABELS[monIndex]
}

export function dayKeyOf(dateStr: string): (typeof DAY_KEYS)[number] {
  const d = parseISO(dateStr + 'T12:00:00')
  const js = d.getDay()
  const monIndex = js === 0 ? 6 : js - 1
  return DAY_KEYS[monIndex]
}

export function formatPretty(dateStr: string): string {
  return format(parseISO(dateStr + 'T12:00:00'), 'EEE, MMM d')
}

export function isPastDay(dateStr: string, today = todayKey()): boolean {
  return isBefore(parseISO(dateStr + 'T12:00:00'), parseISO(today + 'T12:00:00'))
}

export function isSameDay(a: string, b: string): boolean {
  return isEqual(parseISO(a + 'T12:00:00'), parseISO(b + 'T12:00:00'))
}

/** UTC ISO for start/end of a Denver calendar day — useful for reminders */
export function denverDayBounds(dateStr: string): { start: string; end: string } {
  const start = fromZonedTime(`${dateStr}T00:00:00`, TZ)
  const end = fromZonedTime(`${dateStr}T23:59:59.999`, TZ)
  return { start: start.toISOString(), end: end.toISOString() }
}
