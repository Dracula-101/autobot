import { useState } from 'react'
import { Sparkles, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function CheckInCTA() {
  const { today, selectedDate, isCheckedIn, checkInToday, checkins } = useApp()
  const [busy, setBusy] = useState(false)
  const viewingToday = selectedDate === today
  const done = isCheckedIn(today)

  if (!viewingToday) return null

  const handle = async () => {
    if (done || busy) return
    setBusy(true)
    try {
      await checkInToday()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2">
      <div className="mx-auto max-w-lg">
        {done ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-sage/30 bg-ink-card/95 px-4 py-3 shadow-card backdrop-blur-md">
            <CheckCircle2 className="h-5 w-5 text-sage" />
            <div className="text-sm">
              <span className="font-semibold text-sage">Checked in</span>
              <span className="ml-2 text-white/40">
                {checkins[today]?.checked_in_at
                  ? new Date(checkins[today].checked_in_at).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : ''}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handle()}
            disabled={busy}
            className="btn-primary w-full shadow-[0_8px_32px_rgba(125,206,160,0.25)]"
          >
            <Sparkles className="h-5 w-5" />
            {busy ? 'Checking in…' : 'Check in for today'}
          </button>
        )}
      </div>
    </div>
  )
}
