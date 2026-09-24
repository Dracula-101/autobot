import { WifiOff, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function ConnectBanner() {
  const { supabaseConfigured, user } = useApp()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (supabaseConfigured && user) return null

  const message = !supabaseConfigured
    ? 'Connect Supabase — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env. Progress is saved locally until then.'
    : 'Browsing as guest — sign in to sync across devices and enable miss-day email.'

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-soft/25 bg-amber-glow px-3 py-2.5 text-sm text-amber-soft">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded p-1 hover:bg-black/20"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
