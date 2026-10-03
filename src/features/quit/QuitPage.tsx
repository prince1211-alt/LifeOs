import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Award, Clock, HeartPulse, IndianRupee, Pencil, Plus, RotateCcw, ShieldOff, Trash2, Zap } from '@/components/icons'
import { useNow, useTable } from '@/lib/hooks'
import type { Habit, QuitGoal, Relapse, UrgeLog } from '@/lib/types'
import { bestStreakMs, formatHour, MILESTONES, quitStats, urgeInsights } from '@/lib/quit'
import { remove, save } from '@/lib/repo'
import { cn, formatDuration, rupees } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { Badge, EmptyState, PageHeader, Progress, Stat } from '@/components/ui/misc'
import { toast } from '@/store/app'
import { HabitCheck } from '../habits/HabitCheck'
import { habitLogId } from '@/lib/habits'
import { ymd } from '@/lib/utils'

const toLocalInput = (ms: number) => format(ms, "yyyy-MM-dd'T'HH:mm")

export function cleanLabel(elapsed: number) {
  return formatDuration(elapsed)
}

function Milestones({ days }: { days: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MILESTONES.slice(0, 5).map((m) => {
        const got = days >= m.days
        return (
          <span
            key={m.days}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              got ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground/70',
            )}
            title={got ? `Reached ${m.label}` : `Reach ${m.label}`}
          >
            <Award className="h-3 w-3" />
            {m.label}
          </span>
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
          <Button onClick={submit} disabled={!d.name?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost per day (₹)">
            <Input type="number" min={0} value={d.costPerDay ?? 0} onChange={(e) => set({ costPerDay: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Minutes wasted per day">
            <Input type="number" min={0} value={d.minutesPerDay ?? 0} onChange={(e) => set({ minutesPerDay: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="Why I'm quitting (shown when you log an urge)">
          <Textarea value={d.reason ?? ''} onChange={(e) => set({ reason: e.target.value })} placeholder="For my lungs, my family and my wallet." />
        </Field>
        <Field label="Replacement habit (opens when you log an urge)">
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
          <Button onClick={submit}>Log urge</Button>
        </>
      }
    >
      <div className="grid gap-4">
        {goal.reason && (
          <div className="rounded-xl border-l-4 border-primary bg-primary/10 p-3">
            <div className="text-xs font-semibold tracking-wide text-primary uppercase">Why I'm quitting</div>
            <p className="mt-1 text-base font-medium">{goal.reason}</p>
          </div>
        )}
        {replacement && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
            <div>
              <div className="text-xs text-muted-foreground">Do this instead</div>
              <div className="font-medium">
                {replacement.icon} {replacement.name}
              </div>
            </div>
            <HabitCheck habit={replacement} log={logs.find((l) => l.id === habitLogId(replacement.id, ymd()))} date={ymd()} />
          </div>
        )}
        <Field label="Trigger">
          <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="Stress, boredom, after lunch…" />
          {past.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {past.map((p) => (
                <button key={p} type="button" onClick={() => setTrigger(p)}>
                  <Badge variant={trigger === p ? 'primary' : 'outline'}>{p}</Badge>
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label={`Intensity: ${intensity} / 5`}>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIntensity(n)}
                className={cn(
                  'h-10 flex-1 rounded-md border text-sm font-semibold',
                  n <= intensity ? 'border-transparent text-white' : 'hover:bg-muted',
                )}
                style={n <= intensity ? { background: `hsl(${40 - n * 8} 90% ${55 - n * 3}%)` } : undefined}
              >
                {n}
              </button>
            ))}
          </div>
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
      title="Log a relapse"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
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
      <div className="grid gap-3 text-sm">
        <p>It happens. The timer restarts from now; your past streaks and urge log stay saved.</p>
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
    <Card>
      <button className="block w-full text-left" onClick={onOpen}>
        <CardHeader>
          <CardTitle className="text-base">
            <ShieldOff className="h-4 w-4 text-primary" />
            No {goal.name.toLowerCase()}
          </CardTitle>
          {todayUrges > 0 && <Badge>{todayUrges} urges today</Badge>}
        </CardHeader>
        <CardContent className="grid gap-3">
          <div>
            <div className="tabular text-3xl font-bold tracking-tight">{formatDuration(s.elapsed, { seconds: s.days < 1 })}</div>
            <div className="text-sm text-muted-foreground">clean since {format(s.since, 'd MMM yyyy, p')}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Money saved" value={rupees(s.moneySaved)} />
            <Stat label="Time saved" value={formatDuration(s.minutesSaved * 60_000)} />
          </div>
          {s.next && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Next: {s.next.label}</span>
                <span>{Math.round(s.nextProgress * 100)}%</span>
              </div>
              <Progress value={s.nextProgress} />
            </div>
          )}
          <Milestones days={s.days} />
        </CardContent>
      </button>
      <div className="flex gap-2 border-t p-3">
        <Button className="flex-1" variant="secondary" onClick={() => setUrgeOpen(true)}>
          <Zap /> Log urge
        </Button>
        <Button className="flex-1" variant="outline" onClick={() => setRelapseOpen(true)}>
          <RotateCcw /> Relapse
        </Button>
      </div>
      <UrgeDialog goal={goal} open={urgeOpen} onClose={() => setUrgeOpen(false)} />
      <RelapseDialog goal={goal} open={relapseOpen} onClose={() => setRelapseOpen(false)} />
    </Card>
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
            className="mr-auto text-destructive"
            onClick={async () => {
              if (await confirm(`Delete “${goal.name}” and its history?`)) {
                await remove('quitGoals', goal.id)
                onClose()
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Best streak" value={formatDuration(best)} />
          <Stat label="Relapses" value={myRelapses.length} />
          <Stat label="Urges beaten" value={mine.length} sub={mine.length ? `avg ${ins.avgIntensity.toFixed(1)}/5` : undefined} />
        </div>
        {goal.reason && (
          <div className="rounded-xl bg-primary/10 p-3 text-sm">
            <span className="font-semibold">Why: </span>
            {goal.reason}
          </div>
        )}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <HeartPulse className="h-4 w-4" /> Trigger insights
          </h4>
          {ins.total ? (
            <>
              <ul className="mb-3 grid gap-1 text-sm">
                {ins.peakHour != null && (
                  <li>
                    Most urges around <b>{formatHour(ins.peakHour)}</b> — plan something for that time.
                  </li>
                )}
                {ins.topTriggers.length > 0 && (
                  <li>
                    Top triggers: {ins.topTriggers.map(([t, n]) => `${t} (${n})`).join(', ')}
                  </li>
                )}
              </ul>
              <div className="h-32">
                <ResponsiveContainer>
                  <BarChart data={ins.byHour}>
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} tickFormatter={(h) => formatHour(h)} stroke="var(--muted-foreground)" />
                    <Tooltip labelFormatter={(h) => formatHour(Number(h))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
                    <Bar dataKey="count" name="Urges" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Log urges to see when and why they happen.</p>
          )}
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold">Urge log</h4>
          <div className="grid max-h-56 gap-1.5 overflow-y-auto">
            {mine.slice(0, 50).map((u) => (
              <div key={u.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{u.trigger || 'Urge'}</div>
                  {u.action && <div className="text-xs text-muted-foreground">Did instead: {u.action}</div>}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{format(u.at, 'd MMM, p')}</div>
                  <div>Intensity {u.intensity}/5</div>
                </div>
              </div>
            ))}
            {!mine.length && <p className="text-sm text-muted-foreground">No urges logged.</p>}
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold">Relapse history</h4>
          <div className="grid gap-1.5">
            {myRelapses.map((r) => (
              <div key={r.id} className="flex justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span>{r.note || 'Relapse'}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {format(r.at, 'd MMM yyyy, p')}
                  <button className="hover:text-destructive" aria-label="Remove relapse" onClick={() => remove('relapses', r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            ))}
            {!myRelapses.length && <p className="text-sm text-muted-foreground">No relapses. Keep going!</p>}
          </div>
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
            <span className="flex flex-wrap gap-3">
              <span className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" />{rupees(totals.money).slice(1)} saved</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(totals.minutes * 60_000)} back</span>
            </span>
          ) : (
            'Track clean time, money and time saved'
          )
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New goal
          </Button>
        }
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
          action={<Button onClick={() => setCreating(true)}><Plus /> Add a quit goal</Button>}
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
