import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { dayKeyOf, todayKey } from '../lib/dates'
import {
  lecturesForDay,
  lecturePhase,
  lectureTaskId,
  formatClock,
  denverMinutes,
} from '../lib/schedule'

function missedKey(date: string, id: string) {
  return `autobot-missed:${date}:${id}`
}

export function ClassAttendance() {
  const { selectedDate, isTaskDone, toggleTask } = useApp()
  const today = todayKey()
  const day = dayKeyOf(selectedDate)
  const nowMin = denverMinutes()
  const [, bump] = useState(0)

  const ended = useMemo(() => {
    if (selectedDate !== today) return []
    return lecturesForDay(day).filter((l) => lecturePhase(l, nowMin) === 'ended')
  }, [selectedDate, today, day, nowMin])

  if (!ended.length) return null

  return (
    <section className="rounded-2xl border border-ink-border/70 bg-ink-card/90 p-4 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sage/80">
        Class check
      </p>
      <h3 className="mt-1 font-display text-[1.15rem] font-semibold tracking-[-0.02em] text-cream">
        Did you make these?
      </h3>
      <p className="mt-1 text-[13px] text-cream/40">
        Past lectures leave the checklist — confirm so I don’t keep them hanging.
      </p>
      <ul className="mt-3 space-y-2">
        {ended.map((lec) => {
          const id = lectureTaskId(day, lec.id)
          const done = isTaskDone(selectedDate, id)
          let missed = false
          try {
            missed = localStorage.getItem(missedKey(selectedDate, id)) === '1'
          } catch {
            /* ignore */
          }
          return (
            <li
              key={id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-border/60 bg-ink-soft/80 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-cream/90">{lec.course}</p>
                <p className="text-[12px] text-cream/35">
                  {formatClock(lec.startMin)}–{formatClock(lec.endMin)} · {lec.room}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(missedKey(selectedDate, id))
                    } catch {
                      /* ignore */
                    }
                    if (!done) void toggleTask(selectedDate, id)
                    bump((n) => n + 1)
                  }}
                  className={[
                    'rounded-xl px-3 py-1.5 text-[12px] font-semibold transition',
                    done && !missed
                      ? 'bg-sage/20 text-sage'
                      : 'border border-ink-border text-cream/55 hover:border-sage/40 hover:text-cream',
                  ].join(' ')}
                >
                  Went
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem(missedKey(selectedDate, id), '1')
                    } catch {
                      /* ignore */
                    }
                    if (done) void toggleTask(selectedDate, id)
                    bump((n) => n + 1)
                  }}
                  className={[
                    'rounded-xl px-3 py-1.5 text-[12px] font-semibold transition',
                    missed
                      ? 'bg-rose-soft/15 text-rose-soft'
                      : 'border border-ink-border text-cream/45 hover:border-rose-soft/40 hover:text-rose-soft',
                  ].join(' ')}
                >
                  Missed
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
