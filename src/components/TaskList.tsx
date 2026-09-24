import { useMemo } from 'react'
import { PartyPopper } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { tasksForDay, DAY_META } from '../data/tasks'
import { dayKeyOf, formatPretty } from '../lib/dates'
import { TaskItem } from './TaskItem'

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

  // Group by section
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
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-ink-muted">
            {formatPretty(selectedDate)}
            {selectedDate === today && (
              <span className="ml-2 rounded-full bg-amber-glow px-2 py-0.5 text-amber-soft">
                Today
              </span>
            )}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
            {meta.title}
          </h2>
          <p className="mt-1 max-w-md text-sm text-white/50">{meta.blurb}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm tabular-nums text-white/70">
            <span className="text-sage">{doneCount}</span>
            <span className="text-ink-muted">/{tasks.length}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-ink-muted">done</p>
        </div>
      </div>

      {allDone ? (
        <div className="card flex items-center gap-3 border-sage/30 bg-sage/5 px-4 py-4">
          <PartyPopper className="h-6 w-6 text-sage" />
          <div>
            <p className="font-semibold text-sage">Day complete</p>
            <p className="text-sm text-white/50">
              Stack finished. Protect wind-down — home ≠ grind.
            </p>
          </div>
        </div>
      ) : null}

      {sections.map(([section, items]) => (
        <section key={section} className="card overflow-hidden">
          <header className="border-b border-ink-border/60 px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
              {section}
            </h3>
          </header>
          <div className="divide-y divide-ink-border/40 px-1 py-1">
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
