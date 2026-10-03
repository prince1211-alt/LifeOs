import { useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { AlarmClock, Bell, BellRing, Brain, Play, Plus, Trash2, TrendingUp, Volume2 } from 'lucide-react'
import { useNow, useSettings, useTable } from '@/lib/hooks'
import type { Alarm } from '@/lib/types'
import { cn, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { DayPicker, Field, Input, Select, Switch } from '@/components/ui/form'
import { Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { SOUNDS, playOnce, unlockAudio } from '@/lib/audio'
import { notificationPermission, requestNotifications, wakeLockActive } from '@/lib/notify'
import { useApp } from '@/store/app'
import { deleteAlarm, saveAlarm } from './actions'
import { describeRepeat, nextAlarm, nextFire } from './schedule'
import { ring } from './AlarmEngine'

function AlarmDialog({ alarm, open, onClose }: { alarm: Alarm | null; open: boolean; onClose: () => void }) {
  const settings = useSettings()
  const tasks = (useTable('tasks') ?? []).filter((t) => t.status === 'open')
  const blank = (): Partial<Alarm> => ({
    time: '07:00',
    label: '',
    repeatDays: [1, 2, 3, 4, 5],
    sound: settings.defaultSound,
    volume: 0.8,
    enabled: true,
    snoozeMinutes: 5,
    linkedTaskId: null,
    challenge: false,
    gradual: false,
  })
  const [d, setD] = useState<Partial<Alarm>>(blank)
  useEffect(() => {
    if (open) setD(alarm ?? blank())
  }, [open, alarm?.id])
  const set = (p: Partial<Alarm>) => setD((x) => ({ ...x, ...p }))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={alarm ? 'Edit alarm' : 'New alarm'}
      footer={
        <>
          {alarm && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={async () => {
                await deleteAlarm(alarm)
                onClose()
              }}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await saveAlarm({ ...d, enabled: alarm ? d.enabled : true })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Input
          type="time"
          value={d.time}
          onChange={(e) => set({ time: e.target.value || '07:00' })}
          className="tabular h-16 text-center text-4xl font-bold"
          aria-label="Alarm time"
        />
        <Field label="Label">
          <Input value={d.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Wake up" />
        </Field>
        <Field label={`Repeat — ${describeRepeat(d.repeatDays ?? [])}`}>
          <DayPicker value={d.repeatDays ?? []} onChange={(repeatDays) => set({ repeatDays })} weekStart={settings.weekStart} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label="Sound">
            <Select value={d.sound} onChange={(e) => set({ sound: e.target.value })}>
              {SOUNDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => playOnce(d.sound ?? 'classic', d.volume)} aria-label="Preview sound">
            <Play />
          </Button>
        </div>
        <Field label={`Volume — ${Math.round((d.volume ?? 0.8) * 100)}%`}>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={d.volume ?? 0.8}
            onChange={(e) => set({ volume: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </Field>
        <Field label="Snooze length">
          <Select value={d.snoozeMinutes} onChange={(e) => set({ snoozeMinutes: Number(e.target.value) })}>
            {[1, 3, 5, 9, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Linked task (optional)">
          <Select value={d.linkedTaskId ?? ''} onChange={(e) => set({ linkedTaskId: e.target.value || null })}>
            <option value="">None</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span>
              Wake-up challenge
              <span className="block text-xs text-muted-foreground">Solve a small maths problem to dismiss</span>
            </span>
          </span>
          <Switch checked={Boolean(d.challenge)} onChange={(challenge) => set({ challenge })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>
              Gradual volume
              <span className="block text-xs text-muted-foreground">Starts soft and rises over 30 seconds</span>
            </span>
          </span>
          <Switch checked={Boolean(d.gradual)} onChange={(gradual) => set({ gradual })} />
        </label>
      </div>
    </Dialog>
  )
}

function ReadinessCard() {
  const audio = useApp((s) => s.audioUnlocked)
  const [perm, setPerm] = useState(notificationPermission())
  useNow(5000)
  const items = [
    {
      ok: audio,
      label: audio ? 'Alarm sound enabled' : 'Alarm sound not enabled yet (tap once per session)',
      action: !audio && (
        <Button size="sm" onClick={() => unlockAudio()}>
          <Volume2 /> Enable
        </Button>
      ),
    },
    {
      ok: perm === 'granted',
      label: perm === 'unsupported' ? 'Notifications not supported here' : perm === 'denied' ? 'Notifications blocked in browser settings' : perm === 'granted' ? 'Notifications allowed' : 'Notifications not allowed yet',
      action: perm === 'default' && (
        <Button size="sm" onClick={async () => setPerm(await requestNotifications())}>
          <Bell /> Allow
        </Button>
      ),
    },
    { ok: wakeLockActive(), label: wakeLockActive() ? 'Screen kept awake for alarm' : 'Screen wake lock (mobile, when an alarm is armed)', action: null },
  ]
  return (
    <Card className="mb-4 p-4">
      <h3 className="mb-2 text-sm font-semibold">Alarm readiness</h3>
      <ul className="grid gap-2 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', i.ok ? 'bg-success' : 'bg-warning')} />
              {i.label}
            </span>
            {i.action}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Alarms ring only while LifeOS is open (a pinned tab or the installed app). Turn on “Mirror to Google Calendar” in Settings
        for a backup reminder on your phone.
      </p>
    </Card>
  )
}

export function AlarmsPage() {
  const alarms = useTable('alarms')
  const settings = useSettings()
  const now = useNow(1000)
  const [editing, setEditing] = useState<Alarm | null>(null)
  const [creating, setCreating] = useState(false)
  const next = nextAlarm(alarms ?? [], now)
  const sorted = [...(alarms ?? [])].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div>
      <PageHeader
        title="Alarms"
        subtitle={next ? `Next: ${next.alarm.label || 'Alarm'} in ${formatDistanceToNowStrict(next.at)}` : 'No alarms on'}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New alarm
          </Button>
        }
      />
      <ReadinessCard />
      {alarms === undefined ? null : sorted.length ? (
        <div className="grid gap-2">
          {sorted.map((a) => {
            const nf = nextFire(a, now)
            return (
              <Card key={a.id} className={cn('cursor-pointer transition-colors hover:bg-muted/30', !a.enabled && 'opacity-60')} onClick={() => setEditing(a)}>
                <div className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="tabular text-3xl font-bold tracking-tight">{formatTime(a.time, settings.timeFormat)}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                      <span>{a.label || 'Alarm'}</span>·<span>{describeRepeat(a.repeatDays)}</span>
                      {a.challenge && <Badge><Brain className="h-3 w-3" /> challenge</Badge>}
                      {a.gradual && <Badge><TrendingUp className="h-3 w-3" /> gradual</Badge>}
                      {a.calendarEventId && <Badge variant="primary">Calendar</Badge>}
                    </div>
                    {nf && <div className="text-xs text-muted-foreground">Rings in {formatDistanceToNowStrict(nf)}</div>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Test ring"
                    title="Test ring now"
                    onClick={(e) => {
                      e.stopPropagation()
                      ring(a)
                    }}
                  >
                    <BellRing />
                  </Button>
                  <Switch checked={a.enabled} onChange={(enabled) => saveAlarm({ id: a.id, enabled })} label="Alarm on/off" />
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<AlarmClock />}
          title="No alarms yet"
          text="Set a wake-up alarm. Keep LifeOS open as a pinned tab or installed app so it can ring."
          action={<Button onClick={() => setCreating(true)}><Plus /> Add alarm</Button>}
        />
      )}
      <AlarmDialog open={creating || Boolean(editing)} alarm={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  )
}
