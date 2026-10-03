import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Dumbbell, Pencil, Play, Plus, Trash2, Trophy, X } from 'lucide-react'
import { useSettings, useTable } from '@/lib/hooks'
import type { BodyLog, Exercise, WorkoutTemplate } from '@/lib/types'
import { detectPRs, doneSets, exerciseProgress, workoutVolume } from '@/lib/gym'
import { remove, save } from '@/lib/repo'
import { formatDuration, orderedWeekdays, WEEKDAYS_SHORT, ymd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { Field, Input, Segmented, Select } from '@/components/ui/form'
import { Badge, EmptyState, PageHeader, Stat } from '@/components/ui/misc'
import { AddExerciseForm, ExercisePicker, groupByMuscle } from './ExercisePicker'
import { startWorkout } from './actions'

type Tab = 'start' | 'history' | 'exercises' | 'progress' | 'body'

const chartStyle = { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }

function TemplateDialog({ template, open, onClose }: { template: WorkoutTemplate | null; open: boolean; onClose: () => void }) {
  const exercises = useTable('exercises') ?? []
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const [d, setD] = useState<Partial<WorkoutTemplate>>({ name: '', exercises: [] })
  const [picker, setPicker] = useState(false)
  useEffect(() => {
    if (open) setD(template ?? { name: '', exercises: [] })
  }, [open, template])
  const list = d.exercises ?? []
  const setItem = (i: number, p: Partial<WorkoutTemplate['exercises'][number]>) =>
    setD({ ...d, exercises: list.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? 'Edit template' : 'New template'}
      footer={
        <>
          {template && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={async () => {
                await remove('workoutTemplates', template.id)
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
            disabled={!d.name?.trim()}
            onClick={async () => {
              await save('workoutTemplates', { ...d, name: d.name!.trim() })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name">
          <Input autoFocus value={d.name ?? ''} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Upper body" />
        </Field>
        <div className="grid gap-2">
          {list.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_4rem_4rem_auto] items-center gap-2">
              <span className="truncate text-sm font-medium">{names.get(x.exerciseId) ?? 'Exercise'}</span>
              <Input type="number" min={1} value={x.sets} onChange={(e) => setItem(i, { sets: Number(e.target.value) || 1 })} aria-label="Sets" className="h-8" />
              <Input type="number" min={1} value={x.reps} onChange={(e) => setItem(i, { reps: Number(e.target.value) || 1 })} aria-label="Reps" className="h-8" />
              <Button size="icon-sm" variant="ghost" onClick={() => setD({ ...d, exercises: list.filter((_, j) => j !== i) })} aria-label="Remove">
                <X />
              </Button>
            </div>
          ))}
          {list.length > 0 && <p className="text-xs text-muted-foreground">Columns: sets · reps</p>}
        </div>
        <Button variant="outline" onClick={() => setPicker(true)}>
          <Plus /> Add exercise
        </Button>
      </div>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(e) => setD((cur) => ({ ...cur, exercises: [...(cur.exercises ?? []), { exerciseId: e.id, sets: 3, reps: 10 }] }))}
      />
    </Dialog>
  )
}

function StartTab() {
  const templates = useTable('workoutTemplates') ?? []
  const workouts = useTable('workouts') ?? []
  const exercises = useTable('exercises') ?? []
  const settings = useSettings()
  const nav = useNavigate()
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const active = workouts.find((w) => !w.endedAt)
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const todayTpl = templates.find((t) => t.id === settings.gymSchedule[String(new Date().getDay())])

  const go = async (t?: WorkoutTemplate) => {
    const w = await startWorkout(t)
    nav(`/gym/workout/${w.id}`)
  }

  return (
    <div className="grid gap-4">
      {active ? (
        <Card className="border-primary/50 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{active.name} in progress</div>
              <div className="text-sm text-muted-foreground">Started {format(active.startedAt, 'p')}</div>
            </div>
            <Button onClick={() => nav(`/gym/workout/${active.id}`)}>
              <Play /> Resume
            </Button>
          </div>
        </Card>
      ) : todayTpl ? (
        <Card className="border-primary/50 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-primary">Scheduled today</div>
              <div className="font-semibold">{todayTpl.name}</div>
            </div>
            <Button onClick={() => go(todayTpl)}>
              <Play /> Start
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Templates</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => go()} disabled={Boolean(active)}>
            Empty workout
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> Template
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col p-4">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-semibold">{t.name}</h3>
              <Button size="icon-sm" variant="ghost" onClick={() => setEditing(t)} aria-label="Edit template">
                <Pencil />
              </Button>
            </div>
            <ul className="mb-3 flex-1 text-sm text-muted-foreground">
              {t.exercises.map((e, i) => (
                <li key={i}>
                  {names.get(e.exerciseId) ?? '—'} · {e.sets}×{e.reps}
                </li>
              ))}
            </ul>
            <Button onClick={() => go(t)} disabled={Boolean(active)}>
              <Play /> Start
            </Button>
          </Card>
        ))}
      </div>
      <ScheduleCard templates={templates} />
      <TemplateDialog open={creating || Boolean(editing)} template={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  )
}

/** Later: weekly gym schedule that shows on the Today screen. */
function ScheduleCard({ templates }: { templates: WorkoutTemplate[] }) {
  const settings = useSettings()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <CalendarDays className="h-4 w-4" /> Weekly schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-7">
        {orderedWeekdays(settings.weekStart).map((d) => (
          <label key={d} className="grid gap-1 text-xs font-medium">
            {WEEKDAYS_SHORT[d]}
            <Select
              className="h-9 px-2 text-xs"
              value={settings.gymSchedule[String(d)] ?? ''}
              onChange={(e) => {
                const gymSchedule = { ...settings.gymSchedule }
                if (e.target.value) gymSchedule[String(d)] = e.target.value
                else delete gymSchedule[String(d)]
                save('settings', { id: 'settings', gymSchedule })
              }}
            >
              <option value="">Rest</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </label>
        ))}
      </CardContent>
    </Card>
  )
}

function HistoryTab() {
  const workouts = useTable('workouts') ?? []
  const exercises = useTable('exercises') ?? []
  const nav = useNavigate()
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const done = workouts.filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt)
  const { prs } = useMemo(() => detectPRs(workouts), [workouts])
  if (!done.length) return <EmptyState icon={<Dumbbell />} title="No workouts yet" text="Finish a workout and it shows up here." />
  return (
    <div className="grid gap-2">
      {done.map((w) => {
        const mine = prs.filter((p) => p.workoutId === w.id)
        return (
          <Card key={w.id} className="cursor-pointer p-4 transition-colors hover:bg-muted/30" onClick={() => nav(`/gym/workout/${w.id}`)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{w.name}</div>
                <div className="text-xs text-muted-foreground">{format(w.startedAt, 'EEE d MMM yyyy, p')}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge>{formatDuration((w.endedAt ?? w.startedAt) - w.startedAt)}</Badge>
                <Badge>{Math.round(workoutVolume(w)).toLocaleString()} kg</Badge>
                <Badge>{doneSets(w)} sets</Badge>
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{w.entries.map((e) => names.get(e.exerciseId)).filter(Boolean).join(' · ')}</div>
            {mine.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mine.map((p) => (
                  <Badge key={p.exerciseId + p.kind} variant="warning">
                    <Trophy className="h-3 w-3" /> {names.get(p.exerciseId)} {p.value}
                    {p.kind === 'reps' ? ' reps' : p.kind === '1rm' ? ' kg e1RM' : ' kg'}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function ExercisesTab() {
  const exercises = useTable('exercises') ?? []
  const { confirm, node } = useConfirm()
  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Add a custom exercise</h3>
        <AddExerciseForm />
      </Card>
      {groupByMuscle(exercises).map(([muscle, items]) => (
        <section key={muscle}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{muscle}</h3>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {items.map((e: Exercise) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
                <span>
                  {e.name} <span className="text-xs text-muted-foreground">· {e.equipment}</span>
                  {e.isCustom && <Badge className="ml-1.5">custom</Badge>}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete exercise"
                  onClick={async () => (await confirm(`Delete ${e.name}?`)) && remove('exercises', e.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {node}
    </div>
  )
}

/** Later: progress chart per exercise (best weight over time). */
function ProgressTab() {
  const workouts = useTable('workouts') ?? []
  const exercises = useTable('exercises') ?? []
  const used = exercises.filter((e) => workouts.some((w) => w.endedAt && w.entries.some((x) => x.exerciseId === e.id && x.sets.some((s) => s.done))))
  const [sel, setSel] = useState('')
  const id = sel || used[0]?.id || ''
  const data = exerciseProgress(id, workouts).map((p) => ({ ...p, date: format(p.at, 'd MMM') }))
  const { bests } = useMemo(() => detectPRs(workouts), [workouts])
  const best = bests.get(id)
  if (!used.length) return <EmptyState icon={<Dumbbell />} title="No progress yet" text="Log a few workouts to see your strength over time." />
  return (
    <div className="grid gap-4">
      <Select value={id} onChange={(e) => setSel(e.target.value)} className="max-w-xs">
        {used.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>
      {best && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Best weight" value={`${best.weight} kg`} />
          <Stat label="Est. 1RM" value={`${Math.round(best.oneRm)} kg`} />
          <Stat label="Best reps" value={best.reps} />
        </div>
      )}
      <Card className="h-64 p-3">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 10 }} width={32} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={chartStyle} />
            <Line type="monotone" dataKey="weight" name="Best weight (kg)" stroke="var(--primary)" strokeWidth={2} dot />
            <Line type="monotone" dataKey="oneRm" name="Est. 1RM (kg)" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

const MEASURES = ['waist', 'chest', 'arms', 'hips', 'thighs']

/** Later: body weight and measurements log with chart. */
function BodyTab() {
  const logs = (useTable('bodyLogs') ?? []).sort((a, b) => a.date.localeCompare(b.date))
  const [date, setDate] = useState(ymd())
  const [weight, setWeight] = useState('')
  const [m, setM] = useState<Record<string, string>>({})
  const existing = logs.find((l) => l.date === date)
  useEffect(() => {
    setWeight(existing?.weightKg != null ? String(existing.weightKg) : '')
    setM(Object.fromEntries(Object.entries(existing?.measurements ?? {}).map(([k, v]) => [k, String(v)])))
  }, [date, existing?.id, existing?.updatedAt])
  const submit = async () => {
    const measurements: BodyLog['measurements'] = {}
    for (const [k, v] of Object.entries(m)) if (v && Number(v) > 0) measurements[k] = Number(v)
    await save('bodyLogs', { id: existing?.id, date, weightKg: weight ? Number(weight) : null, measurements })
  }
  const data = logs.filter((l) => l.weightKg).map((l) => ({ date: format(new Date(l.date + 'T12:00'), 'd MMM'), weight: l.weightKg }))
  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value || ymd())} />
          </Field>
          <Field label="Weight (kg)">
            <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70.5" />
          </Field>
          {MEASURES.map((k) => (
            <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)} (cm)`}>
              <Input inputMode="decimal" value={m[k] ?? ''} onChange={(e) => setM({ ...m, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <Button className="mt-3" onClick={submit}>
          {existing ? 'Update entry' : 'Save entry'}
        </Button>
      </Card>
      {data.length > 0 ? (
        <Card className="h-64 p-3">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10 }} width={32} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={chartStyle} />
              <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="var(--primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <EmptyState title="No body logs yet" text="Log your weight to see the trend." />
      )}
      <div className="grid gap-1.5">
        {[...logs].reverse().slice(0, 30).map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="font-medium">{format(new Date(l.date + 'T12:00'), 'd MMM yyyy')}</span>
            <span className="flex items-center gap-3 text-muted-foreground">
              {l.weightKg != null && <span>{l.weightKg} kg</span>}
              {Object.entries(l.measurements).map(([k, v]) => (
                <span key={k} className="hidden sm:inline">
                  {k} {v}
                </span>
              ))}
              <button aria-label="Delete entry" className="hover:text-destructive" onClick={() => remove('bodyLogs', l.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GymPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'start'
  const workouts = useTable('workouts') ?? []
  const week = workouts.filter((w) => w.endedAt && w.startedAt > Date.now() - 7 * 86_400_000)
  return (
    <div>
      <PageHeader
        title="Gym"
        subtitle={`${week.length} workout${week.length === 1 ? '' : 's'} this week · ${Math.round(week.reduce((a, w) => a + workoutVolume(w), 0)).toLocaleString()} kg`}
      />
      <Segmented
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        className="mb-4 w-full overflow-x-auto sm:w-auto"
        options={[
          { value: 'start', label: 'Workout' },
          { value: 'history', label: 'History' },
          { value: 'progress', label: 'Progress' },
          { value: 'body', label: 'Body' },
          { value: 'exercises', label: 'Exercises' },
        ]}
      />
      {tab === 'start' && <StartTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'progress' && <ProgressTab />}
      {tab === 'body' && <BodyTab />}
      {tab === 'exercises' && <ExercisesTab />}
    </div>
  )
}
