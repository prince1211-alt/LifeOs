import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

/** Latest signed APK, published by .github/workflows/android.yml. */
export const ANDROID_APK_URL = 'https://github.com/prince1211-alt/LifeOs/releases/latest/download/LifeOS.apk'

/** True inside the Android app (Capacitor), false in the browser. */
export const isNative = Capacitor.isNativePlatform()

/** Fired whenever something that affects native notification schedules changes. */
export const SCHEDULE_EVENT = 'lifeos:schedule'

export function requestReschedule() {
  window.dispatchEvent(new Event(SCHEDULE_EVENT))
}

/** Ask the app shell to navigate (used by notification taps and the back button). */
export const NAVIGATE_EVENT = 'lifeos:navigate'

let pendingNav: string | null = null
let navReady = false

/** Navigate from outside React; remembered until the router is mounted (cold start from a notification). */
export function navigateTo(url: string) {
  if (!navReady) pendingNav = url
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: url }))
}

/** Called by the router once it listens; returns a navigation requested before that. */
export function takePendingNav(): string | null {
  navReady = true
  const url = pendingNav
  pendingNav = null
  return url
}

/** Android status/navigation bar icons: dark on the light theme, light on the dark theme. */
export function setSystemBarsForTheme(dark: boolean) {
  if (!isNative) return
  void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined)
}
