import { useSyncExternalStore } from 'react'

/** True while the media query matches (e.g. '(min-width: 1280px)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
  )
}
