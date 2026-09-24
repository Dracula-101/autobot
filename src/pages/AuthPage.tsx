import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { AutobotMascot } from '../components/AutobotMascot'
import { ArrowRight, Loader2 } from 'lucide-react'

type Mode = 'in' | 'up'

export function AuthPage() {
  const { signIn, signUp, supabaseConfigured, profile } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const headline = useMemo(
    () =>
      mode === 'in'
        ? 'Pick up where you left off'
        : 'Give Autobot a home for your week',
    [mode],
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!supabaseConfigured) {
      setError('Cloud sync isn’t connected yet. Continue as guest for now.')
      return
    }
    if (mode === 'up' && name.trim().length < 2) {
      setError('Add a short display name so Autobot knows what to call you.')
      return
    }
    if (password.length < 6) {
      setError('Password needs at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'in') {
        const res = await signIn(email.trim(), password)
        if (res.error) setError(res.error)
        else navigate(profile.onboarded ? '/' : '/onboarding', { replace: true })
      } else {
        const res = await signUp(email.trim(), password, name.trim())
        if (res.error) setError(res.error)
        else {
          setInfo('Account ready. If email confirmation is on, check your inbox — then sign in.')
          setMode('in')
          setPassword('')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-16 h-40 rounded-full bg-sage/10 blur-3xl"
      />

      <div className="relative mb-8 animate-fade-up">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl border border-ink-border/70 bg-ink-card p-2.5 shadow-soft">
            <AutobotMascot mood="idle" size={44} />
          </div>
          <div>
            <p className="eyebrow">Autobot</p>
            <p className="mt-0.5 text-sm text-cream/45">Quiet caretaker for the grind</p>
          </div>
        </div>

        <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-[-0.02em] text-cream">
          {headline}
        </h1>
        <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-cream/45">
          Sync check-ins across devices, or stay local as a guest. Same checklist either way.
        </p>
      </div>

      <div className="relative mb-5 grid grid-cols-2 rounded-2xl border border-ink-border/70 bg-ink-soft p-1">
        {(
          [
            ['in', 'Sign in'],
            ['up', 'Create account'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id)
              setError('')
              setInfo('')
            }}
            className={[
              'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              mode === id
                ? 'bg-ink-raised text-cream shadow-lift'
                : 'text-cream/40 hover:text-cream/70',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {!supabaseConfigured && (
        <div className="relative mb-4 rounded-2xl border border-amber-soft/20 bg-amber-glow px-4 py-3 text-sm leading-relaxed text-amber-soft">
          Cloud keys aren’t on this build yet. Guest mode still works — open Today and keep
          locking in.
        </div>
      )}

      <form
        onSubmit={(e) => void submit(e)}
        className="relative card animate-fade-up space-y-4 p-5"
        style={{ animationDelay: '60ms' }}
      >
        {mode === 'up' && (
          <div>
            <label className="label" htmlFor="auth-name">
              What should Autobot call you?
            </label>
            <input
              id="auth-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name is perfect"
              autoComplete="nickname"
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            className="input"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'up' ? 'At least 6 characters' : 'Your password'}
            minLength={6}
            required
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-soft/25 bg-rose-glow px-3 py-2.5 text-sm text-rose-soft">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-xl border border-sage/25 bg-sage/10 px-3 py-2.5 text-sm text-sage">
            {info}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Working…
            </>
          ) : mode === 'in' ? (
            'Sign in & sync'
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <div className="relative mt-6 space-y-3">
        <Link
          to={profile.onboarded ? '/' : '/onboarding'}
          className="btn-ghost group w-full"
        >
          Continue as guest
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <p className="text-center text-[12px] leading-relaxed text-cream/30">
          Guest stays on this device. Sign in anytime from Settings to sync.
        </p>
      </div>
    </div>
  )
}
