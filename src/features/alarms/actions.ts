import { db } from '@/lib/db'
import { save, remove } from '@/lib/repo'
import type { Alarm } from '@/lib/types'
import { alarmToEvent, deleteEvent, upsertEvent } from '@/lib/google/calendar'
import { useApp, toast } from '@/store/app'

async function calendarOn() {
  const s = await db.settings.get('settings')
  return Boolean(s?.calendarMirror) && useApp.getState().user?.mode === 'google'
}

/** Later: mirror an alarm to Google Calendar so the phone reminds you when LifeOS is closed. */
export async function mirrorAlarm(a: Alarm) {
  if (!(await calendarOn())) return
  try {
    if (!a.enabled || a.deletedAt) {
      if (a.calendarEventId) {
        await deleteEvent(a.calendarEventId)
        await save('alarms', { id: a.id, calendarEventId: null })
      }
      return
    }
    const id = await upsertEvent(a.calendarEventId, alarmToEvent(a))
    if (id !== a.calendarEventId) await save('alarms', { id: a.id, calendarEventId: id })
  } catch (e) {
    toast(`Calendar mirror failed: ${e instanceof Error ? e.message : e}`)
  }
}

export async function saveAlarm(a: Partial<Alarm>) {
  const rec = await save('alarms', a)
  void mirrorAlarm(rec)
  return rec
}

export async function deleteAlarm(a: Alarm) {
  await remove('alarms', a.id)
  if (a.calendarEventId && (await calendarOn())) deleteEvent(a.calendarEventId).catch(() => undefined)
}

export async function mirrorAllAlarms() {
  const all = (await db.alarms.toArray()).filter((a) => !a.deletedAt)
  for (const a of all) await mirrorAlarm(a)
}
