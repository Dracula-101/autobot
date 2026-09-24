import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useApp } from '../lib/app'
import { usePhaseSync } from '../lib/phase'
import { Autobot } from '../components/Autobot'
import { Sky } from '../components/Sky'
import { Segmented } from '../components/ui'

export function AuthPage() {
  const phase = usePhaseSync()
  const { signIn, signUp, cloud } = useApp()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    setBusy(true)
    if (mode === 'in') {
      const err = await signIn(email.trim(), password)
      if (err) setError(err === 'Invalid login credentials' ? 'That email and password don’t match.' : err)
    } else {
      const res = await signUp(email.trim(), password, name.trim() || email.split('@')[0])
      if (res.error) setError(res.error)
      else if (res.confirm) {
        setInfo('Check your email and tap the confirmation link, then sign in here.')
        setMode('in')
      }
    }
    setBusy(false)
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Sky phase={phase} className="absolute inset-0 -z-10" />
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center text-center">
          <Autobot size={120} mood="wink" track />
          <h1 className="mt-4 text-[30px] font-black tracking-[-0.025em] text-ink">Hey, I’m Autobot.</h1>
          <p className="mt-1 text-[15px] font-semibold text-ink-2">
            Your robot friend for the job hunt, LeetCode, and taking care of yourself. Sign in on your phone and laptop — I
            keep both in sync.
          </p>
        </div>

        {!cloud ? (
          <p className="card mt-8 p-4 text-[14px] font-semibold text-ink-2">This build isn’t connected to the cloud.</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="card mt-8 space-y-4 p-5">
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m)
                setError(null)
              }}
              options={[
                { value: 'in', label: 'Sign in' },
                { value: 'up', label: 'Create account' },
              ]}
            />
            {mode === 'up' && (
              <div>
                <label className="label" htmlFor="auth-name">
                  What should I call you?
                </label>
                <input id="auth-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Pratik" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              />
            </div>
            {error && <p className="rounded-2xl bg-rose/12 px-3 py-2.5 text-[14px] font-bold text-rose">{error}</p>}
            {info && <p className="rounded-2xl bg-mint/15 px-3 py-2.5 text-[14px] font-bold text-ink">{info}</p>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
