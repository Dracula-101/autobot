import { useMemo } from 'react'
import { useApp } from './app'
import { createActions, type Actions } from './actions'

export function useActions(): Actions {
  const { store, settings } = useApp()
  if (!store) throw new Error('useActions needs a signed-in store')
  return useMemo(() => createActions(store, settings), [store, settings])
}
