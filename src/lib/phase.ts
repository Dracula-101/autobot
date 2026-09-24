import { useEffect } from 'react'
import { skyPhase, type Phase } from '@core/index.ts'
import { useApp } from './app'
import { useNow } from './clock'

export function usePhase(): Phase {
  const { settings } = useApp()
  const now = useNow(60_000)
  if (settings.theme === 'day') return 'day'
  if (settings.theme === 'night') return 'night'
  return skyPhase(now)
}

/** Keeps <html data-phase> and the browser/status-bar color in sync with the sky. */
export function usePhaseSync(): Phase {
  const phase = usePhase()
  useEffect(() => {
    const root = document.documentElement
    root.dataset.phase = phase
    const rgb = getComputedStyle(root).getPropertyValue('--bg').trim().split(/\s+/).join(',')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${rgb})`)
  }, [phase])
  return phase
}
