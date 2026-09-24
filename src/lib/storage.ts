import type { LocalState, Profile, DayCheckin, TaskCompletion, WeeklyNotes } from '../types'

const KEY = 'lockin-checkin-v1'

function emptyState(): LocalState {
  return {
    profile: {
      display_name: '',
      reminder_email: '',
      sport_day: 'mon',
      timezone: 'America/Denver',
      onboarded: false,
    },
    checkins: {},
    completions: {},
    weeklyNotes: {},
    guestId: crypto.randomUUID(),
  }
}

export function loadLocal(): LocalState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as LocalState
    return { ...emptyState(), ...parsed }
  } catch {
    return emptyState()
  }
}

export function saveLocal(state: LocalState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function completionKey(date: string, taskId: string): string {
  return `${date}:${taskId}`
}

export type { LocalState, Profile, DayCheckin, TaskCompletion, WeeklyNotes }
