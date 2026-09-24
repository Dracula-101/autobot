import { useApp } from '../context/AppContext'
import { WEEKLY_QUOTAS } from '../data/quotas'
import { ProgressRing } from './ProgressRing'

const COLORS: Record<string, string> = {
  hunt: '#7dcea0',
  leetcode: '#e8b86d',
  fitness: '#8eb4d8',
  class: '#c4a8e0',
  health: '#c97b84',
}

export function QuotaPanel() {
  const { quotaProgress } = useApp()
  const primary = WEEKLY_QUOTAS.filter((q) =>
    ['outreach', 'roles', 'resume', 'leetcode', 'racket', 'move'].includes(q.key),
  )

  const allHit = primary.every((q) => {
    const v = quotaProgress[q.key] ?? 0
    return v >= q.target
  })

  return (
    <section className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Weekly quotas</h3>
          <p className="text-xs text-ink-muted">Must hit by Sunday · America/Denver</p>
        </div>
        {allHit && (
          <span className="rounded-full bg-sage/15 px-2.5 py-1 text-[11px] font-semibold text-sage">
            Locked in
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {primary.map((q) => {
          const value = Math.min(quotaProgress[q.key] ?? 0, q.targetMax ?? q.target)
          const max = q.target
          return (
            <ProgressRing
              key={q.key}
              value={value}
              max={max}
              label={q.label}
              color={COLORS[q.category] ?? '#7dcea0'}
              size={64}
              stroke={5}
            />
          )
        })}
      </div>
      <div className="mt-4 grid gap-2 border-t border-ink-border/60 pt-3 sm:grid-cols-2">
        {WEEKLY_QUOTAS.filter((q) =>
          ['lectures', 'homework', 'sleep', 'scalp'].includes(q.key),
        ).map((q) => {
          const v = quotaProgress[q.key] ?? 0
          const pct = Math.min((v / q.target) * 100, 100)
          return (
            <div key={q.key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-white/60">{q.label}</span>
                  <span className="font-mono tabular-nums text-white/40">
                    {v}/{q.target}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-border">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: COLORS[q.category],
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
