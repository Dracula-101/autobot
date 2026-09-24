import { Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { dayLabel, dayKeyOf, isPastDay } from '../lib/dates'
import { tasksForDay } from '../data/tasks'

export function WeekStrip() {
  const {
    weekDates,
    selectedDate,
    setSelectedDate,
    today,
    isCheckedIn,
    isTaskDone,
    sportDay,
  } = useApp()

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {weekDates.map((date) => {
        const selected = date === selectedDate
        const isToday = date === today
        const checked = isCheckedIn(date)
        const dayKey = dayKeyOf(date)
        const tasks = tasksForDay(dayKey, sportDay)
        const doneCount = tasks.filter((t) => isTaskDone(date, t.id)).length
        const allDone = tasks.length > 0 && doneCount === tasks.length
        const missed = isPastDay(date, today) && !checked

        return (
          <button
            key={date}
            type="button"
            onClick={() => setSelectedDate(date)}
            aria-pressed={selected}
            className={[
              'relative flex min-h-[76px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 transition',
              selected
                ? 'border-cream/20 bg-cream text-ink shadow-lift'
                : 'border-ink-border/60 bg-ink-card/80 text-cream hover:border-ink-border hover:bg-ink-raised',
              isToday && !selected ? 'ring-1 ring-amber-soft/35' : '',
            ].join(' ')}
          >
            <span
              className={[
                'text-[10px] font-semibold uppercase tracking-wide',
                selected ? 'text-ink/55' : isToday ? 'text-amber-soft' : 'text-cream/35',
              ].join(' ')}
            >
              {dayLabel(date)}
            </span>
            <span
              className={[
                'font-mono text-lg font-semibold tabular-nums leading-none',
                selected ? 'text-ink' : 'text-cream/90',
              ].join(' ')}
            >
              {date.slice(-2)}
            </span>
            <span className="flex h-3.5 items-center justify-center">
              {checked || allDone ? (
                <Check
                  className={`h-3.5 w-3.5 ${selected ? 'text-sage-dim' : allDone ? 'text-sage' : 'text-sage/70'}`}
                  strokeWidth={3}
                />
              ) : missed ? (
                <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-rose-soft' : 'bg-rose-soft'}`} />
              ) : isToday ? (
                <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-ink/40' : 'bg-amber-soft'}`} />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-ink/20' : 'bg-ink-border'}`} />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
