import { useEffect } from 'react'
import { Timer, X } from '@/components/icons'
import { useRest } from './rest'
import { useNow } from '@/lib/hooks'
import { clock } from '@/lib/utils'
import { playOnce } from '@/lib/audio'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'

/** Floating rest timer; rings when the rest is over. Mounted in the app shell. */
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
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-2xl border bg-card p-3 shadow-xl md:bottom-6">
      <div className="flex items-center gap-3">
        <Timer className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted-foreground">Rest</span>
            <span className="tabular text-xl font-bold">{clock(left)}</span>
          </div>
          <Progress value={1 - left / (total * 1000)} className="mt-1" />
        </div>
        <Button size="sm" variant="outline" onClick={() => add(-15)}>
          −15
        </Button>
        <Button size="sm" variant="outline" onClick={() => add(15)}>
          +15
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={stop} aria-label="Skip rest">
          <X />
        </Button>
      </div>
    </div>
  )
}
