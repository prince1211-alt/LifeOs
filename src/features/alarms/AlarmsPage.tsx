import { Fragment, useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  AlarmClock,
  AlarmOn,
  Bell,
  BellRing,
  Brain,
  CheckCircle,
  Info,
  Play,
  Plus,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Volume2,
} from '@/components/icons'
import { useNewParam, useNow, useSettings, useTable } from '@/lib/hooks'
import type { Alarm } from '@/lib/types'
import { formatTime } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DayPicker, Field, Input, Select, Switch } from '@/components/ui/form'
import { Badge, Divider, EmptyState, ListItem, PageHeader, SectionTitle } from '@/components/ui/misc'
import { SOUNDS, playOnce, unlockAudio } from '@/lib/audio'
import { notificationPermission, requestNotifications, wakeLockActive } from '@/lib/notify'
import { useApp } from '@/store/app'
import { deleteAlarm, saveAlarm } from './actions'
import { describeRepeat, nextAlarm, nextFire } from './schedule'
import { ring } from './AlarmEngine'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Settings-style row with an icon, a title, supporting text and a trailing switch; the whole row toggles. */
function SwitchRow({
  icon,
  title,
  text,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  text: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 py-2">
      <span className="flex shrink-0 text-on-surface-variant [&_svg]:size-6">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-large text-on-surface">{title}</span>
        <span className="block text-body-medium text-on-surface-variant">{text}</span>
      </span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  )
}

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
  const volume = d.volume ?? 0.8

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
              className="mr-auto -ml-3 text-error"
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
            variant="ghost"
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
      <div className="grid gap-5">
        <Input
          type="time"
          value={d.time}
          onChange={(e) => set({ time: e.target.value || '07:00' })}
          className="tabular h-20 rounded-lg border-transparent bg-surface-container-highest text-center text-display-small hover:border-transparent"
          aria-label="Alarm time"
        />
        <Field label="Label">
          <Input value={d.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Wake up" />
        </Field>
        <Field plain label="Repeat" supporting={describeRepeat(d.repeatDays ?? [])}>
          <DayPicker value={d.repeatDays ?? []} onChange={(repeatDays) => set({ repeatDays })} weekStart={settings.weekStart} />
        </Field>
        <div className="flex items-center gap-2">
          <Field label="Sound" className="flex-1">
            <Select value={d.sound} onChange={(e) => set({ sound: e.target.value })}>
              {SOUNDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <IconButton label="Preview sound" variant="secondary" size="icon-lg" onClick={() => playOnce(d.sound ?? 'classic', d.volume)}>
            <Play filled />
          </IconButton>
        </div>
        <div className="grid gap-1">
          <div className="flex items-center justify-between text-label-large text-on-surface-variant">
            <span>Volume</span>
            <span className="tabular">{Math.round(volume * 100)}%</span>
          </div>
          <div className="flex items-center gap-3 text-on-surface-variant">
            <Volume2 className="size-6" />
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => set({ volume: Number(e.target.value) })}
              aria-label="Volume"
              className="h-10 min-w-0 flex-1"
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>
        <div className="grid gap-1">
          <SwitchRow
            icon={<Brain />}
            title="Wake-up challenge"
            text="Solve a small maths problem to dismiss"
            checked={Boolean(d.challenge)}
            onChange={(challenge) => set({ challenge })}
          />
          <SwitchRow
            icon={<TrendingUp />}
            title="Gradual volume"
            text="Starts soft and rises over 30 seconds"
            checked={Boolean(d.gradual)}
            onChange={(gradual) => set({ gradual })}
          />
        </div>
      </div>
    </Dialog>
  )
}

function ReadinessCard() {
  const audio = useApp((s) => s.audioUnlocked)
  const [perm, setPerm] = useState(notificationPermission())
  useNow(5000)
  const wake = wakeLockActive()
  const items = [
    {
      title: 'Alarm sound',
      ok: audio,
      label: audio ? 'Alarm sound enabled' : 'Alarm sound not enabled yet (tap once per session)',
      action: !audio && (
        <Button size="sm" variant="secondary" onClick={() => unlockAudio()}>
          <Volume2 /> Enable
        </Button>
      ),
    },
    {
      title: 'Notifications',
      ok: perm === 'granted',
      label:
        perm === 'unsupported'
          ? 'Notifications not supported here'
          : perm === 'denied'
            ? 'Notifications blocked in browser settings'
            : perm === 'granted'
              ? 'Notifications allowed'
              : 'Notifications not allowed yet',
      action: perm === 'default' && (
        <Button size="sm" variant="secondary" onClick={async () => setPerm(await requestNotifications())}>
          <Bell /> Allow
        </Button>
      ),
    },
    {
      title: 'Screen awake',
      ok: wake,
      label: wake ? 'Screen kept awake for alarm' : 'Screen wake lock (mobile, when an alarm is armed)',
      action: null,
    },
  ]
  return (
    <section aria-label="Alarm readiness">
      <SectionTitle>Alarm readiness</SectionTitle>
      <div className="overflow-hidden rounded-lg bg-surface-container-low">
        {items.map((i, idx) => (
          <Fragment key={i.title}>
            {idx > 0 && <Divider inset />}
            <ListItem
              leading={i.ok ? <CheckCircle filled className="text-success" /> : <TriangleAlert filled className="text-warning" />}
              headline={i.title}
              supporting={i.label}
              trailing={i.action || undefined}
            />
          </Fragment>
        ))}
        <Divider />
        <div className="flex gap-4 px-4 py-3 text-body-small text-on-surface-variant">
          <Info className="size-5 shrink-0" />
          <p>
            Alarms ring only while LifeOS is open (a pinned tab or the installed app). Turn on “Mirror to Google Calendar” in
            Settings for a backup reminder on your phone.
          </p>
        </div>
      </div>
    </section>
  )
}

/** Google Clock style alarm card: big time, label and repeat days, test ring and on/off switch. */
function AlarmCard({ alarm: a, now, onOpen }: { alarm: Alarm; now: number; onOpen: () => void }) {
  const settings = useSettings()
  const nf = nextFire(a, now)
  const time = formatTime(a.time, settings.timeFormat)
  const [hm, suffix] = time.split(' ')
  const order = settings.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]
  const dayColor = (on: boolean) => (on ? (a.enabled ? 'text-primary' : 'text-on-surface') : 'text-outline')

  return (
    <div
      onClick={onOpen}
      className="state-layer flex cursor-pointer items-start gap-2 rounded-xl bg-surface-container-low py-4 pr-3 pl-5 has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-offset-2 has-[>button:focus-visible]:outline-primary"
    >
      {/* The card's click handler opens the editor; this button makes it reachable by keyboard. */}
      <button
        type="button"
        aria-label={`Edit alarm ${time}, ${a.label || 'Alarm'}, ${describeRepeat(a.repeatDays)}`}
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
      >
        <span className={`tabular block text-display-small ${a.enabled ? 'text-on-surface' : 'text-on-surface-variant'}`}>
          {hm}
          {suffix && <span className="ml-1 text-title-large">{suffix}</span>}
        </span>
        <span className="mt-1 block truncate text-body-medium text-on-surface-variant">{a.label || 'Alarm'}</span>
        {a.repeatDays.length ? (
          <span className="mt-1 flex gap-2 text-label-large">
            {order.map((day) => (
              <span key={day} className={dayColor(a.repeatDays.includes(day))}>
                {DAY_LETTERS[day]}
              </span>
            ))}
          </span>
        ) : (
          <span className="mt-1 block text-label-large text-on-surface-variant">{describeRepeat(a.repeatDays)}</span>
        )}
        {(nf || a.challenge || a.gradual || a.calendarEventId) && (
          <span className="mt-3 flex flex-wrap items-center gap-2">
            {nf && (
              <span className="mr-1 flex items-center gap-1 text-body-small text-on-surface-variant">
                <AlarmOn className="size-4" /> Rings in {formatDistanceToNowStrict(nf)}
              </span>
            )}
            {a.challenge && (
              <Badge variant="secondary">
                <Brain /> Challenge
              </Badge>
            )}
            {a.gradual && (
              <Badge variant="secondary">
                <TrendingUp /> Gradual
              </Badge>
            )}
            {a.calendarEventId && <Badge variant="primary">Calendar</Badge>}
          </span>
        )}
      </button>
      <div className="flex h-11 shrink-0 items-center gap-1">
        <IconButton
          label="Test ring"
          title="Test ring now"
          onClick={(e) => {
            e.stopPropagation()
            ring(a)
          }}
        >
          <BellRing />
        </IconButton>
        {/* Keep the card's ripple off when the switch is pressed. */}
        <span className="flex" onPointerDown={(e) => e.stopPropagation()}>
          <Switch checked={a.enabled} onChange={(enabled) => saveAlarm({ id: a.id, enabled })} label="Alarm on/off" />
        </span>
      </div>
    </div>
  )
}

export function AlarmsPage() {
  const alarms = useTable('alarms')
  const now = useNow(1000)
  const [editing, setEditing] = useState<Alarm | null>(null)
  const [creating, setCreating] = useState(false)
  useNewParam(() => setCreating(true))
  const next = nextAlarm(alarms ?? [], now)
  const sorted = [...(alarms ?? [])].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div>
      <PageHeader
        title="Alarms"
        subtitle={next ? `Next: ${next.alarm.label || 'Alarm'} in ${formatDistanceToNowStrict(next.at)}` : 'No alarms on'}
        fab={{ icon: <Plus />, label: 'New alarm', onClick: () => setCreating(true) }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          {alarms === undefined ? null : sorted.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map((a) => (
                <AlarmCard key={a.id} alarm={a} now={now} onOpen={() => setEditing(a)} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<AlarmClock />}
              title="No alarms yet"
              text="Set a wake-up alarm. Keep LifeOS open as a pinned tab or installed app so it can ring."
              action={
                <Button variant="secondary" onClick={() => setCreating(true)}>
                  <Plus /> Add alarm
                </Button>
              }
            />
          )}
        </div>
        <ReadinessCard />
      </div>
      <AlarmDialog open={creating || Boolean(editing)} alarm={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  )
}
