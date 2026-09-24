import { useApp } from '../context/AppContext'
import { AutobotMascot } from './AutobotMascot'
import { buddyBrief } from '../lib/schedule'

/** Quiet status strip — Today auto-check-in handles the ceremony. */
export function CheckInCTA() {
  const { today, selectedDate, isCheckedIn } = useApp()
  if (selectedDate !== today) return null

  const done = isCheckedIn(today)

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2.5 rounded-2xl border border-ink-border/60 bg-ink-card/95 px-3.5 py-2.5 shadow-soft backdrop-blur-md">
          <AutobotMascot mood={done ? 'happy' : 'idle'} size={26} />
          <p className="min-w-0 flex-1 truncate text-[12px] leading-snug text-cream/50">
            {done ? buddyBrief() : 'Opening Today syncs me in — no tap needed.'}
          </p>
        </div>
      </div>
    </div>
  )
}
