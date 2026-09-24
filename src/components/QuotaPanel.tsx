import { useApp } from '../context/AppContext'
import { WEEKLY_QUOTAS } from '../data/quotas'
import { ProgressRing } from './ProgressRing'

const COLORS: Record<string, string> = {
  hunt: '#8fbc9a',
  leetcode: '#d4a574',
  fitness: '#8eb4d8',
  class: '#b8a4d4',
  health: '#c9898f',
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
    <section className="rounded-2xl border border-ink-border/70 bg-ink-card/90 p-4 shadow-soft">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-[1.05rem] font-semibold tracking-[-0.01em] text-cream">
            This week
          </h3>
          <p className="mt-0.5 text-[12px] text-cream/35">Must-hit by Sunday · Denver</p>
        </div>
        {allHit ? (
          <span className="rounded-full border border-sage/30 bg-sage/10 px-2.5 py-1 text-[11px] font-semibold text-sage">
            Locked in
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {primary.map((q) => {
          const value = Math.min(quotaProgress[q.key] ?? 0, q.targetMax ?? q.target)
          const max = q.target
          return (
            <ProgressRing
              key={q.key}
              value={value}
              max={max}
              label={q.label}
              color={COLORS[q.category] ?? '#8fbc9a'}
              size={64}
              stroke={5}
            />
          )
        })}
      </div>
      <div className="mt-4 grid gap-2.5 border-t border-ink-border/50 pt-3.5 sm:grid-cols-2">
        {WEEKLY_QUOTAS.filter((q) =>
          ['lectures', 'homework', 'sleep', 'scalp'].includes(q.key),
        ).map((q) => {
          const v = quotaProgress[q.key] ?? 0
          const pct = Math.min((v / q.target) * 100, 100)
          return (
            <div key={q.key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-cream/50">{q.label}</span>
                  <span className="font-mono tabular-nums text-cream/30">
                    {v}/{q.target}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-ink-border/80">
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
