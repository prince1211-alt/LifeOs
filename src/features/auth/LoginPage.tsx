import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, CheckSquare, Cloud, Dumbbell, Flame, HardDrive, ShieldOff, Timer } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/15 via-background to-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2.5 2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">LifeOS</h1>
          <p className="mt-1 text-muted-foreground">Your whole day in one place.</p>
        </div>
        <div className="mb-6 grid grid-cols-3 gap-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-xl bg-muted/60 py-3 text-xs font-medium">
              <Icon className="h-5 w-5 text-primary" />
              {label}
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          <Button size="lg" variant="outline" className="h-12" onClick={google} disabled={busy || !configured}>
            <GoogleLogo /> {busy ? 'Signing in…' : 'Sign in with Google'}
          </Button>
          {!configured && (
            <p className="text-center text-xs text-muted-foreground">
              Google sign-in needs <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env</code> (see README).
            </p>
          )}
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="ghost" onClick={local} disabled={busy}>
            <HardDrive /> Use on this device only
          </Button>
        </div>
        <ul className="mt-6 grid gap-2 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <Cloud className="h-4 w-4 shrink-0" /> Data is saved in a hidden app folder in your own Google Drive — no LifeOS server.
          </li>
          <li className="flex gap-2">
            <HardDrive className="h-4 w-4 shrink-0" /> Works offline; changes sync in the background.
          </li>
        </ul>
      </Card>
    </div>
  )
}
