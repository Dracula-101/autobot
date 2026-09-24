import { WeekStrip } from '../components/WeekStrip'
import { TaskList } from '../components/TaskList'
import { QuotaPanel } from '../components/QuotaPanel'
import { AutobotMascot } from '../components/AutobotMascot'
import { useApp } from '../context/AppContext'

export function TodayPage() {
  const { isCheckedIn, today, profile } = useApp()
  const name = (profile.display_name || 'friend').split(' ')[0]
  const checked = isCheckedIn(today)

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-ink-border/70 bg-ink-card/90 px-4 py-4 shadow-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-sage/8 blur-3xl"
        />
        <div className="relative flex items-start gap-3.5">
          <div className="rounded-2xl border border-ink-border/50 bg-ink-soft p-1.5">
            <AutobotMascot mood={checked ? 'happy' : 'nudge'} size={40} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="font-display text-[1.1rem] font-semibold tracking-[-0.015em] text-cream">
              {checked ? `Logged. Nice work, ${name}.` : `I’m with you today, ${name}.`}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-cream/40">
              {checked
                ? 'Knock out what you can — I’ll keep the lights on.'
                : 'One check-in starts the day. Then we stack hunt, LeetCode, and move.'}
            </p>
          </div>
        </div>
      </section>

      <WeekStrip />
      <QuotaPanel />
      <TaskList />
    </div>
  )
}
