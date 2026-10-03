import { useEffect } from 'react'
import { Timer, X } from '@/components/icons'
import { useRest } from './rest'
import { useNow } from '@/lib/hooks'
import { clock } from '@/lib/utils'
import { playOnce } from '@/lib/audio'
import { notify } from '@/lib/notify'
import { Button, IconButton } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'

/**
 * Floating rest timer ("mini player" card); rings when the rest is over. Mounted in the app shell.
 * Phones: above the navigation bar and the extended FAB. Desktop: bottom centre.
 */
export function RestTimerBar() {
  const { endsAt, total, add, stop } = useRest()
  const now = useNow(250)
  const left = endsAt ? endsAt - now : 0

  useEffect(() => {
    if (endsAt && left <= 0) {
      stop()
      if (left < -10_000) return // ended long ago (e.g. page was closed)
      playOnce('bell', 1)
      navigator.vibrate?.([300, 150, 300])
      if (document.hidden) notify('Rest over', 'Time for your next set 💪', { tag: 'rest', url: '/gym' })
    }
  }, [endsAt, left, stop])

  if (!endsAt || left <= 0) return null
  return (
    <section
      aria-label="Rest timer"
      className="animate-md-snackbar fixed inset-x-4 bottom-[calc(168px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-lg bg-surface-container-high text-on-surface shadow-elevation-3 md:bottom-6"
    >
      <div className="flex items-center gap-2 py-2 pr-2 pl-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Timer filled className="size-6" />
        </span>
        <div className="ml-1 min-w-0 flex-1">
          <div className="text-label-medium text-on-surface-variant">Rest</div>
          <div className="tabular text-title-large">{clock(left)}</div>
        </div>
        <Button variant="ghost" className="px-3" onClick={() => add(-15)}>
          −15
        </Button>
        <Button variant="secondary" className="px-4" onClick={() => add(15)}>
          +15
        </Button>
        <IconButton label="Skip rest" onClick={stop}>
          <X />
        </IconButton>
      </div>
      <div className="px-4 pb-3">
        <Progress value={1 - left / (total * 1000)} />
      </div>
    </section>
  )
}
