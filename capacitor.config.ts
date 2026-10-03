import type { CapacitorConfig } from '@capacitor/cli'

// Android app: the same web app, packaged with Capacitor so alarms and reminders
// become real Android notifications that fire even when LifeOS is closed.
const config: CapacitorConfig = {
  appId: 'app.lifeos.android',
  appName: 'LifeOS',
  webDir: 'dist',
  android: {
    // Lets WebView play alarm sounds without a tap (see MainActivity).
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    LocalNotifications: { smallIcon: 'ic_stat_lifeos', iconColor: '#0B57D0' },
    SocialLogin: { providers: { google: true, facebook: false, apple: false, twitter: false } },
  },
}

export default config
