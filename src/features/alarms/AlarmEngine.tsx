import { useEffect, useRef } from 'react'
import { db } from '@/lib/db'
import { useApp } from '@/store/app'
import { playAlarmSound, playOnce, stopAlarmSound } from '@/lib/audio'
import { notificationPermission, notify, setWakeLock } from '@/lib/notify'
import { save } from '@/lib/repo'
import { isDone, isDueOn, habitLogId } from '@/lib/habits'
import { formatTime, ymd } from '@/lib/utils'
import { lastScheduled, nextAlarm } from './schedule'
import type { Alarm } from '@/lib/types'
import { isNative, requestReschedule } from '@/lib/native/platform'

const GRACE_MS = 10 * 60_000
const FIRED_KEY = 'lifeos-fired'
const SNOOZE_KEY = 'lifeos-snooze'

function readMap(key: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}
function writeMap(key: string, m: Record<string, number>) {
  const cutoff = Date.now() - 3 * 86_400_000
  for (const k of Object.keys(m)) if (m[k] < cutoff) delete m[k]
  try {
    localStorage.setItem(key, JSON.stringify(m))
  } catch {
    /* storage full / blocked */
  }
}

/** Pending snoozes: alarm id → time it should ring again. */
export function getSnoozes(): Record<string, number> {
  return readMap(SNOOZE_KEY)
}

/** Mark a key as fired; returns false if it already fired. */
function once(key: string, at: number): boolean {
  const fired = readMap(FIRED_KEY)
  if (fired[key]) return false
  fired[key] = at
  writeMap(FIRED_KEY, fired)
  return true
}

/**
 * Record that the current occurrence of an alarm (or its snooze) was already handled,
 * e.g. from the Android notification, so the in-app engine doesn't ring it again.
 */
export function markAlarmHandled(a: Alarm, now = Date.now()) {
  const t = lastScheduled(a, now)
  if (t) once(`alarm:${a.id}:${t}`, now)
  const m = readMap(SNOOZE_KEY)
  if (m[a.id] && m[a.id] <= now + 1000) {
    delete m[a.id]
    writeMap(SNOOZE_KEY, m)
  }
}

export function ring(a: Alarm) {
  const app = useApp.getState()
  app.setRinging({
    kind: 'alarm',
    alarmId: a.id,
    label: a.label || 'Alarm',
    sound: a.sound,
    volume: a.volume,
    snoozeMinutes: a.snoozeMinutes || 5,
    challenge: Boolean(a.challenge),
    gradual: Boolean(a.gradual),
    firedAt: Date.now(),
  })
  playAlarmSound(a.sound, a.volume, a.gradual)
  navigator.vibrate?.([500, 300, 500, 300, 500])
  notify(`⏰ ${a.label || 'Alarm'}`, `It's ${formatTime(a.time, '12')}`, { tag: `alarm-${a.id}`, sticky: true, url: '/alarms' })
}

export function snooze(alarmId: string, minutes: number) {
  const m = readMap(SNOOZE_KEY)
  m[alarmId] = Date.now() + minutes * 60_000
  writeMap(SNOOZE_KEY, m)
  stopAlarmSound()
  useApp.getState().setRinging(null)
  requestReschedule()
}

export async function dismiss(alarmId: string) {
  const m = readMap(SNOOZE_KEY)
  delete m[alarmId]
  writeMap(SNOOZE_KEY, m)
  stopAlarmSound()
  useApp.getState().setRinging(null)
  const a = await db.alarms.get(alarmId)
  if (a && !a.repeatDays.length && a.enabled) await save('alarms', { id: a.id, enabled: false })
  requestReschedule()
}

/**
 * Checks every few seconds against the real clock: alarms, snoozes,
 * task reminders and habit reminders. Mounted once in the app shell.
 */
export function AlarmEngine() {
  const busy = useRef(false)

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches

    const tick = async () => {
      if (busy.current) return
      busy.current = true
      try {
        const now = Date.now()
        const [alarms, settings] = await Promise.all([db.alarms.toArray(), db.settings.get('settings')])
        const live = alarms.filter((a) => !a.deletedAt)
        const ringing = useApp.getState().ringing

        // In the Android app, scheduled system notifications ring alarms and snoozes
        // (and hand over to the ring screen when LifeOS is open).
        const nativeOwns = isNative && notificationPermission() === 'granted'

        // Alarms
        if (!ringing && !nativeOwns) {
          for (const a of live) {
            const t = lastScheduled(a, now)
            if (t && now - t < GRACE_MS && once(`alarm:${a.id}:${t}`, now)) {
              ring(a)
              break
            }
          }
        }
        // Snoozed alarms
        if (!useApp.getState().ringing && !nativeOwns) {
          const snoozes = readMap(SNOOZE_KEY)
          for (const [id, until] of Object.entries(snoozes)) {
            if (until <= now) {
              delete snoozes[id]
              writeMap(SNOOZE_KEY, snoozes)
              const a = live.find((x) => x.id === id)
              if (a && now - until < GRACE_MS) {
                ring(a)
                break
              }
            }
          }
        }

        // In the Android app, reminders are real scheduled notifications
        // (src/lib/native/notifications.ts) and the screen may sleep.
        if (isNative) return

        // Task reminders: X minutes before the task's time.
        const today = ymd(now)
        const tasks = await db.tasks.where('status').equals('open').toArray()
        for (const t of tasks) {
          if (t.deletedAt || !t.dueDate || !t.dueTime || t.reminderMinutesBefore == null) continue
          const [y, mo, d] = t.dueDate.split('-').map(Number)
          const [h, mi] = t.dueTime.split(':').map(Number)
          const due = new Date(y, mo - 1, d, h, mi).getTime()
          const fireAt = due - t.reminderMinutesBefore * 60_000
          if (now >= fireAt && now - fireAt < GRACE_MS && once(`task:${t.id}:${fireAt}`, now)) {
            const when = t.reminderMinutesBefore ? `in ${t.reminderMinutesBefore} min` : 'now'
            notify(`📝 ${t.title}`, `Due ${when} (${formatTime(t.dueTime, settings?.timeFormat ?? '12')})`, { tag: `task-${t.id}`, url: '/tasks' })
            playOnce('chime', 0.8)
            useApp.getState().toast(`Reminder: ${t.title} — due ${when}`)
          }
        }

        // Habit reminders at the habit's reminder time, if still not done.
        const habits = (await db.habits.toArray()).filter((h) => !h.deletedAt && !h.archived && h.reminderTime)
        if (habits.length) {
          const logs = await db.habitLogs.where('date').aboveOrEqual(ymd(now - 7 * 86_400_000)).toArray()
          for (const h of habits) {
            const [hh, mm] = h.reminderTime!.split(':').map(Number)
            const at = new Date(new Date(now).setHours(hh, mm, 0, 0)).getTime()
            if (now < at || now - at > GRACE_MS) continue
            if (!isDueOn(h, logs, new Date(now), settings?.weekStart ?? 1)) continue
            if (isDone(h, logs.find((l) => l.id === habitLogId(h.id, today) && !l.deletedAt))) continue
            if (once(`habit:${h.id}:${today}`, now)) {
              notify(`${h.icon} ${h.name}`, 'Time for your habit', { tag: `habit-${h.id}`, url: '/habits' })
              playOnce('bell', 0.7)
            }
          }
        }

        // Keep the phone screen awake while an alarm is armed in the next 12 h.
        if (coarse) {
          const next = nextAlarm(live, now)
          await setWakeLock(Boolean(settings?.keepAwake && next && next.at - now < 12 * 3600_000))
        }
      } finally {
        busy.current = false
      }
    }

    tick()
    const id = setInterval(tick, 5000)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return null
}
