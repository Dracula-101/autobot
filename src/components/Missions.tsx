import { useState } from 'react'
import { Check, MoreHorizontal, Plus } from 'lucide-react'
import {
  addDays,
  MOMENT_ORDER,
  momentHint,
  momentLabel,
  type Area,
  type DayType,
  type Mission,
  type Moment,
  type Size,
} from '@core/index.ts'
import { useActions } from '../lib/useActions'
import { AREA, AreaIcon, SizeBadge } from './ui'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { cheer } from './Autobot'

export function MissionCheck({ mission, onToggle }: { mission: Mission; onToggle: () => void }) {
  const done = mission.status === 'done'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={done ? `Mark “${mission.title}” not done` : `Mark “${mission.title}” done`}
      aria-pressed={done}
      className={[
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[2.5px] transition active:scale-90',
        done ? `animate-pop border-transparent ${AREA[mission.area].fill} text-white` : 'border-line-2 hover:border-ink-3',
      ].join(' ')}
    >
      {done && <Check className="h-4 w-4" strokeWidth={3.5} />}
    </button>
  )
}

export function MissionRow({
  mission,
  progress,
  onMenu,
}: {
  mission: Mission
  progress?: number
  onMenu: (m: Mission) => void
}) {
  const actions = useActions()
  const toast = useToast()
  const done = mission.status === 'done'
  const skipped = mission.status === 'skipped'
  const toggle = () => {
    const undo = actions.toggleMission(mission)
    if (!done) {
      cheer()
      toast('Nice. Checked off.', { undo })
    }
  }
  return (
    <li className="flex items-center gap-3 py-2.5">
      <MissionCheck mission={mission} onToggle={toggle} />
      <button type="button" onClick={() => onMenu(mission)} className="min-w-0 flex-1 text-left">
        <p
          className={[
            'text-[15px] font-bold leading-snug transition',
            done ? 'text-ink-3 line-through decoration-2' : skipped ? 'text-ink-3' : 'text-ink',
          ].join(' ')}
        >
          {mission.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-bold text-ink-3">
          <span className={AREA[mission.area].text}>{AREA[mission.area].label}</span>
          {mission.target_key && mission.amount > 1 && (
            <span className="num">
              {Math.min(progress ?? 0, mission.amount)}/{mission.amount}
            </span>
          )}
          {mission.status === 'doing' && <span className="text-accent">In progress</span>}
          {skipped && <span>Skipped</span>}
          {mission.source === 'autobot' && <span>Added by Autobot</span>}
        </p>
      </button>
      <SizeBadge size={mission.size} />
      <button type="button" onClick={() => onMenu(mission)} className="btn-ghost btn-sm h-9 w-9 px-0" aria-label="More options">
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </li>
  )
}

export function MomentGroups({
  missions,
  progress,
  current,
  type,
}: {
  missions: Mission[]
  progress: Map<string, number>
  current: Moment
  type: DayType
}) {
  const [menu, setMenu] = useState<Mission | null>(null)
  const groups = MOMENT_ORDER.map((m) => ({ moment: m, items: missions.filter((x) => x.moment === m) })).filter(
    (g) => g.items.length,
  )
  return (
    <>
      <div className="space-y-3">
        {groups.map(({ moment, items }) => {
          const now = moment === current
          const doneCount = items.filter((i) => i.status === 'done').length
          return (
            <section key={moment} className={`card px-4 pb-1 pt-3.5 ${now ? 'ring-2 ring-primary/40' : ''}`}>
              <header className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-[15px] font-black text-ink">
                    {momentLabel(moment, type)}
                    {now && <span className="chip bg-primary text-primary-ink">Now</span>}
                  </h3>
                  {momentHint(moment, type) && <p className="text-[12px] font-bold text-ink-3">{momentHint(moment, type)}</p>}
                </div>
                <span className="num text-[12px] font-bold text-ink-3">
                  {doneCount}/{items.length}
                </span>
              </header>
              <ul className="divide-y divide-line">
                {items.map((m) => (
                  <MissionRow key={m.id} mission={m} progress={progress.get(m.id)} onMenu={setMenu} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <MissionMenu mission={menu} type={type} onClose={() => setMenu(null)} />
    </>
  )
}

function MissionMenu({ mission, type, onClose }: { mission: Mission | null; type: DayType; onClose: () => void }) {
  const actions = useActions()
  const toast = useToast()
  if (!mission) return null
  const run = (fn: () => () => void, message: string) => {
    const undo = fn()
    toast(message, { undo })
    onClose()
  }
  return (
    <Sheet open={Boolean(mission)} onClose={onClose} title={mission.title}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {mission.status !== 'doing' && mission.status !== 'done' && (
            <button type="button" className="btn-primary" onClick={() => run(() => actions.setMissionStatus(mission, 'doing'), 'Started. Go.')}>
              Start now
            </button>
          )}
          {mission.status !== 'done' && (
            <button type="button" className="btn-soft" onClick={() => run(() => actions.toggleMission(mission), 'Done ✓')}>
              Mark done
            </button>
          )}
          {mission.status === 'done' && (
            <button type="button" className="btn-soft" onClick={() => run(() => actions.toggleMission(mission), 'Reopened')}>
              Reopen
            </button>
          )}
          {mission.status !== 'skipped' && mission.status !== 'done' && (
            <button type="button" className="btn-soft" onClick={() => run(() => actions.setMissionStatus(mission, 'skipped'), 'Skipped — it rolls into the week')}>
              Skip today
            </button>
          )}
        </div>
        <div>
          <p className="label">Move to</p>
          <div className="flex flex-wrap gap-2">
            {MOMENT_ORDER.filter((m) => m !== mission.moment).map((m) => (
              <button
                key={m}
                type="button"
                className="btn-soft btn-sm"
                onClick={() => run(() => actions.moveMission(mission, { moment: m }), `Moved to ${momentLabel(m, type).toLowerCase()}`)}
              >
                {momentLabel(m, type)}
              </button>
            ))}
            <button
              type="button"
              className="btn-soft btn-sm"
              onClick={() => run(() => actions.moveMission(mission, { day: addDays(mission.day, 1) }), 'Moved to tomorrow')}
            >
              Tomorrow
            </button>
          </div>
        </div>
        <button type="button" className="btn-ghost w-full text-rose" onClick={() => run(() => actions.deleteMission(mission), 'Removed')}>
          Remove from today
        </button>
      </div>
    </Sheet>
  )
}

const AREAS: Area[] = ['hunt', 'prep', 'body', 'class', 'life']
const SIZES: { value: Size; label: string }[] = [
  { value: 'S', label: 'Quick' },
  { value: 'M', label: 'Focus' },
  { value: 'L', label: 'Big block' },
]

export function AddMission({ day, type, defaultMoment }: { day: string; type: DayType; defaultMoment: Moment }) {
  const actions = useActions()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [area, setArea] = useState<Area>('life')
  const [size, setSize] = useState<Size>('M')
  const [moment, setMoment] = useState<Moment>(defaultMoment)

  const save = () => {
    if (!title.trim()) return
    actions.addMission({ title: title.trim(), area, size, moment, day })
    setTitle('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMoment(defaultMoment)
          setOpen(true)
        }}
        className="flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-2 py-3.5 text-[15px] font-extrabold text-ink-3 transition hover:border-ink-3 hover:text-ink-2"
      >
        <Plus className="h-5 w-5" strokeWidth={2.6} /> Add something
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add to today"
        footer={
          <button type="button" className="btn-primary flex-1" onClick={save} disabled={!title.trim()}>
            Add mission
          </button>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div>
            <label className="label" htmlFor="mission-title">
              What’s the mission?
            </label>
            <input
              id="mission-title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Email Priya at Google about the new-grad role"
              maxLength={200}
            />
          </div>
          <div>
            <p className="label">Area</p>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArea(a)}
                  className={`flex items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3 text-[14px] font-extrabold transition ${
                    area === a ? 'bg-surface-3 text-ink ring-2 ring-primary/50' : 'bg-surface-2 text-ink-3'
                  }`}
                >
                  <AreaIcon area={a} size="sm" />
                  {AREA[a].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Size</p>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSize(s.value)}
                  className={`btn-sm flex-1 rounded-xl font-extrabold ${size === s.value ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">When (no clock, just the moment)</p>
            <div className="flex flex-wrap gap-2">
              {MOMENT_ORDER.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoment(m)}
                  className={`btn-sm rounded-xl font-extrabold ${moment === m ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
                >
                  {momentLabel(m, type)}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Sheet>
    </>
  )
}
