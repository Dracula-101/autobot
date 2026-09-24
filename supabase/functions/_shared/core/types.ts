import type { DayKey } from './time.ts'

export type Area = 'hunt' | 'prep' | 'body' | 'class' | 'life'
export type Size = 'S' | 'M' | 'L'
/** Clock-free parts of a day. Only classes carry real times. */
export type Moment = 'wake' | 'out' | 'evening' | 'night' | 'bed' | 'anytime'
export type MissionStatus = 'todo' | 'doing' | 'done' | 'skipped'
/** What a mission's progress is measured in (the specific kind of activity) */
export type TargetKey = 'referral' | 'application' | 'followup' | 'leetcode' | 'workout'
export type LogKind = TargetKey | 'scalp' | 'other'
/** Autobot's power cells — every logged action charges one. No quotas. */
export type Cell = 'hunt' | 'prep' | 'body'
/** The daily battery check-in that sizes the plan */
export type Energy = 'low' | 'normal' | 'high'
export type DayType = 'class' | 'free' | 'sport'
export type Voice = 'firm' | 'gentle' | 'strict'
export type ThemePref = 'auto' | 'day' | 'night'
export type MemoryCategory =
  | 'about'
  | 'goal'
  | 'job'
  | 'prep'
  | 'health'
  | 'schedule'
  | 'habit'
  | 'preference'

export interface ClassBlock {
  id: string
  name: string
  short: string
  room: string
  days: DayKey[]
  /** 'HH:MM' wall clock */
  start: string
  end: string
  /** Semester bounds, YYYY-MM-DD */
  from: string
  until: string
}

export interface NotifyPrefs {
  routines: boolean
  classes: boolean
  bedtime: boolean
  followups: boolean
  deadlines: boolean
  nudges: boolean
  weekly: boolean
  /** Minutes before the first class of the day */
  classLead: number
}

export interface Settings {
  voice: Voice
  theme: ThemePref
  rolloverHour: number
  sleep: { bed: string; wake: string }
  /** Racket happens on one of these (partner's choice) */
  sportDays: DayKey[]
  classes: ClassBlock[]
  notify: NotifyPrefs
  /** Companies he's actively going after (starred on the Hunt page) */
  targetCompanies: string[]
  onboarded: boolean
  graduation?: string
}

export interface Row {
  id: string
  user_id?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Mission extends Row {
  day: string
  key?: string | null
  title: string
  area: Area
  size: Size
  moment: Moment
  status: MissionStatus
  target_key?: TargetKey | null
  amount: number
  note?: string | null
  sort: number
  source: 'plan' | 'user' | 'autobot'
  started_at?: string | null
  done_at?: string | null
}

export interface Routine extends Row {
  name: string
  emoji: string
  /** Routines in the same stack share one reminder */
  stack?: 'morning' | 'night' | null
  anchor: 'wake' | 'bed' | 'time'
  /** wake: minutes after waking · bed: minutes before bed */
  offset_min: number
  /** 'HH:MM' — anchor 'time', or the fallback when waking isn't observed */
  at_time?: string | null
  days: DayKey[]
  /** For x-per-week routines (scalp wash); `days` is then ignored */
  per_week?: number | null
  remind: boolean
  active: boolean
  sort: number
}

export interface RoutineLog extends Row {
  routine_id: string
  day: string
  done_at: string
}

export interface LogEntry extends Row {
  day: string
  kind: LogKind
  amount: number
  ref_id?: string | null
  note?: string | null
}

export interface Checkin extends Row {
  date: string
  checked_in_at: string
  note?: string | null
  energy?: Energy | null
}

export interface Memory extends Row {
  category: MemoryCategory
  content: string
  source: 'user' | 'autobot' | 'seed' | 'interview'
  pinned: boolean
}

export type ContactStatus = 'to_contact' | 'messaged' | 'replied' | 'referred' | 'closed'

export interface Contact extends Row {
  name: string
  company: string
  role: string
  channel: 'email' | 'linkedin' | 'other'
  handle: string
  status: ContactStatus
  job_id?: string | null
  last_contact_at?: string | null
  follow_up_on?: string | null
  notes: string
}

export type JobStatus = 'saved' | 'applied' | 'oa' | 'interview' | 'offer' | 'rejected' | 'closed'

export interface Job extends Row {
  company: string
  title: string
  url: string
  location: string
  status: JobStatus
  sponsors: 'yes' | 'no' | 'unknown'
  applied_on?: string | null
  notes: string
}

export type ProblemResult = 'solved' | 'hints' | 'stuck'

export interface Problem extends Row {
  slug: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  pattern: string
  result: ProblemResult
  attempts: number
  interval_days: number
  next_review?: string | null
  last_solved_on?: string | null
  notes: string
}

export interface Review extends Row {
  week_start: string
  win: string
  fix: string
  focus: string
  summary: string
}

export interface ChatAction {
  type: string
  label: string
  table?: string
  id?: string
  undo?: Record<string, unknown>
}

export interface ChatMessage extends Row {
  role: 'user' | 'assistant' | 'system'
  content: string
  actions: ChatAction[]
  meta: Record<string, unknown>
}

export interface Activity extends Row {
  actor: 'you' | 'autobot' | 'system'
  kind: string
  summary: string
  ref_table?: string | null
  ref_id?: string | null
  data: Record<string, unknown>
}

export interface NotificationRow {
  id: string
  user_id: string
  dedupe_key: string
  title: string
  body: string
  url?: string | null
  sent_at: string
  delivered: number
}

export type RoleKind = 'university' | 'recruiter' | 'manager' | 'engineer' | 'other'

/** A LinkedIn profile he clipped — imported, never edited except pipeline link / hidden. */
export interface Lead extends Row {
  source: string
  source_id: string
  name: string
  url: string
  headline: string
  company: string
  company_raw: string
  role_kind: RoleKind
  location: string
  us: boolean
  mutuals: number
  mutual_names: string
  clipped_at?: string | null
  contact_id?: string | null
  hidden: boolean
}

/** A course assignment from his checker. done_at is Autobot's own. */
export interface Assignment extends Row {
  source: string
  source_id: string
  title: string
  course: string
  due_at?: string | null
  url: string
  source_status: string
  checked_at?: string | null
  done_at?: string | null
}
