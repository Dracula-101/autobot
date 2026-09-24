import { NavLink, Outlet } from 'react-router-dom'
import { CalendarCheck, Settings, Trophy } from 'lucide-react'
import { ConnectBanner } from './ConnectBanner'
import { CheckInCTA } from './CheckInCTA'
import { useApp } from '../context/AppContext'

const nav = [
  { to: '/', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/week', label: 'Week', icon: Trophy },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  const { profile } = useApp()
  const name = profile.display_name || 'Pratik'

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-36 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage/80">
            Lock-in
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Hey, {name.split(' ')[0]}
          </h1>
        </div>
        <p className="text-right text-[10px] leading-relaxed text-ink-muted">
          Job hunt → LC → Fitness
          <br />
          <span className="text-white/30">America/Denver</span>
        </p>
      </header>

      <ConnectBanner />

      <main className="flex-1">
        <Outlet />
      </main>

      <CheckInCTA />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-border/60 bg-ink/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex min-h-touch min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-medium transition',
                  isActive ? 'text-sage' : 'text-white/40 hover:text-white/70',
                ].join(' ')
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
