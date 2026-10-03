// Google Calendar (Later): mirror alarms and time blocks so your phone reminds
// you even when LifeOS is closed.
import { gfetch, GoogleApiError, SCOPES } from './auth'
import type { Alarm, TimeBlock } from '../types'
import { ymd } from '../utils'

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone

interface CalEvent {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  recurrence?: string[]
  reminders: { useDefault: boolean; overrides: { method: 'popup'; minutes: number }[] }
}

const local = (date: string, time: string) => `${date}T${time}:00`

function addMinutes(date: string, time: string, minutes: number) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const dt = new Date(y, mo - 1, d, h, mi + minutes)
  return local(ymd(dt), `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`)
}

export function alarmToEvent(a: Alarm, now = new Date()): CalEvent {
  const [h, m] = a.time.split(':').map(Number)
  const first = new Date(now)
  first.setHours(h, m, 0, 0)
  if (first.getTime() < now.getTime()) first.setDate(first.getDate() + 1)
  const date = ymd(first)
  return {
    summary: `⏰ ${a.label || 'Alarm'}`,
    description: 'Mirrored from LifeOS',
    start: { dateTime: local(date, a.time), timeZone: tz() },
    end: { dateTime: addMinutes(date, a.time, 5), timeZone: tz() },
    recurrence: a.repeatDays.length
      ? [`RRULE:FREQ=WEEKLY;BYDAY=${[...a.repeatDays].sort().map((d) => BYDAY[d]).join(',')}`]
      : undefined,
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
  }
}

export function blockToEvent(b: TimeBlock): CalEvent {
  return {
    summary: b.title,
    description: `LifeOS time block · ${b.category}`,
    start: { dateTime: local(b.date, b.start), timeZone: tz() },
    end: { dateTime: local(b.date, b.end), timeZone: tz() },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 5 }] },
  }
}

/** Create or replace an event; returns its id. */
export async function upsertEvent(existingId: string | null | undefined, ev: CalEvent): Promise<string> {
  if (existingId) {
    try {
      const r = await gfetch(
        `${API}/${existingId}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) },
        SCOPES.calendar,
      )
      return ((await r.json()) as { id: string }).id
    } catch (e) {
      if (!(e instanceof GoogleApiError) || (e.status !== 404 && e.status !== 410)) throw e
    }
  }
  const r = await gfetch(
    API,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) },
    SCOPES.calendar,
  )
  return ((await r.json()) as { id: string }).id
}

export async function deleteEvent(id: string) {
  try {
    await gfetch(`${API}/${id}`, { method: 'DELETE' }, SCOPES.calendar)
  } catch (e) {
    if (!(e instanceof GoogleApiError) || (e.status !== 404 && e.status !== 410)) throw e
  }
}
