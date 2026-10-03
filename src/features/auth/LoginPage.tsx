import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, CheckSquare, Cloud, Dumbbell, Flame, HardDrive, Loader2, ShieldOff, Timer, TriangleAlert } from '@/components/icons'
import { LogoMark } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/misc'
import { isConfigured, signIn } from '@/lib/google/auth'
import { fullSync } from '@/lib/sync'
import { db } from '@/lib/db'
import { useApp } from '@/store/app'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

const FEATURES = [
  { icon: AlarmClock, label: 'Alarms' },
  { icon: CheckSquare, label: 'Tasks' },
  { icon: Flame, label: 'Habits' },
  { icon: ShieldOff, label: 'Quit' },
  { icon: Dumbbell, label: 'Gym' },
  { icon: Timer, label: 'Focus' },
]

/** After login: onboarding only when the account has no LifeOS data yet. */
export async function routeAfterLogin(nav: (p: string) => void) {
  const s = await db.settings.get('settings')
  nav(s?.onboardedAt ? '/today' : '/onboarding')
}

export function LoginPage() {
  const nav = useNavigate()
  const setUser = useApp((s) => s.setUser)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const configured = isConfigured()

  const google = async () => {
    setBusy(true)
    setError('')
    try {
      await signIn()
      await fullSync()
      await routeAfterLogin(nav)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg === 'popup_blocked' ? 'The sign-in popup was blocked. Allow popups for this site and try again.' : msg)
    } finally {
      setBusy(false)
    }
  }

  const local = async () => {
    setUser({ mode: 'local', name: 'You', email: '', picture: '' })
    useApp.getState().setSync({ status: 'local' })
    await routeAfterLogin(nav)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:items-center sm:justify-center sm:p-6">
      <main className="flex w-full flex-1 flex-col px-6 pt-12 pb-8 sm:max-w-[480px] sm:flex-none sm:rounded-xl sm:bg-surface-container-low sm:p-10 md:max-w-[1040px]">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          <div>
            <LogoMark size={48} />
            <h1 className="mt-6 text-headline-large text-on-surface md:text-display-small">LifeOS</h1>
            <p className="mt-2 text-body-large text-on-surface-variant">Your whole day in one place.</p>
            <ul className="mt-8 grid grid-cols-3 gap-2" aria-label="What's inside">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex flex-col items-center gap-2 rounded-md bg-surface-container px-2 py-4 text-label-large text-on-surface">
                  <Icon className="size-6 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col md:justify-center">
            <h2 className="text-headline-small text-on-surface">Sign in</h2>
            <p className="mt-2 text-body-medium text-on-surface-variant">
              Use your Google Account to back up and sync across devices, or keep everything on this device.
            </p>
            <div className="mt-8 grid gap-3">
              <Button
                variant="outline"
                className="h-12 w-full gap-3 border-outline bg-surface-container-lowest text-on-surface [&_svg]:size-5"
                onClick={google}
                disabled={busy || !configured}
              >
                {busy ? <Loader2 className="animate-spin text-primary" /> : <GoogleLogo />}
                {busy ? 'Signing in…' : 'Sign in with Google'}
              </Button>
              {!configured && (
                <p className="px-2 text-center text-body-small text-on-surface-variant">
                  Google sign-in isn't set up in this build (it needs <code>VITE_GOOGLE_CLIENT_ID</code>; see README).
                </p>
              )}
              {error && (
                <div role="alert" className="flex items-start gap-3 rounded-md bg-error-container px-4 py-3 text-body-medium text-on-error-container">
                  <TriangleAlert className="size-5 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex items-center gap-4 py-1 text-label-medium text-on-surface-variant">
                <Divider className="flex-1" /> or <Divider className="flex-1" />
              </div>
              <Button variant="ghost" className="w-full" onClick={local} disabled={busy}>
                <HardDrive /> Use on this device only
              </Button>
            </div>
            <ul className="mt-8 grid gap-3 text-body-small text-on-surface-variant">
              <li className="flex gap-3">
                <Cloud className="size-4 shrink-0" /> Data is saved in a hidden app folder in your own Google Drive — no LifeOS server.
              </li>
              <li className="flex gap-3">
                <HardDrive className="size-4 shrink-0" /> Works offline; changes sync in the background.
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
