import { useApp } from '../context/AppContext'
import { AutobotMascot } from './AutobotMascot'
import { buddyBrief } from '../lib/schedule'

type Variant = 'mobile' | 'sidebar' | 'rail'

/** Quiet status strip — Today auto-check-in handles the ceremony. */
export function CheckInCTA({ variant = 'mobile' }: { variant?: Variant }) {
  const { today, selectedDate, isCheckedIn } = useApp()
  if (selectedDate !== today) return null

  const done = isCheckedIn(today)
  const brief = done ? buddyBrief() : 'Opening Today syncs me in.'

  if (variant === 'rail') {
    return (
      <div
        className="flex flex-col items-center gap-1 rounded-xl border border-ink-border/50 bg-ink-card/80 p-1.5"
        title={brief}
      >
        <AutobotMascot mood={done ? 'happy' : 'idle'} size={22} />
        <span
          className={[
            'h-1.5 w-1.5 rounded-full',
            done ? 'bg-sage' : 'bg-cream/25',
          ].join(' ')}
          aria-hidden
        />
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-ink-border/50 bg-ink-card/70 px-2.5 py-2">
        <AutobotMascot mood={done ? 'happy' : 'idle'} size={22} />
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-cream/45">{brief}</p>
      </div>
    )
  }

  // mobile — compact bar above bottom tabs
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2">
      <div className="flex items-center gap-2.5 rounded-2xl border border-ink-border/60 bg-ink-card/95 px-3.5 py-2.5 shadow-soft backdrop-blur-md">
        <AutobotMascot mood={done ? 'happy' : 'idle'} size={26} />
        <p className="min-w-0 flex-1 truncate text-[12px] leading-snug text-cream/50">{brief}</p>
      </div>
    </div>
  )
}
