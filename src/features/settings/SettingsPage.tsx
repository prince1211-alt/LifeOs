import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { Bell, Cloud, Download, LogOut, Mail, Play, RefreshCw, Smartphone, Trash2, Upload, Volume2, X } from 'lucide-react'
import { useSettings, useTable } from '@/lib/hooks'
import type { Settings } from '@/lib/types'
import { save } from '@/lib/repo'
import { downloadFile, ymd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { Checkbox, Input, Segmented, Select, Switch } from '@/components/ui/form'
import { Badge, PageHeader } from '@/components/ui/misc'
import { SOUNDS, playOnce, unlockAudio } from '@/lib/audio'
import { notificationPermission, notify, requestNotifications } from '@/lib/notify'
import { useApp, toast } from '@/store/app'
import { clearLocalData, deleteRemoteData, fullSync, syncDirty } from '@/lib/sync'
import { exportAll, importAll } from '@/lib/data'
import { ensureSeed } from '@/lib/db'
import { ensureScopes, isConfigured, SCOPES, signIn, signOutGoogle } from '@/lib/google/auth'
import { listStarred, type StarredEmail } from '@/lib/google/gmail'
import { applyTheme } from '@/lib/theme'
import { sendSummary } from '../summary/summary'
import { mirrorAllAlarms } from '../alarms/actions'
import { createTask } from '../tasks/actions'
import { getDirty } from '@/lib/repo'
import { promptInstall, useInstallPrompt } from '@/lib/install'

const set = (p: Partial<Settings>) => save('settings', { id: 'settings', ...p })

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
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
        <p className="text-sm text-destructive">{error}</p>
      ) : !emails ? (
        <p className="text-sm text-muted-foreground">Loading starred emails…</p>
      ) : !emails.length ? (
        <p className="text-sm text-muted-foreground">No starred emails.</p>
      ) : (
        <div className="grid gap-2">
          {emails.map((m) => (
            <label key={m.id} className="flex items-start gap-3 rounded-lg border p-2 text-sm">
              <Checkbox
                checked={picked.has(m.id)}
                onChange={(v) => {
                  const n = new Set(picked)
                  if (v) n.add(m.id)
                  else n.delete(m.id)
                  setPicked(n)
                }}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block font-medium">{m.subject}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.from}</span>
                {imported.has(m.id) && <Badge variant="success">already a task</Badge>}
              </span>
            </label>
          ))}
        </div>
      )}
    </Dialog>
  )
}

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

  return (
    <div className="grid gap-4">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>
            <Cloud className="h-4 w-4" /> Account & sync
          </CardTitle>
          {google && <Badge variant={sync.status === 'error' ? 'destructive' : 'success'}>{sync.status === 'error' ? 'Sync error' : 'Google Drive'}</Badge>}
        </CardHeader>
        <CardContent className="divide-y">
          <Row label={user?.name ?? 'Not signed in'} hint={google ? user?.email : 'Local only — data stays in this browser'}>
            {user?.picture && <img src={user.picture} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />}
          </Row>
          {google ? (
            <Row
              label="Sync status"
              hint={
                sync.error
                  ? sync.error
                  : sync.lastSyncedAt
                    ? `Last synced ${formatDistanceToNowStrict(sync.lastSyncedAt, { addSuffix: true })}`
                    : 'Not synced yet'
              }
            >
              <Button size="sm" variant="outline" disabled={busy === 'sync'} onClick={() => run('sync', () => fullSync(), 'Synced')}>
                <RefreshCw className={busy === 'sync' ? 'animate-spin' : ''} /> Sync now
              </Button>
            </Row>
          ) : (
            isConfigured() && (
              <Row label="Connect Google" hint="Back up to your Google Drive and sync across devices">
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
          <Row label="Sign out" hint="Clears this device after a final sync">
            <Button size="sm" variant="outline" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance & time</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Theme">
            <Segmented
              value={s.theme}
              onChange={(theme) => {
                applyTheme(theme)
                set({ theme })
              }}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Row>
          <Row label="Week starts on">
            <Segmented
              value={String(s.weekStart)}
              onChange={(v) => set({ weekStart: Number(v) as 0 | 1 })}
              options={[
                { value: '1', label: 'Monday' },
                { value: '0', label: 'Sunday' },
              ]}
            />
          </Row>
          <Row label="Time format">
            <Segmented
              value={s.timeFormat}
              onChange={(timeFormat) => set({ timeFormat })}
              options={[
                { value: '12', label: '12-hour' },
                { value: '24', label: '24-hour' },
              ]}
            />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timers & sounds</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Pomodoro (minutes)" hint="Focus · short break · long break · long break every N rounds">
            {(['focus', 'short', 'long', 'longEvery'] as const).map((k) => (
              <Input
                key={k}
                type="number"
                min={1}
                aria-label={k}
                className="h-9 w-16"
                value={s.pomodoro[k]}
                onChange={(e) => set({ pomodoro: { ...s.pomodoro, [k]: Math.max(1, Number(e.target.value) || 1) } })}
              />
            ))}
          </Row>
          <Row label="Gym rest timer" hint="Starts after each ticked set">
            <Select className="h-9 w-28" value={s.restSeconds} onChange={(e) => set({ restSeconds: Number(e.target.value) })}>
              {[30, 45, 60, 90, 120, 150, 180, 240].map((v) => (
                <option key={v} value={v}>
                  {v < 60 ? `${v} s` : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min`}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Default alarm sound">
            <Select className="h-9 w-40" value={s.defaultSound} onChange={(e) => set({ defaultSound: e.target.value })}>
              {SOUNDS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
            <Button size="icon" variant="outline" onClick={() => playOnce(s.defaultSound)} aria-label="Preview">
              <Play />
            </Button>
          </Row>
          <Row label="Keep screen awake when an alarm is armed" hint="Mobile only; uses the Screen Wake Lock API">
            <Switch checked={s.keepAwake} onChange={(keepAwake) => set({ keepAwake })} />
          </Row>
          <Row label="Time log categories">
            <div className="flex max-w-md flex-wrap justify-end gap-1">
              {s.categories.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                  <button aria-label={`Remove ${c}`} onClick={() => set({ categories: s.categories.filter((x) => x !== c) })}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newCat.trim() && !s.categories.includes(newCat.trim())) set({ categories: [...s.categories, newCat.trim()] })
                  setNewCat('')
                }}
              >
                <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="+ Add" className="h-7 w-24 text-xs" />
              </form>
            </div>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row
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
                await notify('LifeOS test', 'Notifications and sound are working 🎉', { tag: 'test' })
                if (p !== 'granted') toast('Sound played, but notifications are not allowed')
              }}
            >
              <Bell /> Test
            </Button>
          </Row>
          <Row label="Alarm sound" hint={audio ? 'Enabled for this session' : 'Tap once per session so alarms can play sound'}>
            <Button size="sm" variant={audio ? 'outline' : 'default'} onClick={() => unlockAudio()}>
              <Volume2 /> {audio ? 'Enabled' : 'Enable alarm sound'}
            </Button>
          </Row>
        </CardContent>
      </Card>

      {google && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Mail className="h-4 w-4" /> Gmail & Google Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Daily summary email" hint="Morning plan sent on your first open after this time (asks for Gmail send permission)">
              <Input
                type="time"
                className="h-9 w-28"
                value={s.summaryEmail.time}
                onChange={(e) => set({ summaryEmail: { ...s.summaryEmail, time: e.target.value || '07:00' } })}
                disabled={!s.summaryEmail.enabled}
              />
              <Switch
                checked={s.summaryEmail.enabled}
                onChange={(enabled) =>
                  run('gmail', async () => {
                    if (enabled) await ensureScopes(SCOPES.gmailSend)
                    await set({ summaryEmail: { ...s.summaryEmail, enabled } })
                  })
                }
              />
            </Row>
            <Row label="Send now">
              <Button size="sm" variant="outline" disabled={busy === 'morning'} onClick={() => run('morning', () => sendSummary('morning'), 'Morning plan sent ✉️')}>
                Morning plan
              </Button>
              <Button size="sm" variant="outline" disabled={busy === 'night'} onClick={() => run('night', () => sendSummary('night'), 'Night report sent ✉️')}>
                Night report
              </Button>
            </Row>
            <Row label="Mirror alarms to Google Calendar" hint="Your phone reminds you even when LifeOS is closed. Also enables pushing time blocks.">
              <Switch
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
            </Row>
            <Row label="Starred emails → tasks" hint="Needs Gmail read access (restricted scope; fine in Testing mode)">
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Export all data" hint="Download everything as a JSON file">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => downloadFile(`lifeos-export-${ymd()}.json`, JSON.stringify(await exportAll(), null, 2))}
            >
              <Download /> Export
            </Button>
          </Row>
          <Row label="Import data" hint="Merges a LifeOS export; newer records win">
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
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload /> Import
            </Button>
          </Row>
          {installEvt && (
            <Row label="Install LifeOS" hint="Add to your home screen or desktop">
              <Button size="sm" onClick={() => promptInstall()}>
                <Smartphone /> Install
              </Button>
            </Row>
          )}
          <Row label="Delete all data" hint={google ? 'Removes everything from this device and your Google Drive app folder' : 'Removes everything from this device'}>
            <Button
              size="sm"
              variant="destructive"
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
        </CardContent>
      </Card>
      <p className="pb-4 text-center text-xs text-muted-foreground">LifeOS · fully client-side · your data lives in your browser{google ? ' and your Google Drive' : ''}</p>
      <StarredImport open={starred} onClose={() => setStarred(false)} />
      {node}
    </div>
  )
}
