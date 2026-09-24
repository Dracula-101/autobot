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
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            className={[
              'relative flex min-h-[72px] min-w-[52px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 transition',
              selected
                ? 'border-sage/40 bg-sage/10 shadow-soft'
                : 'border-ink-border/60 bg-ink-card/80 hover:border-ink-border hover:bg-ink-raised',
              isToday && !selected ? 'ring-1 ring-amber-soft/40' : '',
            ].join(' ')}
          >
            <span
              className={[
                'text-[10px] font-semibold uppercase tracking-wider',
                selected ? 'text-sage' : isToday ? 'text-amber-soft' : 'text-ink-muted',
              ].join(' ')}
            >
              {dayLabel(date)}
            </span>
            <span
              className={[
                'font-mono text-lg font-semibold tabular-nums',
                selected ? 'text-white' : 'text-white/80',
              ].join(' ')}
            >
              {date.slice(-2)}
            </span>
            <span className="flex h-4 items-center justify-center">
              {checked || allDone ? (
                <Check
                  className={`h-3.5 w-3.5 ${allDone ? 'text-sage' : 'text-sage/70'}`}
                  strokeWidth={3}
                />
              ) : missed ? (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-soft" />
              ) : isToday ? (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-soft" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-ink-border" />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
