import type { ReactNode } from 'react'
import {
  Briefcase,
  Code2,
  Dumbbell,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { Area, Size } from '@core/index.ts'
import { Autobot, type Mood } from './Autobot'

export const AREA: Record<Area, { label: string; icon: LucideIcon; text: string; bg: string; fill: string }> = {
  hunt: { label: 'Job hunt', icon: Briefcase, text: 'text-a-hunt', bg: 'bg-a-hunt/12', fill: 'bg-a-hunt' },
  prep: { label: 'Prep', icon: Code2, text: 'text-a-prep', bg: 'bg-a-prep/12', fill: 'bg-a-prep' },
  body: { label: 'Body', icon: Dumbbell, text: 'text-a-body', bg: 'bg-a-body/12', fill: 'bg-a-body' },
  class: { label: 'Class', icon: GraduationCap, text: 'text-a-class', bg: 'bg-a-class/12', fill: 'bg-a-class' },
  life: { label: 'Life', icon: Sparkles, text: 'text-a-life', bg: 'bg-a-life/12', fill: 'bg-a-life' },
}

export function AreaIcon({ area, size = 'md' }: { area: Area; size?: 'sm' | 'md' | 'lg' }) {
  const a = AREA[area]
  const Icon = a.icon
  const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl'
  const icon = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${a.bg} ${a.text}`}>
      <Icon className={icon} strokeWidth={2.4} aria-hidden />
    </span>
  )
}

const SIZE_LABEL: Record<Size, string> = { S: 'Quick', M: 'Focus', L: 'Big block' }

export function SizeBadge({ size }: { size: Size }) {
  return (
    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-extrabold text-ink-3" title={SIZE_LABEL[size]}>
      {SIZE_LABEL[size]}
    </span>
  )
}

export function Progress({ value, max, className = 'bg-mint', height = 'h-2' }: { value: number; max: number; className?: string; height?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100)
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-surface-3/70`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${className}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
        {hint && <p className="text-[13px] font-semibold text-ink-3">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={`flex gap-1 rounded-2xl bg-surface-2 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={[
            'flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[14px] font-extrabold transition',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
          ].join(' ')}
        >
          {o.label}
          {o.count != null && o.count > 0 && (
            <span className="num rounded-full bg-accent/15 px-1.5 text-[11px] text-accent">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-ink">{label}</span>
        {hint && <span className="block text-[13px] font-semibold text-ink-3">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-3 transition peer-checked:bg-mint peer-focus-visible:ring-2 peer-focus-visible:ring-sky"
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </label>
  )
}

export function Empty({
  mood = 'happy',
  title,
  body,
  action,
}: {
  mood?: Mood
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <Autobot mood={mood} size={64} />
      <p className="mt-1 text-[16px] font-extrabold text-ink">{title}</p>
      {body && <p className="max-w-xs text-[14px] font-semibold text-ink-3">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Avatar({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[14px] font-extrabold text-ink-2 ${className}`}
    >
      {text}
    </span>
  )
}
