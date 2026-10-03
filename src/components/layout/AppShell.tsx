import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Cloud, CloudOff, HardDrive, Loader2, MoreHorizontal, RefreshCw, TriangleAlert, Volume2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOBILE_MAIN, MOBILE_MORE, NAV } from './nav'
import { useApp } from '@/store/app'
import { fullSync } from '@/lib/sync'
import { getToken } from '@/lib/google/auth'
import { unlockAudio } from '@/lib/audio'
import { formatDistanceToNowStrict } from 'date-fns'
import { useNow } from '@/lib/hooks'
import { Button } from '@/components/ui/button'

function Logo() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" strokeLinecap="round" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight">LifeOS</span>
    </div>
  )
}

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const sync = useApp((s) => s.sync)
  const user = useApp((s) => s.user)
  useNow(30_000)
  if (user?.mode !== 'google')
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Data is stored on this device only">
        <HardDrive className="h-4 w-4" /> {!compact && 'Local only'}
      </span>
    )
  const icon =
    sync.status === 'syncing' ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : sync.status === 'error' ? (
      <TriangleAlert className="h-4 w-4 text-destructive" />
    ) : sync.status === 'offline' ? (
      <CloudOff className="h-4 w-4" />
    ) : (
      <Cloud className="h-4 w-4 text-success" />
    )
  const text =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'offline'
        ? 'Offline'
        : sync.status === 'error'
          ? 'Sync failed'
          : sync.lastSyncedAt
            ? `Synced ${formatDistanceToNowStrict(sync.lastSyncedAt, { addSuffix: true })}`
            : 'Not synced yet'
  return (
    <button
      onClick={() => fullSync().catch(() => undefined)}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      title={sync.error ? `${text}: ${sync.error}. Tap to sync now.` : `${text}. Tap to sync now.`}
    >
      {icon}
      {!compact && <span>{text}</span>}
      {!compact && <RefreshCw className="h-3 w-3 opacity-60" />}
    </button>
  )
}

function UserChip() {
  const user = useApp((s) => s.user)
  if (!user) return null
  return (
    <div className="flex items-center gap-2 px-2">
      {user.picture ? (
        <img src={user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email || 'This device'}</div>
      </div>
    </div>
  )
}

function Banners() {
  const needsReconnect = useApp((s) => s.needsReconnect)
  const audioUnlocked = useApp((s) => s.audioUnlocked)
  const user = useApp((s) => s.user)
  const [hideAudio, setHideAudio] = useState(false)
  return (
    <>
      {needsReconnect && user?.mode === 'google' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-warning/15 px-4 py-2 text-sm">
          <span>Google session expired. Your data is safe on this device.</span>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await getToken([], true)
                await fullSync()
              } catch {
                /* banner stays */
              }
            }}
          >
            Reconnect Google
          </Button>
        </div>
      )}
      {!audioUnlocked && !hideAudio && (
        <div className="flex items-center justify-between gap-2 border-b bg-primary/10 px-4 py-2 text-sm">
          <span>Browsers block sound until you tap once. Enable it so alarms can ring.</span>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={() => unlockAudio()}>
              <Volume2 /> Enable alarm sound
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setHideAudio(true)} aria-label="Hide">
              <X />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false)
  const loc = useLocation()
  const moreActive = MOBILE_MORE.some((p) => loc.pathname.startsWith(p))

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card/50 p-3 md:flex">
        <div className="py-2">
          <Logo />
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t pt-3">
          <SyncIndicator />
          <UserChip />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <Logo />
          <SyncIndicator compact />
        </header>
        <Banners />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
              moreActive || moreOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-x-3 bottom-20 grid grid-cols-3 gap-2 rounded-2xl border bg-card p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV.filter((n) => MOBILE_MORE.includes(n.to)).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 rounded-xl p-3 text-xs font-medium',
                    isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
