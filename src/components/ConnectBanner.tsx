import { Link } from 'react-router-dom'
import { CloudOff, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function ConnectBanner() {
  const { supabaseConfigured, user } = useApp()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (supabaseConfigured && user) return null

  const guest = Boolean(supabaseConfigured)

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-ink-border/70 bg-ink-soft/80 px-3.5 py-3">
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-soft" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-cream/70">
          {guest
            ? 'You’re on this device only. Sync when you want Autobot on your phone too.'
            : 'Cloud isn’t wired yet — progress stays on this device for now.'}
        </p>
        {guest && (
          <Link
            to="/auth"
            className="mt-1.5 inline-flex text-[12px] font-semibold text-sage hover:text-sage/80"
          >
            Sign in to sync →
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-lg p-1 text-cream/30 hover:bg-ink-raised hover:text-cream/60"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
