// Autofills a day with concrete sessions — never quotas. What goes in depends on
// the day type, today's battery (low / normal / charged), which power cells are
// running low, and real context (the next person to message, the next job to
// apply to, the next roadmap problem). Deterministic: two devices planning the
// same day produce identical rows.

import type { Cell, Contact, DayType, Energy, Job, LogEntry, Mission, Moment, Problem, Settings, Size, TargetKey } from './types.ts'
import { stableId } from './ids.ts'
import { addDays, weekdayOf } from './time.ts'
import { classesOn, dayType, live, racketDates, semesterActive } from './schedule.ts'
import { cellStates, neediestCells } from './charge.ts'
import { nextRoadmapProblem, patternName, reviewsDue } from './prep.ts'

export interface PlanContext {
  reviews: { title: string }[]
  nextProblem: { title: string; pattern: string } | null
  followUps: { name: string; company: string }[]
  nextContact: { name: string; company: string } | null
  nextJob: { company: string; title: string } | null
}

export interface PlanInput {
  userId: string
  date: string
  settings: Settings
  logs: LogEntry[]
  energy?: Energy | null
  /** First day we know about (charges start fresh there) */
  since?: string | null
  context?: Partial<PlanContext>
}

/** Pull the planner's context out of synced rows (shared by app and server). */
export function planContext(input: { date: string; problems: Problem[]; contacts: Contact[]; jobs: Job[] }): PlanContext {
  const contacts = live(input.contacts)
  const byAge = <T extends { created_at?: string }>(a: T, b: T) => (a.created_at ?? '').localeCompare(b.created_at ?? '')
  const next = nextRoadmapProblem(input.problems)
  const job = live(input.jobs)
    .filter((j) => j.status === 'saved')
    .sort((a, b) => Number(b.sponsors === 'yes') - Number(a.sponsors === 'yes') || byAge(a, b))[0]
  const contact = contacts.filter((c) => c.status === 'to_contact').sort(byAge)[0]
  return {
    reviews: reviewsDue(input.problems, input.date).map((p) => ({ title: p.title })),
    nextProblem: next ? { title: next.title, pattern: patternName(next.pattern) } : null,
    followUps: contacts
      .filter((c) => c.status === 'messaged' && c.follow_up_on && c.follow_up_on <= input.date)
      .map((c) => ({ name: c.name, company: c.company })),
    nextContact: contact ? { name: contact.name, company: contact.company } : null,
    nextJob: job ? { company: job.company, title: job.title } : null,
  }
}

interface Session {
  key: string
  title: string
  area: Mission['area']
  size: Size
  moment: Moment
  target?: TargetKey
  note?: string
  cell?: Cell
  /** Ordering for sessions without a cell (cell sessions sort by need first) */
  base: number
}

/** Order of sessions within the same cell. */
const WITHIN_CELL: Record<string, number> = {
  followup: 0,
  hunt: 2,
  apply: 4,
  'bonus-hunt': 8,
  prep: 0,
  review: 4,
  'bonus-prep': 8,
  racket: 0,
  body: 2,
}

const at = (who: { name: string; company: string }) => (who.company ? `${who.name} at ${who.company}` : who.name)

export function planDay(input: PlanInput): Mission[] {
  const { userId, date, settings } = input
  const energy: Energy = input.energy ?? 'normal'
  const ctx: PlanContext = {
    reviews: [],
    nextProblem: null,
    followUps: [],
    nextContact: null,
    nextJob: null,
    ...input.context,
  }
  const type: DayType = dayType(date, settings, racketDates(input.logs))
  const classDay = type === 'class'
  const cells = cellStates(input.logs, date, input.since)
  const need = neediestCells(cells)
  const low = energy === 'low'
  const sessions: Session[] = []
  const add = (s: Session) => sessions.push(s)

  if (!classDay) {
    add({
      key: 'leave-room',
      title: low ? 'Get out of the room — even a short stint counts' : 'Get out of the room — campus or library',
      area: 'life',
      size: 'S',
      moment: 'wake',
      base: 0,
    })
  }

  if (type === 'sport') {
    add({ key: 'racket', title: 'Squash or badminton session', area: 'body', size: 'L', moment: 'anytime', target: 'workout', note: 'racket', cell: 'body', base: 5 })
  }

  // ── Hunt
  const huntMoment: Moment = classDay ? 'evening' : 'out'
  if (ctx.followUps.length) {
    const [first] = ctx.followUps
    add({
      key: 'followup',
      title: ctx.followUps.length === 1 ? `Follow up with ${at(first)}` : `Follow up with ${first.name} and the others waiting`,
      area: 'hunt',
      size: 'S',
      moment: huntMoment,
      target: 'followup',
      cell: 'hunt',
      base: 10,
    })
  }
  add({
    key: 'hunt',
    title: ctx.nextContact
      ? `${low ? 'One message: ' : 'Reach out to '}${at(ctx.nextContact)}`
      : low
        ? 'One message to someone at a target company'
        : 'Find someone at a target company and reach out',
    area: 'hunt',
    size: low ? 'S' : 'M',
    moment: huntMoment,
    target: 'referral',
    cell: 'hunt',
    base: 12,
  })
  if (!low) {
    add(
      ctx.nextJob
        ? {
            key: 'apply',
            title: `Apply: ${ctx.nextJob.company}${ctx.nextJob.title ? ` — ${ctx.nextJob.title}` : ''}`,
            area: 'hunt',
            size: 'M',
            moment: huntMoment,
            target: 'application',
            cell: 'hunt',
            base: 14,
          }
        : { key: 'apply', title: 'Find an opening worth a referral', area: 'hunt', size: 'S', moment: huntMoment, base: 60 },
    )
  }

  // ── Prep
  const lectures = classesOn(date, settings)
  const problem = ctx.nextProblem
  add({
    key: 'prep',
    title: problem ? `LeetCode: ${problem.title}` : 'LeetCode block',
    area: 'prep',
    size: low ? 'S' : 'M',
    moment: type === 'sport' ? 'evening' : 'out',
    target: 'leetcode',
    note: problem
      ? classDay && lectures.length > 1
        ? `${problem.pattern} · between ${lectures[0].short} and ${lectures[1].short}`
        : problem.pattern
      : undefined,
    cell: 'prep',
    base: 20,
  })
  if (ctx.reviews.length) {
    add({
      key: 'review',
      title: `Re-solve ${ctx.reviews[0].title} from memory`,
      area: 'prep',
      size: 'S',
      moment: 'night',
      target: 'leetcode',
      cell: 'prep',
      base: 24,
    })
  }

  // ── Body
  if (type !== 'sport') {
    add({
      key: 'body',
      title: low ? 'A short walk counts — get some air' : 'Move — gym, run, or a long walk',
      area: 'body',
      size: low ? 'S' : 'M',
      moment: 'evening',
      target: 'workout',
      cell: 'body',
      base: 30,
    })
  }

  // ── School
  if (semesterActive(date, settings)) {
    if (classDay) {
      add({ key: 'homework', title: 'Homework chunk — whatever is due next', area: 'class', size: 'M', moment: 'night', base: 70 })
    } else if (weekdayOf(date) !== 'sun' || type !== 'sport') {
      add({
        key: 'coursework',
        title: low ? 'Coursework — just the next small piece' : 'Coursework block — Graphics, Linux, or the project',
        area: 'class',
        size: low ? 'M' : 'L',
        moment: 'out',
        base: 70,
      })
    }
  }

  if (weekdayOf(date) === 'sun') {
    add({ key: 'weekly-review', title: 'Weekly review with Autobot', area: 'life', size: 'S', moment: 'night', base: 90 })
  }

  if (energy === 'high') {
    add({ key: 'bonus-hunt', title: 'Bonus: reach out to one more person', area: 'hunt', size: 'S', moment: 'evening', target: 'referral', cell: 'hunt', base: 60 })
    add({ key: 'bonus-prep', title: 'Bonus LeetCode while you’re sharp', area: 'prep', size: 'M', moment: 'night', target: 'leetcode', cell: 'prep', base: 62 })
  }

  // Low battery: only small sessions for the two neediest cells survive.
  const keep = low
    ? (() => {
        const neediest = new Set(need.slice(0, 2))
        const huntPick = ctx.followUps.length ? 'followup' : 'hunt'
        const prepPick = ctx.reviews.length ? 'review' : 'prep'
        return (s: Session) =>
          !s.cell || s.key === 'racket'
            ? true
            : neediest.has(s.cell) && (s.cell !== 'hunt' || s.key === huntPick) && (s.cell !== 'prep' || s.key === prepPick)
      })()
    : () => true

  return sessions.filter(keep).map((s) => ({
    id: stableId(`${userId}:${date}:plan:${s.key}`),
    user_id: userId,
    day: date,
    key: `plan:${s.key}`,
    title: s.title,
    area: s.area,
    size: s.size,
    moment: s.moment,
    status: 'todo',
    target_key: s.target ?? null,
    amount: 1,
    note: s.note ?? null,
    // Within a moment, sessions for the cell that needs it most come first.
    sort: s.cell ? 10 + need.indexOf(s.cell) * 20 + (WITHIN_CELL[s.key] ?? 0) : s.base,
    source: 'plan',
  }))
}

export interface PlanDiff {
  add: Mission[]
  update: { id: string; patch: Partial<Mission> }[]
  remove: string[]
}

/**
 * Reconcile a day's plan with a freshly computed one (e.g. after a battery
 * check-in). Untouched plan sessions are updated or removed; anything started,
 * finished, skipped, moved, or deleted by hand is left alone.
 */
export function diffPlan(all: Mission[], date: string, next: Mission[]): PlanDiff {
  const byId = new Map(all.map((m) => [m.id, m]))
  const nextIds = new Set(next.map((m) => m.id))
  const fields = ['title', 'area', 'size', 'moment', 'target_key', 'note', 'sort'] as const
  const update: PlanDiff['update'] = []
  for (const m of next) {
    const cur = byId.get(m.id)
    if (!cur || cur.deleted_at || cur.status !== 'todo' || cur.day !== date) continue
    const patch: Partial<Mission> = {}
    for (const f of fields) if ((cur[f] ?? null) !== (m[f] ?? null)) (patch as Record<string, unknown>)[f] = m[f]
    if (Object.keys(patch).length) update.push({ id: m.id, patch })
  }
  return {
    add: next.filter((m) => !byId.has(m.id)),
    update,
    remove: all
      .filter((m) => m.day === date && m.source === 'plan' && !m.deleted_at && m.status === 'todo' && !nextIds.has(m.id))
      .map((m) => m.id),
  }
}

/** Is there already a generated plan for `date` among these missions? */
export function hasPlan(missions: Mission[], date: string): boolean {
  return missions.some((m) => m.day === date && m.source === 'plan')
}

export function tomorrowOf(date: string): string {
  return addDays(date, 1)
}
