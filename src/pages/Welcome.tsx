import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bell, Brain, CalendarHeart, Loader2 } from 'lucide-react'
import { live, type Memory } from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { usePhaseSync } from '../lib/phase'
import { api } from '../lib/api'
import { useActions } from '../lib/useActions'
import { Autobot } from '../components/Autobot'
import { Sky } from '../components/Sky'
import { NotificationSettings } from '../components/Notifications'

export function WelcomePage() {
  const phase = usePhaseSync()
  const navigate = useNavigate()
  const { name, updateSettings, cloud } = useApp()
  const actions = useActions()
  const memories = live(useRows<Memory>('memories'))
  const [step, setStep] = useState(0)
  const [story, setStory] = useState('')
  const [busy, setBusy] = useState(false)

  const finish = () => {
    updateSettings({ onboarded: true })
    navigate('/', { replace: true })
  }

  const teach = async () => {
    if (!story.trim()) return setStep(2)
    setBusy(true)
    try {
      if (cloud) await api.chat({ id: crypto.randomUUID(), message: story.trim(), mode: 'teach' })
      else actions.saveMemory({ content: story.trim().slice(0, 2000), category: 'about', source: 'user' })
    } catch {
      actions.saveMemory({ content: story.trim().slice(0, 2000), category: 'about', source: 'user' })
    }
    setBusy(false)
    setStep(2)
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Sky phase={phase} className="absolute inset-0 -z-10" />
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-ink' : 'w-3 bg-ink/25'}`} />
          ))}
        </div>

        {step === 0 && (
          <div key="0" className="animate-fade-up text-center">
            <Autobot size={128} mood="happy" track reactive className="mx-auto" />
            <h1 className="mt-4 text-[30px] font-black tracking-[-0.025em] text-ink">Hey {name}, I’m in.</h1>
            <p className="mt-2 text-[15px] font-semibold text-ink-2">Here’s how I’ll help you lock in this semester:</p>
            <ul className="card mt-5 space-y-3 p-5 text-left">
              {[
                { icon: CalendarHeart, text: 'I plan each day around your battery — no quotas, no clock times, just the moments of your day.' },
                { icon: Brain, text: 'I remember what matters about you, and every change we make is saved on all your devices.' },
                { icon: Bell, text: 'I tap you for pills, serum, classes, follow-ups, and bedtime — and nudge when a day stalls.' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={2.4} />
                  <span className="text-[14px] font-bold text-ink">{text}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => setStep(1)}>
              Let’s go <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div key="1" className="animate-fade-up">
            <div className="flex items-center gap-3">
              <Autobot size={72} mood={memories.length ? 'proud' : 'thinking'} />
              <h1 className="text-[24px] font-black leading-tight tracking-[-0.02em] text-ink">
                {memories.length ? 'Here’s what I already know' : 'Tell me about you'}
              </h1>
            </div>
            {memories.length > 0 ? (
              <>
                <ul className="card mt-4 max-h-[42dvh] space-y-2 overflow-y-auto p-4">
                  {memories.map((m) => (
                    <li key={m.id} className="text-[14px] font-bold leading-snug text-ink">
                      • {m.content}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[13px] font-semibold text-ink-3">Wrong or outdated? Fix anything later in You → What I know.</p>
              </>
            ) : (
              <p className="mt-3 text-[14px] font-semibold text-ink-2">
                Paste anything: your program, goals, schedule, struggles. I’ll split it into things I remember.
              </p>
            )}
            <label className="label mt-4" htmlFor="story">
              {memories.length ? 'Anything to add?' : 'Your story'}
            </label>
            <textarea
              id="story"
              rows={5}
              className="field resize-none"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="I focus best at the library. My Fridays are…"
            />
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => void teach()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {story.trim() ? 'Remember this' : 'Looks right'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div key="2" className="animate-fade-up">
            <div className="flex items-center gap-3">
              <Autobot size={72} mood="wink" />
              <h1 className="text-[24px] font-black leading-tight tracking-[-0.02em] text-ink">Let me tap you on the shoulder</h1>
            </div>
            <div className="card mt-4 p-4">
              <NotificationSettings />
            </div>
            <button type="button" className="btn-primary mt-4 w-full" onClick={finish}>
              Start today <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
