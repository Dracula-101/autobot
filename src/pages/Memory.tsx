import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { live, type Memory, type MemoryCategory } from '@core/index.ts'
import { useRows } from '../lib/app'
import { useActions } from '../lib/useActions'
import { PageHeader } from '../components/Shell'
import { useToast } from '../components/Toast'
import { Empty } from '../components/ui'

const CATEGORIES: { key: MemoryCategory; label: string; emoji: string }[] = [
  { key: 'about', label: 'About you', emoji: '🙂' },
  { key: 'goal', label: 'Goals', emoji: '🎯' },
  { key: 'job', label: 'Job hunt', emoji: '💼' },
  { key: 'prep', label: 'Interview prep', emoji: '🧩' },
  { key: 'health', label: 'Health', emoji: '💊' },
  { key: 'schedule', label: 'Schedule', emoji: '🗓️' },
  { key: 'habit', label: 'Habits', emoji: '🔁' },
  { key: 'preference', label: 'Preferences', emoji: '⚙️' },
]

const SOURCE: Record<Memory['source'], string> = {
  user: 'you told me',
  autobot: 'from chat',
  seed: 'from setup',
  interview: 'from the interview',
}

function MemoryItem({ memory }: { memory: Memory }) {
  const actions = useActions()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(memory.content)

  const save = () => {
    setEditing(false)
    const content = text.trim()
    if (content && content !== memory.content) actions.saveMemory({ ...memory, content })
    else setText(memory.content)
  }

  return (
    <li className="group flex items-start gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            autoFocus
            rows={2}
            className="field resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                save()
              }
              if (e.key === 'Escape') {
                setText(memory.content)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="w-full text-left" title="Tap to edit">
            <p className="text-[15px] font-bold leading-snug text-ink">{memory.content}</p>
            <p className="mt-0.5 text-[12px] font-bold text-ink-3">{SOURCE[memory.source]}</p>
          </button>
        )}
      </div>
      <button
        type="button"
        className={`btn-ghost btn-sm h-9 w-9 px-0 ${memory.pinned ? 'text-amber' : ''}`}
        aria-label={memory.pinned ? 'Unpin' : 'Pin as important'}
        onClick={() => actions.saveMemory({ ...memory, pinned: !memory.pinned })}
      >
        {memory.pinned ? <Pin className="h-4 w-4" fill="currentColor" /> : <PinOff className="h-4 w-4" />}
      </button>
      <button
        type="button"
        className="btn-ghost btn-sm h-9 w-9 px-0 text-rose"
        aria-label="Forget this"
        onClick={() => {
          const undo = actions.deleteMemory(memory)
          toast('Forgotten', { undo })
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  )
}

export function MemoryPage() {
  const actions = useActions()
  const memories = live(useRows<Memory>('memories'))
  const [text, setText] = useState('')
  const [category, setCategory] = useState<MemoryCategory>('about')

  const grouped = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        items: memories
          .filter((m) => m.category === c.key)
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated_at ?? '').localeCompare(a.updated_at ?? '')),
      })).filter((g) => g.items.length),
    [memories],
  )

  const add = () => {
    if (!text.trim()) return
    actions.saveMemory({ content: text.trim(), category, source: 'user' })
    setText('')
  }

  return (
    <div className="page">
      <Link to="/me" className="btn-ghost btn-sm -ml-2 mb-1">
        <ArrowLeft className="h-4 w-4" /> You
      </Link>
      <PageHeader
        title="What I know"
        subtitle={`${memories.length} things. Tap any to fix it — I plan and nudge using these.`}
      />

      <form
        className="card space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label className="label" htmlFor="memory-new">
          Teach me something
        </label>
        <input
          id="memory-new"
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Works best at Norlin Library, not the engineering center"
          maxLength={500}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`chip min-h-[32px] px-3 ${category === c.key ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
          <button type="submit" className="btn-primary btn-sm ml-auto" disabled={!text.trim()}>
            <Plus className="h-4 w-4" /> Remember
          </button>
        </div>
      </form>

      <Link
        to="/chat"
        state={{ prefill: 'Let’s do the get-to-know-you interview.' }}
        className="mt-3 flex items-center gap-3 rounded-card bg-violet/12 px-4 py-3 text-[14px] font-extrabold text-ink transition hover:bg-violet/20"
      >
        <MessageCircle className="h-5 w-5 text-violet" />
        <span className="flex-1">Let Autobot interview you — it’ll fill the gaps one question at a time.</span>
      </Link>

      {grouped.length === 0 ? (
        <div className="card mt-6">
          <Empty mood="thinking" title="I don’t know you yet" body="Add a few facts above, or paste your story with Teach in the chat." />
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.key} className="mt-6">
            <h2 className="mb-2 px-1 text-[15px] font-black text-ink">
              <span aria-hidden>{g.emoji}</span> {g.label}
            </h2>
            <ul className="card divide-y divide-line px-4">
              {g.items.map((m) => (
                <MemoryItem key={m.id} memory={m} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
