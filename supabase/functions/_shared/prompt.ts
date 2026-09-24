import type { UserState } from './state.ts'
import {
  CELL_LABEL,
  CELLS,
  STATUS_LABEL,
  cellStates,
  classesOn,
  classPhase,
  currentMoment,
  DAY_NAMES,
  DAY_TYPE_LABEL,
  dayMinutes,
  dayType,
  formatClock,
  hhmmToDayMinutes,
  live,
  minutesOnDay,
  missionProgress,
  momentLabel,
  nextRoadmapProblem,
  patternName,
  PATTERNS,
  racketDates,
  relativeDay,
  reviewsDue,
  ROADMAP,
  routineDone,
  routinesFor,
  routineWeekCount,
  weekDates,
  weekdayOf,
  weekStart,
  weekTotals,
  addDays,
} from './core/index.ts'

export type ChatMode = 'chat' | 'interview' | 'teach' | 'brief'

const ref = (prefix: string, id: string) => `[${prefix}:${id.slice(0, 8)}]`

const VOICE = {
  firm: 'a firm friend: warm, but you name avoidance kindly and hand him the smallest next step',
  gentle: 'a gentle buddy: encouraging, zero pressure, celebrate small wins',
  strict: 'a strict coach: blunt and demanding, but never cruel',
}

export function buildContext(st: UserState): string {
  const s = st.settings
  const today = st.today
  const nowM = dayMinutes(st.now, s.rolloverHour)
  const type = dayType(today, s, racketDates(st.logs))
  const lectures = classesOn(today, s)
  const wake = st.checkin ? minutesOnDay(new Date(st.checkin.checked_in_at), today) : null
  const moment = currentMoment({
    nowMins: nowM,
    settings: s,
    type,
    wakeMins: wake,
    lastClassEnd: lectures.length ? hhmmToDayMinutes(lectures[lectures.length - 1].end) : null,
  })
  const out: string[] = []

  const energy = st.checkin?.energy ?? null
  out.push(
    `<today date="${today}" weekday="${DAY_NAMES[weekdayOf(today)]}" type="${DAY_TYPE_LABEL[type]}" now="${formatClock(nowM)}" moment="${momentLabel(moment, type)}" opened_app_at="${wake != null ? formatClock(wake) : 'not yet'}" battery="${energy ?? 'not asked yet'}">`,
  )
  if (lectures.length) {
    out.push(
      'Classes: ' +
        lectures
          .map(
            (c) =>
              `${c.name} ${formatClock(hhmmToDayMinutes(c.start))}–${formatClock(hhmmToDayMinutes(c.end))} ${c.room} (${classPhase(c, nowM)})`,
          )
          .join('; '),
    )
  }
  const todays = live(st.missions).filter((m) => m.day === today)
  const progress = missionProgress(todays, st.logs, today)
  out.push(todays.length ? 'Missions:' : 'Missions: none planned yet')
  for (const m of todays.sort((a, b) => a.sort - b.sort)) {
    const p = m.target_key && (progress.get(m.id) ?? 0) > 0 && m.status !== 'done' ? ' (already started via logs)' : ''
    out.push(`- ${ref('m', m.id)} ${m.status} · ${momentLabel(m.moment, type)} · ${m.size} · ${m.area} · ${m.title}${p}`)
  }
  const tomorrow = live(st.missions).filter((m) => m.day === addDays(today, 1))
  if (tomorrow.length) {
    out.push(`Tomorrow: ${tomorrow.map((m) => `${ref('m', m.id)} ${m.title}`).join('; ')}`)
  }
  const routines = routinesFor(today, st.routines)
  if (routines.length) {
    out.push('Routines:')
    for (const r of routines) {
      const status = r.per_week
        ? `${routineWeekCount(r.id, today, st.routineLogs)}/${r.per_week} this week${routineDone(r.id, today, st.routineLogs) ? ', done today' : ''}`
        : routineDone(r.id, today, st.routineLogs)
          ? 'done'
          : 'not yet'
      out.push(`- ${ref('r', r.id)} ${r.emoji} ${r.name}${r.stack ? ` (${r.stack} stack)` : ''} — ${status}`)
    }
  }
  out.push('</today>')

  const cells = cellStates(st.logs, today)
  const totals = weekTotals(st.logs, today)
  const week = weekDates(weekStart(today))
  out.push('<power_cells note="No quotas. Anything logged charges a cell; cells drain ~28%/day; one action a day keeps a cell full.">')
  for (const c of CELLS) {
    const cell = cells[c]
    out.push(
      `- ${CELL_LABEL[c]}: ${STATUS_LABEL[cell.status]} · ${cell.today} today · active ${cell.week.filter(Boolean).length} of ${week.filter((d) => d <= today).length} days this week · streak ${cell.streak} · last active ${cell.lastActive ? relativeDay(cell.lastActive, today) : 'never'}`,
    )
  }
  out.push(
    `This week so far (context only, never a target): ${totals.referral} referral asks, ${totals.followup} follow-ups, ${totals.application} applications, ${totals.leetcode} LeetCode attempts, ${totals.workout} workouts.`,
  )
  out.push(`Sleep window: bed ${s.sleep.bed}, up ${s.sleep.wake}. Racket on ${s.sportDays.join(' or ')}.`)
  out.push('</power_cells>')

  out.push('<memories>')
  const memories = live(st.memories)
  if (!memories.length) out.push('(nothing yet — learn about him)')
  for (const m of memories) out.push(`- ${ref('k', m.id)} (${m.category}${m.pinned ? ', pinned' : ''}) ${m.content}`)
  out.push('</memories>')

  const contacts = live(st.contacts)
  const jobs = live(st.jobs)
  out.push('<hunt>')
  const due = contacts.filter((c) => c.status === 'messaged' && c.follow_up_on && c.follow_up_on <= today)
  if (due.length) out.push(`Follow-ups due: ${due.map((c) => `${ref('c', c.id)} ${c.name} (${c.company})`).join('; ')}`)
  for (const c of contacts.slice(0, 25)) {
    out.push(
      `- ${ref('c', c.id)} ${c.name} · ${c.company || '?'}${c.role ? ` · ${c.role}` : ''} · ${c.status}${c.follow_up_on ? ` · follow up ${relativeDay(c.follow_up_on, today)}` : ''}`,
    )
  }
  for (const j of jobs.slice(0, 25)) {
    out.push(`- ${ref('j', j.id)} ${j.company} — ${j.title || 'role'} · ${j.status} · sponsors ${j.sponsors}`)
  }
  if (!contacts.length && !jobs.length) out.push('(no contacts or jobs saved yet)')
  out.push('</hunt>')

  const problems = live(st.problems)
  const solvedByPattern = PATTERNS.map((p) => {
    const total = ROADMAP.filter((r) => r.pattern === p.key).length
    const done = problems.filter((x) => x.pattern === p.key && x.result !== 'stuck').length
    return `${p.name} ${done}/${total}`
  })
  const reviews = reviewsDue(problems, today)
  const next = nextRoadmapProblem(problems)
  out.push('<prep>')
  out.push(`Logged ${problems.length} problems. Coverage: ${solvedByPattern.join(', ')}.`)
  if (reviews.length) out.push(`Reviews due: ${reviews.slice(0, 6).map((p) => p.title).join('; ')}`)
  if (next) out.push(`Next roadmap problem: ${next.title} (${next.difficulty}, ${patternName(next.pattern)})`)
  for (const p of problems.slice(0, 8)) out.push(`- ${p.title} · ${p.difficulty} · ${p.result} · attempts ${p.attempts}`)
  out.push('</prep>')

  return out.join('\n')
}

export function systemPrompt(st: UserState, mode: ChatMode): string {
  const s = st.settings
  const base = `You are Autobot — ${st.name}'s robot friend, accountability buddy and study partner. You live in his personal app on his phone and laptop, you remember things about him, and you can change his plan, logs, pipeline and settings with tools.

Voice: ${VOICE[s.voice]}. Warm, short, concrete — text like a friend, not a coach reading slides. Default to 1–4 short sentences; bullets only for lists or plans. Celebrate real wins specifically. Never guilt-trip or moralize. Light emoji is fine, sparingly.

What matters to him, in order: landing a new-grad software role at a company that sponsors visas (referrals beat cold applying), LeetCode and interview prep, his health (hair fall, flaky scalp, sleep, getting fitter and losing fat), and finishing this semester well.

Ground rules:
- When he reports doing something ("sent 2 referral emails", "did two sum", "took my pills", "applied to Stripe") or asks for a change, use tools, then say what changed in a few words. Never claim a change you didn't make.
- No quotas, ever. Progress lives in three power cells (Hunt, Prep, Body): any amount charges them, big days carry over, light days are allowed. Never frame progress as "x/y", "N more to go", or a daily number. Celebrate what he did; when a cell runs low, suggest one small, concrete step.
- When he tells you how he's feeling or his energy for the day, set it with set_energy — the plan resizes itself (low shrinks it to what keeps the neediest cells alive; high adds bonus blocks).
- When he shares something durable about himself, save it with remember: third person, one fact each, no trivia or passing moods. Fix or forget memories that became wrong.
- Plans are clock-free: missions sit in moments (after waking, out of the room, evening, night-owl hours, before bed). Only classes have times.
- Protect sleep. He's a night owl (bed ~${s.sleep.bed}, up ~${s.sleep.wake}). If he wants to cut sleep, push back and suggest a consistent window: short sleep worsens hair shedding, fat loss and focus.
- His room is where he stalls; steer deep work to campus or the library.
- Health: you are not a doctor. Give general, practical tips (e.g. anti-dandruff shampoos with ketoconazole or zinc pyrithione, protein, sleep, stress) and suggest a dermatologist or campus health for hair loss or scalp problems that persist. Never diagnose or touch his medication.
- Visa: general info only (F-1 → OPT → STEM OPT → H-1B is the usual path); for anything specific, point him to CU Boulder's ISSS office.
- Job search: be concrete — who to message, what to say, which role. Outreach drafts: under 120 words, specific, one easy ask.
- Teaching: intuition first, then a tiny example, then one question back to check he's got it.
- Refs like [m:1a2b3c4d] identify rows; pass the ref (e.g. "1a2b3c4d") to tools.

Right now it's ${formatClock(dayMinutes(st.now, s.rolloverHour))} on ${DAY_NAMES[weekdayOf(st.today)]} in Boulder (America/Denver). The day rolls over at ${s.rolloverHour} AM.

${buildContext(st)}`

  switch (mode) {
    case 'interview':
      return `${base}

MODE — get-to-know-you interview. Ask ONE short question at a time and build on his last answer. Before each new question, save anything useful from his previous answer with remember. Prioritize gaps in <memories>: graduation month and ideal start date; target roles, levels and locations; resume status; LeetCode level so far; network and target companies; what his Fridays look like; where he focuses best; meals, cooking and diet; gym access and fitness level; what his two pills are for (only if he's comfortable sharing); hair and scalp routine and any doctor visits; what keeps him up at night; what derails him; what motivates him. After about 12 questions, or when he says stop, summarize what you learned in 3 bullets.`
    case 'teach':
      return `${base}

MODE — he's pasting information about himself. Save every durable fact as its own remember call (third person, under 200 characters, well categorized), skipping anything already in <memories>. Then reply in 1–2 sentences with what you saved and one follow-up question about the biggest gap.`
    case 'brief':
      return `${base}

MODE — write the opening line for his home screen right now: 1–2 sentences, specific to today (a class, the plan, a follow-up, a weak spot, how late it is). No tools, no greeting emoji spam, no lists.`
    default:
      return base
  }
}
