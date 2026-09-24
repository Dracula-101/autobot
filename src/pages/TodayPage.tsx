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
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-ink-border/70 bg-ink-card/90 px-4 py-4 shadow-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-sage/8 blur-3xl"
        />
        <div className="relative flex items-start gap-3.5">
          <div className="rounded-2xl border border-ink-border/50 bg-ink-soft p-1.5">
            <AutobotMascot mood="happy" size={48} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="font-display text-[1.15rem] font-semibold tracking-[-0.015em] text-cream">
              Hey {name} — I’m on it.
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-cream/45">{brief}</p>
          </div>
        </div>
      </section>

      <WeekStrip />
      <ClassAttendance />
      <QuotaPanel />
      <TaskList />
      <BuddyChat />
    </div>
  )
}
