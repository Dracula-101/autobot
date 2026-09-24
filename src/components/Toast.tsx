import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Undo2 } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  undo?: () => void
}

type ToastFn = (message: string, opts?: { undo?: () => void }) => void

const ToastContext = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(0)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback<ToastFn>(
    (message, opts) => {
      const id = ++next.current
      setItems((list) => [...list.slice(-2), { id, message, undo: opts?.undo }])
      setTimeout(() => dismiss(id), opts?.undo ? 5000 : 2800)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md animate-fade-up items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[14px] font-bold text-bg shadow-lift"
          >
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.undo && (
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl px-2 py-1 text-[13px] font-extrabold text-accent hover:bg-white/10"
                onClick={() => {
                  t.undo?.()
                  dismiss(t.id)
                }}
              >
                <Undo2 className="h-4 w-4" /> Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastFn {
  return useContext(ToastContext)
}
