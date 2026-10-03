import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/Toaster'
import { useApp } from '@/store/app'
import { db } from '@/lib/db'
import { useSettings } from '@/lib/hooks'
import { applyTheme } from '@/lib/theme'
import { fullSync, startSyncScheduler } from '@/lib/sync'
import { getToken, isConfigured } from '@/lib/google/auth'
import { LoginPage } from '@/features/auth/LoginPage'
import { TodayPage } from '@/features/today/TodayPage'
import { AlarmEngine } from '@/features/alarms/AlarmEngine'
import { RingScreen } from '@/features/alarms/RingScreen'
import { RestTimerBar } from '@/features/gym/RestTimerBar'
import { PomodoroEngine } from '@/features/focus/PomodoroEngine'
import { maybeSendMorning } from '@/features/summary/summary'

// Route pages load on demand so the first screen (Today) opens fast.
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })))
const AlarmsPage = lazy(() => import('@/features/alarms/AlarmsPage').then((m) => ({ default: m.AlarmsPage })))
const HabitsPage = lazy(() => import('@/features/habits/HabitsPage').then((m) => ({ default: m.HabitsPage })))
const QuitPage = lazy(() => import('@/features/quit/QuitPage').then((m) => ({ default: m.QuitPage })))
const GymPage = lazy(() => import('@/features/gym/GymPage').then((m) => ({ default: m.GymPage })))
const WorkoutPage = lazy(() => import('@/features/gym/WorkoutPage').then((m) => ({ default: m.WorkoutPage })))
const FocusPage = lazy(() => import('@/features/focus/FocusPage').then((m) => ({ default: m.FocusPage })))
const StatsPage = lazy(() => import('@/features/stats/StatsPage').then((m) => ({ default: m.StatsPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))

/** Returning visit: load from IndexedDB first, then reconnect Google and sync in the background. */
function useBootstrap() {
  const user = useApp((s) => s.user)
  useEffect(() => {
    startSyncScheduler()
  }, [])
  useEffect(() => {
    if (user?.mode === 'local') useApp.getState().setSync({ status: 'local' })
    if (user?.mode !== 'google' || !isConfigured()) return
    let cancelled = false
    ;(async () => {
      try {
        await getToken() // silent; shows "Reconnect Google" if it can't
        if (cancelled) return
        await fullSync()
        await maybeSendMorning()
      } catch {
        /* banner / sync status already updated */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.mode, user?.email])
}

function ThemeSync() {
  const s = useSettings()
  useEffect(() => {
    applyTheme(s.theme, s.themeColor)
    if (s.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system', s.themeColor)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [s.theme, s.themeColor])
  return null
}

function RequireUser({ children }: { children: React.ReactNode }) {
  const user = useApp((s) => s.user)
  const loc = useLocation()
  // null = no settings row yet (treated as not onboarded); undefined = still loading.
  const settings = useLiveQuery(() => db.settings.get('settings').then((s) => s ?? null), [])
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (settings === undefined) return null
  if (!settings?.onboardedAt && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function App() {
  useBootstrap()
  const user = useApp((s) => s.user)
  return (
    <BrowserRouter>
      <ThemeSync />
      <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/today" replace /> : <LoginPage />} />
        <Route
          path="/onboarding"
          element={
            <RequireUser>
              <OnboardingPage />
            </RequireUser>
          }
        />
        <Route
          element={
            <RequireUser>
              <AppShell />
            </RequireUser>
          }
        >
          <Route path="/today" element={<TodayPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/alarms" element={<AlarmsPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/quit" element={<QuitPage />} />
          <Route path="/gym" element={<GymPage />} />
          <Route path="/gym/workout/:id" element={<WorkoutPage />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/today' : '/login'} replace />} />
      </Routes>
      </Suspense>
      {user && (
        <>
          <AlarmEngine />
          <PomodoroEngine />
          <RingScreen />
          <RestTimerBar />
        </>
      )}
      <Toaster />
    </BrowserRouter>
  )
}
