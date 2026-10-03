// Android app start-up: notifications, back button, status bar colours, resume handling.
import { App } from '@capacitor/app'
import { useApp } from '@/store/app'
import { initNativeNotifications, resync } from './notifications'
import { navigateTo } from './platform'

function handleBack() {
  // Close the top-most dialog or bottom sheet first (they listen for Escape).
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return
  }
  if (useApp.getState().ringing) return // an alarm must be snoozed or dismissed
  if (window.location.pathname === '/today' || window.location.pathname === '/login') void App.minimizeApp()
  else if (window.history.length > 1) window.history.back()
  else navigateTo('/today')
}

export async function initNative() {
  // WebView can play sound without a tap in the app (Capacitor disables the gesture requirement).
  useApp.getState().setAudioUnlocked(true)
  await App.addListener('backButton', handleBack)
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void resync()
  })
  await initNativeNotifications()
}
