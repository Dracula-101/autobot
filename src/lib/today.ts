import { useMemo } from 'react'
import {
  addDays,
  classesOn,
  currentMoment,
  dayMinutes,
  dayType,
  hhmmToDayMinutes,
  live,
  logicalDay,
  minutesOnDay,
  missionProgress,
  pickNextUp,
  racketDates,
  reviewsDue,
  routineDone,
  routinesFor,
  routineWeekCount,
  sortMissions,
  speak,
  stackItems,
  weekTotals,
  type ChatMessage,
  type Checkin,
  type ClassBlock,
  type DayType,
  type LogEntry,
  type LogKind,
  type Mission,
  type Moment,
  type Problem,
  type Routine,
  type RoutineLog,
  type Speech,
  type StackItem,
} from '@core/index.ts'
import { useApp, useRows } from './app'
import { useNow } from './clock'
import { useWeather, type Weather } from './weather'

export interface PerWeekRoutine {
  routine: Routine
  count: number
  doneToday: boolean
}

export interface TodayState {
  now: Date
  date: string
  nowMins: number
  type: DayType
  lectures: ClassBlock[]
  tomorrowLectures: ClassBlock[]
  wakeMins: number | null
  moment: Moment
  missions: Mission[]
  progress: Map<string, number>
  done: number
  total: number
  nextUp: Mission | null
  morning: StackItem[]
  night: StackItem[]
  perWeek: PerWeekRoutine[]
  totals: Record<LogKind, number>
  speech: Speech
  brief: ChatMessage | null
  reviews: Problem[]
  weather: Weather | null
}

export function useToday(skip: string[] = []): TodayState {
  const { settings, name } = useApp()
  const now = useNow(30_000)
  const weather = useWeather()
  const missionsAll = useRows<Mission>('missions')
  const logs = useRows<LogEntry>('logs')
  const routines = useRows<Routine>('routines')
  const routineLogs = useRows<RoutineLog>('routine_logs')
  const checkins = useRows<Checkin>('day_checkins')
  const problems = useRows<Problem>('problems')
  const chat = useRows<ChatMessage>('chat_messages')

  const date = logicalDay(now, settings.rolloverHour)
  const nowMins = dayMinutes(now, settings.rolloverHour)
  const skipKey = skip.join(',')

  return useMemo(() => {
    const racket = racketDates(logs)
    const type = dayType(date, settings, racket)
    const lectures = classesOn(date, settings)
    const tomorrowLectures = classesOn(addDays(date, 1), settings)
    const checkin = checkins.find((c) => c.date === date)
    const wakeMins = checkin ? minutesOnDay(new Date(checkin.checked_in_at), date) : null
    const moment = currentMoment({
      nowMins,
      settings,
      type,
      wakeMins,
      lastClassEnd: lectures.length ? hhmmToDayMinutes(lectures[lectures.length - 1].end) : null,
    })
    const todays = live(missionsAll).filter((m) => m.day === date)
    const missions = sortMissions(todays, 'wake')
    const progress = missionProgress(todays, logs, date)
    const counted = todays.filter((m) => m.status !== 'skipped')
    const done = counted.filter((m) => m.status === 'done').length
    const nextUp = pickNextUp(todays, moment, skipKey ? skipKey.split(',') : [])
    const morning = stackItems('morning', date, routines, routineLogs)
    const night = stackItems('night', date, routines, routineLogs)
    const perWeek = routinesFor(date, routines)
      .filter((r) => r.per_week)
      .map((routine) => ({
        routine,
        count: routineWeekCount(routine.id, date, routineLogs),
        doneToday: routineDone(routine.id, date, routineLogs),
      }))
    const pending = (items: StackItem[]) => items.filter((i) => !i.done).map((i) => i.routine.name.toLowerCase())
    const speech = speak({
      name,
      settings,
      date,
      nowMins,
      type,
      moment,
      wakeMins,
      done,
      total: counted.length,
      nextUp,
      morningPending: pending(morning),
      nightPending: pending(night),
      classes: lectures,
      tomorrowClasses: tomorrowLectures,
      weather,
    })
    const brief =
      live(chat).find((m) => (m.meta as { kind?: string; day?: string })?.kind === 'brief' && (m.meta as { day?: string }).day === date) ??
      null
    return {
      now,
      date,
      nowMins,
      type,
      lectures,
      tomorrowLectures,
      wakeMins,
      moment,
      missions,
      progress,
      done,
      total: counted.length,
      nextUp,
      morning,
      night,
      perWeek,
      totals: weekTotals(logs, date),
      speech,
      brief,
      reviews: reviewsDue(problems, date),
      weather,
    }
  }, [now, date, nowMins, settings, name, missionsAll, logs, routines, routineLogs, checkins, problems, chat, weather, skipKey])
}
