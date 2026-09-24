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
      <section className="card relative overflow-hidden px-4 py-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-sage/10 blur-2xl"
        />
        <div className="relative flex items-center gap-3.5">
          <AutobotMascot mood={checked ? 'happy' : 'nudge'} size={42} />
          <div className="min-w-0">
            <p className="font-display text-[1.05rem] font-semibold tracking-[-0.01em] text-cream">
              {checked ? `Logged. Nice work, ${name}.` : `I’m with you today, ${name}.`}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-cream/40">
              {checked
                ? 'Knock out what you can — I’ll keep the lights on.'
                : 'Check in when you’re ready. One tap, then we stack the day.'}
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
