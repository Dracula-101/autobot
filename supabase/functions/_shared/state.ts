// Everything Autobot needs to know about one person, loaded in parallel.

import type { Db } from './db.ts'
import {
  addDays,
  logicalDay,
  weekStart,
  withDefaults,
  type ChatMessage,
  type Checkin,
  type Contact,
  type Job,
  type LogEntry,
  type Memory,
  type Mission,
  type Problem,
  type Routine,
  type RoutineLog,
  type Settings,
} from './core/index.ts'

export interface UserState {
  userId: string
  name: string
  settings: Settings
  now: Date
  today: string
  memories: Memory[]
  /** Today and tomorrow */
  missions: Mission[]
  routines: Routine[]
  routineLogs: RoutineLog[]
  logs: LogEntry[]
  contacts: Contact[]
  jobs: Job[]
  problems: Problem[]
  checkin: Checkin | null
  /** Oldest first */
  history: ChatMessage[]
}

function rows<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return (res.data ?? []) as T[]
}

export async function loadState(
  db: Db,
  userId: string,
  opts: { now?: Date; history?: number } = {},
): Promise<UserState> {
  const now = opts.now ?? new Date()
  const profile = await db.from('profiles').select('display_name, settings').eq('id', userId).maybeSingle()
  if (profile.error) throw new Error(`profile: ${profile.error.message}`)
  const settings = withDefaults(profile.data?.settings as Partial<Settings> | null)
  const today = logicalDay(now, settings.rolloverHour)
  const since = addDays(weekStart(today), -1)
  // Power cells drain over days, so charge needs a few weeks of logs.
  const logsSince = addDays(today, -28)
  const mine = (table: string) => db.from(table).select('*').eq('user_id', userId).is('deleted_at', null)

  const [memories, missions, routines, routineLogs, logs, contacts, jobs, problems, checkin, history] =
    await Promise.all([
      mine('memories').order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(200),
      mine('missions').gte('day', today).lte('day', addDays(today, 1)),
      mine('routines'),
      mine('routine_logs').gte('day', since),
      mine('logs').gte('day', logsSince),
      mine('contacts').order('updated_at', { ascending: false }).limit(200),
      mine('jobs').order('updated_at', { ascending: false }).limit(200),
      mine('problems').order('updated_at', { ascending: false }).limit(400),
      mine('day_checkins').eq('date', today).limit(1),
      opts.history
        ? mine('chat_messages').order('created_at', { ascending: false }).limit(opts.history)
        : Promise.resolve({ data: [], error: null }),
    ])

  return {
    userId,
    name: ((profile.data?.display_name as string) || 'friend').split(' ')[0],
    settings,
    now,
    today,
    memories: rows<Memory>(memories, 'memories'),
    missions: rows<Mission>(missions, 'missions'),
    routines: rows<Routine>(routines, 'routines'),
    routineLogs: rows<RoutineLog>(routineLogs, 'routine_logs'),
    logs: rows<LogEntry>(logs, 'logs'),
    contacts: rows<Contact>(contacts, 'contacts'),
    jobs: rows<Job>(jobs, 'jobs'),
    problems: rows<Problem>(problems, 'problems'),
    checkin: rows<Checkin>(checkin, 'day_checkins')[0] ?? null,
    history: rows<ChatMessage>(history, 'chat_messages').reverse(),
  }
}
