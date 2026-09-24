import { useEffect, useRef } from 'react'
import { WeekStrip } from '../components/WeekStrip'
import { TaskList } from '../components/TaskList'
import { QuotaPanel } from '../components/QuotaPanel'
import { AutobotMascot } from '../components/AutobotMascot'
import { ClassAttendance } from '../components/ClassAttendance'
import { BuddyChat } from '../components/BuddyChat'
import { useApp } from '../context/AppContext'
import { buddyBrief } from '../lib/schedule'

export function TodayPage() {
  const { isCheckedIn, today, profile, checkInToday } = useApp()
  const name = (profile.display_name || 'friend').split(' ')[0]
  const checked = isCheckedIn(today)
  const brief = buddyBrief()
  const auto = useRef(false)

  // Opening Today is the check-in — no ceremony.
  useEffect(() => {
    if (auto.current) return
    if (checked) return
    auto.current = true
    void checkInToday('auto')
  }, [checked, checkInToday])

  return (
    <div className="space-y-5 pb-16 lg:space-y-6">
      {/* Buddy brief — spans full main width */}
      <section className="panel relative overflow-hidden px-4 py-4 sm:px-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-sage/8 blur-3xl"
        />
        <div className="relative flex items-start gap-3.5">
          <div className="rounded-2xl border border-ink-border/50 bg-ink-soft p-1.5">
            <AutobotMascot mood="happy" size={48} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="font-display text-[1.15rem] font-semibold tracking-[-0.015em] text-cream sm:text-[1.25rem]">
              Hey {name} — I’m on it.
            </p>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-cream/45 sm:text-[14px]">
              {brief}
            </p>
          </div>
        </div>
      </section>

      {/* Desktop: primary + side columns; tablet: 2-col where possible; mobile: stack */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(280px,32%,360px)] lg:gap-6 xl:gap-8">
        <div className="min-w-0 space-y-5">
          <WeekStrip />
          <TaskList />
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start">
          <ClassAttendance />
          <QuotaPanel />
        </aside>
      </div>

      <BuddyChat />
    </div>
  )
}
