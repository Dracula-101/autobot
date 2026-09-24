// Assignments from his checker: one row per assignment, and the "Due soon"
// card on Today.

import { Link } from 'react-router-dom'
import { Check, ChevronRight, ExternalLink } from 'lucide-react'
import {
  assignmentDone,
  courseShort,
  formatClock,
  logicalDay,
  relativeDay,
  wallClock,
  type Assignment,
} from '@core/index.ts'
import { useApp } from '../lib/app'
import { useActions } from '../lib/useActions'
import { useToast } from './Toast'
import { cheer } from './Autobot'
import { SectionTitle } from './ui'

/** "tomorrow 11:59 PM", "Friday 5:00 PM" (Boulder time) */
export function dueLabel(dueAt: string, today: string): string {
  const w = wallClock(new Date(dueAt))
  return `${relativeDay(w.date, today)} ${formatClock(w.minutes)}`
}

/** Tone by how close the deadline is. Past deadlines stay neutral: the checker can't see submissions. */
export function urgency(dueAt: string, now: Date): 'past' | 'soon' | 'near' | 'later' {
  const hours = (new Date(dueAt).getTime() - now.getTime()) / 3_600_000
  if (hours < 0) return 'past'
  if (hours <= 24) return 'soon'
  if (hours <= 72) return 'near'
  return 'later'
}

const URGENCY_TEXT = { past: 'text-ink-3', soon: 'text-accent', near: 'text-amber', later: 'text-ink-3' }

export function AssignmentRow({ a, now }: { a: Assignment; now: Date }) {
  const { settings } = useApp()
  const actions = useActions()
  const toast = useToast()
  const today = logicalDay(now, settings.rolloverHour)
  const done = assignmentDone(a)
  // Done according to the checker (submitted) — Autobot can't un-submit it.
  const locked = done && !a.done_at
  const course = courseShort(a.course, settings.classes)

  const toggle = () => {
    if (locked) return
    const undo = actions.setAssignmentDone(a, !done)
    if (!done) cheer()
    toast(done ? 'Reopened' : `Done: ${a.title}`, { undo })
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={toggle}
        disabled={locked}
        aria-pressed={done}
        aria-label={done ? `Mark ${a.title} not done` : `Mark ${a.title} done`}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          done ? 'border-mint bg-mint text-white' : 'border-line-2 hover:border-mint'
        }`}
      >
        {done && <Check className="h-4 w-4" strokeWidth={3.2} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] font-extrabold ${done ? 'text-ink-3 line-through' : 'text-ink'}`}>{a.title}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] font-bold text-ink-3">
          <span className="chip bg-a-class/12 py-0.5 text-a-class">{course}</span>
          {a.due_at && (
            <span className={done ? '' : URGENCY_TEXT[urgency(a.due_at, now)]}>due {dueLabel(a.due_at, today)}</span>
          )}
          {locked && <span className="text-mint">· {a.source_status.toLowerCase()}</span>}
        </p>
      </div>
      {a.url && (
        <a
          className="btn-ghost btn-sm h-9 w-9 shrink-0 px-0"
          href={a.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${a.title}`}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </li>
  )
}

/** Today's heads-up: what's due this week. Hidden when nothing is. */
export function DueSoonCard({ due, now }: { due: Assignment[]; now: Date }) {
  if (!due.length) return null
  const first = due[0]
  const pressing = first.due_at ? urgency(first.due_at, now) : 'later'
  return (
    <section className={`card p-4 ${pressing === 'soon' ? 'ring-2 ring-accent/30' : ''}`}>
      <SectionTitle
        title="Due soon"
        hint="From your assignment checker"
        action={
          <Link to="/school" className="btn-ghost btn-sm -mr-2 text-ink-3">
            All <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />
      <ul className="divide-y divide-line">
        {due.slice(0, 4).map((a) => (
          <AssignmentRow key={a.id} a={a} now={now} />
        ))}
      </ul>
    </section>
  )
}
