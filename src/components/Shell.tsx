import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Briefcase, Code2, GraduationCap, HeartPulse, MessageCircle, Moon, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react'
import type { Phase } from '@core/index.ts'
import { useApp, useRows, useSyncStatus } from '../lib/app'
import { usePhaseSync } from '../lib/phase'
import { useMediaQuery } from '../lib/media'
import { initials } from '../lib/companies'
import type { SyncRow } from '../lib/sync'
import { Autobot } from './Autobot'
import { Brain } from './Brain'
import { ChatPanel } from './ChatPanel'

const PHASE_ICON: Record<Phase, LucideIcon> = { dawn: Sunrise, day: Sun, dusk: Sunset, night: Moon }

function navItems(phase: Phase) {
  return [
    { to: '/', label: 'Today', icon: PHASE_ICON[phase], end: true },
    { to: '/hunt', label: 'Hunt', icon: Briefcase },
    { to: '/chat', label: 'Chat', icon: MessageCircle },
    { to: '/prep', label: 'Prep', icon: Code2 },
    { to: '/body', label: 'Body', icon: HeartPulse },
    // Sidebar only; on phones School lives in Today's "Due soon" card and You → Sources.
    { to: '/school', label: 'School', icon: GraduationCap, desktop: true },
  ]
}

export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const { cloud } = useApp()
  const { status, pending } = useSyncStatus()
  const view = !cloud
    ? { dot: 'bg-ink-3', label: 'This device only' }
    : status === 'synced'
      ? { dot: 'bg-mint', label: 'Synced' }
      : status === 'offline'
        ? { dot: 'bg-amber', label: pending ? `Offline · ${pending} saved here` : 'Offline' }
        : status === 'error'
          ? { dot: 'bg-rose', label: 'Sync hiccup' }
          : { dot: 'bg-sky animate-pulse', label: 'Syncing' }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-3" title={view.label}>
      <span className={`h-2 w-2 rounded-full ${view.dot}`} aria-hidden />
      {!compact && view.label}
      {compact && <span className="sr-only">{view.label}</span>}
    </span>
  )
}

export function MeButton({ className = '' }: { className?: string }) {
  const { name } = useApp()
  const { status } = useSyncStatus()
  const dot = status === 'synced' ? 'bg-mint' : status === 'offline' ? 'bg-amber' : status === 'error' ? 'bg-rose' : 'bg-ink-3'
  return (
    <Link
      to="/me"
      aria-label="You, memory and settings"
      className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-[14px] font-extrabold text-ink shadow-card ${className}`}
    >
      {initials(name) || 'Me'}
      <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-bg ${dot}`} aria-hidden />
    </Link>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 pb-5 pt-2">
      <div className="min-w-0">
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.025em] text-ink">{title}</h1>
        {subtitle && <div className="mt-0.5 text-[14px] font-semibold text-ink-3">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        {action}
        <MeButton className="lg:hidden" />
      </div>
    </header>
  )
}

function Sidebar({ phase }: { phase: Phase }) {
  const { name } = useApp()
  const memories = useRows<SyncRow>('memories')
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-6 backdrop-blur-xl lg:flex">
      <Link to="/" className="flex items-center gap-3 px-2">
        <Autobot size={46} track mood="happy" reactive />
        <div className="min-w-0">
          <p className="text-[17px] font-black tracking-[-0.01em] text-ink">Autobot</p>
          <SyncBadge />
        </div>
      </Link>
      <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
        {navItems(phase).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex min-h-[44px] items-center gap-3 rounded-2xl px-3 text-[15px] font-extrabold transition',
                isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:bg-surface/70 hover:text-ink-2',
                to === '/chat' ? 'xl:hidden' : '',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2.4} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-2">
        <NavLink
          to="/me"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl p-2 transition ${isActive ? 'bg-surface shadow-card' : 'hover:bg-surface/70'}`
          }
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-[14px] font-extrabold text-ink">
            {initials(name) || 'Me'}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-extrabold text-ink">{name}</span>
            <span className="block text-[12px] font-bold text-ink-3">Knows {memories.length} things about you</span>
          </span>
        </NavLink>
      </div>
    </aside>
  )
}

function TabBar({ phase }: { phase: Phase }) {
  const items = navItems(phase).filter((i) => !i.desktop)
  const location = useLocation()
  const onChat = location.pathname.startsWith('/chat')
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-end justify-around px-2">
        {items.map(({ to, label, icon: Icon, end }) =>
          to === '/chat' ? (
            <NavLink key={to} to={to} aria-label="Chat with Autobot" className="-mt-5 flex flex-col items-center gap-0.5 pb-2">
              <span
                className={`flex h-[60px] w-[60px] items-center justify-center rounded-full bg-surface shadow-lift ring-4 transition ${
                  onChat ? 'ring-primary' : 'ring-bg'
                }`}
              >
                <Autobot size={48} mood={onChat ? 'happy' : 'idle'} reactive float={false} />
              </span>
              <span className={`text-[11px] font-extrabold ${onChat ? 'text-ink' : 'text-ink-3'}`}>Autobot</span>
            </NavLink>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-0.5 pt-2 text-[11px] font-extrabold transition ${
                  isActive ? 'text-ink' : 'text-ink-3'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.6 : 2.1} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}

export function Layout() {
  const phase = usePhaseSync()
  const location = useLocation()
  const onChat = location.pathname.startsWith('/chat')
  const wide = useMediaQuery('(min-width: 1280px)')
  return (
    <div className="min-h-dvh lg:flex">
      <Brain />
      <Sidebar phase={phase} />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
      {wide && !onChat && (
        <aside className="sticky top-0 h-dvh w-[400px] shrink-0 border-l border-line bg-surface/40">
          <ChatPanel docked />
        </aside>
      )}
      <TabBar phase={phase} />
    </div>
  )
}
