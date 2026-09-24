import type { ClassBlock, Routine, Settings } from './types.ts'
import { DAY_KEYS } from './time.ts'
import { stableId } from './ids.ts'

export const FALL_2026_CLASSES: ClassBlock[] = [
  {
    id: 'csci-5113',
    name: 'Linux System Administration',
    short: 'Linux',
    room: 'ECCR 1B55',
    days: ['tue', 'thu'],
    start: '12:30',
    end: '13:45',
    from: '2026-08-20',
    until: '2026-12-04',
  },
  {
    id: 'csci-5229',
    name: 'Computer Graphics',
    short: 'Graphics',
    room: 'ECCR 200',
    days: ['tue', 'thu'],
    start: '15:30',
    end: '16:45',
    from: '2026-08-20',
    until: '2026-12-04',
  },
  {
    id: 'csci-5040',
    name: 'Professional Masters Project',
    short: 'Masters Project',
    room: 'ECCS 1B12',
    days: ['tue', 'thu'],
    start: '17:00',
    end: '18:15',
    from: '2026-08-20',
    until: '2026-12-04',
  },
]

export const DEFAULT_SETTINGS: Settings = {
  voice: 'firm',
  theme: 'auto',
  rolloverHour: 5,
  sleep: { bed: '02:30', wake: '10:30' },
  sportDays: ['sun', 'mon'],
  classes: FALL_2026_CLASSES,
  notify: {
    routines: true,
    classes: true,
    bedtime: true,
    followups: true,
    deadlines: true,
    nudges: true,
    weekly: true,
    classLead: 75,
  },
  targetCompanies: [],
  onboarded: false,
  graduation: '2027-05',
}

/** Deep-ish merge so new default keys appear for existing users. */
export function withDefaults(raw: Partial<Settings> | null | undefined): Settings {
  const s = (raw ?? {}) as Partial<Settings>
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    sleep: { ...DEFAULT_SETTINGS.sleep, ...(s.sleep ?? {}) },
    notify: { ...DEFAULT_SETTINGS.notify, ...(s.notify ?? {}) },
    classes: s.classes ?? DEFAULT_SETTINGS.classes,
    sportDays: s.sportDays ?? DEFAULT_SETTINGS.sportDays,
    targetCompanies: s.targetCompanies ?? [],
  }
}

type RoutineSeed = Omit<Routine, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & {
  key: string
}

export const ROUTINE_SEEDS: RoutineSeed[] = [
  {
    key: 'morning-pill',
    name: 'Morning pill',
    emoji: '💊',
    stack: 'morning',
    anchor: 'wake',
    offset_min: 15,
    at_time: '11:30',
    days: DAY_KEYS,
    per_week: null,
    remind: true,
    active: true,
    sort: 0,
  },
  {
    key: 'morning-serum',
    name: 'Hair serum',
    emoji: '💧',
    stack: 'morning',
    anchor: 'wake',
    offset_min: 15,
    at_time: '11:30',
    days: DAY_KEYS,
    per_week: null,
    remind: true,
    active: true,
    sort: 1,
  },
  {
    key: 'night-pill',
    name: 'Night pill',
    emoji: '💊',
    stack: 'night',
    anchor: 'bed',
    offset_min: 45,
    at_time: null,
    days: DAY_KEYS,
    per_week: null,
    remind: true,
    active: true,
    sort: 2,
  },
  {
    key: 'night-serum',
    name: 'Hair serum',
    emoji: '💧',
    stack: 'night',
    anchor: 'bed',
    offset_min: 45,
    at_time: null,
    days: DAY_KEYS,
    per_week: null,
    remind: true,
    active: true,
    sort: 3,
  },
  {
    key: 'scalp-wash',
    name: 'Anti-dandruff wash',
    emoji: '🧴',
    stack: null,
    anchor: 'time',
    offset_min: 0,
    at_time: '20:00',
    days: DAY_KEYS,
    per_week: 3,
    remind: true,
    active: true,
    sort: 4,
  },
]

export function seedRoutines(userId: string): Routine[] {
  return ROUTINE_SEEDS.map(({ key, ...r }) => ({
    ...r,
    id: stableId(`${userId}:routine:${key}`),
    user_id: userId,
  }))
}

export const STACK_LABEL = { morning: 'Morning stack', night: 'Night stack' } as const
