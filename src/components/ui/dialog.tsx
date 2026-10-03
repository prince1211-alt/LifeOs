import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from '@/components/icons'
import { cn } from '@/lib/utils'
import { Button } from './button'

/**
 * Material 3 dialog: a modal bottom sheet on phones (drag handle, 28px top corners)
 * and a basic dialog on larger screens (28px corners, surface-container-high).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  icon,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  /** Optional hero icon shown above the title (M3 dialog with icon). */
  icon?: React.ReactNode
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-md-fade absolute inset-0 bg-scrim/40" onClick={onClose} />
      <div
        className={cn(
          'animate-md-sheet sm:animate-md-dialog relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl bg-surface-container-low text-on-surface shadow-elevation-3 [--field-bg:var(--md-surface-container-low)] sm:max-w-[560px] sm:min-w-[320px] sm:rounded-xl sm:bg-surface-container-high sm:[--field-bg:var(--md-surface-container-high)]',
          className,
        )}
      >
        <div className="flex justify-center pt-4 pb-1 sm:hidden" aria-hidden>
          <span className="h-1 w-8 rounded-full bg-on-surface-variant/40" />
        </div>
        <div className={cn('flex items-start gap-3 px-6 pt-3 pb-4 sm:pt-6', icon && 'flex-col items-center text-center')}>
          {icon && <div className="text-[var(--md-secondary)] [&_svg]:size-6">{icon}</div>}
          <h2 className="min-w-0 flex-1 text-headline-small text-on-surface">{title}</h2>
          {!icon && (
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close" className="-mt-1 -mr-3">
              <X />
            </Button>
          )}
        </div>
        <div className="overflow-y-auto px-6 pt-2 pb-4 text-body-medium text-on-surface-variant">
          <div className="text-on-surface">{children}</div>
        </div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Promise-based confirm dialog (M3 basic dialog with text buttons). */
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
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant="ghost" className={state?.danger ? 'text-error' : undefined} onClick={() => close(true)}>
            Confirm
          </Button>
        </>
      }
    >
      <p className="text-body-medium text-on-surface-variant">{state?.text}</p>
    </Dialog>
  )
  return { confirm, node }
}
