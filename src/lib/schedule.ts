import { nowInDenver, dayKeyOf, todayKey, TZ } from './dates'
import type { DayKey } from '../types'

/** Fixed Fall lecture blocks — Boulder / America/Denver (MDT/MST) */
export type Lecture = {
  id: string
  course: string
  room: string
  startMin: number
  endMin: number
  days: DayKey[]
}

export const LECTURES: Lecture[] = [
  {
    id: 'class-linux',
    course: 'Linux SysAdmin',
    room: 'ECCR 1B55',
    startMin: 12 * 60 + 30,
    endMin: 13 * 60 + 45,
    days: ['tue', 'thu'],
  },
  {
    id: 'class-graphics',
    course: 'Computer Graphics',
    room: 'ECCR 200',
    startMin: 15 * 60 + 30,
    endMin: 16 * 60 + 45,
    days: ['tue', 'thu'],
  },
  {
    id: 'class-capstone',
    course: 'Pro Masters Project',
    room: 'ECCS 1B12',
    startMin: 17 * 60,
    endMin: 18 * 60 + 15,
    days: ['tue', 'thu'],
  },
]

export function denverMinutes(date = new Date()): number {
  const z = nowInDenver(date)
  return z.getHours() * 60 + z.getMinutes()
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export type LecturePhase = 'upcoming' | 'live' | 'ended'

export function lecturePhase(lec: Lecture, nowMin = denverMinutes()): LecturePhase {
  if (nowMin < lec.startMin) return 'upcoming'
  if (nowMin < lec.endMin) return 'live'
  return 'ended'
}

export function lecturesForDay(day: DayKey): Lecture[] {
  return LECTURES.filter((l) => l.days.includes(day))
}

export function lectureTaskId(day: DayKey, lectureId: string): string {
  return `${day}-${lectureId}`
}

export function firstLectureOfDay(day: DayKey): Lecture | null {
  const list = lecturesForDay(day)
  if (!list.length) return null
  return list.reduce((a, b) => (a.startMin < b.startMin ? a : b))
}

/** True when Denver time is in the 20-min window starting 90 min before first lecture */
export function reminderWindowOpen(date = new Date()): {
  open: boolean
  lecture: Lecture | null
  day: DayKey
  dateKey: string
} {
  const dateKey = todayKey(date)
  const day = dayKeyOf(dateKey)
  const lec = firstLectureOfDay(day)
  if (!lec) return { open: false, lecture: null, day, dateKey }
  const now = denverMinutes(date)
  const target = lec.startMin - 90
  const open = now >= target && now < target + 20
  return { open, lecture: lec, day, dateKey }
}

export function buddyBrief(date = new Date()): string {
  const dateKey = todayKey(date)
  const day = dayKeyOf(dateKey)
  const now = denverMinutes(date)
  const clock = formatClock(now)
  const lecs = lecturesForDay(day)

  if (!lecs.length) {
    if (now < 11 * 60) {
      return `${clock} MDT · Boulder. Free day — when you’re on campus, hunt first, then LC.`
    }
    if (now < 17 * 60) {
      return `${clock} MDT. Free-day stack: outreach → LeetCode → move. I’m watching the week.`
    }
    return `${clock} MDT. Wind down — home isn’t the grind spot. Quick wrap, then stop.`
  }

  const ended = lecs.filter((l) => lecturePhase(l, now) === 'ended')
  const live = lecs.find((l) => lecturePhase(l, now) === 'live')
  const next = lecs.find((l) => lecturePhase(l, now) === 'upcoming')

  if (live) {
    return `${clock} MDT — ${live.course} until ${formatClock(live.endMin)} (${live.room}). I’ve got the rest queued.`
  }
  if (ended.length === lecs.length) {
    return `${clock} MDT — lectures done. Tap who you made / missed, then we hit hunt & LC.`
  }
  if (next) {
    const mins = next.startMin - now
    const when =
      mins >= 120
        ? `at ${formatClock(next.startMin)}`
        : mins >= 60
          ? `in ${Math.round(mins / 60)}h ${mins % 60}m`
          : `in ${mins} min`
    return `${clock} MDT. ${next.course} ${when} · ${next.room}. Light hunt or one LC until then.`
  }
  return `${clock} MDT · Denver. I’m with you.`
}

export { TZ }
