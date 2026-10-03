import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border bg-card shadow-xl sm:max-w-lg sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-5 py-3 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function useConfirm() {
  const [state, setState] = React.useState<{ text: string; resolve: (v: boolean) => void; danger?: boolean } | null>(null)
  const confirm = React.useCallback(
    (text: string, danger = true) => new Promise<boolean>((resolve) => setState({ text, resolve, danger })),
    [],
  )
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  const node = (
    <Dialog
      open={Boolean(state)}
      onClose={() => close(false)}
      title="Are you sure?"
      footer={
        <>
          <button className="h-9 rounded-md px-4 text-sm hover:bg-muted" onClick={() => close(false)}>
            Cancel
          </button>
          <button
            className={cn(
              'h-9 rounded-md px-4 text-sm font-medium text-white',
              state?.danger ? 'bg-destructive' : 'bg-primary',
            )}
            onClick={() => close(true)}
          >
            Confirm
          </button>
        </>
      }
    >
      <p className="text-sm">{state?.text}</p>
    </Dialog>
  )
  return { confirm, node }
}
