import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Loader2, Volume2 } from '@/components/icons'
import { LogoMark } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { DayPicker, Field, Input, Select } from '@/components/ui/form'
import { Divider, Progress } from '@/components/ui/misc'
import { requestNotifications, notificationPermission } from '@/lib/notify'
import { unlockAudio, playOnce } from '@/lib/audio'
import { save } from '@/lib/repo'
import { useSettings, useTable } from '@/lib/hooks'
import { useApp } from '@/store/app'
import { HABIT_COLORS } from '@/lib/habits'
import { cn, orderedWeekdays, WEEKDAYS_SHORT } from '@/lib/utils'
import { saveAlarm } from '../alarms/actions'

const SUGGESTED = [
  { name: 'Drink water', icon: '💧', type: 'count' as const, target: 8 },
  { name: 'Exercise', icon: '🏃', type: 'check' as const, target: 1 },
  { name: 'Read 10 pages', icon: '📚', type: 'check' as const, target: 1 },
  { name: 'Meditate', icon: '🧘', type: 'check' as const, target: 1 },
  { name: 'Sleep by 11 pm', icon: '😴', type: 'check' as const, target: 1 },
  { name: 'Eat vegetables', icon: '🥗', type: 'check' as const, target: 1 },
  { name: 'Journal', icon: '✍️', type: 'check' as const, target: 1 },
  { name: 'Floss', icon: '🦷', type: 'check' as const, target: 1 },
]

const STEPS = ['Alerts', 'Alarm', 'Habits', 'Quit', 'Gym']

const STEP_TEXT = [
  { title: 'Allow alerts', text: 'LifeOS needs notifications and sound so alarms and reminders can reach you.' },
  { title: 'Set a wake-up alarm', text: 'Pick a time and the days it repeats. You can add more alarms later.' },
  { title: 'Pick up to 3 good habits', text: 'Start small. You can add more habits later.' },
  { title: 'Quit something?', text: 'Optional. LifeOS counts your clean time and the money and time you save.' },
  { title: 'Choose your gym days', text: 'Pick a workout for each day, or leave it as a rest day.' },
]

/** Tonal permission card: icon disc, title, supporting text and one action. */
function PermissionCard({
  icon,
  title,
  text,
  done,
  children,
}: {
  icon: React.ReactNode
  title: string
  text: string
  done: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4 rounded-lg bg-surface-container p-4">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-6',
          done ? 'bg-success-container text-on-success-container' : 'bg-secondary-container text-on-secondary-container',
        )}
      >
        {done ? <Check /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-title-medium text-on-surface">{title}</div>
        <p className="mt-0.5 text-body-medium text-on-surface-variant">{text}</p>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

/** First-time onboarding: runs only when the account has no LifeOS data yet. */
export function OnboardingPage() {
  const nav = useNavigate()
  const settings = useSettings()
  const templates = useTable('workoutTemplates') ?? []
  const audio = useApp((s) => s.audioUnlocked)
  const [step, setStep] = useState(0)
  const [perm, setPerm] = useState(notificationPermission())
  const [wake, setWake] = useState({ time: '06:30', days: [1, 2, 3, 4, 5] })
  const [habits, setHabits] = useState<string[]>([])
  const [quit, setQuit] = useState({ name: '', cost: '', minutes: '' })
  const [gym, setGym] = useState<Record<string, string>>({})
  const user = useApp((s) => s.user)
  const sync = useApp((s) => s.sync)

  // A returning user on a new device: once Drive data arrives, skip onboarding.
  useEffect(() => {
    if (settings.onboardedAt) nav('/today', { replace: true })
  }, [settings.onboardedAt, nav])

  if (user?.mode === 'google' && sync.status === 'syncing' && !sync.lastSyncedAt)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface px-6 pt-[env(safe-area-inset-top)] text-center">
        <LogoMark size={56} />
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-body-large text-on-surface-variant">Loading your LifeOS data from Google Drive…</p>
      </div>
    )

  const finish = async () => {
    await saveAlarm({ time: wake.time, label: 'Wake up', repeatDays: wake.days, sound: settings.defaultSound, volume: 0.8, enabled: true, snoozeMinutes: 5 })
    let i = 0
    for (const name of habits) {
      const h = SUGGESTED.find((x) => x.name === name)!
      await save('habits', {
        name: h.name,
        icon: h.icon,
        color: HABIT_COLORS[i++ % HABIT_COLORS.length],
        type: h.type,
        target: h.target,
        schedule: { kind: 'daily', days: [], timesPerWeek: 3 },
        reminderTime: null,
      })
    }
    if (quit.name.trim())
      await save('quitGoals', { name: quit.name.trim(), startDate: Date.now(), costPerDay: Number(quit.cost) || 0, minutesPerDay: Number(quit.minutes) || 0, reason: '' })
    await save('settings', { id: 'settings', gymSchedule: gym, onboardedAt: Date.now() })
    nav('/today', { replace: true })
  }

  const skipAll = async () => {
    await save('settings', { id: 'settings', onboardedAt: Date.now() })
    nav('/today', { replace: true })
  }

  const granted = perm === 'granted'

  return (
    <div className="flex min-h-dvh flex-col bg-surface pt-[env(safe-area-inset-top)] sm:items-center sm:justify-center sm:p-6">
      <div className="flex w-full flex-1 flex-col overflow-hidden [--field-bg:var(--md-surface)] sm:max-w-[560px] sm:flex-none sm:rounded-xl sm:bg-surface-container-low sm:[--field-bg:var(--md-surface-container-low)]">
        <div className="sm:px-8 sm:pt-6">
          <Progress value={(step + 1) / STEPS.length} />
        </div>

        <div className="flex items-center gap-3 px-6 pt-4 sm:px-8">
          <LogoMark size={28} />
          <span className="flex-1 text-label-large text-on-surface-variant">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </span>
          <Button variant="ghost" size="sm" className="-mr-3" onClick={skipAll}>
            Skip setup
          </Button>
        </div>

        <div className="flex-1 px-6 pt-6 pb-4 sm:min-h-[420px] sm:px-8">
          <h1 className="text-headline-small text-on-surface">{STEP_TEXT[step].title}</h1>
          <p className="mt-2 text-body-medium text-on-surface-variant">{STEP_TEXT[step].text}</p>

          <div className="mt-6">
            {step === 0 && (
              <div className="grid gap-3">
                <PermissionCard icon={<Bell />} title="Notifications" text="Alarms and reminders pop up even when LifeOS is in the background." done={granted}>
                  <Button variant={granted ? 'secondary' : 'default'} onClick={async () => setPerm(await requestNotifications())}>
                    {granted ? <Check /> : <Bell />} {granted ? 'Notifications allowed' : 'Allow notifications'}
                  </Button>
                  {perm === 'denied' && (
                    <p className="mt-2 text-body-small text-error">Blocked — you can allow notifications later in your browser settings.</p>
                  )}
                </PermissionCard>
                <PermissionCard icon={<Volume2 />} title="Alarm sound" text="Browsers only play sound after a tap, so turn it on once now." done={audio}>
                  <Button
                    variant={audio ? 'secondary' : 'default'}
                    onClick={async () => {
                      if (await unlockAudio()) playOnce('chime', 0.6)
                    }}
                  >
                    {audio ? <Check /> : <Volume2 />} {audio ? 'Alarm sound enabled' : 'Enable alarm sound'}
                  </Button>
                </PermissionCard>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-6">
                <Field label="Wake-up time">
                  <Input
                    type="time"
                    value={wake.time}
                    onChange={(e) => setWake({ ...wake, time: e.target.value || '06:30' })}
                    className="tabular h-20 text-center text-display-small"
                  />
                </Field>
                <Field label="Repeat on" plain>
                  <DayPicker value={wake.days} onChange={(days) => setWake({ ...wake, days })} weekStart={settings.weekStart} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTED.map((h) => {
                    const on = habits.includes(h.name)
                    const full = !on && habits.length >= 3
                    return (
                      <button
                        key={h.name}
                        type="button"
                        aria-pressed={on}
                        aria-disabled={full}
                        onClick={() => setHabits(on ? habits.filter((x) => x !== h.name) : habits.length < 3 ? [...habits, h.name] : habits)}
                        className={cn(
                          'state-layer flex min-h-14 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                          on ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface',
                          full && 'opacity-40',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-full text-title-large',
                            on ? 'bg-surface-container-lowest/60' : 'bg-surface-container-highest',
                          )}
                          aria-hidden
                        >
                          {h.icon}
                        </span>
                        <span className="min-w-0 flex-1 text-label-large">{h.name}</span>
                        {on && <Check className="size-5 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
                <p className="px-1 text-body-small text-on-surface-variant">{habits.length} of 3 selected</p>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-5">
                <Field label="What do you want to quit?">
                  <Input value={quit.name} onChange={(e) => setQuit({ ...quit, name: e.target.value })} placeholder="Smoking, junk food, reels…" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cost per day (₹)">
                    <Input type="number" min={0} value={quit.cost} onChange={(e) => setQuit({ ...quit, cost: e.target.value })} />
                  </Field>
                  <Field label="Minutes wasted per day">
                    <Input type="number" min={0} value={quit.minutes} onChange={(e) => setQuit({ ...quit, minutes: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="overflow-hidden rounded-lg bg-surface-container [--field-bg:var(--md-surface-container)]">
                {orderedWeekdays(settings.weekStart).map((d, i) => {
                  const workout = Boolean(gym[String(d)])
                  return (
                    <div key={d}>
                      {i > 0 && <Divider className="ml-[72px]" />}
                      <div className="flex items-center gap-4 px-4 py-2">
                        <span
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full',
                            workout ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant',
                          )}
                        >
                          <span className="text-label-large">{WEEKDAYS_SHORT[d]}</span>
                        </span>
                        <Select
                          aria-label={`Workout on ${WEEKDAYS_SHORT[d]}`}
                          value={gym[String(d)] ?? ''}
                          onChange={(e) => {
                            const g = { ...gym }
                            if (e.target.value) g[String(d)] = e.target.value
                            else delete g[String(d)]
                            setGym(g)
                          }}
                          className="h-12 flex-1"
                        >
                          <option value="">Rest</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={finish}>
              <Check /> Finish
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
