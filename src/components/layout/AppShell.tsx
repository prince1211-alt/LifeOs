import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  Cloud,
  CloudOff,
  HardDrive,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  SyncProblem,
  TriangleAlert,
  Volume2,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { CREATE_ACTIONS, MOBILE_MAIN, MOBILE_MORE, NAV, titleFor } from './nav'
import { useApp } from '@/store/app'
import { fullSync } from '@/lib/sync'
import { getToken } from '@/lib/google/auth'
import { unlockAudio } from '@/lib/audio'
import { useMediaQuery, useNow } from '@/lib/hooks'
import { Button, IconButton } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ListItem } from '@/components/ui/misc'

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="var(--md-primary-container)" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="var(--md-primary)" strokeOpacity="0.25" strokeWidth="4.5" />
      <path d="M24 11a13 13 0 1 1-11.3 19.4" fill="none" stroke="var(--md-primary)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M24 17v7l4.5 4.5" fill="none" stroke="var(--md-on-primary-container)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Logo() {
  return (
    <Link to="/today" className="flex items-center gap-2 rounded-full pr-2" aria-label="LifeOS home">
      <LogoMark />
      <span className="text-title-large text-on-surface-variant">
        <span className="font-medium text-on-surface">Life</span>OS
      </span>
    </Link>
  )
}

/** Sync status as an icon button (tap = Sync now). */
export function SyncButton() {
  const sync = useApp((s) => s.sync)
  const user = useApp((s) => s.user)
  useNow(30_000)
  if (user?.mode !== 'google')
    return (
      <IconButton label="Local only — data stays on this device" onClick={() => undefined} className="cursor-default">
        <HardDrive />
      </IconButton>
    )
  const icon =
    sync.status === 'syncing' ? (
      <Loader2 className="animate-spin" />
    ) : sync.status === 'error' ? (
      <SyncProblem className="text-error" />
    ) : sync.status === 'offline' ? (
      <CloudOff />
    ) : (
      <Cloud filled />
    )
  const text =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'offline'
        ? 'Offline — changes will sync later'
        : sync.status === 'error'
          ? `Sync failed${sync.error ? `: ${sync.error}` : ''}. Tap to retry.`
          : sync.lastSyncedAt
            ? `Synced ${formatDistanceToNowStrict(sync.lastSyncedAt, { addSuffix: true })}. Tap to sync now.`
            : 'Not synced yet. Tap to sync now.'
  return (
    <IconButton label={text} onClick={() => fullSync().catch(() => undefined)}>
      {icon}
    </IconButton>
  )
}

function Avatar({ size = 32 }: { size?: number }) {
  const user = useApp((s) => s.user)
  if (!user) return null
  return (
    <Link to="/settings" className="state-layer rounded-full p-1" aria-label={`Account: ${user.name}`} title={user.email || user.name}>
      {user.picture ? (
        <img src={user.picture} alt="" style={{ width: size, height: size }} className="rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span
          style={{ width: size, height: size }}
          className="flex items-center justify-center rounded-full bg-tertiary-container text-title-small text-on-tertiary-container"
        >
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </Link>
  )
}

/** M3 banners shown at the top of the content (reconnect, enable sound). */
function Banners() {
  const needsReconnect = useApp((s) => s.needsReconnect)
  const audioUnlocked = useApp((s) => s.audioUnlocked)
  const user = useApp((s) => s.user)
  const [hideAudio, setHideAudio] = useState(false)
  const items: { key: string; icon: React.ReactNode; text: string; actions: React.ReactNode }[] = []
  if (needsReconnect && user?.mode === 'google')
    items.push({
      key: 'reconnect',
      icon: <TriangleAlert filled className="text-error" />,
      text: 'Your Google session expired. Your data is safe on this device.',
      actions: (
        <Button
          variant="ghost"
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
      ),
    })
  if (!audioUnlocked && !hideAudio)
    items.push({
      key: 'audio',
      icon: <Volume2 filled className="text-primary" />,
      text: 'Browsers block sound until you tap once. Turn it on so alarms can ring.',
      actions: (
        <>
          <Button variant="ghost" onClick={() => setHideAudio(true)}>
            Dismiss
          </Button>
          <Button variant="ghost" onClick={() => unlockAudio()}>
            Enable sound
          </Button>
        </>
      ),
    })
  if (!items.length) return null
  return (
    <div className="mb-4 grid gap-2">
      {items.map((b) => (
        <div key={b.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-surface-container-high py-2 pr-2 pl-4">
          <span className="[&_svg]:size-6">{b.icon}</span>
          <span className="min-w-48 flex-1 py-1 text-body-medium text-on-surface">{b.text}</span>
          <span className="ml-auto flex">{b.actions}</span>
        </div>
      ))}
    </div>
  )
}

/** Google Drive–style "New" button with a menu of things to create. */
function NewButton({ compact }: { compact: boolean }) {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="New"
        className={cn(
          'state-layer flex h-14 items-center gap-3 rounded-lg bg-primary-container text-label-large text-on-primary-container shadow-elevation-1 transition-shadow hover:shadow-elevation-2',
          compact ? 'w-14 justify-center' : 'pr-6 pl-4',
        )}
      >
        <Plus className="size-6" />
        {!compact && 'New'}
      </button>
      {open && (
        <div
          role="menu"
          className="animate-md-fade absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden rounded-xs bg-surface-container py-2 shadow-elevation-2"
        >
          {CREATE_ACTIONS.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                nav(to)
              }}
              className="state-layer flex h-12 w-full items-center gap-3 px-3 text-label-large text-on-surface"
            >
              <Icon className="size-6 text-on-surface-variant" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const wide = useMediaQuery('(min-width: 1024px)')
  const [railPref, setRailPref] = useState<boolean | null>(null)
  const rail = railPref ?? !wide // drawer on large screens, rail on medium
  const loc = useLocation()
  const moreActive = MOBILE_MORE.some((p) => loc.pathname.startsWith(p))
  const user = useApp((s) => s.user)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => setMoreOpen(false), [loc.pathname])

  return (
    <div className="min-h-screen bg-surface md:bg-surface-container">
      {/* Top app bar */}
      <header
        className={cn(
          'sticky top-0 z-30 flex h-16 items-center gap-1 px-2 transition-colors duration-200 md:bg-surface-container md:px-3',
          scrolled ? 'bg-surface-container' : 'bg-surface',
        )}
      >
        <IconButton label={rail ? 'Expand menu' : 'Collapse menu'} className="hidden md:inline-flex" onClick={() => setRailPref(!rail)}>
          <Menu />
        </IconButton>
        <div className="flex items-center gap-2 pl-2 md:hidden">
          <LogoMark size={28} />
          <span className="text-title-large text-on-surface">{titleFor(loc.pathname)}</span>
        </div>
        <div className="hidden pl-1 md:block">
          <Logo />
        </div>
        <div className="flex-1" />
        <SyncButton />
        <Avatar />
      </header>

      <div className="flex">
        {/* Navigation drawer (large) / rail (medium) */}
        <aside
          className={cn(
            'sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col gap-1 overflow-y-auto pb-4 no-scrollbar md:flex',
            rail ? 'w-20 items-center px-2' : 'w-64 px-3',
          )}
        >
          <div className={cn('mb-4 pt-1', !rail && 'px-1')}>
            <NewButton compact={rail} />
          </div>
          <nav className={cn('flex flex-col', rail ? 'w-full items-center gap-3' : 'gap-0.5')}>
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} title={rail ? label : undefined}>
                {({ isActive }) =>
                  rail ? (
                    <span className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          'state-layer flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                          isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
                        )}
                      >
                        <Icon filled={isActive} className="size-6" />
                      </span>
                      <span className={cn('text-label-medium', isActive ? 'text-on-surface' : 'text-on-surface-variant')}>{label}</span>
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'state-layer flex h-12 items-center gap-3 rounded-full pr-6 pl-4 text-label-large transition-colors',
                        isActive ? 'bg-secondary-container font-bold text-on-secondary-container' : 'text-on-surface-variant',
                      )}
                    >
                      <Icon filled={isActive} className="size-6" />
                      {label}
                    </span>
                  )
                }
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content pane: white rounded sheet on the tinted frame (Drive/Gmail), plain surface on phones */}
        <main
          className={cn(
            'min-w-0 flex-1 bg-surface pb-[calc(104px+env(safe-area-inset-bottom))] [--field-bg:var(--md-surface)]',
            'md:mr-4 md:mb-4 md:min-h-[calc(100vh-5rem)] md:rounded-xl md:bg-surface-container-lowest md:pb-10 md:[--field-bg:var(--md-surface-container-lowest)]',
          )}
        >
          <div className="mx-auto w-full max-w-5xl px-4 pt-2 md:px-8 md:pt-8">
            <Banners />
            <Outlet />
          </div>
        </main>
      </div>

      {/* Navigation bar (phones) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface-container pb-safe md:hidden" aria-label="Main">
        <div className="grid h-20 grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="flex flex-col items-center justify-center gap-1">
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'state-layer flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200',
                      isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
                    )}
                  >
                    <Icon filled={isActive} className="size-6" />
                  </span>
                  <span className={cn('text-label-medium', isActive ? 'font-bold text-on-surface' : 'text-on-surface-variant')}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center gap-1" aria-haspopup="dialog">
            <span
              className={cn(
                'state-layer flex h-8 w-16 items-center justify-center rounded-full',
                moreActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
              )}
            >
              <MoreHorizontal className="size-6" />
            </span>
            <span className={cn('text-label-medium', moreActive ? 'font-bold text-on-surface' : 'text-on-surface-variant')}>More</span>
          </button>
        </div>
      </nav>

      {/* "More" bottom sheet (phones) */}
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title={user?.name ?? 'More'}>
        <div className="-mx-6 grid">
          {NAV.filter((n) => MOBILE_MORE.includes(n.to)).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}>
              {({ isActive }) => (
                <ListItem
                  leading={<Icon filled={isActive} className={isActive ? 'text-primary' : undefined} />}
                  headline={<span className={isActive ? 'font-bold text-primary' : undefined}>{label}</span>}
                  className="state-layer"
                />
              )}
            </NavLink>
          ))}
          <div className="mt-2 border-t border-outline-variant px-6 pt-4 text-label-large text-on-surface-variant">Create</div>
          <div className="flex flex-wrap gap-2 px-6 pt-3 pb-2">
            {CREATE_ACTIONS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className="state-layer inline-flex h-8 items-center gap-2 rounded-sm border border-outline pr-4 pl-2 text-label-large text-on-surface-variant"
              >
                <Icon className="size-[18px] text-primary" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
