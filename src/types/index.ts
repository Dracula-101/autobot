export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type SportDay = 'mon' | 'sun'
export type TaskVariant = 'partner' | 'solo' | 'default'

export interface TaskDef {
  id: string
  label: string
  day: DayKey
  section?: string
  /** If set, only show when sport_day matches this variant */
  variant?: TaskVariant
  category?: 'hunt' | 'leetcode' | 'fitness' | 'class' | 'health' | 'admin' | 'reset'
  /** Counts toward weekly quota key */
  quotaKey?: string
  quotaDelta?: number
  parentId?: string
}

export interface Profile {
  id: string
  display_name: string
  reminder_email: string
  sport_day: SportDay
  timezone: string
  created_at?: string
  onboarded?: boolean
}

export interface DayCheckin {
  id?: string
  user_id: string
  date: string
  checked_in_at: string
  note?: string | null
}

export interface TaskCompletion {
  id?: string
  user_id: string
  date: string
  task_id: string
  completed: boolean
  completed_at?: string | null
  meta?: Record<string, unknown> | null
}

export interface WeeklyNotes {
  user_id: string
  week_start: string
  win: string
  fix: string
  focus: string
}

export interface QuotaDef {
  key: string
  label: string
  target: number
  targetMax?: number
  category: 'hunt' | 'leetcode' | 'fitness' | 'class' | 'health'
}

export type LocalState = {
  profile: Partial<Profile> & { onboarded?: boolean }
  checkins: Record<string, DayCheckin>
  completions: Record<string, TaskCompletion> // key: `${date}:${taskId}`
  weeklyNotes: Record<string, WeeklyNotes> // key: week_start
  guestId: string
}
