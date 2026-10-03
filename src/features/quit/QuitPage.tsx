import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Award, ChevronRight, Clock, HeartPulse, Pencil, Plus, RotateCcw, Savings, ShieldOff, Tag, Trash2, Zap } from '@/components/icons'
import { useNewParam, useNow, useTable } from '@/lib/hooks'
import type { Habit, QuitGoal, Relapse, UrgeLog } from '@/lib/types'
import { bestStreakMs, formatHour, MILESTONES, quitStats, urgeInsights } from '@/lib/quit'
import { remove, save } from '@/lib/repo'
import { cn, formatDuration, rupees } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { Chip, Field, Input, Segmented, Select, Textarea } from '@/components/ui/form'
import { Badge, EmptyState, ListItem, PageHeader, Progress, SectionTitle, Stat } from '@/components/ui/misc'
import { toast } from '@/store/app'
import { HabitAvatar, HabitCheck } from '../habits/HabitCheck'
import { habitLogId } from '@/lib/habits'
import { ymd } from '@/lib/utils'

const toLocalInput = (ms: number) => format(ms, "yyyy-MM-dd'T'HH:mm")

const axis = { tick: { fontSize: 11, fill: 'var(--md-on-surface-variant)' }, axisLine: false, tickLine: false } as const
const tooltipStyle = { background: 'var(--md-surface-container-high)', border: 'none', borderRadius: 8, color: 'var(--md-on-surface)' }

export function cleanLabel(elapsed: number) {
  return formatDuration(elapsed)
}

/** Clean time with big numbers and small units, e.g. "5 days 4 hrs" (Google Clock style). */
function CleanTimer({ text }: { text: string }) {
  const parts = text.split(' ')
  const pairs = Array.from({ length: Math.ceil(parts.length / 2) }, (_, i) => [parts[i * 2], parts[i * 2 + 1] ?? ''] as const)
  return (
    <span className="tabular flex flex-wrap items-baseline gap-x-3">
      {pairs.map(([n, unit]) => (
        <span key={unit} className="whitespace-nowrap">
          <span className="text-display-small">{n}</span>
          <span className="ml-1 text-title-medium">{unit}</span>
        </span>
      ))}
    </span>
  )
}

/** "Why I'm quitting" callout in the contrasting tertiary colour. */
function ReasonCallout({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg bg-tertiary-container p-4 text-on-tertiary-container">
      <div className="flex items-center gap-2 text-label-large">
        <HeartPulse className="size-[18px]" /> Why I'm quitting
      </div>
      <p className="mt-1 text-body-large">{reason}</p>
    </div>
  )
}

function Milestones({ days }: { days: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MILESTONES.slice(0, 5).map((m) => {
        const got = days >= m.days
        return (
          <Badge key={m.days} variant={got ? 'tertiary' : 'outline'} title={got ? `Reached ${m.label}` : `Reach ${m.label}`}>
            <Award filled={got} />
            {m.label}
          </Badge>
        )
      })}
    </div>
  )
}

function GoalDialog({ goal, open, onClose }: { goal: QuitGoal | null; open: boolean; onClose: () => void }) {
  const habits = useTable('habits') ?? []
  const blank = (): Partial<QuitGoal> => ({ name: '', startDate: Date.now(), costPerDay: 0, minutesPerDay: 0, reason: '', replacementHabitId: null })
  const [d, setD] = useState<Partial<QuitGoal>>(blank)
  useEffect(() => {
    if (open) setD(goal ?? blank())
  }, [open, goal])
  const set = (p: Partial<QuitGoal>) => setD((x) => ({ ...x, ...p }))
  const submit = async () => {
    if (!d.name?.trim()) return
    await save('quitGoals', { ...d, name: d.name.trim() })
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? 'Edit quit goal' : 'New quit goal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={submit} disabled={!d.name?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5 pt-2">
        <Field label="What are you quitting?">
          <Input autoFocus value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Smoking, junk food, reels…" />
        </Field>
        <Field label="Clean since">
          <Input
            type="datetime-local"
            value={toLocalInput(d.startDate ?? Date.now())}
            onChange={(e) => set({ startDate: e.target.value ? new Date(e.target.value).getTime() : Date.now() })}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
          <Field label="Cost per day (₹)">
            <Input type="number" min={0} value={d.costPerDay ?? 0} onChange={(e) => set({ costPerDay: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Minutes wasted per day">
            <Input type="number" min={0} value={d.minutesPerDay ?? 0} onChange={(e) => set({ minutesPerDay: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="Why I'm quitting" supporting="Shown when you log an urge">
          <Textarea value={d.reason ?? ''} onChange={(e) => set({ reason: e.target.value })} placeholder="For my lungs, my family and my wallet." />
        </Field>
        <Field label="Replacement habit" supporting="Opens when you log an urge">
          <Select value={d.replacementHabitId ?? ''} onChange={(e) => set({ replacementHabitId: e.target.value || null })}>
            <option value="">None</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.icon} {h.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  )
}

export function UrgeDialog({ goal, open, onClose }: { goal: QuitGoal; open: boolean; onClose: () => void }) {
  const urges = useTable('urgeLogs') ?? []
  const habits = useTable('habits') ?? []
  const logs = useTable('habitLogs') ?? []
  const [trigger, setTrigger] = useState('')
  const [intensity, setIntensity] = useState(3)
  const [action, setAction] = useState('')
  useEffect(() => {
    if (open) {
      setTrigger('')
      setIntensity(3)
      setAction('')
    }
  }, [open])
  const past = [...new Set(urges.filter((u) => u.quitGoalId === goal.id).map((u) => u.trigger.trim()).filter(Boolean))].slice(0, 6)
  const replacement: Habit | undefined = habits.find((h) => h.id === goal.replacementHabitId)
  const submit = async () => {
    await save('urgeLogs', { quitGoalId: goal.id, at: Date.now(), trigger: trigger.trim(), intensity, action: action.trim() })
    toast('Urge logged. You beat it. 💪')
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Urge: ${goal.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={submit}>
            Log urge
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {goal.reason && <ReasonCallout reason={goal.reason} />}
        {replacement && (
          <div className="flex items-center gap-3 rounded-lg bg-surface-container py-3 pr-3 pl-4">
            <HabitAvatar habit={replacement} />
            <div className="min-w-0 flex-1">
              <div className="text-label-medium text-on-surface-variant">Do this instead</div>
              <div className="truncate text-title-medium text-on-surface">{replacement.name}</div>
            </div>
            <HabitCheck habit={replacement} log={logs.find((l) => l.id === habitLogId(replacement.id, ymd()))} date={ymd()} />
          </div>
        )}
        <div className="grid gap-3 pt-2">
          <Field label="Trigger">
            <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="Stress, boredom, after lunch…" />
          </Field>
          {past.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {past.map((p) => (
                <Chip key={p} selected={trigger === p} onClick={() => setTrigger(p)}>
                  {p}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <Field plain label="Intensity" supporting="1 is mild, 5 is overwhelming">
          <Segmented
            value={String(intensity)}
            onChange={(v) => setIntensity(Number(v))}
            className="w-full"
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Field>
        <Field label="What I did instead">
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Went for a walk, drank water…" />
        </Field>
      </div>
    </Dialog>
  )
}

function RelapseDialog({ goal, open, onClose }: { goal: QuitGoal; open: boolean; onClose: () => void }) {
  const [note, setNote] = useState('')
  useEffect(() => setNote(''), [open])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={<RotateCcw style={{ color: 'var(--md-secondary)' }} />}
      title="Log a relapse"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            className="text-error"
            onClick={async () => {
              await save('relapses', { quitGoalId: goal.id, at: Date.now(), note: note.trim() })
              toast('Timer reset. Your history is kept — start again now.')
              onClose()
            }}
          >
            Reset timer
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <p className="text-body-medium text-on-surface-variant">It happens. The timer restarts from now; your past streaks and urge log stay saved.</p>
        <Field label="What happened? (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

function GoalCard({ goal, relapses, urges, onOpen }: { goal: QuitGoal; relapses: Relapse[]; urges: UrgeLog[]; onOpen: () => void }) {
  const now = useNow(1000)
  const s = quitStats(goal, relapses, now)
  const [urgeOpen, setUrgeOpen] = useState(false)
  const [relapseOpen, setRelapseOpen] = useState(false)
  const todayUrges = urges.filter((u) => u.quitGoalId === goal.id && ymd(u.at) === ymd(now)).length
  return (
    <Card className="flex flex-col gap-4 p-2 pb-4">
      <button type="button" onClick={onOpen} className="state-layer flex flex-col rounded-md bg-primary-container p-4 text-left text-on-primary-container">
        <span className="flex items-center gap-2">
          <ShieldOff className="size-5" />
          <span className="min-w-0 flex-1 truncate text-title-medium">No {goal.name.toLowerCase()}</span>
          <ChevronRight className="size-6" />
        </span>
        <span className="mt-3">
          <CleanTimer text={formatDuration(s.elapsed, { seconds: s.days < 1 })} />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-body-medium">
          <span>Clean since {format(s.since, 'd MMM yyyy, p')}</span>
          {todayUrges > 0 && (
            <Badge variant="tertiary">
              <Zap /> {todayUrges} {todayUrges === 1 ? 'urge' : 'urges'} today
            </Badge>
          )}
        </span>
      </button>
      <div className="grid gap-4 px-2">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Money saved" value={rupees(s.moneySaved)} />
          <Stat label="Time saved" value={formatDuration(s.minutesSaved * 60_000)} />
        </div>
        {s.next && (
          <div className="grid gap-2">
            <div className="flex justify-between gap-2 text-body-small text-on-surface-variant">
              <span>Next milestone: {s.next.label}</span>
              <span className="tabular">{Math.round(s.nextProgress * 100)}%</span>
            </div>
            <Progress value={s.nextProgress} />
          </div>
        )}
        <Milestones days={s.days} />
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={() => setUrgeOpen(true)}>
            <Zap /> Log urge
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => setRelapseOpen(true)}>
            <RotateCcw /> Relapse
          </Button>
        </div>
      </div>
      <UrgeDialog goal={goal} open={urgeOpen} onClose={() => setUrgeOpen(false)} />
      <RelapseDialog goal={goal} open={relapseOpen} onClose={() => setRelapseOpen(false)} />
    </Card>
  )
}

/** Intensity 1–5 as a tonal disc: calm colours for mild urges, error colours for strong ones. */
function IntensityDisc({ value }: { value: number }) {
  const tone =
    value >= 4
      ? 'bg-error-container text-on-error-container'
      : value === 3
        ? 'bg-warning-container text-on-warning-container'
        : 'bg-secondary-container text-on-secondary-container'
  return (
    <span title={`Intensity ${value}/5`} className={cn('tabular flex size-10 items-center justify-center rounded-full', tone)}>
      <span className="sr-only">Intensity </span>
      <span className="text-title-medium">{value}</span>
    </span>
  )
}

function GoalDetail({ goal, relapses, urges, onClose, onEdit }: { goal: QuitGoal; relapses: Relapse[]; urges: UrgeLog[]; onClose: () => void; onEdit: () => void }) {
  const { confirm, node } = useConfirm()
  const mine = urges.filter((u) => u.quitGoalId === goal.id).sort((a, b) => b.at - a.at)
  const myRelapses = relapses.filter((r) => r.quitGoalId === goal.id).sort((a, b) => b.at - a.at)
  const ins = urgeInsights(mine)
  const best = bestStreakMs(goal, relapses)
  return (
    <Dialog
      open
      onClose={onClose}
      title={`No ${goal.name.toLowerCase()}`}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto -ml-3 text-error"
            onClick={async () => {
              if (await confirm(`Delete “${goal.name}” and its history?`)) {
                await remove('quitGoals', goal.id)
                onClose()
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat className="p-3" label="Best streak" value={formatDuration(best)} />
          <Stat className="p-3" label="Relapses" value={myRelapses.length} />
          <Stat className="p-3" label="Urges beaten" value={mine.length} sub={mine.length ? `avg ${ins.avgIntensity.toFixed(1)}/5` : undefined} />
        </div>
        {goal.reason && <ReasonCallout reason={goal.reason} />}
        <section>
          <SectionTitle>Trigger insights</SectionTitle>
          {ins.total ? (
            <div className="grid gap-3">
              {(ins.peakHour != null || ins.topTriggers.length > 0) && (
                <div className="flex flex-col gap-0.5 overflow-hidden rounded-lg">
                  {ins.peakHour != null && (
                    <ListItem
                      className="bg-surface-container"
                      leading={<Clock />}
                      headline={`Most urges around ${formatHour(ins.peakHour)}`}
                      supporting="Plan something for that time."
                    />
                  )}
                  {ins.topTriggers.length > 0 && (
                    <ListItem
                      className="bg-surface-container"
                      leading={<Tag />}
                      headline="Top triggers"
                      supporting={ins.topTriggers.map(([t, n]) => `${t} (${n})`).join(', ')}
                    />
                  )}
                </div>
              )}
              <div className="h-32">
                <ResponsiveContainer>
                  <BarChart data={ins.byHour} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
                    <XAxis dataKey="hour" interval={2} tickFormatter={(h) => formatHour(h)} {...axis} />
                    <Tooltip
                      labelFormatter={(h) => formatHour(Number(h))}
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'var(--md-on-surface)', fillOpacity: 0.08 }}
                    />
                    <Bar dataKey="count" name="Urges" fill="var(--md-tertiary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="px-1 text-body-medium text-on-surface-variant">Log urges to see when and why they happen.</p>
          )}
        </section>
        <section>
          <SectionTitle>Urge log</SectionTitle>
          {mine.length ? (
            <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg">
              {mine.slice(0, 50).map((u) => (
                <ListItem
                  key={u.id}
                  className="bg-surface-container"
                  leading={<IntensityDisc value={u.intensity} />}
                  headline={u.trigger || 'Urge'}
                  supporting={u.action ? `Did instead: ${u.action}` : undefined}
                  trailing={<span className="tabular">{format(u.at, 'd MMM, p')}</span>}
                />
              ))}
            </div>
          ) : (
            <p className="px-1 text-body-medium text-on-surface-variant">No urges logged.</p>
          )}
        </section>
        <section>
          <SectionTitle>Relapse history</SectionTitle>
          {myRelapses.length ? (
            <div className="flex flex-col gap-0.5 overflow-hidden rounded-lg">
              {myRelapses.map((r) => (
                <ListItem
                  key={r.id}
                  className="bg-surface-container pr-2"
                  leading={<RotateCcw />}
                  headline={r.note || 'Relapse'}
                  supporting={format(r.at, 'd MMM yyyy, p')}
                  trailing={
                    <IconButton label="Remove relapse" size="icon-sm" onClick={() => remove('relapses', r.id)}>
                      <Trash2 />
                    </IconButton>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="px-1 text-body-medium text-on-surface-variant">No relapses. Keep going!</p>
          )}
        </section>
      </div>
      {node}
    </Dialog>
  )
}

export function QuitPage() {
  const goals = useTable('quitGoals')
  const relapses = useTable('relapses') ?? []
  const urges = useTable('urgeLogs') ?? []
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<QuitGoal | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  useNewParam(() => setCreating(true))
  const now = useNow(60_000)
  const totals = (goals ?? []).reduce(
    (a, g) => {
      const s = quitStats(g, relapses, now)
      return { money: a.money + s.moneySaved, minutes: a.minutes + s.minutesSaved }
    },
    { money: 0, minutes: 0 },
  )
  const d = (goals ?? []).find((g) => g.id === detail)

  return (
    <div>
      <PageHeader
        title="Quit bad habits"
        subtitle={
          goals?.length ? (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <Savings className="size-[18px]" />
                {rupees(totals.money)} saved
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-[18px]" />
                {formatDuration(totals.minutes * 60_000)} back
              </span>
            </span>
          ) : (
            'Track clean time, money and time saved'
          )
        }
        fab={{ icon: <Plus />, label: 'New goal', onClick: () => setCreating(true) }}
      />
      {goals === undefined ? null : goals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} relapses={relapses} urges={urges} onOpen={() => setDetail(g.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ShieldOff />}
          title="No quit goals yet"
          text="Pick one thing to stop — smoking, junk food, endless reels — and watch the clean time grow."
        />
      )}
      {d && (
        <GoalDetail
          goal={d}
          relapses={relapses}
          urges={urges}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(d)
            setDetail(null)
          }}
        />
      )}
      <GoalDialog open={creating || Boolean(editing)} goal={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  )
}
