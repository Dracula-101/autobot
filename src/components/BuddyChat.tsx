import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { askBuddy, geminiConfigured, type ChatMsg } from '../lib/gemini'
import { buddyBrief } from '../lib/schedule'
import { useApp } from '../context/AppContext'
import { dayKeyOf, todayKey } from '../lib/dates'
import { tasksForDay } from '../data/tasks'
import { AutobotMascot } from './AutobotMascot'

export function BuddyChat() {
  const { sportDay, isTaskDone, toggleTask, profile, selectedDate } = useApp()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ role: 'model', text: buddyBrief() }])
  const bottom = useRef<HTMLDivElement>(null)
  const ready = geminiConfigured()

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, open])

  const send = async () => {
    const text = input.trim()
    if (!text || busy || !ready) return
    setInput('')
    const next: ChatMsg[] = [...msgs, { role: 'user', text }]
    setMsgs(next)
    setBusy(true)
    try {
      const day = dayKeyOf(selectedDate)
      const now = selectedDate === todayKey() ? new Date() : undefined
      const tasks = tasksForDay(day, sportDay, { now, mode: 'full' })
      const done = tasks.filter((t) => isTaskDone(selectedDate, t.id)).map((t) => t.label)
      const openTasks = tasks.filter((t) => !isTaskDone(selectedDate, t.id)).map((t) => t.label)
      const ctx = [
        `Name: ${profile.display_name || 'friend'}`,
        `Date: ${selectedDate} (${day})`,
        `Brief: ${buddyBrief()}`,
        `Still open: ${openTasks.slice(0, 12).join('; ') || 'none'}`,
        `Done: ${done.slice(0, 12).join('; ') || 'none'}`,
      ].join('\n')

      let reply = await askBuddy(next.slice(-8), ctx)
      const action = reply.match(/ACTION:(done|missed):([^\n]+)/i)
      if (action) {
        const hint = action[2].trim().toLowerCase()
        const match = tasks.find((t) => t.label.toLowerCase().includes(hint.slice(0, 28)))
        if (match) {
          const isDone = isTaskDone(selectedDate, match.id)
          if (action[1].toLowerCase() === 'done' && !isDone) await toggleTask(selectedDate, match.id)
          if (action[1].toLowerCase() === 'missed' && isDone) await toggleTask(selectedDate, match.id)
        }
        reply = reply.replace(/ACTION:(done|missed):[^\n]+\n?/i, '').trim()
      }
      setMsgs((m) => [...m, { role: 'model', text: reply || '…' }])
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: 'model', text: e instanceof Error ? e.message : 'Couldn’t reach Gemini.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-ink-border/80 bg-ink-card px-3.5 py-2.5 text-sm font-semibold text-cream shadow-lift hover:border-cream/25 md:bottom-8 md:right-8 lg:right-[max(2rem,calc((100vw-1520px)/2+2rem))]"
      >
        <AutobotMascot mood="nudge" size={22} />
        Chat
        <MessageCircle className="h-4 w-4 text-cream/40" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="flex max-h-[min(720px,90dvh)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-ink-border bg-ink shadow-lift">
            <header className="flex items-center justify-between border-b border-ink-border/70 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <AutobotMascot mood="happy" size={32} />
                <div>
                  <p className="text-sm font-semibold text-cream">Autobot</p>
                  <p className="text-[11px] text-cream/40">
                    {ready ? 'Gemini buddy · Denver time' : 'Set VITE_GEMINI_API_KEY to enable'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl p-2 text-cream/40 hover:bg-ink-raised hover:text-cream"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={[
                    'max-w-[85%] min-w-0 whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed [overflow-wrap:anywhere]',
                    m.role === 'user' ? 'ml-auto bg-cream text-ink' : 'bg-ink-soft text-cream/85',
                  ].join(' ')}
                >
                  {m.text}
                </div>
              ))}
              <div ref={bottom} />
            </div>

            <form
              className="flex gap-2 border-t border-ink-border/70 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <input
                className="input flex-1 py-3"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={ready ? 'Ask me anything…' : 'Gemini key missing on this build'}
                disabled={!ready || busy}
              />
              <button type="submit" className="btn-primary px-4" disabled={!ready || busy}>
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
