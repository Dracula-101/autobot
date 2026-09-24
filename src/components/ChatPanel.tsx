import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUp,
  Brain as BrainIcon,
  Briefcase,
  CheckCircle2,
  Code2,
  GraduationCap,
  RotateCcw,
  Settings2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { formatDate, live, relativeDay, wallClock, type ChatAction, type ChatMessage } from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { api, type ChatMode } from '../lib/api'
import { Markdown } from '../lib/markdown'
import type { SyncRow } from '../lib/sync'
import { Autobot, cheer } from './Autobot'
import { Sheet } from './Sheet'
import { SyncBadge } from './Shell'

const SUGGESTIONS: { label: string; text: string; mode?: ChatMode }[] = [
  { label: 'Plan my day', text: 'Look at today and tell me what order to do things in.' },
  { label: 'I’m stuck in my room', text: 'I’m in my room and can’t get started. Help me get moving.' },
  { label: 'Who do I ask for referrals?', text: 'Help me pick 3 people to ask for referrals this week, and what to say.' },
  { label: 'Quiz me', text: 'Quiz me on a LeetCode pattern I’m weak at — one question at a time.' },
  { label: 'How are my cells?', text: 'How are my power cells looking this week? Be honest — what needs charging?' },
  { label: 'Get to know me', text: 'Let’s do the get-to-know-you interview.', mode: 'interview' },
]

const ACTION_ICON: Record<string, LucideIcon> = {
  memory: BrainIcon,
  mission: CheckCircle2,
  contact: UserPlus,
  job: Briefcase,
  problem: Code2,
  routine: Sparkles,
  settings: Settings2,
  log: TrendingUp,
  class: GraduationCap,
}

const ACTION_LINK: Record<string, string> = {
  memory: '/me/memory',
  mission: '/',
  contact: '/hunt?tab=people',
  job: '/hunt?tab=jobs',
  problem: '/prep',
  routine: '/body',
  settings: '/me',
  log: '/',
}

function ActionChip({ action }: { action: ChatAction }) {
  const kind = action.type.split('.')[0]
  const Icon = ACTION_ICON[kind] ?? Sparkles
  return (
    <Link
      to={ACTION_LINK[kind] ?? '/me/changes'}
      className="inline-flex max-w-full items-center gap-1.5 rounded-xl bg-mint/12 px-2.5 py-1.5 text-[12.5px] font-bold text-ink-2 transition hover:bg-mint/20"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-mint" strokeWidth={2.6} aria-hidden />
      <span className="truncate">{action.label}</span>
    </Link>
  )
}

function dayLabel(iso: string | undefined, today: string): string {
  if (!iso) return 'Today'
  const d = wallClock(new Date(iso)).date
  const rel = relativeDay(d, today)
  return rel === 'today' ? 'Today' : rel === 'yesterday' ? 'Yesterday' : formatDate(d, { weekday: true })
}

function timeLabel(iso?: string): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function ChatPanel({ docked = false, initialInput = '' }: { docked?: boolean; initialInput?: string }) {
  const { store, cloud, user } = useApp()
  const navigate = useNavigate()
  const rows = useRows<ChatMessage>('chat_messages')
  const memories = useRows<SyncRow>('memories')
  const [input, setInput] = useState(initialInput)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<{ text: string; mode: ChatMode; error: string } | null>(null)
  const [mode, setMode] = useState<ChatMode>(() => (localStorage.getItem('autobot:chatmode') as ChatMode) || 'chat')
  const [teachOpen, setTeachOpen] = useState(false)
  const [teachText, setTeachText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const today = wallClock().date

  useEffect(() => {
    localStorage.setItem('autobot:chatmode', mode)
  }, [mode])

  // Replies sort after their question even if a device clock is off.
  const messages = useMemo(() => {
    const list = live(rows)
    const byId = new Map(list.map((m) => [m.id, m]))
    const key = (m: ChatMessage) => {
      const own = m.created_at ?? ''
      const q = (m.meta as { reply_to?: string })?.reply_to
      const asked = q ? byId.get(q)?.created_at : undefined
      return asked && asked > own ? `${asked}~` : own
    }
    return list.sort((a, b) => key(a).localeCompare(key(b)))
  }, [rows])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, busy, failed])

  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const send = async (text: string, sendMode: ChatMode = mode) => {
    const message = text.trim()
    if (!message || busy || !store) return
    setFailed(null)
    setInput('')
    if (sendMode !== mode) setMode(sendMode)
    const id = crypto.randomUUID()
    store.upsert('chat_messages', { id, role: 'user', content: message, actions: [], meta: { mode: sendMode } } as unknown as SyncRow)
    setBusy(true)
    try {
      const { reply } = await api.chat({ id, message, mode: sendMode })
      store.ingest('chat_messages', [reply as unknown as SyncRow])
      if (reply.actions?.some((a) => /^(mission|problem|log|routine)/.test(a.type))) cheer()
    } catch (e) {
      setFailed({ text: message, mode: sendMode, error: e instanceof Error ? e.message : 'Couldn’t reach Autobot.' })
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send(input)
    }
  }

  const empty = messages.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className={`flex items-center gap-3 border-b border-line px-4 ${docked ? 'py-3' : 'py-3.5'}`}>
        <Autobot size={docked ? 40 : 46} mood={busy ? 'thinking' : 'happy'} track={!docked} reactive />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black text-ink">Autobot</p>
          <p className="flex items-center gap-2 text-[12px] font-bold text-ink-3">
            <span>Knows {memories.length} things</span>
            <SyncBadge compact />
          </p>
        </div>
        <button
          type="button"
          className="btn-soft btn-sm"
          onClick={() => setTeachOpen(true)}
          title="Paste anything about yourself and Autobot will remember it"
        >
          <Wand2 className="h-4 w-4" /> Teach
        </button>
        {docked && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => navigate('/chat')} aria-label="Open chat full screen">
            Expand
          </button>
        )}
      </header>

      {mode !== 'chat' && (
        <div className="flex items-center gap-2 border-b border-line bg-violet/10 px-4 py-2 text-[13px] font-bold text-ink-2">
          <Sparkles className="h-4 w-4 text-violet" aria-hidden />
          <span className="flex-1">{mode === 'interview' ? 'Interview mode — your answers become memories.' : 'Teach mode'}</span>
          <button type="button" className="btn-ghost btn-sm min-h-[30px]" onClick={() => setMode('chat')}>
            <X className="h-4 w-4" /> End
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {!cloud || !user ? (
          <div className="mx-auto max-w-sm py-10 text-center">
            <Autobot size={72} mood="sleepy" className="mx-auto" />
            <p className="mt-3 text-[16px] font-extrabold text-ink">My brain lives in the cloud</p>
            <p className="mt-1 text-[14px] font-semibold text-ink-3">
              Sign in and I’ll remember our chats on your phone and laptop.
            </p>
          </div>
        ) : empty ? (
          <div className="mx-auto max-w-sm py-8 text-center">
            <Autobot size={80} mood="wink" track className="mx-auto" />
            <p className="mt-3 text-[18px] font-black text-ink">Hey, I’m Autobot.</p>
            <p className="mt-1 text-[14px] font-semibold text-ink-3">
              Tell me what you did, ask me to plan, or let me quiz you. Everything we say is saved and synced.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {messages.map((m, i) => {
              const prev = messages[i - 1]
              const newDay = !prev || dayLabel(prev.created_at, today) !== dayLabel(m.created_at, today)
              const mine = m.role === 'user'
              const error = Boolean((m.meta as { error?: unknown })?.error)
              const brief = (m.meta as { kind?: string })?.kind === 'brief'
              return (
                <li key={m.id}>
                  {newDay && (
                    <p className="mb-3 mt-1 text-center text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-3">
                      {dayLabel(m.created_at, today)}
                    </p>
                  )}
                  <div className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
                    {!mine && <Autobot size={28} mood={error ? 'worried' : 'happy'} float={false} className="mb-1" />}
                    <div className={`flex max-w-[85%] flex-col gap-1.5 ${mine ? 'items-end' : 'items-start'}`}>
                      {brief && <span className="px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent">Today’s note</span>}
                      <div
                        className={[
                          'rounded-[20px] px-3.5 py-2.5 text-[15px] font-semibold leading-relaxed',
                          mine
                            ? 'rounded-br-md bg-primary text-primary-ink'
                            : error
                              ? 'rounded-bl-md bg-rose/12 text-ink'
                              : 'rounded-bl-md bg-surface text-ink shadow-card',
                        ].join(' ')}
                        title={timeLabel(m.created_at)}
                      >
                        {mine ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : <Markdown text={m.content} />}
                      </div>
                      {!mine && m.actions?.length > 0 && (
                        <div className="flex max-w-full flex-wrap gap-1.5">
                          {m.actions.map((a, j) => (
                            <ActionChip key={j} action={a} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {busy && (
          <div className="mt-3 flex items-end gap-2">
            <Autobot size={28} mood="thinking" float={false} className="mb-1" />
            <div className="flex items-center gap-1 rounded-[20px] rounded-bl-md bg-surface px-4 py-3.5 shadow-card" aria-label="Autobot is thinking">
              {[0, 1, 2].map((d) => (
                <span key={d} className="typing-dot h-2 w-2 rounded-full bg-ink-3" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {failed && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-rose/12 px-3.5 py-2.5 text-[13px] font-bold text-ink-2">
            <span className="min-w-0">{failed.error}</span>
            <button type="button" className="btn-soft btn-sm shrink-0" onClick={() => void send(failed.text, failed.mode)}>
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {cloud && user && (
        <div
          className={`border-t border-line bg-bg/70 px-3 pt-2.5 backdrop-blur-xl ${
            docked ? 'pb-3' : 'pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-4'
          }`}
        >
          {!busy && !input && (
            <div className="no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => void send(s.text, s.mode ?? mode)}
                  className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-[13px] font-extrabold text-ink-2 shadow-card transition hover:text-ink"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <textarea
              ref={box}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={mode === 'interview' ? 'Answer Autobot…' : 'Tell Autobot anything…'}
              className="field min-h-[48px] resize-none py-3"
              aria-label="Message Autobot"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="btn-primary h-12 w-12 shrink-0 rounded-2xl px-0"
              aria-label="Send"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={3} />
            </button>
          </form>
        </div>
      )}

      <Sheet
        open={teachOpen}
        onClose={() => setTeachOpen(false)}
        title="Teach Autobot about you"
        footer={
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={!teachText.trim() || busy}
            onClick={() => {
              setTeachOpen(false)
              void send(teachText, 'teach').then(() => setMode('chat'))
              setTeachText('')
            }}
          >
            <Wand2 className="h-4 w-4" /> Remember all of this
          </button>
        }
      >
        <p className="mb-3 text-[14px] font-semibold text-ink-3">
          Paste anything — your situation, goals, resume summary, a note about someone. Autobot splits it into memories you
          can edit later.
        </p>
        <textarea
          value={teachText}
          onChange={(e) => setTeachText(e.target.value)}
          rows={9}
          className="field resize-none"
          placeholder="I’m a 2nd-year MS CS student… I want to…"
        />
      </Sheet>
    </div>
  )
}
