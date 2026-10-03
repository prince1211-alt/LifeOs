import type { Alarm } from '@/lib/types'
import { WEEKDAYS_SHORT } from '@/lib/utils'

function at(base: Date, time: string, dayOffset = 0): number {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, h, m, 0, 0)
  return d.getTime()
}

/** Next time an enabled alarm will ring, or null. */
export function nextFire(a: Alarm, now = Date.now()): number | null {
  if (!a.enabled) return null
  const base = new Date(now)
  for (let i = 0; i <= 7; i++) {
    const t = at(base, a.time, i)
    if (t <= now) continue
    if (!a.repeatDays.length) return t > a.updatedAt ? t : null
    if (a.repeatDays.includes(new Date(t).getDay())) return t
  }
  return null
}

/**
 * Most recent scheduled ring time at or before `now` (checks today and
 * yesterday). Compared against the real clock, so background-tab throttling
 * only delays the ring by seconds rather than skipping it.
 */
export function lastScheduled(a: Alarm, now = Date.now()): number | null {
  if (!a.enabled) return null
  const base = new Date(now)
  for (const off of [0, -1]) {
    const t = at(base, a.time, off)
    if (t > now) continue
    if (a.repeatDays.length && !a.repeatDays.includes(new Date(t).getDay())) continue
    // Alarms created or edited after this slot shouldn't ring for it.
    if (t <= a.updatedAt) continue
    return t
  }
  return null
}

export function nextAlarm(alarms: Alarm[], now = Date.now()) {
  let best: { alarm: Alarm; at: number } | null = null
  for (const a of alarms) {
    const t = nextFire(a, now)
    if (t && (!best || t < best.at)) best = { alarm: a, at: t }
  }
  return best
}

export function describeRepeat(days: number[]) {
  if (!days.length) return 'Once'
  if (days.length === 7) return 'Every day'
  const s = [...days].sort().join()
  if (s === '1,2,3,4,5') return 'Weekdays'
  if (s === '0,6') return 'Weekends'
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => WEEKDAYS_SHORT[d])
    .join(', ')
}
