// Which push notifications are due right now. Runs server-side every few
// minutes; each reminder has a scheduled time and a validity window, so a late
// cron tick still delivers and a duplicate tick is a no-op (dedupe keys).

import type { Checkin, Contact, LogEntry, Mission, Routine, RoutineLog, Settings } from './types.ts'
import {
  dayMinutes,
  formatClock,
  hhmmToDayMinutes,
  logicalDay,
  minutesOnDay,
  weekdayOf,
  weekStart,
  addDays,
} from './time.ts'
import {
  classesOn,
  dayType,
  live,
  perWeekExpected,
  pickNextUp,
  racketDates,
  routineDone,
  routinesFor,
  routineWeekCount,
  currentMoment,
} from './schedule.ts'
import { cellStates, describeCells } from './charge.ts'
import { fill, joinNames, NUDGE_COPY, pick, tomorrowLine } from './voice.ts'

export interface ReminderContext {
  now: Date
  settings: Settings
  routines: Routine[]
  routineLogs: RoutineLog[]
  checkin?: Checkin | null
  missions: Mission[]
  contacts: Contact[]
  logs: LogEntry[]
  sentKeys: Set<string>
}

export interface DueReminder {
  key: string
  title: string
  body: string
  url: string
  tag: string
}

interface Slot {
  key: string
  at: number
  /** How long after `at` the reminder is still worth sending */
  window: number
  build: () => Omit<DueReminder, 'key'> | null
}

export function reminderSlots(ctx: ReminderContext): Slot[] {
  const s = ctx.settings
  const date = logicalDay(ctx.now, s.rolloverHour)
  const wakeDefault = hhmmToDayMinutes(s.sleep.wake, s.rolloverHour)
  const bed = hhmmToDayMinutes(s.sleep.bed, s.rolloverHour)
  const wake = ctx.checkin && ctx.checkin.date === date ? minutesOnDay(new Date(ctx.checkin.checked_in_at), date) : null
  const todays = routinesFor(date, ctx.routines).filter((r) => r.remind)
  const missions = live(ctx.missions).filter((m) => m.day === date)
  const type = dayType(date, s, racketDates(ctx.logs))
  const lectures = classesOn(date, s)
  const slots: Slot[] = []

  if (s.notify.routines) {
    for (const stack of ['morning', 'night'] as const) {
      const items = todays.filter((r) => r.stack === stack)
      if (!items.length) continue
      const offset = Math.min(...items.map((r) => r.offset_min))
      let at: number
      if (stack === 'morning') {
        const fallback = items[0].at_time ? hhmmToDayMinutes(items[0].at_time, s.rolloverHour) : wakeDefault + 60
        at = wake == null ? fallback : Math.min(wake + offset, fallback)
      } else {
        at = bed - offset
      }
      slots.push({
        key: `stack:${stack}:${date}`,
        at,
        window: stack === 'morning' ? 240 : bed + 120 - at,
        build: () => {
          const pending = items.filter((r) => !routineDone(r.id, date, ctx.routineLogs))
          if (!pending.length) return null
          const names = pending.map((r) => r.name.toLowerCase())
          return stack === 'morning'
            ? {
                title: `${pending[0].emoji} Morning stack`,
                body: `${capitalize(joinNames(names))} — 30 seconds, then we start the day.`,
                url: '/?focus=stack',
                tag: 'stack-morning',
              }
            : {
                title: `🌙 Night stack`,
                body: `${capitalize(joinNames(names))}, then screens down.`,
                url: '/?focus=stack',
                tag: 'stack-night',
              }
        },
      })
    }

    for (const r of todays.filter((r) => !r.stack && r.per_week)) {
      slots.push({
        key: `routine:${r.id}:${date}`,
        at: r.at_time ? hhmmToDayMinutes(r.at_time, s.rolloverHour) : 20 * 60,
        window: 180,
        build: () => {
          if (routineDone(r.id, date, ctx.routineLogs)) return null
          const count = routineWeekCount(r.id, date, ctx.routineLogs)
          if (count >= perWeekExpected(r.per_week!, date)) return null
          return {
            title: `${r.emoji} ${r.name}`,
            body: `${count}/${r.per_week} this week — tonight’s a good one for it.`,
            url: '/body',
            tag: `routine-${r.id}`,
          }
        },
      })
    }

    for (const r of todays.filter((r) => !r.stack && !r.per_week && r.anchor === 'time' && r.at_time)) {
      slots.push({
        key: `routine:${r.id}:${date}`,
        at: hhmmToDayMinutes(r.at_time!, s.rolloverHour),
        window: 120,
        build: () =>
          routineDone(r.id, date, ctx.routineLogs)
            ? null
            : { title: `${r.emoji} ${r.name}`, body: 'Quick one — tap when it’s done.', url: '/body', tag: `routine-${r.id}` },
      })
    }
  }

  if (s.notify.classes && lectures.length) {
    const first = lectures[0]
    const start = hhmmToDayMinutes(first.start)
    slots.push({
      key: `class:${date}`,
      at: start - s.notify.classLead,
      window: s.notify.classLead,
      build: () => {
        const rest = lectures.slice(1).map((c) => c.short)
        return {
          title: `🎒 ${first.short} at ${formatClock(start)}`,
          body: `${first.room}. Leave by ${formatClock(start - 25)}.${rest.length ? ` Then ${rest.join(' → ')}.` : ''}`,
          url: '/',
          tag: 'class',
        }
      },
    })
  }

  if (s.notify.bedtime) {
    slots.push({
      key: `bed:${date}`,
      at: bed - 15,
      window: 75,
      build: () => ({
        title: 'Lights out in 15',
        body: tomorrowLine(classesOn(addDays(date, 1), s)),
        url: '/',
        tag: 'bedtime',
      }),
    })
  }

  // A low-battery day is allowed to be light: no nagging.
  const lowDay = ctx.checkin?.date === date && ctx.checkin.energy === 'low'
  if (s.notify.nudges && missions.length && !lowDay) {
    const voice = s.voice
    const nowMins = dayMinutes(ctx.now, s.rolloverHour)
    const done = missions.filter((m) => m.status === 'done').length
    const next = () =>
      pickNextUp(
        missions,
        currentMoment({ nowMins, settings: s, type, wakeMins: wake }),
      )
    if (type !== 'class') {
      const base = wake ?? wakeDefault
      slots.push({
        key: `nudge:idle:${date}`,
        at: base + 240,
        window: 180,
        build: () => {
          const n = next()
          if (done > 0 || !n) return null
          return {
            title: 'Autobot',
            body: fill(pick(`${date}:idle`, NUDGE_COPY.idle[voice]), {
              hours: `${Math.round((nowMins - base) / 60)} hours`,
              next: n.title,
            }),
            url: '/',
            tag: 'nudge',
          }
        },
      })
      slots.push({
        key: `nudge:evening:${date}`,
        at: 20 * 60,
        window: 120,
        build: () => {
          const n = next()
          if (!n || done / missions.length >= 0.5) return null
          return {
            title: 'Autobot',
            body: fill(pick(`${date}:evening`, NUDGE_COPY.evening[voice]), {
              done,
              total: missions.length,
              next: n.title,
            }),
            url: '/',
            tag: 'nudge',
          }
        },
      })
    } else {
      const lastEnd = hhmmToDayMinutes(lectures[lectures.length - 1].end)
      slots.push({
        key: `nudge:afterclass:${date}`,
        at: lastEnd + 45,
        window: 120,
        build: () => {
          const n = next()
          if (!n) return null
          return {
            title: 'Autobot',
            body: fill(pick(`${date}:afterclass`, NUDGE_COPY.afterClass[voice]), { next: n.title }),
            url: '/',
            tag: 'nudge',
          }
        },
      })
    }
  }

  if (s.notify.followups) {
    slots.push({
      key: `followups:${date}`,
      at: (wake ?? wakeDefault) + 150,
      window: 300,
      build: () => {
        const due = live(ctx.contacts).filter(
          (c) => c.status === 'messaged' && c.follow_up_on && c.follow_up_on <= date,
        )
        if (!due.length) return null
        const first = due[0]
        const more = due.length > 1 ? ` + ${due.length - 1} more` : ''
        return {
          title: '📬 Follow-ups due',
          body: `${first.name}${first.company ? ` (${first.company})` : ''}${more} — a short, friendly bump.`,
          url: '/hunt?tab=people',
          tag: 'followups',
        }
      },
    })
  }

  if (s.notify.weekly && weekdayOf(date) === 'sun') {
    slots.push({
      key: `weekly:${weekStart(date)}`,
      at: 20 * 60,
      window: 240,
      build: () => ({
        title: '🗓️ Week wrap',
        body: `${describeCells(cellStates(ctx.logs, date))}. Two minutes for your review?`,
        url: '/?review=1',
        tag: 'weekly',
      }),
    })
  }

  return slots
}

export function dueReminders(ctx: ReminderContext): DueReminder[] {
  const nowMins = dayMinutes(ctx.now, ctx.settings.rolloverHour)
  const out: DueReminder[] = []
  for (const slot of reminderSlots(ctx)) {
    if (ctx.sentKeys.has(slot.key)) continue
    if (nowMins < slot.at || nowMins >= slot.at + Math.max(slot.window, 1)) continue
    const built = slot.build()
    if (built) out.push({ key: slot.key, ...built })
  }
  return out
}

/** Upcoming reminders for the rest of today — shown in settings. */
export function upcomingReminders(ctx: ReminderContext): { key: string; at: number; label: string }[] {
  const nowMins = dayMinutes(ctx.now, ctx.settings.rolloverHour)
  return reminderSlots(ctx)
    .filter((s) => s.at > nowMins && !ctx.sentKeys.has(s.key))
    .map((s) => ({ key: s.key, at: s.at, label: slotLabel(s.key) }))
    .sort((a, b) => a.at - b.at)
}

const SLOT_LABELS: [prefix: string, label: string][] = [
  ['stack:morning:', 'Morning stack'],
  ['stack:night:', 'Night stack'],
  ['nudge:idle:', 'Slow-start nudge (only if nothing’s done)'],
  ['nudge:evening:', 'Evening check (only if behind)'],
  ['nudge:afterclass:', 'After-class nudge'],
  ['class:', 'First class'],
  ['bed:', 'Bedtime'],
  ['followups:', 'Follow-ups (only if any are due)'],
  ['weekly:', 'Week wrap'],
  ['routine:', 'Routine'],
]

function slotLabel(key: string): string {
  return SLOT_LABELS.find(([prefix]) => key.startsWith(prefix))?.[1] ?? key
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
