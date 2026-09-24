// Denver wall-clock helpers. Pure Intl — runs in the browser and in Deno.
//
// Autobot thinks in *logical days*: a night owl's 2 AM still belongs to
// "tonight", so the day only rolls over at `rolloverHour` (default 5 AM).
// Times on a logical day are "day minutes" measured from that day's midnight
// and may run past 1440 (02:30 AM next morning = 1590).

export const TZ = 'America/Denver'

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const DAY_NAMES: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

export interface WallClock {
  /** Calendar date in the zone, YYYY-MM-DD */
  date: string
  hour: number
  minute: number
  /** Minutes since the calendar midnight */
  minutes: number
  weekday: DayKey
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
    formatters.set(tz, f)
  }
  return f
}

const WEEKDAY_FROM_SHORT: Record<string, DayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
}

export function wallClock(at: Date = new Date(), tz = TZ): WallClock {
  const parts: Record<string, string> = {}
  for (const p of formatter(tz).formatToParts(at)) parts[p.type] = p.value
  const hour = Number(parts.hour) % 24
  const minute = Number(parts.minute)
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
    weekday: WEEKDAY_FROM_SHORT[parts.weekday] ?? 'mon',
  }
}

// ── Calendar-date arithmetic on YYYY-MM-DD strings (noon UTC avoids DST edges)

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date)
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10)
}

export function weekdayOf(date: string): DayKey {
  const [y, m, d] = parts(date)
  const js = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() // 0 = Sunday
  return DAY_KEYS[(js + 6) % 7]
}

/** Monday of the week containing `date` */
export function weekStart(date: string): string {
  return addDays(date, -DAY_KEYS.indexOf(weekdayOf(date)))
}

export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

// ── Logical day

export function logicalDay(at: Date = new Date(), rolloverHour = 5, tz = TZ): string {
  const w = wallClock(at, tz)
  return w.minutes < rolloverHour * 60 ? addDays(w.date, -1) : w.date
}

/** Minutes since the logical day's midnight (can exceed 1440 after midnight). */
export function dayMinutes(at: Date = new Date(), rolloverHour = 5, tz = TZ): number {
  const w = wallClock(at, tz)
  return w.minutes < rolloverHour * 60 ? w.minutes + 1440 : w.minutes
}

/** 'HH:MM' → day minutes; times before the rollover hour land after midnight. */
export function hhmmToDayMinutes(hhmm: string, rolloverHour = 5): number {
  const [h, m] = hhmm.split(':').map(Number)
  const minutes = (h % 24) * 60 + (m || 0)
  return minutes < rolloverHour * 60 ? minutes + 1440 : minutes
}

export function dayMinutesToHhmm(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** The UTC instant of `dayMins` on logical day `date` in the zone. */
export function instantOf(date: string, dayMins: number, tz = TZ): Date {
  const extraDays = Math.floor(dayMins / 1440)
  const cal = addDays(date, extraDays)
  const mins = dayMins - extraDays * 1440
  const [y, m, d] = parts(cal)
  const h = Math.floor(mins / 60)
  const mi = mins % 60
  const target = Date.UTC(y, m - 1, d, h, mi)
  let guess = target
  // Two passes converge across DST transitions.
  for (let i = 0; i < 2; i++) {
    const w = wallClock(new Date(guess), tz)
    const [wy, wm, wd] = parts(w.date)
    const seen = Date.UTC(wy, wm - 1, wd, w.hour, w.minute)
    guess -= seen - target
  }
  return new Date(guess)
}

/** Day minutes of an instant relative to a given logical day. */
export function minutesOnDay(at: Date, date: string, tz = TZ): number {
  const w = wallClock(at, tz)
  return daysBetween(date, w.date) * 1440 + w.minutes
}

// ── Formatting

export function formatClock(dayMins: number): string {
  const m = ((Math.round(dayMins) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, '0')} ${suffix}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(date: string, opts: { weekday?: boolean } = {}): string {
  const [, m, d] = parts(date)
  const base = `${MONTHS[m - 1]} ${d}`
  if (!opts.weekday) return base
  return `${DAY_NAMES[weekdayOf(date)].slice(0, 3)}, ${base}`
}

export function formatDuration(mins: number): string {
  const m = Math.max(0, Math.round(mins))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

/** Friendly relative label: today / tomorrow / yesterday / Mon, Sep 29 */
export function relativeDay(date: string, today: string): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 1 && diff < 7) return DAY_NAMES[weekdayOf(date)]
  return formatDate(date, { weekday: true })
}
