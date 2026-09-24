import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { SportDay } from '../types'
import { AutobotMascot } from '../components/AutobotMascot'

export function OnboardingPage() {
  const { updateProfile, profile } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(profile.display_name || 'Pratik Pujari')
  const [email, setEmail] = useState(profile.reminder_email || '')
  const [sport, setSport] = useState<SportDay>(
    (profile.sport_day as SportDay) || 'mon',
  )
  const [step, setStep] = useState(0)

  const finish = async () => {
    await updateProfile({
      display_name: name.trim() || 'Pratik',
      reminder_email: email.trim(),
      sport_day: sport,
      timezone: 'America/Denver',
      onboarded: true,
    })
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-1">
        <AutobotMascot mood="happy" size={48} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sage">
        Autobot
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Let’s set up your day</h1>
      <p className="mt-2 text-sm text-white/45">
        I’ll look after the checklist — Job hunt → LeetCode → Fitness. Deep work on campus.
      </p>

      <div className="mt-8 card space-y-5 p-5">
        {step === 0 && (
          <>
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Display name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/50">
                Reminder email
              </label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@colorado.edu"
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Used for miss-day email via GitHub Actions (stored in profile).
              </p>
            </div>
            <button type="button" className="btn-primary w-full" onClick={() => setStep(1)}>
              Continue
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <p className="mb-3 text-sm text-white/70">
                Which day is sport with your partner this week?
              </p>
              <div className="flex gap-2">
                {(['mon', 'sun'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSport(d)}
                    className={[
                      'flex-1 rounded-xl border py-4 text-sm font-semibold capitalize transition',
                      sport === d
                        ? 'border-sage/40 bg-sage/10 text-sage'
                        : 'border-ink-border text-white/50',
                    ].join(' ')}
                  >
                    {d === 'mon' ? 'Monday' : 'Sunday'}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
                The other day becomes light campus + solo movement. Partner can’t do
                Wed/Sat.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                type="button"
                className="btn-primary flex-[2]"
                onClick={() => void finish()}
              >
                Meet Autobot
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
