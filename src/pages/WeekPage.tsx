import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { WEEKLY_QUOTAS } from '../data/quotas'
import { Check, Circle } from 'lucide-react'

const FOCUS_OPTIONS = [
  'resume',
  'referral list',
  'LC patterns',
  'applications',
] as const

export function WeekPage() {
  const {
    quotaProgress,
    weeklyNotes,
    saveWeeklyNotes,
    sportDay,
    updateProfile,
    weekStart,
    isCheckedIn,
    weekDates,
  } = useApp()

  const [win, setWin] = useState(weeklyNotes?.win ?? '')
  const [fix, setFix] = useState(weeklyNotes?.fix ?? '')
  const [focus, setFocus] = useState(weeklyNotes?.focus ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setWin(weeklyNotes?.win ?? '')
    setFix(weeklyNotes?.fix ?? '')
    setFocus(weeklyNotes?.focus ?? '')
  }, [weeklyNotes, weekStart])

  const campusDays = weekDates.filter((_, i) => [2, 4, 5].includes(i)) // Wed Fri Sat
  const campusStacks = campusDays.filter((d) => isCheckedIn(d)).length

  const handleSave = async () => {
    await saveWeeklyNotes({ win, fix, focus })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="animate-fade-up space-y-5 lg:space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-cream lg:text-[1.35rem]">
          Sunday scoreboard
        </h2>
        <p className="mt-1 text-sm text-cream/45">
          Week of {weekStart} · fill as you go
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
      <section className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-border/60 text-left text-[11px] uppercase text-ink-muted">
              <th className="px-4 py-3 font-medium">Area</th>
              <th className="px-2 py-3 font-medium">Target</th>
              <th className="px-2 py-3 font-medium">Actual</th>
              <th className="px-4 py-3 font-medium">Hit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-border/40">
            {WEEKLY_QUOTAS.filter((q) =>
              ['outreach', 'roles', 'resume', 'leetcode', 'racket', 'move'].includes(
                q.key,
              ),
            ).map((q) => {
              const actual = quotaProgress[q.key] ?? 0
              const hit = actual >= q.target
              const targetLabel =
                q.targetMax != null ? `${q.target}–${q.targetMax}` : String(q.target)
              return (
                <tr key={q.key}>
                  <td className="px-4 py-3 text-white/80">{q.label}</td>
                  <td className="px-2 py-3 font-mono tabular-nums text-white/40">
                    {targetLabel}
                  </td>
                  <td className="px-2 py-3 font-mono tabular-nums text-white">
                    {actual}
                  </td>
                  <td className="px-4 py-3">
                    {hit ? (
                      <Check className="h-4 w-4 text-sage" strokeWidth={3} />
                    ) : (
                      <Circle className="h-4 w-4 text-ink-border" />
                    )}
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className="px-4 py-3 text-white/80">Wed + Fri + Sat stacks</td>
              <td className="px-2 py-3 font-mono text-white/40">3</td>
              <td className="px-2 py-3 font-mono text-white">{campusStacks}</td>
              <td className="px-4 py-3">
                {campusStacks >= 3 ? (
                  <Check className="h-4 w-4 text-sage" strokeWidth={3} />
                ) : (
                  <Circle className="h-4 w-4 text-ink-border" />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            One win
          </label>
          <textarea
            className="input min-h-[72px] resize-none"
            value={win}
            onChange={(e) => setWin(e.target.value)}
            placeholder="What went well this week?"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            One fix for next week
          </label>
          <textarea
            className="input min-h-[72px] resize-none"
            value={fix}
            onChange={(e) => setFix(e.target.value)}
            placeholder="What will you tighten?"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-white/50">
            Next week sport day
          </label>
          <div className="flex gap-2">
            {(['mon', 'sun'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => void updateProfile({ sport_day: d })}
                className={[
                  'flex-1 rounded-xl border py-3 text-sm font-semibold capitalize transition',
                  sportDay === d
                    ? 'border-sage/40 bg-sage/10 text-sage'
                    : 'border-ink-border text-white/50 hover:border-ink-border hover:text-white',
                ].join(' ')}
              >
                {d === 'mon' ? 'Monday' : 'Sunday'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-white/50">
            Next week focus
          </label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFocus(opt)}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition',
                  focus === opt
                    ? 'border-amber-soft/40 bg-amber-glow text-amber-soft'
                    : 'border-ink-border text-white/45 hover:text-white',
                ].join(' ')}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => void handleSave()} className="btn-primary w-full sm:w-auto sm:min-w-[12rem]">
          {saved ? 'Saved ✓' : 'Save scoreboard'}
        </button>
      </section>
      </div>
    </div>
  )
}
