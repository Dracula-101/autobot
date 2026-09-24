import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import {
  loadLocal,
  saveLocal,
  completionKey,
  type LocalState,
} from '../lib/storage'
import type {
  DayCheckin,
  Profile,
  SportDay,
  TaskCompletion,
  WeeklyNotes,
} from '../types'
import { todayKey, weekStartKey, weekDays } from '../lib/dates'
import { TASKS } from '../data/tasks'
import { WEEKLY_QUOTAS } from '../data/quotas'

interface AppContextValue {
  supabaseConfigured: boolean
  user: User | null
  session: Session | null
  authLoading: boolean
  profile: Partial<Profile> & { onboarded?: boolean }
  sportDay: SportDay
  selectedDate: string
  setSelectedDate: (d: string) => void
  weekStart: string
  weekDates: string[]
  today: string
  checkins: Record<string, DayCheckin>
  completions: Record<string, TaskCompletion>
  weeklyNotes: WeeklyNotes | null
  isCheckedIn: (date: string) => boolean
  isTaskDone: (date: string, taskId: string) => boolean
  toggleTask: (date: string, taskId: string) => Promise<void>
  checkInToday: (note?: string) => Promise<void>
  updateProfile: (patch: Partial<Profile> & { onboarded?: boolean }) => Promise<void>
  saveWeeklyNotes: (notes: Partial<WeeklyNotes>) => Promise<void>
  quotaProgress: Record<string, number>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  userId: string
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<LocalState>(() => loadLocal())
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [selectedDate, setSelectedDate] = useState(() => todayKey())
  const today = todayKey()
  const weekStart = weekStartKey(selectedDate)
  const weekDates = useMemo(() => weekDays(weekStart), [weekStart])

  const userId = user?.id ?? local.guestId

  // Persist local
  useEffect(() => {
    saveLocal(local)
  }, [local])

  // Auth listener
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load remote profile + week data when user signs in
  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false
    ;(async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (profile) {
        setLocal((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            ...profile,
            onboarded: Boolean(profile.display_name),
          },
        }))
      }

      const ws = weekStartKey()
      const days = weekDays(ws)
      const { data: checkins } = await supabase
        .from('day_checkins')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', days[0])
        .lte('date', days[6])

      const { data: completions } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', days[0])
        .lte('date', days[6])

      const { data: notes } = await supabase
        .from('weekly_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', ws)
        .maybeSingle()

      if (cancelled) return
      setLocal((prev) => {
        const next = { ...prev }
        const checkinMap = { ...prev.checkins }
        for (const c of checkins ?? []) {
          checkinMap[c.date] = c as DayCheckin
        }
        const completionMap = { ...prev.completions }
        for (const t of completions ?? []) {
          completionMap[completionKey(t.date, t.task_id)] = t as TaskCompletion
        }
        const weeklyNotes = { ...prev.weeklyNotes }
        if (notes) weeklyNotes[ws] = notes as WeeklyNotes
        return { ...next, checkins: checkinMap, completions: completionMap, weeklyNotes }
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const sportDay: SportDay = (local.profile.sport_day as SportDay) || 'mon'

  const isCheckedIn = useCallback(
    (date: string) => Boolean(local.checkins[date]),
    [local.checkins],
  )

  const isTaskDone = useCallback(
    (date: string, taskId: string) =>
      Boolean(local.completions[completionKey(date, taskId)]?.completed),
    [local.completions],
  )

  const toggleTask = useCallback(
    async (date: string, taskId: string) => {
      const key = completionKey(date, taskId)
      const currently = Boolean(local.completions[key]?.completed)
      const nextCompleted = !currently
      const row: TaskCompletion = {
        user_id: userId,
        date,
        task_id: taskId,
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
      }

      setLocal((prev) => ({
        ...prev,
        completions: { ...prev.completions, [key]: row },
      }))

      if (supabase && user) {
        if (nextCompleted) {
          await supabase.from('task_completions').upsert(
            {
              user_id: user.id,
              date,
              task_id: taskId,
              completed: true,
              completed_at: row.completed_at,
            },
            { onConflict: 'user_id,date,task_id' },
          )
        } else {
          await supabase
            .from('task_completions')
            .delete()
            .eq('user_id', user.id)
            .eq('date', date)
            .eq('task_id', taskId)
        }
      }
    },
    [local.completions, user, userId],
  )

  const checkInToday = useCallback(
    async (note?: string) => {
      const date = todayKey()
      const row: DayCheckin = {
        user_id: userId,
        date,
        checked_in_at: new Date().toISOString(),
        note: note ?? null,
      }
      setLocal((prev) => ({
        ...prev,
        checkins: { ...prev.checkins, [date]: row },
      }))
      if (supabase && user) {
        await supabase.from('day_checkins').upsert(
          {
            user_id: user.id,
            date,
            checked_in_at: row.checked_in_at,
            note: note ?? null,
          },
          { onConflict: 'user_id,date' },
        )
      }
    },
    [user, userId],
  )

  const updateProfile = useCallback(
    async (patch: Partial<Profile> & { onboarded?: boolean }) => {
      setLocal((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...patch },
      }))
      if (supabase && user) {
        const { onboarded: _o, ...db } = patch
        await supabase.from('profiles').upsert({ id: user.id, ...db })
      }
    },
    [user],
  )

  const saveWeeklyNotes = useCallback(
    async (notes: Partial<WeeklyNotes>) => {
      const ws = weekStart
      const row: WeeklyNotes = {
        user_id: userId,
        week_start: ws,
        win: notes.win ?? local.weeklyNotes[ws]?.win ?? '',
        fix: notes.fix ?? local.weeklyNotes[ws]?.fix ?? '',
        focus: notes.focus ?? local.weeklyNotes[ws]?.focus ?? '',
      }
      setLocal((prev) => ({
        ...prev,
        weeklyNotes: { ...prev.weeklyNotes, [ws]: row },
      }))
      if (supabase && user) {
        await supabase.from('weekly_notes').upsert(row)
      }
    },
    [user, userId, weekStart, local.weeklyNotes],
  )

  const quotaProgress = useMemo(() => {
    const progress: Record<string, number> = {}
    for (const q of WEEKLY_QUOTAS) progress[q.key] = 0

    for (const date of weekDates) {
      for (const task of TASKS) {
        if (!task.quotaKey || !task.quotaDelta) continue
        // Only count if this task is relevant for the day's sport variant
        const dayKey = task.day
        const dateDay = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][
          (new Date(date + 'T12:00:00').getDay() + 6) % 7
        ]
        if (dayKey !== dateDay) continue
        if (task.variant === 'partner' && dateDay !== sportDay) continue
        if (task.variant === 'solo' && dateDay === sportDay) continue
        if (isTaskDone(date, task.id)) {
          progress[task.quotaKey] =
            (progress[task.quotaKey] ?? 0) + task.quotaDelta
        }
      }
    }
    return progress
  }, [weekDates, sportDay, isTaskDone])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase not configured' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!supabase) return { error: 'Supabase not configured' }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) return { error: error.message }
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName,
          reminder_email: email,
          sport_day: 'mon',
          timezone: 'America/Denver',
        })
        setLocal((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            display_name: displayName,
            reminder_email: email,
            onboarded: true,
          },
        }))
      }
      return {}
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  const value: AppContextValue = {
    supabaseConfigured,
    user,
    session,
    authLoading,
    profile: local.profile,
    sportDay,
    selectedDate,
    setSelectedDate,
    weekStart,
    weekDates,
    today,
    checkins: local.checkins,
    completions: local.completions,
    weeklyNotes: local.weeklyNotes[weekStart] ?? null,
    isCheckedIn,
    isTaskDone,
    toggleTask,
    checkInToday,
    updateProfile,
    saveWeeklyNotes,
    quotaProgress,
    signIn,
    signUp,
    signOut,
    userId,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
