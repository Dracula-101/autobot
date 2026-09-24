import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Link } from 'react-router-dom'
import { AutobotMascot } from '../components/AutobotMascot'

export function AuthPage() {
  const { signIn, signUp, supabaseConfigured } = useApp()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('Pratik Pujari')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'in') {
        const res = await signIn(email, password)
        if (res.error) setError(res.error)
      } else {
        const res = await signUp(email, password, name)
        if (res.error) setError(res.error)
        else setInfo('Account created. Check your email if confirmation is required, then sign in.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 flex justify-center">
          <AutobotMascot mood="idle" size={56} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sage">
          Autobot
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {mode === 'in' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Your cute caretaker for the Mon–Sun grind. One account is enough.
        </p>
      </div>

      {!supabaseConfigured && (
        <div className="mb-4 rounded-xl border border-amber-soft/25 bg-amber-glow px-3 py-2.5 text-sm text-amber-soft">
          Supabase keys missing — you can still use the app in guest mode via{' '}
          <Link to="/onboarding" className="underline">
            onboarding
          </Link>
          .
        </div>
      )}

      <form onSubmit={(e) => void submit(e)} className="card space-y-4 p-5">
        {mode === 'up' && (
          <div>
            <label className="mb-1.5 block text-xs text-white/50">Display name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs text-white/50">Email</label>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-white/50">Password</label>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <p className="text-sm text-rose-soft">{error}</p>}
        {info && <p className="text-sm text-sage">{info}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !supabaseConfigured}>
          {busy ? '…' : mode === 'in' ? 'Sign in' : 'Sign up'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/40">
        {mode === 'in' ? (
          <>
            No account?{' '}
            <button
              type="button"
              className="text-sage hover:underline"
              onClick={() => setMode('up')}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Have an account?{' '}
            <button
              type="button"
              className="text-sage hover:underline"
              onClick={() => setMode('in')}
            >
              Sign in
            </button>
          </>
        )}
      </p>

      <p className="mt-6 text-center">
        <Link to="/onboarding" className="text-sm text-white/35 hover:text-white/60">
          Continue as guest (local only) →
        </Link>
      </p>
    </div>
  )
}
