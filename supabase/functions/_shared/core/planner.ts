// Autofills a day from the week's targets. Deterministic: the same inputs on
// two devices yield identical rows (same ids), so plans never duplicate.

import type { DayType, LogEntry, Mission, Moment, Settings, Size, TargetKey } from './types.ts'
import { stableId } from './ids.ts'
import { addDays, weekDates, weekdayOf, weekStart } from './time.ts'
import { CAPACITY, classesOn, dayType, racketDates, semesterActive, weekTotals } from './schedule.ts'

export interface PlanInput {
  userId: string
  date: string
  settings: Settings
  logs: LogEntry[]
  /** Problems whose spaced-review date has arrived */
  reviewsDue: number
}

/** Never plan more than this per day, however far behind the week is. */
const DAILY_CAP: Record<TargetKey, number> = { referral: 4, application: 5, leetcode: 4, workout: 1 }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const sizeFor = (n: number): Size => (n >= 3 ? 'L' : 'M')

export function shareForToday(input: PlanInput, key: TargetKey): number {
  const { date, settings } = input
  const racket = racketDates(input.logs)
  const left = weekDates(weekStart(date)).filter((d) => d >= date)
  const capOf = (d: string) => CAPACITY[dayType(d, settings, racket)]
  const capToday = capOf(date)
  const capLeft = left.reduce((sum, d) => sum + capOf(d), 0)
  const doneBefore = weekTotals(input.logs, date, { before: date })[key]
  const remaining = Math.max(0, settings.targets[key] - doneBefore)
  if (!remaining || !capLeft) return 0
  const isLastDay = left.length === 1
  const raw = isLastDay ? remaining : (remaining * capToday) / capLeft
  let n = Math.round(raw)
  if (n === 0 && raw >= 0.3) n = 1
  return Math.min(n, DAILY_CAP[key])
}

export function planDay(input: PlanInput): Mission[] {
  const { userId, date, settings } = input
  const racket = racketDates(input.logs)
  const type: DayType = dayType(date, settings, racket)
  const missions: Mission[] = []

  const add = (
    key: string,
    title: string,
    fields: {
      area: Mission['area']
      size: Size
      moment: Moment
      target_key?: TargetKey
      amount?: number
      note?: string
    },
  ) => {
    missions.push({
      id: stableId(`${userId}:${date}:plan:${key}`),
      user_id: userId,
      day: date,
      key: `plan:${key}`,
      title,
      area: fields.area,
      size: fields.size,
      moment: fields.moment,
      status: 'todo',
      target_key: fields.target_key ?? null,
      amount: fields.amount ?? 1,
      note: fields.note ?? null,
      sort: missions.length * 10,
      source: 'plan',
    })
  }

  const classDay = type === 'class'
  const inSemester = semesterActive(date, settings)

  if (!classDay) {
    add('leave-room', 'Get out of the room — campus or library', {
      area: 'life',
      size: 'S',
      moment: 'wake',
    })
  }

  if (type === 'sport') {
    add('racket', 'Squash or badminton session', {
      area: 'body',
      size: 'L',
      moment: 'anytime',
      target_key: 'workout',
      note: 'racket',
    })
  }

  const referrals = shareForToday(input, 'referral')
  if (referrals) {
    add('referral', `Send ${plural(referrals, 'referral message')}`, {
      area: 'hunt',
      size: sizeFor(referrals),
      moment: classDay ? 'evening' : 'out',
      target_key: 'referral',
      amount: referrals,
    })
  }

  const applications = shareForToday(input, 'application')
  if (applications) {
    add('application', `Apply to ${plural(applications, 'role')}`, {
      area: 'hunt',
      size: sizeFor(applications),
      moment: classDay ? 'evening' : 'out',
      target_key: 'application',
      amount: applications,
    })
  }

  const leetcode = shareForToday(input, 'leetcode')
  if (leetcode) {
    if (classDay) {
      const lectures = classesOn(date, settings)
      const gap = lectures.length > 1 ? `between ${lectures[0].short} and ${lectures[1].short}` : 'around class'
      add('leetcode', `${plural(leetcode, 'LeetCode problem')} ${gap}`, {
        area: 'prep',
        size: sizeFor(leetcode),
        moment: 'out',
        target_key: 'leetcode',
        amount: leetcode,
      })
    } else if (leetcode >= 2) {
      add('leetcode', `Solve ${plural(leetcode - 1, 'LeetCode problem')}`, {
        area: 'prep',
        size: sizeFor(leetcode - 1),
        moment: 'out',
        target_key: 'leetcode',
        amount: leetcode - 1,
      })
      add('leetcode-night', 'One more LeetCode in your sharp hours', {
        area: 'prep',
        size: 'M',
        moment: 'night',
        target_key: 'leetcode',
        amount: 1,
      })
    } else {
      add('leetcode', 'Solve 1 LeetCode problem', {
        area: 'prep',
        size: 'M',
        moment: 'out',
        target_key: 'leetcode',
        amount: 1,
      })
    }
  }

  if (input.reviewsDue > 0) {
    const n = Math.min(input.reviewsDue, 2)
    add('review', `Re-solve ${plural(n, 'old problem')} from memory`, {
      area: 'prep',
      size: 'S',
      moment: 'night',
      amount: n,
    })
  }

  if (type !== 'sport' && shareForToday(input, 'workout')) {
    add('workout', 'Workout — gym, run, or a long walk', {
      area: 'body',
      size: 'M',
      moment: 'evening',
      target_key: 'workout',
    })
  }

  if (inSemester) {
    if (classDay) {
      add('homework', 'Homework chunk — whatever is due next', { area: 'class', size: 'M', moment: 'night' })
    } else if (weekdayOf(date) !== 'sun' || type !== 'sport') {
      add('coursework', 'Coursework block — Graphics, Linux, or the project', {
        area: 'class',
        size: 'L',
        moment: 'out',
      })
    }
  }

  if (weekdayOf(date) === 'sun') {
    add('weekly-review', 'Weekly review with Autobot', { area: 'life', size: 'S', moment: 'night' })
  }

  return missions
}

/** Is there already a generated plan for `date` among these missions? */
export function hasPlan(missions: Mission[], date: string): boolean {
  return missions.some((m) => m.day === date && m.source === 'plan')
}

export function tomorrowOf(date: string): string {
  return addDays(date, 1)
}
