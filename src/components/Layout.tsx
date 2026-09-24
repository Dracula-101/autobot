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

function NavItems({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) =>
            [
              compact
                ? 'flex min-h-touch w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 text-[10px] font-semibold transition'
                : 'flex min-h-touch items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition',
              isActive
                ? 'bg-cream/[0.07] text-cream'
                : 'text-cream/40 hover:bg-cream/[0.04] hover:text-cream/70',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={compact ? 'h-5 w-5' : 'h-[18px] w-[18px]'}
                strokeWidth={isActive ? 2.25 : 1.9}
              />
              <span className={compact ? undefined : 'truncate'}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

export function Layout() {
  const { profile, isCheckedIn, today } = useApp()
  const name = (profile.display_name || 'friend').split(' ')[0]
  const mood = isCheckedIn(today) ? 'happy' : 'idle'

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar ≥1024 */}
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-ink-border/50 bg-ink-soft/40 lg:flex">
        <div className="flex items-center gap-3 px-4 pb-2 pt-6">
          <div className="rounded-xl border border-ink-border/60 bg-ink-card p-1.5 shadow-soft">
            <AutobotMascot mood={mood} size={36} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-cream/35">Autobot</p>
            <p className="truncate font-display text-[15px] font-semibold tracking-[-0.02em] text-cream">
              {name}
            </p>
          </div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-2.5">
          <NavItems />
        </nav>

        <div className="space-y-3 border-t border-ink-border/40 px-3 py-4">
          <CheckInCTA variant="sidebar" />
          <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
            Hunt · LC · Move
            <span className="mt-0.5 block text-cream/20">Denver time</span>
          </p>
        </div>
      </aside>

      {/* Tablet icon rail 768–1023 */}
      <aside className="sticky top-0 hidden h-dvh w-[64px] shrink-0 flex-col items-center border-r border-ink-border/50 bg-ink-soft/40 md:flex lg:hidden">
        <div className="pt-5">
          <div className="rounded-xl border border-ink-border/60 bg-ink-card p-1 shadow-soft">
            <AutobotMascot mood={mood} size={28} />
          </div>
        </div>
        <nav className="mt-5 flex flex-1 flex-col items-stretch gap-1 px-1.5">
          <NavItems compact />
        </nav>
        <div className="pb-4">
          <CheckInCTA variant="rail" />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 px-4 pb-1 pt-5 md:hidden">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-ink-border/60 bg-ink-card p-1.5 shadow-soft">
              <AutobotMascot mood={mood} size={36} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-cream/35">Autobot</p>
              <h1 className="font-display text-[1.2rem] font-semibold tracking-[-0.02em] text-cream">
                Hey, {name}
              </h1>
            </div>
          </div>
          <p className="text-right text-[11px] leading-relaxed text-ink-muted">
            Hunt · LC · Move
            <br />
            <span className="text-cream/25">Denver</span>
          </p>
        </header>

        {/* Desktop/tablet page greeting strip */}
        <header className="hidden items-end justify-between gap-4 px-6 pb-1 pt-6 md:flex lg:px-8">
          <div>
            <p className="text-[12px] font-medium text-cream/35">Autobot · Denver</p>
            <h1 className="mt-0.5 font-display text-[1.45rem] font-semibold tracking-[-0.025em] text-cream">
              Hey, {name}
            </h1>
          </div>
          <p className="pb-1 text-[12px] text-ink-muted">Hunt · LC · Move</p>
        </header>

        <div className="shell flex-1 pb-28 pt-3 md:pb-10 md:pt-4">
          <ConnectBanner />
          <main className="animate-fade-up">
            <Outlet />
          </main>
        </div>

        {/* Mobile check-in strip */}
        <div className="md:hidden">
          <CheckInCTA variant="mobile" />
        </div>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-border/50 bg-ink/90 backdrop-blur-xl md:hidden">
          <div className="flex justify-around px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex min-h-touch min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 text-[11px] font-semibold transition',
                    isActive ? 'bg-cream/[0.08] text-cream' : 'text-cream/35 hover:text-cream/65',
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
    </div>
  )
}
