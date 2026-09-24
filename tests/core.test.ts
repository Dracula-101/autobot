import { describe, expect, it } from 'vitest'
import {
  assignmentDone,
  classesOn,
  DEFAULT_SETTINGS,
  dayMinutes,
  dayType,
  dueReminders,
  hhmmToDayMinutes,
  instantOf,
  logicalDay,
  planDay,
  seedRoutines,
  cellStates,
  companyOf,
  dailyPicks,
  diffPlan,
  dayGain,
  isUS,
  normalizeProfile,
  parseMutuals,
  planContext,
  roleOf,
  type Assignment,
  type Lead,
  skyPhase,
  speak,
  stableId,
  sunTimes,
  wallClock,
  weekdayOf,
  weekStart,
  type Checkin,
  type LogEntry,
  type Mission,
  type ReminderContext,
  type RoutineLog,
} from '@core/index.ts'

const S = DEFAULT_SETTINGS
const USER = '00000000-0000-4000-8000-000000000001'

/** Denver wall time → Date, e.g. at('2026-09-23', '11:40') */
function at(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return instantOf(date, h * 60 + m)
}

describe('time', () => {
  it('reads Denver wall clock and rolls the logical day over at 5 AM', () => {
    const t = new Date('2026-09-24T08:30:00Z') // 2:30 AM MDT
    expect(wallClock(t)).toMatchObject({ date: '2026-09-24', hour: 2, minute: 30, weekday: 'thu' })
    expect(logicalDay(t)).toBe('2026-09-23')
    expect(dayMinutes(t)).toBe(1590)
    expect(logicalDay(new Date('2026-09-24T11:00:00Z'))).toBe('2026-09-24') // 5 AM
  })

  it('maps day minutes back to instants, across midnight and DST', () => {
    expect(instantOf('2026-09-23', 1590).toISOString()).toBe('2026-09-24T08:30:00.000Z')
    expect(instantOf('2026-10-31', 720).toISOString()).toBe('2026-10-31T18:00:00.000Z') // MDT
    expect(instantOf('2026-11-01', 720).toISOString()).toBe('2026-11-01T19:00:00.000Z') // MST
  })

  it('treats bedtimes before the rollover as after midnight', () => {
    expect(hhmmToDayMinutes('02:30')).toBe(1590)
    expect(hhmmToDayMinutes('10:30')).toBe(630)
  })

  it('knows weekdays and Monday week starts', () => {
    expect(weekdayOf('2026-09-24')).toBe('thu')
    expect(weekStart('2026-09-24')).toBe('2026-09-21')
    expect(weekStart('2026-09-27')).toBe('2026-09-21')
  })
})

describe('sky', () => {
  it('computes Boulder sunrise and sunset to within a few minutes', () => {
    const { sunrise, sunset } = sunTimes('2026-09-24')
    const rise = wallClock(sunrise).minutes
    const set = wallClock(sunset).minutes
    expect(rise).toBeGreaterThan(6 * 60 + 43)
    expect(rise).toBeLessThan(7 * 60 + 3)
    expect(set).toBeGreaterThan(18 * 60 + 48)
    expect(set).toBeLessThan(19 * 60 + 8)
  })

  it('switches phases with the sun', () => {
    expect(skyPhase(at('2026-09-24', '12:00'))).toBe('day')
    expect(skyPhase(at('2026-09-24', '23:30'))).toBe('night')
    expect(skyPhase(at('2026-09-24', '07:00'))).toBe('dawn')
    expect(skyPhase(at('2026-09-24', '19:00'))).toBe('dusk')
  })
})

describe('schedule', () => {
  it('finds classes only on Tue/Thu inside the semester', () => {
    expect(classesOn('2026-09-24', S).map((c) => c.short)).toEqual(['Linux', 'Graphics', 'Masters Project'])
    expect(classesOn('2026-09-23', S)).toEqual([])
    expect(classesOn('2026-12-10', S)).toEqual([])
  })

  it('floats racket day between Sunday and Monday', () => {
    expect(dayType('2026-09-24', S)).toBe('class')
    expect(dayType('2026-09-23', S)).toBe('free')
    expect(dayType('2026-09-27', S)).toBe('sport')
    expect(dayType('2026-09-28', S)).toBe('sport')
    expect(dayType('2026-09-28', S, new Set(['2026-09-27']))).toBe('free')
  })
})

describe('power cells', () => {
  const day = (d: string, kind: LogEntry['kind'], amount = 1): LogEntry => ({ id: `${d}${kind}${amount}`, day: d, kind, amount })

  it('fills a cell with one action a day and never needs a quota', () => {
    const logs = ['2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'].map((d) =>
      day(d, 'referral'),
    )
    const cells = cellStates(logs, '2026-09-23')
    expect(cells.hunt.status).toBe('full')
    expect(cells.hunt.streak).toBe(7)
    expect(cells.prep.status).not.toBe('full')
  })

  it('lets a big day carry a light one', () => {
    const big = cellStates([day('2026-09-22', 'leetcode', 5)], '2026-09-23', '2026-09-22')
    const small = cellStates([day('2026-09-22', 'leetcode', 1)], '2026-09-23', '2026-09-22')
    expect(big.prep.level).toBeGreaterThan(small.prep.level)
    expect(big.prep.status === 'good' || big.prep.status === 'full').toBe(true)
  })

  it('drains gently instead of resetting', () => {
    const logs = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'].map((d) => day(d, 'workout', 2))
    const afterOneDayOff = cellStates(logs, '2026-09-20').body.level
    const afterFourDaysOff = cellStates(logs, '2026-09-23').body.level
    expect(afterOneDayOff).toBeGreaterThan(0.9)
    expect(afterFourDaysOff).toBeLessThan(afterOneDayOff)
    expect(afterFourDaysOff).toBeGreaterThan(0.2)
  })

  it('rewards more work with diminishing returns', () => {
    expect(dayGain(0)).toBe(0)
    expect(dayGain(2)).toBeGreaterThan(dayGain(1))
    expect(dayGain(10) - dayGain(5)).toBeLessThan(dayGain(2) - dayGain(1))
  })

  it('counts follow-ups and applications toward the Hunt cell', () => {
    const cells = cellStates([day('2026-09-23', 'followup'), day('2026-09-23', 'application')], '2026-09-23')
    expect(cells.hunt.today).toBe(2)
    expect(cells.hunt.week[2]).toBe(true)
  })
})

describe('planner', () => {
  const input = { userId: USER, date: '2026-09-23', settings: S, logs: [] as LogEntry[] }
  const context = {
    nextContact: { name: 'Priya', company: 'Google' },
    nextJob: { company: 'Stripe', title: 'SWE, New Grad' },
    nextProblem: { title: 'Contains Duplicate', pattern: 'Arrays & Hashing' },
  }

  it('plans concrete sessions with no numeric quotas', () => {
    const plan = planDay({ ...input, context })
    const titles = plan.map((m) => m.title)
    expect(titles).toContain('Reach out to Priya at Google')
    expect(titles).toContain('Apply: Stripe — SWE, New Grad')
    expect(titles).toContain('LeetCode: Contains Duplicate')
    expect(plan.find((m) => m.key === 'plan:leave-room')?.moment).toBe('wake')
    for (const m of plan) {
      expect(m.amount).toBe(1)
      expect(m.title).not.toMatch(/\d+ (referral|role|problem|message)s?/)
    }
  })

  it('shrinks a low-battery day to the neediest cells and grows a charged one', () => {
    const normal = planDay({ ...input, context }).length
    const low = planDay({ ...input, context, energy: 'low' })
    const high = planDay({ ...input, context, energy: 'high' })
    expect(low.length).toBeLessThan(normal)
    expect(high.length).toBeGreaterThan(normal)
    expect(low.find((m) => m.key === 'plan:hunt')?.title).toBe('One message: Priya at Google')
    expect(low.some((m) => m.key === 'plan:apply')).toBe(false)
    expect(high.some((m) => m.key?.startsWith('plan:bonus'))).toBe(true)
  })

  it('puts the neediest cell first', () => {
    const logs: LogEntry[] = [{ id: 'l', day: '2026-09-22', kind: 'referral', amount: 4 }]
    const plan = planDay({ ...input, logs, context })
    const out = plan.filter((m) => m.moment === 'out' && m.target_key).sort((a, b) => a.sort - b.sort)
    expect(out[0].target_key).toBe('leetcode')
  })

  it('is deterministic so devices never duplicate a plan', () => {
    expect(planDay(input).map((m) => m.id)).toEqual(planDay(input).map((m) => m.id))
    expect(stableId('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(planDay({ ...input, date: '2026-09-27' }).map((m) => m.key)).toEqual(
      expect.arrayContaining(['plan:racket', 'plan:weekly-review']),
    )
  })

  it('reconciles a battery change without touching started, finished, or deleted work', () => {
    const normal = planDay({ ...input, context })
    const started = { ...normal.find((m) => m.key === 'plan:apply')!, status: 'doing' as const }
    const deleted = { ...normal.find((m) => m.key === 'plan:body')!, deleted_at: '2026-09-23T18:00:00Z' }
    const existing = normal.map((m) => (m.id === started.id ? started : m.id === deleted.id ? deleted : m))
    const low = planDay({ ...input, context, energy: 'low' })
    const diff = diffPlan(existing, '2026-09-23', low)
    expect(diff.remove).not.toContain(started.id)
    expect(diff.add.map((m) => m.id)).not.toContain(deleted.id)
    expect(diff.update.find((u) => u.id === low.find((m) => m.key === 'plan:hunt')!.id)?.patch.title).toBe(
      'One message: Priya at Google',
    )
    const back = diffPlan([...existing, ...diff.add], '2026-09-23', normal)
    expect(back.add.map((m) => m.id)).not.toContain(deleted.id)
  })
})

describe('reminders', () => {
  const routines = seedRoutines(USER)
  const base = (now: Date, extra: Partial<ReminderContext> = {}): ReminderContext => ({
    now,
    settings: S,
    routines,
    routineLogs: [],
    checkin: null,
    missions: [],
    contacts: [],
    logs: [],
    sentKeys: new Set(),
    ...extra,
  })
  const keys = (ctx: ReminderContext) => dueReminders(ctx).map((r) => r.key)

  it('sends the morning stack at the fallback time when waking is not seen', () => {
    expect(keys(base(at('2026-09-23', '11:40')))).toContain('stack:morning:2026-09-23')
    expect(keys(base(at('2026-09-23', '11:20')))).not.toContain('stack:morning:2026-09-23')
  })

  it('sends it right after waking when the app was opened', () => {
    const checkin: Checkin = { id: 'c', date: '2026-09-23', checked_in_at: at('2026-09-23', '10:05').toISOString() }
    expect(keys(base(at('2026-09-23', '10:25'), { checkin }))).toContain('stack:morning:2026-09-23')
  })

  it('stays quiet once the stack is done or already sent', () => {
    const done: RoutineLog[] = routines
      .filter((r) => r.stack === 'morning')
      .map((r) => ({ id: r.id + 'l', routine_id: r.id, day: '2026-09-23', done_at: '' }))
    expect(keys(base(at('2026-09-23', '11:40'), { routineLogs: done }))).not.toContain('stack:morning:2026-09-23')
    expect(
      keys(base(at('2026-09-23', '11:40'), { sentKeys: new Set(['stack:morning:2026-09-23']) })),
    ).not.toContain('stack:morning:2026-09-23')
  })

  it('files the 1:45 AM night stack under the previous logical day', () => {
    expect(keys(base(at('2026-09-24', '01:50')))).toContain('stack:night:2026-09-23')
  })

  it('warns before the first class and not after it starts', () => {
    expect(keys(base(at('2026-09-24', '11:20')))).toContain('class:2026-09-24')
    expect(keys(base(at('2026-09-24', '12:35')))).not.toContain('class:2026-09-24')
  })

  it('nudges an idle free day, but not once something is done', () => {
    const missions: Mission[] = planDay({ userId: USER, date: '2026-09-23', settings: S, logs: [] })
    const checkin: Checkin = { id: 'c', date: '2026-09-23', checked_in_at: at('2026-09-23', '10:30').toISOString() }
    const now = at('2026-09-23', '15:00')
    expect(keys(base(now, { missions, checkin }))).toContain('nudge:idle:2026-09-23')
    const oneDone = missions.map((m, i) => (i === 0 ? { ...m, status: 'done' as const } : m))
    expect(keys(base(now, { missions: oneDone, checkin }))).not.toContain('nudge:idle:2026-09-23')
  })
})

describe('voice', () => {
  const ctx = {
    name: 'Pratik',
    settings: S,
    date: '2026-09-24',
    type: 'class' as const,
    moment: 'out' as const,
    wakeMins: 630,
    done: 0,
    total: 4,
    nextUp: null,
    morningPending: [],
    nightPending: [],
    classes: classesOn('2026-09-24', S),
    tomorrowClasses: [],
  }

  it('sends him to bed after bedtime', () => {
    expect(speak({ ...ctx, nowMins: 1620 }).mood).toBe('sleepy')
  })

  it('points at the next lecture when one is close', () => {
    const s = speak({ ...ctx, nowMins: 11 * 60 + 30 })
    expect(s.mood).toBe('focused')
    expect(s.text).toContain('Linux at 12:30 PM')
  })

  it('puts a close deadline first, but not a far one', () => {
    const dueSoon = { title: 'HW3', course: 'Graphics', minutesLeft: 150 }
    const s = speak({ ...ctx, type: 'free', classes: [], nowMins: 20 * 60, dueSoon })
    expect(s.text).toBe('HW3 (Graphics) is due in 2h 30m. That comes first — everything else can wait.')
    expect(speak({ ...ctx, type: 'free', classes: [], nowMins: 20 * 60, dueSoon: { ...dueSoon, minutesLeft: 45 } }).mood).toBe('worried')
    expect(speak({ ...ctx, type: 'free', classes: [], nowMins: 20 * 60, dueSoon: { ...dueSoon, minutesLeft: 900 } }).text).not.toContain('HW3')
  })
})

describe('sources', () => {
  it('finds the real company in messy fields and headlines', () => {
    expect(companyOf('Tesla 🤖🚗🦾⚡️', 'Recruiting Leader at Tesla')).toBe('Tesla')
    expect(companyOf('', 'Senior Recruiter | Tesla')).toBe('Tesla')
    expect(companyOf('Last Mile', 'Engineering Manager Amazon @ Last Mile | Ex-Microsoft @ Azure')).toBe('Amazon')
    expect(companyOf('', 'ᴛᴀʟᴇɴᴛ ᴀᴄQᴜɪꜱɪᴛɪᴏɴ ꜱᴘᴇᴄɪᴀʟɪꜱᴛ @ᴀᴍᴀᴢᴏɴ')).toBe('Amazon')
    expect(companyOf('Amazon Web Services (AWS)', '')).toBe('Amazon')
    expect(companyOf('', 'Technical Recruiter | Certified Talent Advisor')).toBe('')
  })

  it('tells new-grad recruiters, recruiters, managers and engineers apart', () => {
    expect(roleOf('Recruiter, Amazon University Talent Acquisition')).toBe('university')
    expect(roleOf('Full Lifecycle University Recruiter')).toBe('university')
    expect(roleOf('Staff Recruiter, Charging at Tesla')).toBe('recruiter')
    expect(roleOf('Talent Acquisition Manager')).toBe('recruiter')
    expect(roleOf('Engineering Manager @ Amazon')).toBe('manager')
    expect(roleOf('Sr. SDM at Amazon')).toBe('manager')
    expect(roleOf('Software Development Engineer at Oracle')).toBe('engineer')
  })

  it('reads mutual connections from the clipped summary line', () => {
    expect(parseMutuals('Asha Rao, Ben Cole & 2 other mutual connections')).toEqual({ count: 4, names: ['Asha Rao', 'Ben Cole'] })
    expect(parseMutuals('Asha Rao & Ben Cole are mutual connections')).toEqual({ count: 2, names: ['Asha Rao', 'Ben Cole'] })
    expect(parseMutuals('Asha Rao is a mutual connection')).toEqual({ count: 1, names: ['Asha Rao'] })
    expect(parseMutuals('')).toEqual({ count: 0, names: [] })
  })

  it('flags leads outside the US', () => {
    expect(isUS('Austin, Texas, United States')).toBe(true)
    expect(isUS('Greater Seattle Area')).toBe(true)
    expect(isUS('Bengaluru, Karnataka, India')).toBe(false)
  })

  const lead = (id: string, raw: Parameters<typeof normalizeProfile>[0], extra: Partial<Lead> = {}): Lead => ({
    ...normalizeProfile(raw),
    id,
    hidden: false,
    contact_id: null,
    ...extra,
  })
  const leads: Lead[] = [
    lead('a', { id: 1, name: 'Ana', headline: 'University Recruiter at Amazon', location: 'Seattle, Washington, United States', summary: 'Asha Rao is a mutual connection' }),
    lead('b', { id: 2, name: 'Bo', headline: 'Early Career Recruiter | Amazon', location: 'United States', summary: 'Asha Rao & Ben Cole are mutual connections' }),
    lead('c', { id: 3, name: 'Cy', headline: 'Campus Recruiter at Amazon', location: 'United States' }),
    lead('d', { id: 4, name: 'Di', headline: 'Senior Recruiter at Tesla', location: 'Austin, Texas, United States' }),
    lead('e', { id: 5, name: 'Ed', headline: 'University Recruiter at Oracle', location: 'Bengaluru, Karnataka, India' }),
    lead('f', { id: 6, name: 'Fa', headline: 'Recruiter at Tesla', location: 'United States' }, { contact_id: 'x' }),
  ]

  it('picks warm new-grad recruiters first, at most two per company, skipping ones already in the pipeline', () => {
    const picks = dailyPicks(leads, { targets: [], jobCompanies: new Set() }, '2026-09-24', 3)
    expect(picks.map((l) => l.company)).toEqual(['Amazon', 'Amazon', 'Tesla'])
    expect(picks.map((l) => l.id)).not.toContain('f')
    expect(picks.map((l) => l.id)).not.toContain('e')
  })

  it('names a real person and the most urgent assignment in the plan', () => {
    const assignments: Assignment[] = [
      { id: 'as1', source: 'checker', source_id: '1', title: 'HW3: Shading', course: 'CSCI 5229-001', due_at: '2026-09-26T05:59:00Z', url: '', source_status: 'open' },
      { id: 'as2', source: 'checker', source_id: '2', title: 'Lab 2', course: 'CSCI 5113', due_at: '2026-09-22T05:59:00Z', url: '', source_status: 'open', done_at: '2026-09-21T00:00:00Z' },
    ]
    const context = planContext({
      date: '2026-09-23',
      problems: [],
      contacts: [],
      jobs: [],
      leads,
      assignments,
      classes: S.classes,
      now: new Date('2026-09-23T18:00:00Z'),
    })
    expect(context.nextContact?.detail).toMatch(/New-grad recruiter/)
    expect(context.nextAssignment).toMatchObject({ title: 'HW3: Shading', course: 'Graphics' })
    const plan = planDay({ userId: USER, date: '2026-09-23', settings: S, logs: [], context })
    expect(plan.find((m) => m.key === 'plan:coursework')?.title).toBe('Work on HW3: Shading')
    expect(plan.find((m) => m.key === 'plan:hunt')?.title).toMatch(/^Reach out to (Ana|Bo|Cy) at Amazon$/)
  })

  it('reads checker statuses without mistaking "not submitted" for done', () => {
    const done = (source_status: string, done_at: string | null = null) => assignmentDone({ source_status, done_at })
    expect(done('')).toBe(false)
    expect(done('submitted')).toBe(true)
    expect(done('Graded')).toBe(true)
    expect(done('Not submitted')).toBe(false)
    expect(done('not yet submitted')).toBe(false)
    expect(done('unsubmitted')).toBe(false)
    expect(done('incomplete')).toBe(false)
    expect(done('missing', '2026-09-20T00:00:00Z')).toBe(true)
  })

  it('reminds about a deadline the day before and three hours before', () => {
    const a: Assignment = { id: 'as1', source: 'checker', source_id: '1', title: 'HW3', course: 'CSCI 5229', due_at: '2026-09-25T05:59:00Z', url: '', source_status: 'open' }
    const ctx = (now: Date): ReminderContext => ({
      now, settings: S, routines: [], routineLogs: [], checkin: null, missions: [], contacts: [], logs: [], assignments: [a], sentKeys: new Set(),
    })
    expect(dueReminders(ctx(at('2026-09-23', '12:45'))).map((r) => r.key)).toContain('due:as1:eve')
    expect(dueReminders(ctx(new Date('2026-09-25T03:00:00Z'))).map((r) => r.key)).toContain('due:as1:soon')
    expect(dueReminders(ctx(new Date('2026-09-25T03:00:00Z')))[0]?.title).toBe('⏰ Due in 3 hours')
  })
})
