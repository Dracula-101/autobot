// Everything the UI can change, applied through the sync store. Each action
// records itself in the change log and returns an undo.

import {
  addDays,
  diffPlan,
  logicalDay,
  missionProgress,
  planContext,
  planDay,
  roadmapProblem,
  scheduleReview,
  slugify,
  stableId,
  type Activity,
  type Checkin,
  type Contact,
  type ContactStatus,
  type Energy,
  type Job,
  type JobStatus,
  type LogEntry,
  type LogKind,
  type Memory,
  type Mission,
  type Problem,
  type ProblemResult,
  type Review,
  type Routine,
  type RoutineLog,
  type Settings,
} from '@core/index.ts'
import type { SyncRow, SyncStore, Table } from './sync'

export type Undo = () => void

const nowIso = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()
const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Snapshot rows so an action can be reverted exactly. */
function snapshot(store: SyncStore, table: Table, ids: string[]) {
  const before = ids.map((id) => store.get<SyncRow>(table, id)).filter(Boolean) as SyncRow[]
  const known = new Set(before.map((r) => r.id))
  return () => {
    for (const row of before) store.upsert(table, { ...row })
    for (const id of ids) if (!known.has(id) && store.get(table, id)) store.remove(table, id)
  }
}

export function createActions(store: SyncStore, settings: Settings) {
  const today = () => logicalDay(new Date(), settings.rolloverHour)

  const log = (
    summary: string,
    kind: string,
    ref?: { table: string; id: string },
    data: Record<string, unknown> = {},
    actor: Activity['actor'] = 'you',
  ) => {
    store.upsert('activity', {
      id: uuid(),
      actor,
      kind,
      summary,
      ref_table: ref?.table ?? null,
      ref_id: ref?.id ?? null,
      data,
    } as Activity as SyncRow)
  }

  const addLog = (entry: Omit<LogEntry, 'id' | 'day'> & { day?: string }): string => {
    const id = uuid()
    store.upsert('logs', { id, day: entry.day ?? today(), ...entry } as LogEntry as SyncRow)
    return id
  }

  const missionLogs = (missionId: string) =>
    store.rows<LogEntry>('logs').filter((l) => l.ref_id === missionId)

  const checkinId = (date: string) => stableId(`${store.userId}:checkin:${date}`)

  /** A plan for `date` from everything the store knows right now. */
  const freshPlan = (date: string, energy: Energy | null) =>
    planDay({
      userId: store.userId,
      date,
      settings,
      logs: store.rows<LogEntry>('logs'),
      energy,
      since: store
        .rows<Checkin>('day_checkins')
        .map((c) => c.date)
        .sort()[0],
      context: planContext({
        date,
        problems: store.rows<Problem>('problems'),
        contacts: store.rows<Contact>('contacts'),
        jobs: store.rows<Job>('jobs'),
      }),
    })

  const actions = {
    // ── day

    checkIn(): void {
      const date = today()
      store.upsert(
        'day_checkins',
        { id: checkinId(date), date, checked_in_at: nowIso(), note: 'opened app' } as Checkin as SyncRow,
        { ignoreDuplicates: true },
      )
    },

    ensurePlan(): void {
      const date = today()
      // Deleted plan rows count too: never resurrect a mission he removed.
      if (store.all<Mission>('missions').some((m) => m.day === date && m.source === 'plan')) return
      const energy = store.get<Checkin>('day_checkins', checkinId(date))?.energy ?? null
      const plan = freshPlan(date, energy)
      if (!plan.length) return
      store.upsert('missions', plan as unknown as SyncRow[], { ignoreDuplicates: true })
      log(`Planned ${plan.length} sessions for today`, 'plan.generate', undefined, { day: date }, 'autobot')
    },

    /** Today's battery check-in: resizes the plan without touching started or finished work. */
    setEnergy(energy: Energy): Undo {
      const date = today()
      const id = checkinId(date)
      const existing = store.get<Checkin>('day_checkins', id)
      const undoCheckin = snapshot(store, 'day_checkins', [id])
      store.upsert('day_checkins', {
        ...(existing ?? { id, date, checked_in_at: nowIso(), note: 'battery check-in' }),
        energy,
      } as Checkin as SyncRow)

      const all = store.all<Mission>('missions')
      const diff = diffPlan(all, date, freshPlan(date, energy))
      const touched = [...diff.add.map((m) => m.id), ...diff.update.map((u) => u.id), ...diff.remove]
      const undoMissions = snapshot(store, 'missions', touched)
      if (diff.add.length) store.upsert('missions', diff.add as unknown as SyncRow[], { ignoreDuplicates: true })
      for (const u of diff.update) store.patch<Mission>('missions', u.id, u.patch)
      for (const id of diff.remove) store.remove('missions', id)
      const word = { low: 'Low', normal: 'Normal', high: 'Charged' }[energy]
      log(`Battery today: ${word}`, 'energy.set', undefined, { energy, added: diff.add.length, removed: diff.remove.length })
      return () => {
        undoMissions()
        undoCheckin()
      }
    },

    // ── missions

    toggleMission(m: Mission): Undo {
      const undoMission = snapshot(store, 'missions', [m.id])
      if (m.status === 'done') {
        const touched = missionLogs(m.id).map((l) => l.id)
        const undoLogs = snapshot(store, 'logs', touched)
        store.patch<Mission>('missions', m.id, { status: 'todo', done_at: null })
        for (const id of touched) store.remove('logs', id)
        log(`Reopened: ${clip(m.title)}`, 'mission.update', { table: 'missions', id: m.id })
        return () => {
          undoMission()
          undoLogs()
        }
      }
      store.patch<Mission>('missions', m.id, { status: 'done', done_at: nowIso() })
      const created: string[] = []
      if (m.target_key) {
        const have = missionProgress(store.rows<Mission>('missions'), store.rows<LogEntry>('logs'), m.day).get(m.id) ?? 0
        if (m.amount - have > 0) {
          created.push(addLog({ day: m.day, kind: m.target_key, amount: m.amount - have, ref_id: m.id, note: m.note ?? null }))
        }
      }
      log(`Done: ${clip(m.title)}`, 'mission.done', { table: 'missions', id: m.id })
      return () => {
        undoMission()
        for (const id of created) store.remove('logs', id)
      }
    },

    setMissionStatus(m: Mission, status: Mission['status']): Undo {
      const undo = snapshot(store, 'missions', [m.id])
      const patch: Partial<Mission> = { status }
      if (status === 'doing') patch.started_at = nowIso()
      if (status !== 'done') patch.done_at = null
      store.patch<Mission>('missions', m.id, patch)
      const verb = { doing: 'Started', skipped: 'Skipped', todo: 'Reopened', done: 'Done' }[status]
      log(`${verb}: ${clip(m.title)}`, 'mission.update', { table: 'missions', id: m.id })
      return undo
    },

    moveMission(m: Mission, to: { moment?: Mission['moment']; day?: string }): Undo {
      const undo = snapshot(store, 'missions', [m.id])
      store.patch<Mission>('missions', m.id, { ...to, status: m.status === 'doing' ? 'todo' : m.status })
      const where = to.day && to.day !== m.day ? (to.day === addDays(today(), 1) ? 'tomorrow' : to.day) : to.moment
      log(`Moved to ${where}: ${clip(m.title)}`, 'mission.move', { table: 'missions', id: m.id })
      return undo
    },

    addMission(input: Pick<Mission, 'title' | 'area' | 'size' | 'moment'> & Partial<Mission>): Mission {
      const row: Mission = {
        id: uuid(),
        day: input.day ?? today(),
        key: null,
        status: 'todo',
        target_key: null,
        amount: 1,
        note: null,
        sort: 1000 + store.rows('missions').length,
        source: 'user',
        ...input,
      }
      store.upsert('missions', row as unknown as SyncRow)
      log(`Added: ${clip(row.title)}`, 'mission.add', { table: 'missions', id: row.id })
      return row
    },

    deleteMission(m: Mission): Undo {
      const logIds = missionLogs(m.id).map((l) => l.id)
      const undoMission = snapshot(store, 'missions', [m.id])
      const undoLogs = snapshot(store, 'logs', logIds)
      store.remove('missions', m.id)
      for (const id of logIds) store.remove('logs', id)
      log(`Removed: ${clip(m.title)}`, 'mission.delete', { table: 'missions', id: m.id })
      return () => {
        undoMission()
        undoLogs()
      }
    },

    // ── routines

    markRoutine(r: Routine, done: boolean, day = today()): Undo {
      const id = stableId(`${r.id}:${day}`)
      const undo = snapshot(store, 'routine_logs', [id])
      store.upsert('routine_logs', {
        id,
        routine_id: r.id,
        day,
        done_at: nowIso(),
        deleted_at: done ? null : nowIso(),
      } as RoutineLog as SyncRow)
      log(`${done ? 'Checked off' : 'Unchecked'} ${r.emoji} ${r.name}`, 'routine.mark', { table: 'routine_logs', id })
      return undo
    },

    saveRoutine(r: Partial<Routine> & Pick<Routine, 'name'>): Routine {
      const existing = r.id ? store.get<Routine>('routines', r.id) : undefined
      const row: Routine = {
        emoji: '✨',
        stack: null,
        anchor: 'time',
        offset_min: 0,
        at_time: '20:00',
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        per_week: null,
        remind: true,
        active: true,
        sort: 100 + store.rows('routines').length,
        ...existing,
        ...r,
        id: r.id ?? uuid(),
      }
      store.upsert('routines', row as unknown as SyncRow)
      log(`${existing ? 'Updated' : 'Added'} routine: ${row.emoji} ${row.name}`, 'routine.save', { table: 'routines', id: row.id })
      return row
    },

    deleteRoutine(r: Routine): Undo {
      const undo = snapshot(store, 'routines', [r.id])
      store.remove('routines', r.id)
      log(`Removed routine: ${r.emoji} ${r.name}`, 'routine.delete', { table: 'routines', id: r.id })
      return undo
    },

    // ── progress

    logProgress(kind: LogKind, amount: number, note: string | null = null): Undo {
      const id = addLog({ kind, amount, note, ref_id: null })
      const label: Record<LogKind, string> = {
        referral: 'referral ask',
        application: 'application',
        followup: 'follow-up',
        leetcode: 'LeetCode problem',
        workout: note === 'racket' ? 'racket session' : 'workout',
        scalp: 'scalp wash',
        other: 'thing',
      }
      log(`Logged ${amount} ${label[kind]}${amount === 1 ? '' : 's'}`, 'log.add', { table: 'logs', id })
      return () => store.remove('logs', id)
    },

    logProblem(input: { title: string; result: ProblemResult; notes?: string; difficulty?: Problem['difficulty']; pattern?: string }): {
      problem: Problem
      undo: Undo
    } {
      const known = roadmapProblem(input.title)
      const slug = known?.slug ?? slugify(input.title)
      const existing = store.rows<Problem>('problems').find((p) => p.slug === slug)
      const id = existing?.id ?? stableId(`${store.userId}:problem:${slug}`)
      const undoProblem = snapshot(store, 'problems', [id])
      const review = scheduleReview(input.result, existing ?? null, today())
      const problem: Problem = {
        id,
        slug,
        title: known?.title ?? input.title.trim(),
        difficulty: known?.difficulty ?? input.difficulty ?? 'Medium',
        pattern: known?.pattern ?? input.pattern ?? existing?.pattern ?? 'other',
        result: input.result,
        attempts: (existing?.attempts ?? 0) + 1,
        interval_days: review.interval_days,
        next_review: review.next_review,
        last_solved_on: input.result === 'stuck' ? (existing?.last_solved_on ?? null) : today(),
        notes: [existing?.notes, input.notes?.trim()].filter(Boolean).join('\n'),
      }
      store.upsert('problems', problem as unknown as SyncRow)
      // Getting stuck is still effort — it charges the Prep cell too.
      const logId = addLog({ kind: 'leetcode', amount: 1, ref_id: id, note: null })
      log(`LeetCode: ${problem.title} (${input.result})`, 'problem.log', { table: 'problems', id })
      return {
        problem,
        undo: () => {
          undoProblem()
          store.remove('logs', logId)
        },
      }
    },

    // ── hunt

    saveContact(input: Partial<Contact> & Pick<Contact, 'name'>): Contact {
      const existing = input.id ? store.get<Contact>('contacts', input.id) : undefined
      const row: Contact = {
        company: '',
        role: '',
        channel: 'email',
        handle: '',
        status: 'to_contact',
        job_id: null,
        last_contact_at: null,
        follow_up_on: null,
        notes: '',
        ...existing,
        ...input,
        id: input.id ?? uuid(),
      }
      store.upsert('contacts', row as unknown as SyncRow)
      log(`${existing ? 'Updated' : 'Added'} ${row.name}${row.company ? ` (${row.company})` : ''}`, 'contact.save', {
        table: 'contacts',
        id: row.id,
      })
      return row
    },

    setContactStatus(c: Contact, status: ContactStatus, followUpDays = 5): Undo {
      const undo = snapshot(store, 'contacts', [c.id])
      const patch: Partial<Contact> = { status }
      let logId: string | null = null
      if (status === 'messaged') {
        patch.last_contact_at = nowIso()
        patch.follow_up_on = addDays(today(), followUpDays)
        if (c.status !== 'messaged') logId = addLog({ kind: 'referral', amount: 1, ref_id: c.id, note: null })
      } else if (status !== 'to_contact') {
        patch.follow_up_on = null
      }
      store.patch<Contact>('contacts', c.id, patch)
      const verb: Record<ContactStatus, string> = {
        to_contact: 'Back to “reach out”',
        messaged: 'Messaged',
        replied: 'Replied',
        referred: 'Referred you',
        closed: 'Closed',
      }
      log(`${verb[status]}: ${c.name}${c.company ? ` (${c.company})` : ''}`, 'contact.status', { table: 'contacts', id: c.id })
      return () => {
        undo()
        if (logId) store.remove('logs', logId)
      }
    },

    bumpFollowUp(c: Contact, days = 5): Undo {
      const undo = snapshot(store, 'contacts', [c.id])
      store.patch<Contact>('contacts', c.id, { last_contact_at: nowIso(), follow_up_on: addDays(today(), days) })
      const logId = addLog({ kind: 'followup', amount: 1, ref_id: c.id, note: null })
      log(`Followed up with ${c.name}`, 'contact.followup', { table: 'contacts', id: c.id })
      return () => {
        undo()
        store.remove('logs', logId)
      }
    },

    deleteContact(c: Contact): Undo {
      const undo = snapshot(store, 'contacts', [c.id])
      store.remove('contacts', c.id)
      log(`Removed ${c.name}`, 'contact.delete', { table: 'contacts', id: c.id })
      return undo
    },

    saveJob(input: Partial<Job> & Pick<Job, 'company'>): Job {
      const existing = input.id ? store.get<Job>('jobs', input.id) : undefined
      const row: Job = {
        title: '',
        url: '',
        location: '',
        status: 'saved',
        sponsors: 'unknown',
        applied_on: null,
        notes: '',
        ...existing,
        ...input,
        id: input.id ?? uuid(),
      }
      store.upsert('jobs', row as unknown as SyncRow)
      log(`${existing ? 'Updated' : 'Saved'} ${row.company}${row.title ? ` — ${clip(row.title, 40)}` : ''}`, 'job.save', {
        table: 'jobs',
        id: row.id,
      })
      return row
    },

    setJobStatus(j: Job, status: JobStatus): Undo {
      const undo = snapshot(store, 'jobs', [j.id])
      const patch: Partial<Job> = { status }
      let logId: string | null = null
      if (status === 'applied' && !j.applied_on) {
        patch.applied_on = today()
        logId = addLog({ kind: 'application', amount: 1, ref_id: j.id, note: null })
      }
      store.patch<Job>('jobs', j.id, patch)
      log(`${j.company}: ${status}`, 'job.status', { table: 'jobs', id: j.id })
      return () => {
        undo()
        if (logId) store.remove('logs', logId)
      }
    },

    deleteJob(j: Job): Undo {
      const undo = snapshot(store, 'jobs', [j.id])
      store.remove('jobs', j.id)
      log(`Removed ${j.company} job`, 'job.delete', { table: 'jobs', id: j.id })
      return undo
    },

    // ── memory

    saveMemory(input: Partial<Memory> & Pick<Memory, 'content' | 'category'>): Memory {
      const existing = input.id ? store.get<Memory>('memories', input.id) : undefined
      const row: Memory = { source: 'user', pinned: false, ...existing, ...input, id: input.id ?? uuid() }
      store.upsert('memories', row as unknown as SyncRow)
      log(`${existing ? 'Edited' : 'Taught Autobot'}: ${clip(row.content)}`, existing ? 'memory.update' : 'memory.add', {
        table: 'memories',
        id: row.id,
      })
      return row
    },

    deleteMemory(m: Memory): Undo {
      const undo = snapshot(store, 'memories', [m.id])
      store.remove('memories', m.id)
      log(`Made Autobot forget: ${clip(m.content)}`, 'memory.forget', { table: 'memories', id: m.id })
      return undo
    },

    // ── weekly review

    saveReview(weekStartDate: string, fields: Partial<Pick<Review, 'win' | 'fix' | 'focus' | 'summary'>>): void {
      const id = stableId(`${store.userId}:review:${weekStartDate}`)
      const existing = store.get<Review>('reviews', id)
      store.upsert('reviews', {
        win: '',
        fix: '',
        focus: '',
        summary: '',
        ...existing,
        ...fields,
        id,
        week_start: weekStartDate,
      } as Review as SyncRow)
      if (!existing) log('Started this week’s review', 'review.save', { table: 'reviews', id })
    },
  }

  return actions
}

export type Actions = ReturnType<typeof createActions>
