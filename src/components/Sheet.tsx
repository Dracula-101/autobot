import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({ open, onClose, title, children, footer }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('input, textarea, select, button[data-autofocus]')
      ;(first ?? panel.current)?.focus()
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-lift outline-none sm:max-w-lg sm:animate-fade-up sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-2 sm:hidden" aria-hidden />
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm -mr-2 h-9 w-9 px-0" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <footer className="flex gap-2 border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
