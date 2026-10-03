import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative, requestReschedule } from './native/platform'

// In the Android app, notifications are native (src/lib/native/notifications.ts);
// this module only tracks their permission so the UI can show it.
let nativePerm: NotificationPermission = 'default'

export function setNativePermission(display: string) {
  nativePerm = display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default'
}

export function notificationsSupported() {
  return isNative || (typeof window !== 'undefined' && 'Notification' in window)
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (isNative) return nativePerm
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (isNative) {
    const { display } = await LocalNotifications.requestPermissions()
    setNativePermission(display)
    if (nativePerm === 'granted') requestReschedule()
    return nativePerm
  }
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

/** Show a notification; uses the service worker when available (needed on Android). */
export async function notify(title: string, body: string, opts: { tag?: string; url?: string; sticky?: boolean } = {}) {
  // The Android app schedules its own system notifications ahead of time.
  if (isNative || notificationPermission() !== 'granted') return
  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    tag: opts.tag,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    requireInteraction: opts.sticky,
    data: { url: opts.url ?? '/today' },
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) return await reg.showNotification(title, options)
  } catch {
    /* fall through */
  }
  try {
    const n = new Notification(title, options)
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* not supported in this context */
  }
}

// Screen Wake Lock keeps a phone from sleeping while an alarm is armed.
let lock: { release: () => Promise<void> } | null = null

export async function setWakeLock(on: boolean) {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
  if (!wl) return false
  try {
    if (on && !lock && document.visibilityState === 'visible') {
      lock = await wl.request('screen')
      ;(lock as unknown as EventTarget).addEventListener?.('release', () => (lock = null))
    } else if (!on && lock) {
      await lock.release()
      lock = null
    }
    return true
  } catch {
    lock = null
    return false
  }
}

export const wakeLockActive = () => Boolean(lock)

/** "Test" button in Settings: a real notification in the browser or the Android app. */
export async function sendTestNotification() {
  if (isNative) {
    if (nativePerm !== 'granted') return
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 900_100,
          title: 'LifeOS test',
          body: 'Notifications and sound are working 🎉',
          channelId: 'lifeos_reminders',
          smallIcon: 'ic_stat_lifeos',
          iconColor: '#0B57D0',
          schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
        },
      ],
    })
    return
  }
  await notify('LifeOS test', 'Notifications and sound are working 🎉', { tag: 'test' })
}
