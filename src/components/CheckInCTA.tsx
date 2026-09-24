import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { AutobotMascot } from './AutobotMascot'

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
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-sage/30 bg-ink-card/95 px-4 py-3 shadow-card backdrop-blur-md">
            <AutobotMascot mood="happy" size={28} />
            <div className="text-sm">
              <span className="font-semibold text-sage">Checked in. Proud of you.</span>
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
            className="btn-primary w-full shadow-glow"
          >
            <AutobotMascot mood="nudge" size={26} className="shrink-0" />
            {busy ? 'One sec…' : 'Check in for today'}
          </button>
        )}
      </div>
    </div>
  )
}
