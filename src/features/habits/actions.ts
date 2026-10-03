import { db } from '@/lib/db'
import { save } from '@/lib/repo'
import { habitLogId, isDone } from '@/lib/habits'
import type { Habit, HabitLog } from '@/lib/types'
import { toast } from '@/store/app'
import { ymd } from '@/lib/utils'

async function getLog(h: Habit, date: string): Promise<HabitLog | undefined> {
  const l = await db.habitLogs.get(habitLogId(h.id, date))
  return l && !l.deletedAt ? l : undefined
}

async function writeLog(h: Habit, date: string, value: number, skipped = false) {
  await save('habitLogs', { id: habitLogId(h.id, date), habitId: h.id, date, value: Math.max(0, value), skipped, deletedAt: null })
}

/** After checking `h`, nudge any habit stacked on it ("after brushing → 10 push-ups"). */
async function stackNudge(h: Habit) {
  const next = (await db.habits.toArray()).filter((x) => !x.deletedAt && !x.archived && x.stackAfterHabitId === h.id)
  if (next.length) toast(`Next up: ${next.map((x) => `${x.icon} ${x.name}`).join(', ')}`)
}

/** One-tap check-in with undo. Check habits toggle; count habits add one. */
export async function checkIn(h: Habit, date = ymd()) {
  const prev = await getLog(h, date)
  const wasDone = isDone(h, prev)
  if (h.type === 'check') {
    await writeLog(h, date, wasDone ? 0 : 1)
  } else {
    await writeLog(h, date, (prev?.skipped ? 0 : prev?.value ?? 0) + 1)
  }
  const after = await getLog(h, date)
  const nowDone = isDone(h, after)
  if (nowDone && !wasDone) {
    toast(`${h.icon} ${h.name} done`, { label: 'Undo', run: () => writeLog(h, date, prev?.value ?? 0, prev?.skipped) })
    stackNudge(h)
  }
}

export async function setCount(h: Habit, date: string, value: number) {
  await writeLog(h, date, value)
}

/** Later: skip / freeze a day (sick day) without breaking the streak. */
export async function toggleSkip(h: Habit, date = ymd()) {
  const prev = await getLog(h, date)
  await writeLog(h, date, 0, !prev?.skipped)
  toast(prev?.skipped ? 'Skip removed' : 'Day skipped — streak is safe')
}
