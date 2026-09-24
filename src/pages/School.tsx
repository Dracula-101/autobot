import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { courseShort, formatDate, lastCheck, live, wallClock, type Assignment } from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { useNow } from '../lib/clock'
import { healthy, useSources } from '../lib/sources'
import { PageHeader } from '../components/Shell'
import { AssignmentRow } from '../components/School'
import { Empty, SectionTitle } from '../components/ui'

const DAY = 86_400_000

function Group({ title, hint, list, now }: { title: string; hint?: string; list: Assignment[]; now: Date }) {
  if (!list.length) return null
  return (
    <section>
      <SectionTitle title={title} hint={hint} />
      <ul className="card divide-y divide-line px-4">
        {list.map((a) => (
          <AssignmentRow key={a.id} a={a} now={now} />
        ))}
      </ul>
    </section>
  )
}

export function SchoolPage() {
  const { settings } = useApp()
  const now = useNow(60_000)
  const rows = useRows<Assignment>('assignments')
  const { checker, available } = useSources()
  const [course, setCourse] = useState('all')

  const all = useMemo(() => live(rows).sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9')), [rows])
  const classes = settings.classes
  const short = (a: Assignment) => courseShort(a.course, classes)
  const courses = useMemo(() => [...new Set(all.map((a) => courseShort(a.course, classes)))].sort(), [all, classes])

  // The checker only reports assignments before they're due and can't see
  // submissions, so past deadlines are history, not "overdue".
  const t = now.getTime()
  const due = (a: Assignment) => (a.due_at ? new Date(a.due_at).getTime() : Infinity)
  const list = all.filter((a) => course === 'all' || short(a) === course)
  const week = list.filter((a) => due(a) >= t && due(a) <= t + 7 * DAY)
  const later = list.filter((a) => due(a) > t + 7 * DAY)
  const past = list.filter((a) => due(a) < t && t - due(a) < 30 * DAY).reverse()

  const reported = lastCheck(all)
  const reportedOn = reported ? formatDate(wallClock(new Date(reported)).date, { weekday: true }) : null
  const quiet = reported ? t - new Date(reported).getTime() > 2 * DAY : false

  const status = !available
    ? 'Sign in to sync your assignment checker'
    : reportedOn
      ? `From your assignment checker · last report ${reportedOn}`
      : 'From your assignment checker'

  return (
    <div className="page">
      <PageHeader title="School" subtitle={status} />

      {all.length === 0 ? (
        <div className="card">
          <Empty
            mood="thinking"
            title="No assignments yet"
            body={
              checker && !healthy(checker)
                ? 'I can reach your checker, but I can’t read its assignments yet. The fix is under Sources.'
                : 'Deadlines from your assignment checker land here, with reminders the day before and 3 hours before.'
            }
            action={
              <Link to="/me#sources" className="btn-soft">
                Open Sources
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {courses.length > 1 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {['all', ...courses].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={course === c}
                  onClick={() => setCourse(c)}
                  className={`chip min-h-[34px] shrink-0 px-3.5 text-[13px] ${course === c ? 'bg-primary text-primary-ink' : 'bg-surface text-ink-2 shadow-card'}`}
                >
                  {c === 'all' ? 'All classes' : c}
                </button>
              ))}
            </div>
          )}
          <Group title="This week" hint="Tick them off as you submit — reminders stop for done ones" list={week} now={now} />
          {!week.length && (
            <div className="card p-5">
              <p className="text-[15px] font-extrabold text-ink">Nothing due this week that I know of</p>
              <p className="mt-1 text-[14px] font-semibold text-ink-3">
                {quiet && reportedOn
                  ? `Your checker’s last report was ${reportedOn}, so anything assigned since then isn’t here yet. Worth a quick look at Canvas.`
                  : 'Good time to get ahead on the project.'}
              </p>
            </div>
          )}
          <Group title="Later" list={later} now={now} />
          {past.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none px-1 text-[14px] font-extrabold text-ink-3 hover:text-ink-2">
                Past deadlines <span className="num">({past.length})</span>
                <span className="ml-1 inline-block transition group-open:rotate-90">›</span>
              </summary>
              <ul className="card mt-2 divide-y divide-line px-4">
                {past.map((a) => (
                  <AssignmentRow key={a.id} a={a} now={now} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
