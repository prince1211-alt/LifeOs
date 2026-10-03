import { Children, Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  AlarmClock,
  Bell,
  CalendarToday,
  Check,
  Clock,
  Cloud,
  CloudSync,
  Contrast,
  DeleteForever,
  Download,
  Event,
  Hourglass,
  Label,
  Loader2,
  LogOut,
  Mail,
  Palette,
  Play,
  RefreshCw,
  Smartphone,
  Star,
  SyncProblem,
  Timer,
  Trash2,
  Upload,
  Volume2,
  X,
} from '@/components/icons'
import { useSettings, useTable } from '@/lib/hooks'
import type { Settings } from '@/lib/types'
import { save } from '@/lib/repo'
import { cn, downloadFile, ymd } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { Checkbox, Field, Input, Segmented, Select, Switch } from '@/components/ui/form'
import { Badge, Divider, ListItem, PageHeader, SectionTitle } from '@/components/ui/misc'
import { SOUNDS, playOnce, unlockAudio } from '@/lib/audio'
import { notificationPermission, requestNotifications, sendTestNotification } from '@/lib/notify'
import { useApp, toast, type UserProfile } from '@/store/app'
import { clearLocalData, deleteRemoteData, fullSync, syncDirty } from '@/lib/sync'
import { exportAll, importAll } from '@/lib/data'
import { ensureSeed } from '@/lib/db'
import { ensureScopes, isConfigured, SCOPES, signIn, signOutGoogle } from '@/lib/google/auth'
import { listStarred, type StarredEmail } from '@/lib/google/gmail'
import { applyTheme, schemeVars, THEME_SEEDS } from '@/lib/theme'
import { sendSummary } from '../summary/summary'
import { mirrorAllAlarms } from '../alarms/actions'
import { createTask } from '../tasks/actions'
import { getDirty } from '@/lib/repo'
import { promptInstall, useInstallPrompt } from '@/lib/install'
import { ANDROID_APK_URL, isNative } from '@/lib/native/platform'

const set = (p: Partial<Settings>) => save('settings', { id: 'settings', ...p })

/** One settings section: primary-coloured title over a rounded tonal list with dividers between rows. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = Children.toArray(children)
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="overflow-hidden rounded-lg bg-surface-container-low [--field-bg:var(--md-surface-container-low)]">
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <Divider inset />}
            {row}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

/**
 * List row for wide controls (segmented buttons, selects, button groups). The control sits under
 * the text on phones and trails it on larger screens; `block` keeps it under the text everywhere.
 */
function Row({
  icon,
  label,
  hint,
  block = false,
  children,
}: {
  icon: React.ReactNode
  label: string
  hint?: React.ReactNode
  block?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex min-h-14 flex-col gap-x-4 gap-y-3 px-4 py-3', !block && 'sm:flex-row sm:items-center sm:py-2')}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="flex shrink-0 text-on-surface-variant [&_svg]:size-6">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-body-large text-on-surface">{label}</div>
          {hint && <div className="text-body-medium text-on-surface-variant">{hint}</div>}
        </div>
      </div>
      <div className={cn('flex flex-wrap items-center gap-2 pl-10', !block && 'sm:shrink-0 sm:pl-0')}>{children}</div>
    </div>
  )
}

function UserAvatar({ user }: { user: UserProfile | null }) {
  if (user?.picture) return <img src={user.picture} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" />
  return (
    <span className="flex size-10 items-center justify-center rounded-full bg-tertiary-container text-title-medium text-on-tertiary-container">
      {(user?.name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Android "Wallpaper & style" swatch: primary on top, secondary and tertiary below (tone-80 accents). */
function swatchStyle(hex: string) {
  const v = schemeVars(hex, true)
  return {
    background: `conic-gradient(${v.primary} 0 90deg, ${v.tertiary} 90deg 180deg, ${v.secondary} 180deg 270deg, ${v.primary} 270deg)`,
    check: v['on-primary'],
  }
}

const PRESETS = THEME_SEEDS.map((t) => ({ ...t, ...swatchStyle(t.hex) }))

function Swatch({ background, check, on }: { background: string; check: string; on: boolean }) {
  return (
    <>
      <span
        className={cn('size-10 rounded-full transition-transform duration-200 ease-standard', on && 'scale-[0.8]')}
        style={{ background }}
      />
      {on && <Check className="absolute size-5" style={{ color: check }} />}
    </>
  )
}

/** Material You colour picker: preset seeds plus a custom colour. */
function ThemeColours({ theme, value }: { theme: Settings['theme']; value: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = (draft ?? value).toLowerCase()
  const custom = !PRESETS.some((p) => p.hex.toLowerCase() === current)
  const customSwatch = swatchStyle(current)

  const pick = (hex: string) => {
    window.clearTimeout(timer.current)
    setDraft(null)
    applyTheme(theme, hex)
    set({ themeColor: hex })
  }
  // The native picker fires on every drag step: preview live, save once it settles.
  const pickCustom = (hex: string) => {
    setDraft(hex)
    applyTheme(theme, hex)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      set({ themeColor: hex }).then(() => setDraft(null))
    }, 400)
  }

  const ring = 'state-layer relative flex size-12 items-center justify-center rounded-full'
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Theme colour">
      {PRESETS.map((p) => {
        const on = p.hex.toLowerCase() === current
        return (
          <button
            key={p.hex}
            type="button"
            aria-label={p.name}
            aria-pressed={on}
            title={p.name}
            onClick={() => pick(p.hex)}
            className={cn(ring, on ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface')}
          >
            <Swatch background={p.background} check={p.check} on={on} />
          </button>
        )
      })}
      <label
        title="Custom colour"
        className={cn(
          ring,
          'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
          custom ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
        )}
      >
        {custom ? (
          <Swatch background={customSwatch.background} check={customSwatch.check} on />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full border border-outline">
            <Palette className="size-5" />
          </span>
        )}
        <input
          type="color"
          aria-label="Custom colour"
          value={current}
          onChange={(e) => pickCustom(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function StarredImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks = useTable('tasks') ?? []
  const [emails, setEmails] = useState<StarredEmail[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const imported = new Set(tasks.map((t) => t.source?.messageId).filter(Boolean))
  useEffect(() => {
    if (!open) return
    setEmails(null)
    setError('')
    listStarred(25)
      .then((list) => {
        setEmails(list)
        setPicked(new Set(list.filter((m) => !imported.has(m.id)).map((m) => m.id)))
      })
      .catch((e) => setError(errText(e)))
  }, [open])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Starred emails → tasks"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={!picked.size}
            onClick={async () => {
              for (const m of emails ?? []) {
                if (!picked.has(m.id) || imported.has(m.id)) continue
                await createTask({ title: m.subject, notes: `From: ${m.from}\n${m.snippet}`, tags: ['email'], dueDate: ymd(), source: { kind: 'gmail', messageId: m.id } })
              }
              toast(`Added ${picked.size} task(s) from Gmail`)
              onClose()
            }}
          >
            Add {picked.size} task(s)
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-body-medium text-error">{error}</p>
      ) : !emails ? (
        <p className="flex items-center gap-3 py-4 text-body-medium text-on-surface-variant">
          <Loader2 className="size-5 animate-spin text-primary" /> Loading starred emails…
        </p>
      ) : !emails.length ? (
        <p className="py-4 text-body-medium text-on-surface-variant">No starred emails.</p>
      ) : (
        <div className="-mx-3 grid">
          {emails.map((m) => (
            <label key={m.id} className="state-layer flex cursor-pointer items-start gap-4 rounded-md px-3 py-2.5">
              <Checkbox
                checked={picked.has(m.id)}
                onChange={(v) => {
                  const n = new Set(picked)
                  if (v) n.add(m.id)
                  else n.delete(m.id)
                  setPicked(n)
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-title-small text-on-surface">{m.subject}</span>
                <span className="block truncate text-body-small text-on-surface-variant">{m.from}</span>
                {imported.has(m.id) && (
                  <Badge variant="success" className="mt-1">
                    Already a task
                  </Badge>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </Dialog>
  )
}

const POMODORO = [
  { key: 'focus', label: 'Focus' },
  { key: 'short', label: 'Short break' },
  { key: 'long', label: 'Long break' },
  { key: 'longEvery', label: 'Long every' },
] as const

export function SettingsPage() {
  const s = useSettings()
  const user = useApp((st) => st.user)
  const sync = useApp((st) => st.sync)
  const audio = useApp((st) => st.audioUnlocked)
  const nav = useNavigate()
  const { confirm, node } = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [perm, setPerm] = useState(notificationPermission())
  const [busy, setBusy] = useState('')
  const [starred, setStarred] = useState(false)
  const [newCat, setNewCat] = useState('')
  const installEvt = useInstallPrompt()
  const google = user?.mode === 'google'

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key)
    try {
      await fn()
      if (ok) toast(ok)
    } catch (e) {
      toast(errText(e))
    } finally {
      setBusy('')
    }
  }

  const signOut = async () => {
    let unsynced = false
    if (google) {
      try {
        await syncDirty()
      } catch {
        /* checked below */
      }
      unsynced = Object.keys(await getDirty()).length > 0
    }
    const msg = google
      ? unsynced
        ? 'Some changes are not synced yet and will be lost from this device. Sign out anyway?'
        : 'Sign out and remove LifeOS data from this device? Your data stays in your Google Drive.'
      : 'Leave local mode? Data on this device will be deleted unless you export it first.'
    if (!(await confirm(msg))) return
    signOutGoogle()
    await clearLocalData()
    await ensureSeed()
    useApp.getState().setUser(null)
    useApp.getState().setSync({ status: 'idle', lastSyncedAt: null, error: null })
    nav('/login')
  }

  const syncHint = sync.error
    ? sync.error
    : sync.lastSyncedAt
      ? `Last synced ${formatDistanceToNowStrict(sync.lastSyncedAt, { addSuffix: true })}`
      : 'Not synced yet'

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <PageHeader title="Settings" />

      <Group title="Account">
        <ListItem
          leading={<UserAvatar user={user} />}
          headline={user?.name ?? 'Not signed in'}
          supporting={<span className="block truncate">{google ? user?.email : 'Local only — data stays in this browser'}</span>}
          trailing={
            google && <Badge variant={sync.status === 'error' ? 'destructive' : 'success'}>{sync.status === 'error' ? 'Sync error' : 'Google Drive'}</Badge>
          }
        />
        {google ? (
          <ListItem
            leading={sync.status === 'error' ? <SyncProblem className="text-error" /> : <CloudSync />}
            headline="Google Drive sync"
            supporting={syncHint}
            trailing={
              <Button size="sm" variant="secondary" disabled={busy === 'sync'} onClick={() => run('sync', () => fullSync(), 'Synced')}>
                <RefreshCw className={busy === 'sync' ? 'animate-spin' : ''} /> Sync now
              </Button>
            }
          />
        ) : (
          isConfigured() && (
            <Row icon={<Cloud />} label="Connect Google" hint="Back up to your Google Drive and sync across devices">
              <Button
                size="sm"
                onClick={() =>
                  run(
                    'connect',
                    async () => {
                      await signIn()
                      await fullSync()
                    },
                    'Connected to Google Drive',
                  )
                }
              >
                Sign in with Google
              </Button>
            </Row>
          )
        )}
        <ListItem
          leading={<LogOut />}
          headline="Sign out"
          supporting={google ? 'Clears this device after a final sync' : 'Leaves local mode and clears this device'}
          onClick={signOut}
        />
      </Group>

      <Group title="Appearance">
        <Row icon={<Contrast />} label="Theme">
          <Segmented
            value={s.theme}
            onChange={(theme) => {
              applyTheme(theme, s.themeColor)
              set({ theme })
            }}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Row>
        <Row icon={<Palette />} label="Theme colour" hint="The whole app is tinted from this colour" block>
          <ThemeColours theme={s.theme} value={s.themeColor} />
        </Row>
      </Group>

      <Group title="Date & time">
        <Row icon={<CalendarToday />} label="Week starts on">
          <Segmented
            value={String(s.weekStart)}
            onChange={(v) => set({ weekStart: Number(v) as 0 | 1 })}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
          />
        </Row>
        <Row icon={<Clock />} label="Time format">
          <Segmented
            value={s.timeFormat}
            onChange={(timeFormat) => set({ timeFormat })}
            options={[
              { value: '12', label: '12-hour' },
              { value: '24', label: '24-hour' },
            ]}
          />
        </Row>
      </Group>

      <Group title="Timers & sounds">
        <Row icon={<Timer />} label="Pomodoro" hint="Minutes for focus and breaks; a long break every N rounds" block>
          <div className="grid w-full max-w-lg grid-cols-2 gap-x-2 gap-y-4 pt-1 sm:grid-cols-4">
            {POMODORO.map(({ key, label }) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  min={1}
                  aria-label={key}
                  className="tabular h-12"
                  value={s.pomodoro[key]}
                  onChange={(e) => set({ pomodoro: { ...s.pomodoro, [key]: Math.max(1, Number(e.target.value) || 1) } })}
                />
              </Field>
            ))}
          </div>
        </Row>
        <Row icon={<Hourglass />} label="Gym rest timer" hint="Starts after each ticked set">
          <Select className="h-10 w-36" aria-label="Gym rest timer" value={s.restSeconds} onChange={(e) => set({ restSeconds: Number(e.target.value) })}>
            {[30, 45, 60, 90, 120, 150, 180, 240].map((v) => (
              <option key={v} value={v}>
                {v < 60 ? `${v} s` : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min`}
              </option>
            ))}
          </Select>
        </Row>
        <Row icon={<AlarmClock />} label="Default alarm sound">
          <Select className="h-10 w-44" aria-label="Default alarm sound" value={s.defaultSound} onChange={(e) => set({ defaultSound: e.target.value })}>
            {SOUNDS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <IconButton label="Preview" onClick={() => playOnce(s.defaultSound)}>
            <Play />
          </IconButton>
        </Row>
        <ListItem
          leading={<Smartphone />}
          headline="Keep screen awake"
          supporting="While an alarm is armed. Mobile only; uses the Screen Wake Lock API"
          trailing={<Switch label="Keep screen awake when an alarm is armed" checked={s.keepAwake} onChange={(keepAwake) => set({ keepAwake })} />}
        />
        <Row icon={<Label />} label="Time log categories" block>
          {s.categories.map((c) => (
            <span key={c} className="inline-flex h-8 items-center gap-1 rounded-sm border border-outline pr-1 pl-3 text-label-large text-on-surface-variant">
              {c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                onClick={() => set({ categories: s.categories.filter((x) => x !== c) })}
                className="state-layer flex size-6 items-center justify-center rounded-full"
              >
                <X className="size-[18px]" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (newCat.trim() && !s.categories.includes(newCat.trim())) set({ categories: [...s.categories, newCat.trim()] })
              setNewCat('')
            }}
          >
            <Input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="+ Add"
              aria-label="Add category"
              className="h-8 w-28 rounded-sm px-3 text-label-large"
            />
          </form>
        </Row>
      </Group>

      <Group title="Notifications">
        <Row
          icon={<Bell />}
          label="Browser notifications"
          hint={
            perm === 'granted'
              ? 'Allowed'
              : perm === 'denied'
                ? 'Blocked — allow notifications for this site in your browser settings'
                : perm === 'unsupported'
                  ? 'Not supported in this browser'
                  : 'Not yet allowed'
          }
        >
          {perm === 'default' && (
            <Button size="sm" onClick={async () => setPerm(await requestNotifications())}>
              Allow
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const p = await requestNotifications()
              setPerm(p)
              playOnce('chime')
              await sendTestNotification()
              if (p !== 'granted') toast('Sound played, but notifications are not allowed')
            }}
          >
            <Bell /> Test
          </Button>
        </Row>
        <Row icon={<Volume2 />} label="Alarm sound" hint={audio ? 'Enabled for this session' : 'Tap once per session so alarms can play sound'}>
          <Button size="sm" variant={audio ? 'outline' : 'default'} onClick={() => unlockAudio()}>
            {audio ? <Check /> : <Volume2 />} {audio ? 'Enabled' : 'Enable alarm sound'}
          </Button>
        </Row>
      </Group>

      {google && (
        <Group title="Gmail & Google Calendar">
          <Row icon={<Mail />} label="Daily summary email" hint="Morning plan sent on your first open after this time (asks for Gmail send permission)">
            <Input
              type="time"
              aria-label="Summary email time"
              className="tabular h-10 w-32"
              value={s.summaryEmail.time}
              onChange={(e) => set({ summaryEmail: { ...s.summaryEmail, time: e.target.value || '07:00' } })}
              disabled={!s.summaryEmail.enabled}
            />
            <Switch
              label="Daily summary email"
              checked={s.summaryEmail.enabled}
              onChange={(enabled) =>
                run('gmail', async () => {
                  if (enabled) await ensureScopes(SCOPES.gmailSend)
                  await set({ summaryEmail: { ...s.summaryEmail, enabled } })
                })
              }
            />
          </Row>
          <Row icon={<Mail />} label="Send now" hint="Email today's plan or tonight's report right away">
            <Button size="sm" variant="outline" disabled={busy === 'morning'} onClick={() => run('morning', () => sendSummary('morning'), 'Morning plan sent ✉️')}>
              Morning plan
            </Button>
            <Button size="sm" variant="outline" disabled={busy === 'night'} onClick={() => run('night', () => sendSummary('night'), 'Night report sent ✉️')}>
              Night report
            </Button>
          </Row>
          <ListItem
            leading={<Event />}
            headline="Mirror alarms to Google Calendar"
            supporting="Your phone reminds you even when LifeOS is closed. Also enables pushing time blocks."
            trailing={
              <Switch
                label="Mirror alarms to Google Calendar"
                checked={s.calendarMirror}
                onChange={(on) =>
                  run(
                    'cal',
                    async () => {
                      if (on) await ensureScopes(SCOPES.calendar)
                      await set({ calendarMirror: on })
                      if (on) await mirrorAllAlarms()
                    },
                    on ? 'Alarms mirrored to Google Calendar' : undefined,
                  )
                }
              />
            }
          />
          <Row icon={<Star />} label="Starred emails → tasks" hint="Needs Gmail read access (restricted scope; fine in Testing mode)">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                run('starred', async () => {
                  await ensureScopes(SCOPES.gmailRead)
                  setStarred(true)
                })
              }
            >
              Import starred
            </Button>
          </Row>
        </Group>
      )}

      <Group title="Data">
        <ListItem
          leading={<Download />}
          headline="Export all data"
          supporting="Download everything as a JSON file"
          trailing={
            <Button
              size="sm"
              variant="outline"
              onClick={async () => downloadFile(`lifeos-export-${ymd()}.json`, JSON.stringify(await exportAll(), null, 2))}
            >
              Export
            </Button>
          }
        />
        <ListItem
          leading={<Upload />}
          headline="Import data"
          supporting="Merges a LifeOS export; newer records win"
          trailing={
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  run('import', async () => {
                    const n = await importAll(JSON.parse(await f.text()))
                    toast(`Imported ${n} record(s)`)
                  })
                }}
              />
              <Button size="sm" variant="outline" disabled={busy === 'import'} onClick={() => fileRef.current?.click()}>
                Import
              </Button>
            </>
          }
        />
        {!isNative && (
          <ListItem
            leading={<Smartphone />}
            headline="Android app"
            supporting="Alarms and reminders ring even when the app is closed"
            trailing={
              <a
                href={ANDROID_APK_URL}
                className="state-layer inline-flex h-8 items-center rounded-full border border-outline px-4 text-label-large text-primary"
              >
                Download
              </a>
            }
          />
        )}
        {installEvt && (
          <ListItem
            leading={<Smartphone />}
            headline="Install LifeOS"
            supporting="Add to your home screen or desktop"
            trailing={
              <Button size="sm" onClick={() => promptInstall()}>
                Install
              </Button>
            }
          />
        )}
        <Row
          icon={<DeleteForever className="text-error" />}
          label="Delete all data"
          hint={google ? 'Removes everything from this device and your Google Drive app folder' : 'Removes everything from this device'}
        >
          <Button
            size="sm"
            variant="outline"
            className="border-error text-error"
            disabled={busy === 'delete'}
            onClick={async () => {
              if (!(await confirm('Permanently delete ALL LifeOS data? This cannot be undone. Export first if unsure.'))) return
              run(
                'delete',
                async () => {
                  if (google) await deleteRemoteData()
                  await clearLocalData()
                  await ensureSeed()
                },
                'All data deleted',
              )
            }}
          >
            <Trash2 /> Delete all
          </Button>
        </Row>
      </Group>

      <p className="px-4 pt-2 pb-4 text-center text-body-small text-on-surface-variant">
        LifeOS · fully client-side · your data lives in your browser{google ? ' and your Google Drive' : ''}
      </p>
      <StarredImport open={starred} onClose={() => setStarred(false)} />
      {node}
    </div>
  )
}
