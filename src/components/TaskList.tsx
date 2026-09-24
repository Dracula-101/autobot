import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { tasksForDay, DAY_META } from '../data/tasks'
import { dayKeyOf, formatPretty } from '../lib/dates'
import { TaskItem } from './TaskItem'
import { AutobotMascot } from './AutobotMascot'

export function TaskList() {
  const { selectedDate, sportDay, isTaskDone, toggleTask, today } = useApp()
  const dayKey = dayKeyOf(selectedDate)
  const tasks = useMemo(
    () => tasksForDay(dayKey, sportDay),
    [dayKey, sportDay],
  )
  const meta = DAY_META[dayKey]
  const doneCount = tasks.filter((t) => isTaskDone(selectedDate, t.id)).length
  const allDone = tasks.length > 0 && doneCount === tasks.length
  const empty = tasks.length === 0

  const sections = useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const t of tasks) {
      const key = t.section ?? 'Today'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return Array.from(map.entries())
  }, [tasks])

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-cream/40">
            {formatPretty(selectedDate)}
            {selectedDate === today ? (
              <span className="ml-2 inline-flex items-center rounded-full border border-amber-soft/25 bg-amber-glow px-2 py-0.5 text-[11px] font-medium text-amber-soft">
                Today
              </span>
            ) : null}
          </p>
          <h2 className="mt-1 font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-cream">
            {meta.title}
          </h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-cream/40">
            {meta.blurb}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-ink-border/60 bg-ink-soft px-3 py-2 text-right">
          <p className="font-mono text-sm tabular-nums text-cream/80">
            <span className="text-sage">{doneCount}</span>
            <span className="text-cream/30">/{tasks.length}</span>
          </p>
          <p className="text-[10px] text-cream/35">done</p>
        </div>
      </div>

      {allDone ? (
        <div className="flex items-center gap-3 rounded-2xl border border-sage/25 bg-sage/5 px-4 py-3.5">
          <AutobotMascot mood="happy" size={36} />
          <div>
            <p className="text-sm font-semibold text-sage">Stack cleared.</p>
            <p className="text-[13px] text-cream/40">Protect wind-down — home isn’t the grind spot.</p>
          </div>
        </div>
      ) : null}

      {empty ? (
        <div className="flex items-center gap-3 rounded-2xl border border-ink-border/70 bg-ink-card/90 px-4 py-4">
          <AutobotMascot mood="sleep" size={36} />
          <div>
            <p className="text-sm font-semibold text-cream/80">Quiet day</p>
            <p className="text-[13px] text-cream/40">Nothing queued. Rest, or peek at another day.</p>
          </div>
        </div>
      ) : null}

      {sections.map(([section, items]) => (
        <section key={section} className="overflow-hidden rounded-2xl border border-ink-border/70 bg-ink-card/90 shadow-soft">
          <header className="flex items-center justify-between border-b border-ink-border/50 px-4 py-2.5">
            <h3 className="text-[13px] font-medium text-cream/50">{section}</h3>
            <span className="font-mono text-[11px] tabular-nums text-cream/25">
              {items.filter((t) => isTaskDone(selectedDate, t.id)).length}/{items.length}
            </span>
          </header>
          <div className="divide-y divide-ink-border/35 px-1 py-1">
            {items.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                done={isTaskDone(selectedDate, task.id)}
                onToggle={() => void toggleTask(selectedDate, task.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
