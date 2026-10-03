import { X } from '@/components/icons'
import { useApp } from '@/store/app'

/** Material 3 snackbar: bottom-left on desktop; on phones above the navigation bar, or above the FAB when a page has one. */
export function Toaster() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 transition-[bottom] duration-200 in-[body:has([data-page-fab])]:max-md:bottom-[calc(160px+env(safe-area-inset-bottom))] md:right-auto md:bottom-6 md:left-6 md:items-start md:px-0"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-md-snackbar pointer-events-auto flex min-h-12 w-full max-w-[560px] items-center gap-2 rounded-xs bg-inverse-surface py-1 pr-1 pl-4 text-body-medium text-inverse-on-surface shadow-elevation-3 md:min-w-[344px]"
        >
          <span className="flex-1 py-2">{t.text}</span>
          {t.action && (
            <button
              className="state-layer h-10 rounded-full px-3 text-label-large text-inverse-primary"
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="state-layer flex h-10 w-10 items-center justify-center rounded-full">
            <X className="size-5" />
          </button>
        </div>
      ))}
    </div>
  )
}
