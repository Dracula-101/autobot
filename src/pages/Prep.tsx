import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ExternalLink, GraduationCap, Plus, RotateCcw } from 'lucide-react'
import {
  leetcodeUrl,
  live,
  logicalDay,
  nextRoadmapProblem,
  patternName,
  PATTERNS,
  relativeDay,
  reviewsDue,
  ROADMAP,
  searchRoadmap,
  weekTotals,
  type LogEntry,
  type Problem,
  type ProblemResult,
  type RoadmapProblem,
} from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { useActions } from '../lib/useActions'
import { PageHeader } from '../components/Shell'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { cheer } from '../components/Autobot'
import { Progress, Ring, SectionTitle } from '../components/ui'

const DIFF_TONE = { Easy: 'bg-mint/15 text-mint', Medium: 'bg-amber/15 text-amber', Hard: 'bg-rose/12 text-rose' } as const

const RESULTS: { value: ProblemResult; label: string; hint: string }[] = [
  { value: 'solved', label: 'Solved it', hint: 'Review in a week' },
  { value: 'hints', label: 'Needed hints', hint: 'Review in 3 days' },
  { value: 'stuck', label: 'Got stuck', hint: 'Try again tomorrow' },
]

function ResultButtons({ onPick }: { onPick: (r: ProblemResult) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {RESULTS.map((r) => (
        <button key={r.value} type="button" className="btn-soft btn-sm flex-col gap-0 py-2" onClick={() => onPick(r.value)}>
          <span>{r.label}</span>
          <span className="text-[11px] font-bold text-ink-3">{r.hint}</span>
        </button>
      ))}
    </div>
  )
}

function LogSheet({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: RoadmapProblem | Problem | null }) {
  const actions = useActions()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<RoadmapProblem | null>(null)
  const [notes, setNotes] = useState('')
  const title = initial?.title ?? picked?.title ?? query
  const matches = initial || picked ? [] : searchRoadmap(query)

  const log = (result: ProblemResult) => {
    if (!title.trim()) return
    const { problem, undo } = actions.logProblem({ title, result, notes })
    if (result !== 'stuck') cheer()
    toast(`${problem.title} — review ${result === 'stuck' ? 'tomorrow' : result === 'hints' ? 'in 3 days' : 'in a week+'}`, { undo })
    setQuery('')
    setPicked(null)
    setNotes('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={initial ? `Log: ${initial.title}` : 'Log a problem'}>
      <div className="space-y-4">
        {!initial && (
          <div>
            <label className="label" htmlFor="lc-search">
              Problem
            </label>
            <input
              id="lc-search"
              className="field"
              value={picked ? picked.title : query}
              onChange={(e) => {
                setPicked(null)
                setQuery(e.target.value)
              }}
              placeholder="Start typing — two sum, LRU cache…"
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-2xl border border-line">
                {matches.map((p) => (
                  <li key={p.slug}>
                    <button
                      type="button"
                      onClick={() => setPicked(p)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-extrabold text-ink">{p.title}</span>
                        <span className="text-[12px] font-bold text-ink-3">{patternName(p.pattern)}</span>
                      </span>
                      <span className={`chip ${DIFF_TONE[p.difficulty]}`}>{p.difficulty}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query && !matches.length && !picked && (
              <p className="mt-1 text-[12px] font-bold text-ink-3">Not in the roadmap — that’s fine, it’ll still count.</p>
            )}
          </div>
        )}
        <div>
          <label className="label" htmlFor="lc-notes">
            One-line takeaway (optional)
          </label>
          <input
            id="lc-notes"
            className="field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hash map of value → index, check complement first"
          />
        </div>
        <div>
          <p className="label">How did it go?</p>
          <ResultButtons onPick={log} />
        </div>
      </div>
    </Sheet>
  )
}

export function PrepPage() {
  const { settings } = useApp()
  const problems = live(useRows<Problem>('problems'))
  const logs = useRows<LogEntry>('logs')
  const today = logicalDay(new Date(), settings.rolloverHour)
  const week = weekTotals(logs, today)
  const due = reviewsDue(problems, today)
  const next = nextRoadmapProblem(problems)
  const [sheet, setSheet] = useState<{ initial?: RoadmapProblem | Problem | null } | null>(null)
  const [openPattern, setOpenPattern] = useState<string | null>(null)

  const solved = useMemo(() => new Set(problems.filter((p) => p.result !== 'stuck').map((p) => p.slug)), [problems])
  const attempted = useMemo(() => new Set(problems.map((p) => p.slug)), [problems])
  const started = PATTERNS.filter((p) => ROADMAP.some((r) => r.pattern === p.key && attempted.has(r.slug))).length

  return (
    <div className="page">
      <PageHeader
        title="Prep"
        subtitle="Patterns, not problems. Spaced review makes them stick."
        action={
          <button type="button" className="btn-primary btn-sm h-10" onClick={() => setSheet({ initial: null })}>
            <Plus className="h-4 w-4" strokeWidth={3} /> Log
          </button>
        }
      />

      <div className="card flex items-center gap-4 p-4">
        <Ring value={week.leetcode} max={settings.targets.leetcode} size={64} stroke={7} color="rgb(var(--a-prep))">
          <span className="num text-[14px] font-bold text-ink">{week.leetcode}</span>
        </Ring>
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          <div>
            <p className="num text-[20px] font-bold text-ink">{solved.size}</p>
            <p className="text-[12px] font-extrabold text-ink-3">solved</p>
          </div>
          <div>
            <p className={`num text-[20px] font-bold ${due.length ? 'text-accent' : 'text-ink'}`}>{due.length}</p>
            <p className="text-[12px] font-extrabold text-ink-3">reviews due</p>
          </div>
          <div>
            <p className="num text-[20px] font-bold text-ink">
              {started}/{PATTERNS.length}
            </p>
            <p className="text-[12px] font-extrabold text-ink-3">patterns</p>
          </div>
        </div>
      </div>
      <p className="mt-2 px-1 text-[12px] font-bold text-ink-3">
        This week: {week.leetcode}/{settings.targets.leetcode} problems
      </p>

      {next && (
        <section className="card mt-4 p-5">
          <p className="text-[12px] font-black uppercase tracking-[0.1em] text-a-prep">Up next · {patternName(next.pattern)}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="text-[21px] font-black leading-tight text-ink">{next.title}</h2>
            <span className={`chip shrink-0 ${DIFF_TONE[next.difficulty]}`}>{next.difficulty}</span>
          </div>
          <p className="mt-1 text-[14px] font-semibold text-ink-3">{PATTERNS.find((p) => p.key === next.pattern)?.idea}</p>
          <div className="mt-4 flex gap-2">
            <a className="btn-primary flex-1" href={leetcodeUrl(next.slug)} target="_blank" rel="noreferrer">
              Open on LeetCode <ExternalLink className="h-4 w-4" />
            </a>
            <button type="button" className="btn-soft" onClick={() => setSheet({ initial: next })}>
              Log it
            </button>
          </div>
        </section>
      )}

      {due.length > 0 && (
        <section className="mt-6">
          <SectionTitle title="Re-solve from memory" hint="Close the tab, rebuild the idea, then code it." />
          <ul className="card divide-y divide-line px-4">
            {due.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <RotateCcw className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-extrabold text-ink">{p.title}</p>
                  <p className="text-[12px] font-bold text-ink-3">
                    {patternName(p.pattern)} · last {p.result === 'stuck' ? 'got stuck' : p.result === 'hints' ? 'needed hints' : 'solved'}
                  </p>
                </div>
                <a className="btn-ghost btn-sm h-9 w-9 px-0" href={leetcodeUrl(p.slug)} target="_blank" rel="noreferrer" aria-label="Open on LeetCode">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button type="button" className="btn-soft btn-sm" onClick={() => setSheet({ initial: p })}>
                  Log
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle title="Patterns" hint="Learn them in this order. Three solid problems each is a great first pass." />
        <ul className="space-y-2">
          {PATTERNS.map((pattern) => {
            const list = ROADMAP.filter((r) => r.pattern === pattern.key)
            const done = list.filter((r) => solved.has(r.slug)).length
            const open = openPattern === pattern.key
            return (
              <li key={pattern.key} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenPattern(open ? null : pattern.key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[15px] font-extrabold text-ink">{pattern.name}</p>
                      <span className="num shrink-0 text-[12px] font-bold text-ink-3">
                        {done}/{list.length}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Progress value={done} max={list.length} className="bg-a-prep" height="h-1.5" />
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-ink-3 transition ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="border-t border-line px-4 pb-4 pt-3">
                    <p className="text-[14px] font-bold text-ink">{pattern.idea}</p>
                    <p className="mt-1 text-[13px] font-semibold text-ink-3">Reach for it when: {pattern.signal}</p>
                    <Link
                      to="/chat"
                      state={{ prefill: `Teach me ${pattern.name} in 5 minutes — intuition, a tiny example, then quiz me.` }}
                      className="btn-soft btn-sm mt-3"
                    >
                      <GraduationCap className="h-4 w-4" /> Teach me this
                    </Link>
                    <ul className="mt-3 space-y-1">
                      {list.map((r) => (
                        <li key={r.slug} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              solved.has(r.slug) ? 'bg-a-prep text-white' : attempted.has(r.slug) ? 'border-2 border-accent' : 'border-2 border-line-2'
                            }`}
                          >
                            {solved.has(r.slug) && <Check className="h-3 w-3" strokeWidth={3.5} />}
                          </span>
                          <a
                            href={leetcodeUrl(r.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink hover:underline"
                          >
                            {r.title}
                          </a>
                          <span className={`chip px-2 py-0.5 text-[11px] ${DIFF_TONE[r.difficulty]}`}>{r.difficulty}</span>
                          <button type="button" className="btn-ghost btn-sm min-h-[30px] px-2" onClick={() => setSheet({ initial: r })}>
                            Log
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {problems.length > 0 && (
        <section className="mt-6">
          <SectionTitle title="History" />
          <ul className="card divide-y divide-line px-4">
            {[...problems]
              .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
              .slice(0, 12)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-extrabold text-ink">{p.title}</p>
                    <p className="text-[12px] font-bold text-ink-3">
                      {patternName(p.pattern)} · {p.attempts} {p.attempts === 1 ? 'attempt' : 'attempts'}
                    </p>
                  </div>
                  {p.next_review && (
                    <span className="shrink-0 text-[12px] font-extrabold text-ink-3">review {relativeDay(p.next_review, today)}</span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      <LogSheet open={Boolean(sheet)} onClose={() => setSheet(null)} initial={sheet?.initial ?? null} />
    </div>
  )
}
