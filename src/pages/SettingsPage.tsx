import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Link } from 'react-router-dom'
import type { SportDay } from '../types'
import { LogOut, LogIn } from 'lucide-react'

export function SettingsPage() {
  const {
    profile,
    updateProfile,
    sportDay,
    user,
    signOut,
    supabaseConfigured,
  } = useApp()
  const [name, setName] = useState(profile.display_name || '')
  const [email, setEmail] = useState(profile.reminder_email || '')
  const [saved, setSaved] = useState(false)

  const save = async () => {
    await updateProfile({
      display_name: name.trim(),
      reminder_email: email.trim(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-white/45">Profile & preferences</p>
      </div>

      <section className="card space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-xs text-white/50">Display name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-white/50">Reminder email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs text-white/50">Sport day preference</label>
          <div className="flex gap-2">
            {(['mon', 'sun'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => void updateProfile({ sport_day: d as SportDay })}
                className={[
                  'flex-1 rounded-xl border py-3 text-sm font-semibold capitalize transition',
                  sportDay === d
                    ? 'border-sage/40 bg-sage/10 text-sage'
                    : 'border-ink-border text-white/50',
                ].join(' ')}
              >
                {d === 'mon' ? 'Monday' : 'Sunday'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-ink-muted">
          Timezone locked to America/Denver for “today” and miss-day email.
        </p>
        <button type="button" className="btn-primary w-full" onClick={() => void save()}>
          {saved ? 'Saved ✓' : 'Save profile'}
        </button>
      </section>

      <section className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-white/80">Account</h3>
        {user ? (
          <>
            <p className="text-sm text-white/50">{user.email}</p>
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-white/50">
              {supabaseConfigured
                ? 'Guest mode — sign in to sync.'
                : 'Supabase not connected — local only.'}
            </p>
            <Link to="/auth" className="btn-ghost w-full">
              <LogIn className="h-4 w-4" /> Sign in / Sign up
            </Link>
          </>
        )}
      </section>

      <section className="card p-4 text-[11px] leading-relaxed text-ink-muted">
        <p className="font-medium text-white/40">Hard rules</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Deep work = campus. Home is for sleep, food, wind-down.</li>
          <li>Cut room YouTube — not sleep.</li>
          <li>Every free day: leave the house for one real session.</li>
        </ul>
      </section>
    </div>
  )
}
