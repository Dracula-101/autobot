import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Settings2, Sparkles } from 'lucide-react'
import { ConnectBanner } from './ConnectBanner'
import { CheckInCTA } from './CheckInCTA'
import { AutobotMascot } from './AutobotMascot'
import { useApp } from '../context/AppContext'

const nav = [
  { to: '/', label: 'Today', icon: CalendarDays, end: true },
  { to: '/week', label: 'Week', icon: Sparkles },
  { to: '/settings', label: 'You', icon: Settings2 },
]

export function Layout() {
  const { profile, isCheckedIn, today } = useApp()
  const name = (profile.display_name || 'friend').split(' ')[0]
  const mood = isCheckedIn(today) ? 'happy' : 'idle'

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-40 pt-5">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-ink-border/60 bg-ink-card p-1.5 shadow-soft">
            <AutobotMascot mood={mood} size={40} />
          </div>
          <div>
            <p className="eyebrow">Autobot</p>
            <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-cream">
              Hey, {name}
            </h1>
          </div>
        </div>
        <p className="pt-1 text-right text-[11px] leading-relaxed text-ink-muted">
          Hunt · LC · Move
          <br />
          <span className="text-cream/25">Denver time</span>
        </p>
      </header>

      <ConnectBanner />

      <main className="flex-1 animate-fade-up">
        <Outlet />
      </main>

      <CheckInCTA />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-border/50 bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl justify-around px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex min-h-touch min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 text-[11px] font-semibold transition',
                  isActive ? 'bg-sage/10 text-sage' : 'text-cream/35 hover:text-cream/65',
                ].join(' ')
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2.1} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
