import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { SportDay } from '../types'
import { AutobotMascot } from '../components/AutobotMascot'

export function OnboardingPage() {
  const { updateProfile, profile } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(profile.display_name || '')
  const [email, setEmail] = useState(profile.reminder_email || '')
  const [sport, setSport] = useState<SportDay>((profile.sport_day as SportDay) || 'mon')
  const [step, setStep] = useState(0)

  const finish = async () => {
    await updateProfile({
      display_name: name.trim() || 'friend',
      reminder_email: email.trim(),
      sport_day: sport,
      timezone: 'America/Denver',
      onboarded: true,
    })
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-6">
        <div className="mb-4 inline-flex rounded-2xl border border-ink-border/70 bg-ink-card p-2.5 shadow-soft">
          <AutobotMascot mood="happy" size={48} />
        </div>
        <p className="eyebrow">Quick setup</p>
        <h1 className="mt-2 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-cream">
          {step === 0 ? 'Who am I looking after?' : 'When’s racket day?'}
        </h1>
        <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-cream/45">
          {step === 0
            ? 'Just a name and where miss-day nudges should land. Takes under a minute.'
            : 'Partner can only do Sun or Mon — pick the usual one so Autobot schedules around it.'}
        </p>
      </div>

      <div className="card space-y-5 p-5">
        {step === 0 ? (
          <>
            <div>
              <label className="label" htmlFor="ob-name">
                Display name
              </label>
              <input
                id="ob-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What Autobot should call you"
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="ob-email">
                Reminder email
              </label>
              <input
                id="ob-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@colorado.edu"
              />
              <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                Used only for miss-day email if you wire SMTP later.
              </p>
            </div>
            <button type="button" className="btn-primary w-full" onClick={() => setStep(1)}>
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              {(['mon', 'sun'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSport(d)}
                  className={[
                    'flex-1 rounded-2xl border py-5 text-sm font-semibold transition',
                    sport === d
                      ? 'border-sage/40 bg-sage/10 text-sage shadow-glow'
                      : 'border-ink-border text-cream/45 hover:border-ink-border hover:text-cream/70',
                  ].join(' ')}
                >
                  {d === 'mon' ? 'Monday' : 'Sunday'}
                </button>
              ))}
            </div>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Wed and Sat stay off the racket calendar. The other free day becomes light campus +
              solo movement.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="btn-primary flex-[2]" onClick={() => void finish()}>
                Meet Autobot
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
