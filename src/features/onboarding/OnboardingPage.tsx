import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Loader2, Volume2 } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DayPicker, Field, Input, Select } from '@/components/ui/form'
import { Progress } from '@/components/ui/misc'
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        Loading your LifeOS data from Google Drive…
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-5">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </span>
            <button onClick={skipAll} className="hover:text-foreground">
              Skip setup
            </button>
          </div>
          <Progress value={(step + 1) / STEPS.length} />
        </div>

        {step === 0 && (
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">Allow alerts</h2>
            <p className="text-sm text-muted-foreground">LifeOS needs notifications and sound so alarms and reminders can reach you.</p>
            <Button
              size="lg"
              variant={perm === 'granted' ? 'outline' : 'default'}
              onClick={async () => setPerm(await requestNotifications())}
            >
              {perm === 'granted' ? <Check /> : <Bell />} {perm === 'granted' ? 'Notifications allowed' : 'Allow notifications'}
            </Button>
            {perm === 'denied' && <p className="text-xs text-destructive">Blocked — you can allow notifications later in your browser settings.</p>}
            <Button
              size="lg"
              variant={audio ? 'outline' : 'default'}
              onClick={async () => {
                if (await unlockAudio()) playOnce('chime', 0.6)
              }}
            >
              {audio ? <Check /> : <Volume2 />} {audio ? 'Alarm sound enabled' : 'Enable alarm sound'}
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">Set a wake-up alarm</h2>
            <Input type="time" value={wake.time} onChange={(e) => setWake({ ...wake, time: e.target.value || '06:30' })} className="tabular h-16 text-center text-4xl font-bold" />
            <Field label="Repeat on">
              <DayPicker value={wake.days} onChange={(days) => setWake({ ...wake, days })} weekStart={settings.weekStart} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">Pick up to 3 good habits</h2>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED.map((h) => {
                const on = habits.includes(h.name)
                return (
                  <button
                    key={h.name}
                    onClick={() => setHabits(on ? habits.filter((x) => x !== h.name) : habits.length < 3 ? [...habits, h.name] : habits)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors',
                      on ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                      !on && habits.length >= 3 && 'opacity-50',
                    )}
                  >
                    <span className="text-xl">{h.icon}</span>
                    {h.name}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">{habits.length}/3 selected. You can add more later.</p>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">Quit something? (optional)</h2>
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
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">Choose your gym days</h2>
            <div className="grid gap-2">
              {orderedWeekdays(settings.weekStart).map((d) => (
                <div key={d} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                  <span className="text-sm font-medium">{WEEKDAYS_SHORT[d]}</span>
                  <Select
                    value={gym[String(d)] ?? ''}
                    onChange={(e) => {
                      const g = { ...gym }
                      if (e.target.value) g[String(d)] = e.target.value
                      else delete g[String(d)]
                      setGym(g)
                    }}
                    className="h-9"
                  >
                    <option value="">Rest</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
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
      </Card>
    </div>
  )
}
