// The things Autobot can actually do. Every tool writes through the caller's
// RLS-scoped client and records a human-readable action + activity row, so
// every change is visible in chat and in the change log.

import type { Db } from './db.ts'
import type { FunctionDeclaration, GeminiFunctionCall } from './gemini.ts'
import type { UserState } from './state.ts'
import {
  addDays,
  daysBetween,
  dayMinutes,
  formatDate,
  live,
  missionProgress,
  planContext,
  planDay,
  diffPlan,
  relativeDay,
  roadmapProblem,
  routinesFor,
  scheduleReview,
  slugify,
  stableId,
  withDefaults,
  type Area,
  type ChatAction,
  type Contact,
  type ContactStatus,
  type Energy,
  type Assignment,
  type Job,
  type JobStatus,
  type Lead,
  type LogKind,
  type Memory,
  type MemoryCategory,
  type Mission,
  type Moment,
  type Problem,
  type ProblemResult,
  type Settings,
  type Size,
  type TargetKey,
} from './core/index.ts'

const MEMORY_CATEGORIES: MemoryCategory[] = ['about', 'goal', 'job', 'prep', 'health', 'schedule', 'habit', 'preference']
const AREAS: Area[] = ['hunt', 'prep', 'body', 'class', 'life']
const MOMENTS: Moment[] = ['wake', 'out', 'evening', 'night', 'bed', 'anytime']
const TARGETS: TargetKey[] = ['referral', 'application', 'followup', 'leetcode', 'workout']
const LOG_KINDS: LogKind[] = ['referral', 'application', 'followup', 'leetcode', 'workout', 'scalp', 'other']
const CONTACT_STATUSES: ContactStatus[] = ['to_contact', 'messaged', 'replied', 'referred', 'closed']
const JOB_STATUSES: JobStatus[] = ['saved', 'applied', 'oa', 'interview', 'offer', 'rejected', 'closed']

const str = { type: 'string' }
const int = { type: 'integer' }
const oneOf = (values: string[], description?: string) => ({ type: 'string', enum: values, description })

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'remember',
    description:
      'Save one durable fact about Pratik (a preference, goal, constraint, person, routine, health note). Third person, one fact, under 200 characters.',
    parameters: {
      type: 'object',
      properties: { category: oneOf(MEMORY_CATEGORIES), content: str },
      required: ['category', 'content'],
    },
  },
  {
    name: 'update_memory',
    description: 'Correct or re-categorize an existing memory, or pin it as especially important.',
    parameters: {
      type: 'object',
      properties: { ref: str, content: str, category: oneOf(MEMORY_CATEGORIES), pinned: { type: 'boolean' } },
      required: ['ref'],
    },
  },
  {
    name: 'forget',
    description: 'Delete a memory that is wrong or no longer true.',
    parameters: { type: 'object', properties: { ref: str }, required: ['ref'] },
  },
  {
    name: 'add_mission',
    description:
      'Add a clock-free mission to a day plan. Use a concrete, doable title ("Email Priya at Google for a referral"), not a vague one.',
    parameters: {
      type: 'object',
      properties: {
        title: str,
        area: oneOf(AREAS),
        size: oneOf(['S', 'M', 'L'], 'S ≈ quick, M ≈ a focused block, L ≈ a big block'),
        moment: oneOf(MOMENTS),
        when: { type: 'string', description: '"today", "tomorrow", or YYYY-MM-DD' },
        target: oneOf(TARGETS, 'The kind of logged activity that completes it (and charges its cell), if any'),
      },
      required: ['title', 'area'],
    },
  },
  {
    name: 'update_mission',
    description: 'Mark a mission done, skipped or back to todo; move it to another moment or day; or rename it.',
    parameters: {
      type: 'object',
      properties: {
        ref: str,
        status: oneOf(['todo', 'doing', 'done', 'skipped']),
        moment: oneOf(MOMENTS),
        when: { type: 'string', description: '"today", "tomorrow", or YYYY-MM-DD' },
        title: str,
      },
      required: ['ref'],
    },
  },
  {
    name: 'log_progress',
    description:
      'Log something he did that isn’t covered by log_problem/save_contact/save_job (e.g. "did a workout", "sent 3 referral DMs"). Charges the matching power cell — no targets involved.',
    parameters: {
      type: 'object',
      properties: {
        kind: oneOf(LOG_KINDS),
        amount: int,
        note: { type: 'string', description: 'Use "racket" for squash/badminton sessions' },
      },
      required: ['kind', 'amount'],
    },
  },
  {
    name: 'log_problem',
    description: 'Log a LeetCode attempt (even a stuck one counts as effort). Schedules spaced review and charges the Prep cell.',
    parameters: {
      type: 'object',
      properties: {
        title: str,
        result: oneOf(['solved', 'hints', 'stuck'], 'solved alone, needed hints, or got stuck'),
        difficulty: oneOf(['Easy', 'Medium', 'Hard']),
        pattern: str,
        notes: str,
      },
      required: ['title', 'result'],
    },
  },
  {
    name: 'save_contact',
    description:
      'Add or update a person in the referral pipeline. Setting status to "messaged" logs a referral ask and schedules a follow-up; followed_up=true logs a follow-up nudge.',
    parameters: {
      type: 'object',
      properties: {
        ref: str,
        name: str,
        company: str,
        role: str,
        channel: oneOf(['email', 'linkedin', 'other']),
        handle: { type: 'string', description: 'Email address or LinkedIn URL' },
        status: oneOf(CONTACT_STATUSES),
        followed_up: { type: 'boolean', description: 'He just followed up with them' },
        lead: { type: 'string', description: 'Ref of a lead from <leads> this person came from (fills in their details)' },
        follow_up_days: int,
        notes: str,
      },
      required: ['name'],
    },
  },
  {
    name: 'save_job',
    description: 'Add or update a job opening. Setting status to "applied" logs an application.',
    parameters: {
      type: 'object',
      properties: {
        ref: str,
        company: str,
        title: str,
        url: str,
        status: oneOf(JOB_STATUSES),
        sponsors: oneOf(['yes', 'no', 'unknown']),
        notes: str,
      },
      required: ['company'],
    },
  },
  {
    name: 'mark_routine',
    description: 'Check off (or undo) a routine for today, e.g. the morning pill or hair serum.',
    parameters: {
      type: 'object',
      properties: { ref: { type: 'string', description: 'Routine ref or name' }, done: { type: 'boolean' } },
      required: ['ref'],
    },
  },
  {
    name: 'update_settings',
    description:
      'Change a setting. Keys: sleep.bed, sleep.wake (HH:MM), voice (firm|gentle|strict), notify.routines|classes|bedtime|followups|nudges|weekly (true/false), notify.classLead (minutes).',
    parameters: { type: 'object', properties: { key: str, value: str }, required: ['key', 'value'] },
  },
  {
    name: 'finish_assignment',
    description: 'Mark an assignment from <school> done (or not done) when he says he submitted or finished it.',
    parameters: { type: 'object', properties: { ref: str, done: { type: 'boolean' } }, required: ['ref'] },
  },
  {
    name: 'set_energy',
    description:
      'Set today’s battery when he says how he feels ("wiped", "decent", "fired up"). The day’s plan resizes: low keeps only what the neediest cells need, high adds bonus blocks.',
    parameters: { type: 'object', properties: { level: oneOf(['low', 'normal', 'high']) }, required: ['level'] },
  },
]

type Args = Record<string, unknown>
type Result = Record<string, unknown>

const s = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const clip = (v: string, n = 70) => (v.length > n ? `${v.slice(0, n - 1)}…` : v)

function pickEnum<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

export class Toolbox {
  readonly actions: ChatAction[] = []

  constructor(
    private db: Db,
    private state: UserState,
    private source: 'autobot' | 'interview' = 'autobot',
  ) {}

  async run(call: GeminiFunctionCall): Promise<Result> {
    const args = (call.args ?? {}) as Args
    try {
      switch (call.name) {
        case 'remember':
          return await this.remember(args)
        case 'update_memory':
          return await this.updateMemory(args)
        case 'forget':
          return await this.forget(args)
        case 'add_mission':
          return await this.addMission(args)
        case 'update_mission':
          return await this.updateMission(args)
        case 'log_progress':
          return await this.logProgress(args)
        case 'log_problem':
          return await this.logProblem(args)
        case 'save_contact':
          return await this.saveContact(args)
        case 'save_job':
          return await this.saveJob(args)
        case 'mark_routine':
          return await this.markRoutine(args)
        case 'update_settings':
          return await this.updateSettings(args)
        case 'set_energy':
          return await this.setEnergy(args)
        case 'finish_assignment':
          return await this.finishAssignment(args)
        default:
          return { ok: false, error: `Unknown tool ${call.name}` }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  // ── plumbing

  private get uid() {
    return this.state.userId
  }

  private async write(table: string, row: Record<string, unknown>) {
    const { error } = await this.db.from(table).upsert({ user_id: this.uid, ...row }, { onConflict: 'id' })
    if (error) throw new Error(`${table}: ${error.message}`)
  }

  private async record(action: ChatAction, kind: string, data: Record<string, unknown> = {}) {
    this.actions.push(action)
    await this.db.from('activity').insert({
      user_id: this.uid,
      actor: 'autobot',
      kind,
      summary: action.label,
      ref_table: action.table ?? null,
      ref_id: action.id ?? null,
      data,
    })
  }

  private resolve<T extends { id: string; deleted_at?: string | null }>(list: T[], ref: unknown): T | undefined {
    const key = s(ref, 64).replace(/^\[?[a-z]:/i, '').replace(/\]$/, '').toLowerCase()
    if (!key) return undefined
    return live(list).find((r) => r.id.toLowerCase().startsWith(key))
  }

  private dayFor(when: unknown): string {
    const w = s(when, 20).toLowerCase()
    if (!w || w === 'today') return this.state.today
    if (w === 'tomorrow') return addDays(this.state.today, 1)
    if (/^\d{4}-\d{2}-\d{2}$/.test(w) && Math.abs(daysBetween(this.state.today, w)) <= 21) return w
    return this.state.today
  }

  private dayLabel(day: string) {
    return day === this.state.today ? '' : ` (${relativeDay(day, this.state.today)})`
  }

  private async log(kind: LogKind, amount: number, refId: string | null, note: string | null = null) {
    const row = {
      id: crypto.randomUUID(),
      day: this.state.today,
      kind,
      amount,
      ref_id: refId,
      note,
    }
    await this.write('logs', row)
    this.state.logs.push({ ...row, user_id: this.uid })
  }

  // ── memories

  private async remember(a: Args): Promise<Result> {
    const content = s(a.content, 500)
    if (!content) return { ok: false, error: 'content is empty' }
    const dup = live(this.state.memories).find((m) => m.content.toLowerCase() === content.toLowerCase())
    if (dup) return { ok: true, duplicate: true, ref: dup.id.slice(0, 8) }
    const row: Memory = {
      id: crypto.randomUUID(),
      category: pickEnum(a.category, MEMORY_CATEGORIES, 'about'),
      content,
      source: this.source,
      pinned: false,
    }
    await this.write('memories', row as unknown as Record<string, unknown>)
    this.state.memories.push(row)
    await this.record({ type: 'memory.add', label: `Remembered: ${clip(content)}`, table: 'memories', id: row.id }, 'memory.add')
    return { ok: true, ref: row.id.slice(0, 8) }
  }

  private async updateMemory(a: Args): Promise<Result> {
    const m = this.resolve(this.state.memories, a.ref)
    if (!m) return { ok: false, error: 'memory not found' }
    const patch: Partial<Memory> = {}
    if (s(a.content)) patch.content = s(a.content)
    if (a.category) patch.category = pickEnum(a.category, MEMORY_CATEGORIES, m.category)
    if (typeof a.pinned === 'boolean') patch.pinned = a.pinned
    const { error } = await this.db.from('memories').update(patch).eq('id', m.id)
    if (error) throw new Error(error.message)
    Object.assign(m, patch)
    await this.record(
      { type: 'memory.update', label: `Updated memory: ${clip(m.content)}`, table: 'memories', id: m.id },
      'memory.update',
      patch,
    )
    return { ok: true }
  }

  private async forget(a: Args): Promise<Result> {
    const m = this.resolve(this.state.memories, a.ref)
    if (!m) return { ok: false, error: 'memory not found' }
    const deleted_at = new Date().toISOString()
    const { error } = await this.db.from('memories').update({ deleted_at }).eq('id', m.id)
    if (error) throw new Error(error.message)
    m.deleted_at = deleted_at
    await this.record(
      { type: 'memory.forget', label: `Forgot: ${clip(m.content)}`, table: 'memories', id: m.id, undo: { deleted_at: null } },
      'memory.forget',
    )
    return { ok: true }
  }

  // ── missions

  private async addMission(a: Args): Promise<Result> {
    const title = s(a.title, 200)
    if (!title) return { ok: false, error: 'title is empty' }
    const day = this.dayFor(a.when)
    const target = TARGETS.includes(a.target as TargetKey) ? (a.target as TargetKey) : null
    const row: Mission = {
      id: crypto.randomUUID(),
      day,
      key: null,
      title,
      area: pickEnum(a.area, AREAS, 'life'),
      size: pickEnum(a.size, ['S', 'M', 'L'] as Size[], 'M'),
      moment: pickEnum(a.moment, MOMENTS, 'anytime'),
      status: 'todo',
      target_key: target,
      amount: 1,
      note: null,
      sort: 1000 + this.state.missions.length,
      source: 'autobot',
    }
    await this.write('missions', row as unknown as Record<string, unknown>)
    this.state.missions.push(row)
    await this.record(
      { type: 'mission.add', label: `Added${this.dayLabel(day)}: ${clip(title)}`, table: 'missions', id: row.id },
      'mission.add',
    )
    return { ok: true, ref: row.id.slice(0, 8), day }
  }

  private async updateMission(a: Args): Promise<Result> {
    const m = this.resolve(this.state.missions, a.ref)
    if (!m) return { ok: false, error: 'mission not found' }
    const patch: Partial<Mission> = {}
    const labels: string[] = []

    if (a.status && a.status !== m.status) {
      const status = pickEnum(a.status, ['todo', 'doing', 'done', 'skipped'] as Mission['status'][], m.status)
      patch.status = status
      if (status === 'done') {
        patch.done_at = new Date().toISOString()
        if (m.target_key) {
          const have = missionProgress(this.state.missions, this.state.logs, m.day).get(m.id) ?? 0
          if (m.amount - have > 0) await this.log(m.target_key, m.amount - have, m.id, m.note ?? null)
        }
        labels.push('Marked done')
      } else {
        patch.done_at = null
        if (status === 'doing') patch.started_at = new Date().toISOString()
        await this.clearMissionLogs(m.id)
        labels.push(status === 'skipped' ? 'Skipped' : status === 'doing' ? 'Started' : 'Reopened')
      }
    }
    if (a.moment && a.moment !== m.moment) {
      patch.moment = pickEnum(a.moment, MOMENTS, m.moment)
      labels.push(`Moved to ${patch.moment}`)
    }
    if (a.when) {
      const day = this.dayFor(a.when)
      if (day !== m.day) {
        patch.day = day
        labels.push(`Moved to ${relativeDay(day, this.state.today)}`)
      }
    }
    if (s(a.title) && s(a.title) !== m.title) {
      patch.title = s(a.title, 200)
      labels.push('Renamed')
    }
    if (!labels.length) return { ok: true, unchanged: true }

    const { error } = await this.db.from('missions').update(patch).eq('id', m.id)
    if (error) throw new Error(error.message)
    Object.assign(m, patch)
    await this.record(
      { type: 'mission.update', label: `${labels.join(', ')}: ${clip(m.title)}`, table: 'missions', id: m.id },
      'mission.update',
      patch,
    )
    return { ok: true }
  }

  private async clearMissionLogs(missionId: string) {
    const deleted_at = new Date().toISOString()
    const { error } = await this.db
      .from('logs')
      .update({ deleted_at })
      .eq('ref_id', missionId)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    for (const l of this.state.logs) if (l.ref_id === missionId) l.deleted_at = deleted_at
  }

  // ── progress

  private async logProgress(a: Args): Promise<Result> {
    const kind = pickEnum(a.kind, LOG_KINDS, 'other')
    const amount = Math.max(-20, Math.min(20, Math.round(Number(a.amount) || 1)))
    const note = s(a.note, 200) || null
    await this.log(kind, amount, null, note)
    const unit: Record<LogKind, string> = {
      referral: 'referral ask',
      application: 'application',
      followup: 'follow-up',
      leetcode: 'LeetCode problem',
      workout: 'workout',
      scalp: 'scalp wash',
      other: 'thing',
    }
    await this.record(
      { type: 'log.add', label: `Logged ${amount} ${unit[kind]}${Math.abs(amount) === 1 ? '' : 's'}${note ? ` (${clip(note, 30)})` : ''}`, table: 'logs' },
      'log.add',
      { kind, amount, note },
    )
    return { ok: true }
  }

  private async logProblem(a: Args): Promise<Result> {
    const rawTitle = s(a.title, 160)
    if (!rawTitle) return { ok: false, error: 'title is empty' }
    const known = roadmapProblem(rawTitle)
    const slug = known?.slug ?? slugify(rawTitle)
    const existing = live(this.state.problems).find((p) => p.slug === slug)
    const result = pickEnum(a.result, ['solved', 'hints', 'stuck'] as ProblemResult[], 'solved')
    const review = scheduleReview(result, existing ?? null, this.state.today)
    const notes = [existing?.notes, s(a.notes, 400)].filter(Boolean).join('\n')
    const row: Problem = {
      id: existing?.id ?? stableId(`${this.uid}:problem:${slug}`),
      slug,
      title: known?.title ?? rawTitle,
      difficulty: known?.difficulty ?? pickEnum(a.difficulty, ['Easy', 'Medium', 'Hard'] as Problem['difficulty'][], 'Medium'),
      pattern: known?.pattern ?? (s(a.pattern, 40) || existing?.pattern || 'other'),
      result,
      attempts: (existing?.attempts ?? 0) + 1,
      interval_days: review.interval_days,
      next_review: review.next_review,
      last_solved_on: result === 'stuck' ? (existing?.last_solved_on ?? null) : this.state.today,
      notes,
    }
    await this.write('problems', row as unknown as Record<string, unknown>)
    if (existing) Object.assign(existing, row)
    else this.state.problems.push(row)
    await this.log('leetcode', 1, row.id) // stuck still counts as effort
    const verdict = { solved: 'solved', hints: 'solved with hints', stuck: 'stuck — back tomorrow' }[result]
    await this.record(
      {
        type: 'problem.log',
        label: `LeetCode: ${row.title} — ${verdict}, review ${relativeDay(review.next_review, this.state.today)}`,
        table: 'problems',
        id: row.id,
      },
      'problem.log',
      { result },
    )
    return { ok: true, next_review: review.next_review }
  }

  // ── hunt

  private async saveContact(a: Args): Promise<Result> {
    const lead = this.resolve<Lead>(this.state.leads, a.lead)
    const name = s(a.name, 120) || lead?.name || ''
    const company = s(a.company, 120) || lead?.company || ''
    const linked = lead?.contact_id ? live(this.state.contacts).find((c) => c.id === lead.contact_id) : undefined
    const existing =
      this.resolve(this.state.contacts, a.ref) ??
      linked ??
      live(this.state.contacts).find(
        (c) => c.name.toLowerCase() === name.toLowerCase() && (!company || c.company.toLowerCase() === company.toLowerCase()),
      )
    if (!existing && !name) return { ok: false, error: 'name is required' }
    const status = pickEnum(a.status, CONTACT_STATUSES, existing?.status ?? 'to_contact')
    const row: Contact = {
      // Same id the app uses for a lead, so both sides can't create the person twice.
      id: existing?.id ?? (lead ? stableId(`${this.uid}:lead-contact:${lead.id}`) : crypto.randomUUID()),
      name: name || existing!.name,
      company: company || existing?.company || '',
      role: s(a.role, 120) || existing?.role || lead?.headline.slice(0, 120) || '',
      channel: pickEnum(a.channel, ['email', 'linkedin', 'other'] as Contact['channel'][], existing?.channel ?? (lead ? 'linkedin' : 'email')),
      handle: s(a.handle, 300) || existing?.handle || lead?.url || '',
      status,
      job_id: existing?.job_id ?? null,
      last_contact_at: existing?.last_contact_at ?? null,
      follow_up_on: existing?.follow_up_on ?? null,
      notes: [existing?.notes, s(a.notes, 600)].filter(Boolean).join('\n'),
    }
    const becameMessaged = status === 'messaged' && existing?.status !== 'messaged'
    const followedUp = a.followed_up === true && !becameMessaged
    if (becameMessaged || followedUp) row.last_contact_at = new Date().toISOString()
    if (a.follow_up_days != null || becameMessaged || followedUp) {
      const days = Math.max(1, Math.min(30, Number(a.follow_up_days) || 5))
      row.follow_up_on = addDays(this.state.today, days)
    }
    if (status === 'replied' || status === 'referred' || status === 'closed') row.follow_up_on = null
    await this.write('contacts', row as unknown as Record<string, unknown>)
    if (existing) Object.assign(existing, row)
    else this.state.contacts.push(row)
    if (lead && !lead.contact_id) {
      const { error } = await this.db.from('leads').update({ contact_id: row.id }).eq('id', lead.id)
      if (error) throw new Error(error.message)
      lead.contact_id = row.id
    }
    if (becameMessaged) await this.log('referral', 1, row.id)
    if (followedUp) await this.log('followup', 1, row.id)
    const statusLabel: Record<ContactStatus, string> = {
      to_contact: 'to reach out',
      messaged: `messaged, follow up ${row.follow_up_on ? formatDate(row.follow_up_on) : 'later'}`,
      replied: 'replied',
      referred: 'referred you 🎉',
      closed: 'closed',
    }
    await this.record(
      {
        type: 'contact.save',
        label: `${existing ? 'Updated' : 'Added'} ${row.name}${row.company ? ` (${row.company})` : ''} — ${statusLabel[status]}`,
        table: 'contacts',
        id: row.id,
      },
      'contact.save',
      { status },
    )
    return { ok: true, ref: row.id.slice(0, 8), follow_up_on: row.follow_up_on }
  }

  private async saveJob(a: Args): Promise<Result> {
    const company = s(a.company, 120)
    const title = s(a.title, 160)
    const existing =
      this.resolve(this.state.jobs, a.ref) ??
      live(this.state.jobs).find(
        (j) => j.company.toLowerCase() === company.toLowerCase() && (!title || j.title.toLowerCase() === title.toLowerCase()),
      )
    if (!existing && !company) return { ok: false, error: 'company is required' }
    const status = pickEnum(a.status, JOB_STATUSES, existing?.status ?? 'saved')
    const row: Job = {
      id: existing?.id ?? crypto.randomUUID(),
      company: company || existing!.company,
      title: title || existing?.title || '',
      url: s(a.url, 500) || existing?.url || '',
      location: existing?.location ?? '',
      status,
      sponsors: pickEnum(a.sponsors, ['yes', 'no', 'unknown'] as Job['sponsors'][], existing?.sponsors ?? 'unknown'),
      applied_on: existing?.applied_on ?? null,
      notes: [existing?.notes, s(a.notes, 600)].filter(Boolean).join('\n'),
    }
    const applied = status === 'applied' && existing?.status !== 'applied' && !existing?.applied_on
    if (applied) row.applied_on = this.state.today
    await this.write('jobs', row as unknown as Record<string, unknown>)
    if (existing) Object.assign(existing, row)
    else this.state.jobs.push(row)
    if (applied) await this.log('application', 1, row.id)
    await this.record(
      {
        type: 'job.save',
        label: `${existing ? 'Updated' : 'Saved'} ${row.company}${row.title ? ` — ${clip(row.title, 40)}` : ''} (${status})`,
        table: 'jobs',
        id: row.id,
      },
      'job.save',
      { status },
    )
    return { ok: true, ref: row.id.slice(0, 8) }
  }

  // ── routines

  private async markRoutine(a: Args): Promise<Result> {
    const todays = routinesFor(this.state.today, this.state.routines)
    let routine = this.resolve(todays, a.ref)
    if (!routine) {
      const q = s(a.ref, 60).toLowerCase()
      const matches = todays.filter((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase()))
      if (matches.length > 1) {
        // "serum" at night means the night one.
        const evening = dayMinutes(this.state.now, this.state.settings.rolloverHour) >= 18 * 60
        routine = matches.find((r) => r.stack === (evening ? 'night' : 'morning')) ?? matches[0]
      } else routine = matches[0]
    }
    if (!routine) return { ok: false, error: 'routine not found', routines: todays.map((r) => r.name) }
    const done = a.done !== false
    const id = stableId(`${routine.id}:${this.state.today}`)
    await this.write('routine_logs', {
      id,
      routine_id: routine.id,
      day: this.state.today,
      done_at: new Date().toISOString(),
      deleted_at: done ? null : new Date().toISOString(),
    })
    await this.record(
      {
        type: 'routine.mark',
        label: `${done ? 'Checked off' : 'Unchecked'} ${routine.emoji} ${routine.name}`,
        table: 'routine_logs',
        id,
      },
      'routine.mark',
      { done },
    )
    return { ok: true }
  }

  // ── settings

  private async updateSettings(a: Args): Promise<Result> {
    const key = s(a.key, 40)
    const raw = s(a.value, 40)
    const settings: Settings = withDefaults(this.state.settings)
    const hhmm = /^([01]?\d|2[0-3]):[0-5]\d$/
    let label = ''
    if (key === 'sleep.bed' || key === 'sleep.wake') {
      if (!hhmm.test(raw)) return { ok: false, error: 'use HH:MM' }
      const v = raw.padStart(5, '0')
      settings.sleep = { ...settings.sleep, [key.split('.')[1]]: v }
      label = `${key === 'sleep.bed' ? 'Bedtime' : 'Wake-up'} → ${v}`
    } else if (key === 'voice') {
      settings.voice = pickEnum(raw, ['firm', 'gentle', 'strict'], settings.voice)
      label = `Voice → ${settings.voice}`
    } else if (key === 'notify.classLead') {
      settings.notify = { ...settings.notify, classLead: Math.max(15, Math.min(180, Math.round(Number(raw)))) }
      label = `Class reminder → ${settings.notify.classLead} min before`
    } else if (key.startsWith('notify.')) {
      const k = key.split('.')[1] as keyof Settings['notify']
      if (!(k in settings.notify) || k === 'classLead') return { ok: false, error: 'unknown notification' }
      const on = raw === 'true' || raw === 'on' || raw === '1'
      settings.notify = { ...settings.notify, [k]: on }
      label = `${k} reminders ${on ? 'on' : 'off'}`
    } else {
      return { ok: false, error: 'unsupported setting' }
    }
    const { error } = await this.db.from('profiles').update({ settings }).eq('id', this.uid)
    if (error) throw new Error(error.message)
    this.state.settings = settings
    await this.record({ type: 'settings.update', label: `Changed: ${label}`, table: 'profiles' }, 'settings.update', {
      key,
      value: raw,
    })
    return { ok: true }
  }

  // ── battery

  private async setEnergy(a: Args): Promise<Result> {
    const level = pickEnum(a.level, ['low', 'normal', 'high'] as Energy[], 'normal')
    const st = this.state
    const today = st.today
    const now = new Date().toISOString()
    if (st.checkin && st.checkin.date === today) {
      const { error } = await this.db.from('day_checkins').update({ energy: level }).eq('id', st.checkin.id)
      if (error) throw new Error(error.message)
      st.checkin.energy = level
    } else {
      const row = { id: stableId(`${this.uid}:checkin:${today}`), date: today, checked_in_at: now, note: 'set in chat', energy: level }
      await this.write('day_checkins', row)
      st.checkin = { ...row, user_id: this.uid }
    }

    const next = planDay({
      userId: this.uid,
      date: today,
      settings: st.settings,
      logs: st.logs,
      energy: level,
      context: planContext({ date: today, problems: st.problems, contacts: st.contacts, jobs: st.jobs }),
    })
    const diff = diffPlan(st.missions, today, next)
    if (diff.add.length) {
      const { error } = await this.db.from('missions').upsert(
        diff.add.map((m) => ({ ...m, user_id: this.uid })),
        { onConflict: 'id', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
      st.missions.push(...diff.add)
    }
    for (const u of diff.update) {
      const { error } = await this.db.from('missions').update(u.patch).eq('id', u.id)
      if (error) throw new Error(error.message)
      Object.assign(st.missions.find((m) => m.id === u.id) ?? {}, u.patch)
    }
    if (diff.remove.length) {
      const { error } = await this.db.from('missions').update({ deleted_at: now }).in('id', diff.remove)
      if (error) throw new Error(error.message)
      for (const m of st.missions) if (diff.remove.includes(m.id)) m.deleted_at = now
    }
    const word = { low: 'Low', normal: 'Normal', high: 'Charged' }[level]
    const changes = [diff.add.length && `${diff.add.length} added`, diff.remove.length && `${diff.remove.length} set aside`]
      .filter(Boolean)
      .join(', ')
    await this.record(
      { type: 'settings.energy', label: `Battery today: ${word}${changes ? ` — plan resized (${changes})` : ''}`, table: 'day_checkins' },
      'energy.set',
      { level, added: diff.add.length, removed: diff.remove.length },
    )
    return { ok: true, added: diff.add.map((m) => m.title), set_aside: diff.remove.length }
  }

  // ── school

  private async finishAssignment(a: Args): Promise<Result> {
    const item = this.resolve<Assignment>(this.state.assignments, a.ref)
    if (!item) return { ok: false, error: 'assignment not found' }
    const done = a.done !== false
    const done_at = done ? new Date().toISOString() : null
    const { error } = await this.db.from('assignments').update({ done_at }).eq('id', item.id)
    if (error) throw new Error(error.message)
    item.done_at = done_at
    await this.record(
      { type: 'class.assignment', label: `${done ? 'Finished' : 'Reopened'}: ${clip(item.title)}`, table: 'assignments', id: item.id },
      'assignment.done',
      { done },
    )
    return { ok: true }
  }
}
