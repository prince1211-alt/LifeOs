// Android app only: turns alarms, snoozes, task/habit reminders and running timers
// into scheduled system notifications, so they fire even when LifeOS is closed.
import { liveQuery } from 'dexie'
import { LocalNotifications, type ActionPerformed, type LocalNotificationSchema } from '@capacitor/local-notifications'
import { db } from '../db'
import { isDueOn, isDone, habitLogId } from '../habits'
import { formatTime, parseYmd, ymd } from '../utils'
import { DEFAULT_SETTINGS } from '../seed'
import { setNativePermission } from '../notify'
import { navigateTo, SCHEDULE_EVENT } from './platform'
import { nextFire } from '@/features/alarms/schedule'
import { dismiss, getSnoozes, markAlarmHandled, ring, snooze } from '@/features/alarms/AlarmEngine'
import { usePomodoro, PHASE_LABEL } from '@/features/focus/pomodoro'
import { useRest } from '@/features/gym/rest'
import { useApp } from '@/store/app'

const CHANNELS = {
  alarms: 'lifeos_alarms',
  reminders: 'lifeos_reminders',
  timers: 'lifeos_timers',
} as const

const ALARM_ACTIONS = 'LIFEOS_ALARM'
const SMALL_ICON = 'ic_stat_lifeos'
const MANAGED = 'managed' // extra.lifeos value for notifications rebuilt by resync()
const TIMER_IDS = { pomodoro: 900_001, rest: 900_002 }
const HORIZON_DAYS = 14

type Kind = 'alarm' | 'task' | 'habit' | 'timer'
interface Extra {
  lifeos: typeof MANAGED | 'timer'
  kind: Kind
  alarmId?: string
  url?: string
}

/** Stable positive 31-bit id from a string (FNV-1a). */
export function notificationId(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 899_000) + 1_000 // stays clear of TIMER_IDS
}

const atTime = (date: string, time: string) => {
  const d = parseYmd(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

async function setupChannels() {
  await LocalNotifications.createChannel({
    id: CHANNELS.alarms,
    name: 'Alarms',
    description: 'Wake-up and other alarms',
    importance: 5, // max: sound + heads-up
    visibility: 1, // show on the lock screen
    sound: 'lifeos_alarm.wav',
    vibration: true,
    lights: true,
    lightColor: '#0B57D0',
  })
  await LocalNotifications.createChannel({
    id: CHANNELS.reminders,
    name: 'Reminders',
    description: 'Task and habit reminders',
    importance: 4, // high
    visibility: 1, // show on the lock screen
    sound: 'lifeos_chime.wav',
    vibration: true,
  })
  await LocalNotifications.createChannel({
    id: CHANNELS.timers,
    name: 'Timers',
    description: 'Pomodoro and gym rest timers',
    importance: 4, // high
    visibility: 1, // show on the lock screen
    sound: 'lifeos_bell.wav',
    vibration: true,
  })
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ALARM_ACTIONS,
        actions: [
          { id: 'snooze', title: 'Snooze' },
          { id: 'dismiss', title: 'Dismiss', destructive: true },
        ],
      },
    ],
  })
}

async function refreshPermission(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions()
  setNativePermission(display)
  return display === 'granted'
}

/** Everything that should currently be scheduled (alarms, snoozes, reminders). */
async function wanted(now = Date.now()): Promise<LocalNotificationSchema[]> {
  const live = <T extends { deletedAt?: number | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt)
  const [alarms, tasks, habits, settingsRow] = await Promise.all([
    db.alarms.toArray().then(live),
    db.tasks.where('status').equals('open').toArray().then(live),
    db.habits.toArray().then(live),
    db.settings.get('settings'),
  ])
  const settings = { ...DEFAULT_SETTINGS, ...settingsRow }
  const out: LocalNotificationSchema[] = []
  const base = { smallIcon: SMALL_ICON, iconColor: '#0B57D0' }

  for (const a of alarms) {
    if (!a.enabled) continue
    const [hour, minute] = a.time.split(':').map(Number)
    const common = {
      ...base,
      title: `⏰ ${a.label || 'Alarm'}`,
      body: `${formatTime(a.time, settings.timeFormat)} · Tap to open`,
      channelId: CHANNELS.alarms,
      actionTypeId: ALARM_ACTIONS,
      autoCancel: true,
      extra: { lifeos: MANAGED, kind: 'alarm', alarmId: a.id, url: '/alarms' } satisfies Extra,
    }
    if (a.repeatDays.length) {
      for (const d of a.repeatDays)
        out.push({ ...common, id: notificationId(`alarm:${a.id}:${d}`), schedule: { on: { weekday: d + 1, hour, minute }, allowWhileIdle: true } })
    } else {
      const t = nextFire(a, now)
      if (t) out.push({ ...common, id: notificationId(`alarm:${a.id}`), schedule: { at: new Date(t), allowWhileIdle: true } })
    }
  }

  for (const [alarmId, until] of Object.entries(getSnoozes())) {
    const a = alarms.find((x) => x.id === alarmId)
    if (!a || until <= now) continue
    out.push({
      ...base,
      id: notificationId(`snooze:${alarmId}`),
      title: `⏰ ${a.label || 'Alarm'} (snoozed)`,
      body: 'Tap to open',
      channelId: CHANNELS.alarms,
      actionTypeId: ALARM_ACTIONS,
      autoCancel: true,
      schedule: { at: new Date(until), allowWhileIdle: true },
      extra: { lifeos: MANAGED, kind: 'alarm', alarmId, url: '/alarms' } satisfies Extra,
    })
  }

  const horizon = now + HORIZON_DAYS * 86_400_000
  for (const t of tasks) {
    if (!t.dueDate || !t.dueTime || t.reminderMinutesBefore == null) continue
    const fireAt = atTime(t.dueDate, t.dueTime).getTime() - t.reminderMinutesBefore * 60_000
    if (fireAt <= now || fireAt > horizon) continue
    const when = t.reminderMinutesBefore ? `in ${t.reminderMinutesBefore} min` : 'now'
    out.push({
      ...base,
      id: notificationId(`task:${t.id}:${fireAt}`),
      title: `📝 ${t.title}`,
      body: `Due ${when} (${formatTime(t.dueTime, settings.timeFormat)})`,
      channelId: CHANNELS.reminders,
      autoCancel: true,
      schedule: { at: new Date(fireAt), allowWhileIdle: true },
      extra: { lifeos: MANAGED, kind: 'task', url: '/tasks' } satisfies Extra,
    })
  }

  const remindable = habits.filter((h) => !h.archived && h.reminderTime)
  if (remindable.length) {
    const logs = live(await db.habitLogs.where('date').aboveOrEqual(ymd(now - 7 * 86_400_000)).toArray())
    for (const h of remindable) {
      for (let i = 0; i < HORIZON_DAYS; i++) {
        const day = new Date(now + i * 86_400_000)
        const date = ymd(day)
        const at = atTime(date, h.reminderTime!)
        if (at.getTime() <= now) continue
        if (!isDueOn(h, logs, day, settings.weekStart)) continue
        if (isDone(h, logs.find((l) => l.id === habitLogId(h.id, date)))) continue
        out.push({
          ...base,
          id: notificationId(`habit:${h.id}:${date}`),
          title: `${h.icon} ${h.name}`,
          body: 'Time for your habit',
          channelId: CHANNELS.reminders,
          autoCancel: true,
          schedule: { at, allowWhileIdle: true },
          extra: { lifeos: MANAGED, kind: 'habit', url: '/habits' } satisfies Extra,
        })
      }
    }
  }
  return out
}

let running: Promise<void> | null = null
let again = false

/** Cancel our pending notifications and schedule the current set. Serialised and coalesced. */
export function resync(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      if (!(await refreshPermission())) return
      const pending = await LocalNotifications.getPending()
      const ours = pending.notifications.filter((n) => (n.extra as Extra | undefined)?.lifeos === MANAGED)
      if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
      const list = await wanted()
      // Android caps an app at 500 pending alarms; keep well under it.
      if (list.length) await LocalNotifications.schedule({ notifications: list.slice(0, 400) })
    } catch (e) {
      console.warn('Could not schedule notifications', e)
    } finally {
      running = null
      if (again) {
        again = false
        void resync()
      }
    }
  })()
  return running
}

let resyncTimer: ReturnType<typeof setTimeout> | undefined
function resyncSoon() {
  clearTimeout(resyncTimer)
  resyncTimer = setTimeout(() => void resync(), 800)
}

/** Pomodoro and rest timers: one notification at the moment they end. */
function watchTimers() {
  const scheduled: Record<'pomodoro' | 'rest', number | null> = { pomodoro: null, rest: null }
  const apply = async (key: 'pomodoro' | 'rest', endsAt: number | null, title: string, body: string) => {
    if (scheduled[key] === endsAt) return
    scheduled[key] = endsAt
    const id = TIMER_IDS[key]
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] })
      if (endsAt && endsAt > Date.now() && (await refreshPermission()))
        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title,
              body,
              smallIcon: SMALL_ICON,
              iconColor: '#0B57D0',
              channelId: CHANNELS.timers,
              autoCancel: true,
              schedule: { at: new Date(endsAt), allowWhileIdle: true },
              extra: { lifeos: 'timer', kind: 'timer', url: key === 'rest' ? '/gym' : '/focus' } satisfies Extra,
            },
          ],
        })
    } catch (e) {
      console.warn('Timer notification failed', e)
    }
  }
  const onPomodoro = (s: ReturnType<typeof usePomodoro.getState>) =>
    apply(
      'pomodoro',
      s.running ? s.endsAt : null,
      s.phase === 'focus' ? 'Focus session done 🎉' : `${PHASE_LABEL[s.phase]} over`,
      s.phase === 'focus' ? 'Take a break.' : 'Ready for the next focus round?',
    )
  const onRest = (s: ReturnType<typeof useRest.getState>) => apply('rest', s.endsAt, 'Rest over', 'Time for your next set 💪')
  onPomodoro(usePomodoro.getState())
  onRest(useRest.getState())
  usePomodoro.subscribe(onPomodoro)
  useRest.subscribe(onRest)
}

async function onAction({ actionId, notification }: ActionPerformed) {
  const extra = notification.extra as Extra | undefined
  if (!extra) return
  if (extra.kind === 'alarm' && extra.alarmId) {
    const a = await db.alarms.get(extra.alarmId)
    if (!a) return
    markAlarmHandled(a)
    if (actionId === 'snooze') snooze(a.id, a.snoozeMinutes || 5)
    else if (actionId === 'dismiss') await dismiss(a.id)
    else if (useApp.getState().ringing?.alarmId !== a.id) ring(a)
    return
  }
  if (extra.url) navigateTo(extra.url)
}

let started = false

/** Called once at start-up in the Android app. */
export async function initNativeNotifications() {
  if (started) return
  started = true
  try {
    await setupChannels()
  } catch (e) {
    console.warn('Notification channels', e)
  }
  await LocalNotifications.addListener('localNotificationActionPerformed', (a) => void onAction(a))
  // While LifeOS is open, the in-app ring screen / timers take over: silence the system copy.
  await LocalNotifications.addListener('localNotificationReceived', (n) => {
    const extra = n.extra as Extra | undefined
    if (extra?.kind === 'alarm' || extra?.kind === 'timer')
      void LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: n.id, title: n.title, body: n.body }] })
  })
  window.addEventListener(SCHEDULE_EVENT, resyncSoon)
  // Any change to alarms, tasks, habits or check-ins reschedules (debounced).
  liveQuery(async () => {
    await Promise.all([db.alarms.toArray(), db.tasks.toArray(), db.habits.toArray(), db.habitLogs.count(), db.settings.get('settings')])
    return Date.now()
  }).subscribe({ next: resyncSoon, error: () => undefined })
  watchTimers()
  await resync()
}
