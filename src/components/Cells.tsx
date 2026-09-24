import { Link } from 'react-router-dom'
import { BatteryFull, BatteryLow, BatteryMedium, Zap, type LucideIcon } from 'lucide-react'
import {
  CELL_LABEL,
  CELL_NUDGE,
  CELLS,
  DAY_KEYS,
  STATUS_LABEL,
  type Cell,
  type CellState,
  type Energy,
} from '@core/index.ts'
import { AREA } from './ui'

const CELL_LINK: Record<Cell, string> = { hunt: '/hunt', prep: '/prep', body: '/body' }

/** A battery glyph. Overflow (big days) shows as a spark, drained as a warning tint. */
export function Battery({ state, className = '' }: { state: CellState; className?: string }) {
  const fill = Math.max(0.04, Math.min(1, state.level))
  const color = state.status === 'drained' ? 'bg-rose' : AREA[state.cell].fill
  return (
    <span className={`relative inline-flex items-center ${className}`} aria-hidden>
      <span className="relative h-4 w-full overflow-hidden rounded-[6px] border-2 border-ink-3/40 p-[2px]">
        <span
          className={`block h-full rounded-[3px] transition-[width] duration-700 ease-out ${color} ${
            state.status === 'drained' ? 'animate-pulse' : ''
          }`}
          style={{ width: `${fill * 100}%` }}
        />
      </span>
      <span className="ml-[2px] h-2 w-[3px] rounded-r-sm bg-ink-3/40" />
      {state.status === 'super' && (
        <Zap className="absolute -right-2 -top-2.5 h-4 w-4 text-amber" fill="currentColor" strokeWidth={1.5} />
      )}
    </span>
  )
}

/** The three power cells, each linking to its page. */
export function PowerCells({ cells }: { cells: Record<Cell, CellState> }) {
  return (
    <section className="card p-4" aria-label="Power cells">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-black text-ink">Power cells</h3>
        <span className="text-[12px] font-bold text-ink-3">Anything you do charges them</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {CELLS.map((c) => {
          const s = cells[c]
          const Icon = AREA[c].icon
          const weak = s.status === 'drained' || s.status === 'low'
          return (
            <Link
              key={c}
              to={CELL_LINK[c]}
              className="group rounded-2xl p-1 transition hover:bg-surface-2/60"
              aria-label={`${CELL_LABEL[c]} cell: ${STATUS_LABEL[s.status]}${weak ? ` — ${CELL_NUDGE[c]}` : ''}`}
            >
              <span className={`flex items-center gap-1.5 text-[13px] font-extrabold ${AREA[c].text}`}>
                <Icon className="h-4 w-4" strokeWidth={2.6} aria-hidden />
                {CELL_LABEL[c]}
              </span>
              <Battery state={s} className="mt-2 w-full" />
              <span className={`mt-1.5 block text-[12px] font-extrabold ${weak ? 'text-accent' : 'text-ink-2'}`}>
                {STATUS_LABEL[s.status]}
              </span>
              {weak && <span className="block text-[11px] font-bold leading-tight text-ink-3">{CELL_NUDGE[c]}</span>}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/** One cell as a wide tile (Hunt / Prep / Body pages). */
export function CellTile({ state, blurb }: { state: CellState; blurb: string }) {
  const Icon = AREA[state.cell].icon
  const weak = state.status === 'drained' || state.status === 'low'
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex items-center gap-2 text-[15px] font-black ${AREA[state.cell].text}`}>
          <Icon className="h-5 w-5" strokeWidth={2.6} aria-hidden />
          {CELL_LABEL[state.cell]} cell
        </span>
        <span className={`text-[13px] font-extrabold ${weak ? 'text-accent' : 'text-ink-2'}`}>{STATUS_LABEL[state.status]}</span>
      </div>
      <Battery state={state} className="mt-3 w-full" />
      <WeekDots week={state.week} cell={state.cell} className="mt-3" />
      <p className="mt-2 text-[13px] font-semibold text-ink-3">
        {weak ? `Running low — ${CELL_NUDGE[state.cell]}.` : blurb}
        {state.streak >= 2 && ` ${state.streak}-day streak.`}
      </p>
    </div>
  )
}

export function WeekDots({ week, cell, className = '' }: { week: boolean[]; cell: Cell; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label="Days active this week">
      {DAY_KEYS.map((d, i) => (
        <span key={d} className="flex flex-col items-center gap-1">
          <span
            className={`h-3 w-3 rounded-full ${week[i] ? AREA[cell].fill : 'border-2 border-line-2'}`}
            title={`${d}: ${week[i] ? 'active' : 'quiet'}`}
          />
          <span className="text-[10px] font-extrabold uppercase text-ink-3">{d.slice(0, 1)}</span>
        </span>
      ))}
    </div>
  )
}

/** This week at a glance: which days each cell got charged. No totals. */
export function WeekCells({ cells }: { cells: Record<Cell, CellState> }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-black text-ink">This week</h3>
        <span className="text-[12px] font-bold text-ink-3">Days you charged each cell</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {CELLS.map((c) => (
          <div key={c} className="flex items-center justify-between gap-3">
            <span className={`w-12 text-[13px] font-extrabold ${AREA[c].text}`}>{CELL_LABEL[c]}</span>
            <WeekDots week={cells[c].week} cell={c} className="flex-1 justify-between" />
            <span className="w-24 text-right text-[12px] font-extrabold text-ink-3">{STATUS_LABEL[cells[c].status]}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const ENERGY: { value: Energy; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'low', label: 'Low', icon: BatteryLow, hint: 'Small day — keep the cells alive' },
  { value: 'normal', label: 'Normal', icon: BatteryMedium, hint: 'A solid, regular day' },
  { value: 'high', label: 'Charged', icon: BatteryFull, hint: 'Bonus blocks while you’re sharp' },
]

export function EnergyCard({
  energy,
  onPick,
  open,
  onOpen,
}: {
  energy: Energy | null
  onPick: (e: Energy) => void
  open: boolean
  onOpen: () => void
}) {
  if (energy && !open) {
    const current = ENERGY.find((e) => e.value === energy)!
    const Icon = current.icon
    return (
      <button
        type="button"
        onClick={onOpen}
        className="chip min-h-[36px] bg-surface px-3 text-[13px] text-ink-2 shadow-card"
        aria-label={`Battery today: ${current.label}. Change`}
      >
        <Icon className="h-4 w-4" aria-hidden /> Battery: {current.label}
        <span className="text-ink-3">· change</span>
      </button>
    )
  }
  return (
    <section className="card p-4">
      <h3 className="text-[15px] font-black text-ink">How’s your battery today?</h3>
      <p className="text-[13px] font-semibold text-ink-3">No wrong answer — I’ll size today to match.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ENERGY.map(({ value, label, icon: Icon, hint }) => (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            aria-pressed={energy === value}
            className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center transition active:scale-[0.97] ${
              energy === value ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink hover:bg-surface-3'
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={2.2} aria-hidden />
            <span className="text-[14px] font-extrabold">{label}</span>
            <span className={`text-[11px] font-bold leading-tight ${energy === value ? 'text-primary-ink/80' : 'text-ink-3'}`}>
              {hint}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
