import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Dumbbell, MonitorWeight, Pencil, Play, Plus, ShowChart, Timer, Trash2, Trophy, X } from '@/components/icons'
import { db } from '@/lib/db'
import { useNewParam, useNow, useSettings, useTable } from '@/lib/hooks'
import type { BodyLog, Exercise, Workout, WorkoutTemplate } from '@/lib/types'
import { detectPRs, doneSets, exerciseProgress, workoutVolume } from '@/lib/gym'
import { remove, save } from '@/lib/repo'
import { formatDuration, orderedWeekdays, WEEKDAYS_SHORT, ymd } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { Field, Input, Select, Tabs } from '@/components/ui/form'
import { Badge, EmptyState, ListItem, PageHeader, SectionTitle, Stat } from '@/components/ui/misc'
import { AddExerciseForm, ExercisePicker, groupByMuscle } from './ExercisePicker'
import { startWorkout } from './actions'

type Tab = 'start' | 'history' | 'exercises' | 'progress' | 'body'
type StartFn = (template?: WorkoutTemplate | 'scheduled') => Promise<void>

/** Recharts styling from the M3 colour roles (see docs/DESIGN.md). */
const tooltipStyle = { background: 'var(--md-surface-container-high)', border: 'none', borderRadius: 8, color: 'var(--md-on-surface)', fontSize: 12 }
const axisTick = { fontSize: 11, fill: 'var(--md-on-surface-variant)' }

/** Today's template from the weekly schedule, read straight from the database so it works before live queries load. */
async function scheduledTemplate(): Promise<WorkoutTemplate | undefined> {
  const settings = await db.settings.get('settings')
  const id = settings?.gymSchedule?.[String(new Date().getDay())]
  const template = id ? await db.workoutTemplates.get(id) : undefined
  return template && !template.deletedAt ? template : undefined
}

/** Starts (or resumes) a workout and opens it; repeat taps while one is starting are ignored. */
function useStartWorkout(): StartFn {
  const nav = useNavigate()
  const busy = useRef(false)
  return async (template) => {
    if (busy.current) return
    busy.current = true
    try {
      const w = await startWorkout(template === 'scheduled' ? await scheduledTemplate() : template)
      nav(`/gym/workout/${w.id}`)
    } finally {
      busy.current = false
    }
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const TEMPLATE_GRID = 'grid grid-cols-[1fr_4.5rem_4.5rem_2.5rem] items-center gap-2'

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
              className="mr-auto -ml-3 text-error"
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
            variant="ghost"
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
      <div className="grid gap-5 pt-2">
        <Field label="Name">
          <Input autoFocus value={d.name ?? ''} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Upper body" />
        </Field>
        {list.length > 0 ? (
          <div className="grid gap-2">
            <div className={`${TEMPLATE_GRID} text-label-medium text-on-surface-variant`}>
              <span className="px-1">Exercise</span>
              <span className="text-center">Sets</span>
              <span className="text-center">Reps</span>
              <span />
            </div>
            {list.map((x, i) => (
              <div key={i} className={TEMPLATE_GRID}>
                <span className="truncate px-1 text-body-large text-on-surface">{names.get(x.exerciseId) ?? 'Exercise'}</span>
                <Input
                  type="number"
                  min={1}
                  value={x.sets}
                  onChange={(e) => setItem(i, { sets: Number(e.target.value) || 1 })}
                  aria-label="Sets"
                  className="tabular h-10 px-2 text-center"
                />
                <Input
                  type="number"
                  min={1}
                  value={x.reps}
                  onChange={(e) => setItem(i, { reps: Number(e.target.value) || 1 })}
                  aria-label="Reps"
                  className="tabular h-10 px-2 text-center"
                />
                <IconButton label="Remove" onClick={() => setD({ ...d, exercises: list.filter((_, j) => j !== i) })}>
                  <X />
                </IconButton>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-body-medium text-on-surface-variant">Add the exercises you usually do. Weights prefill from your last session.</p>
        )}
        <Button variant="outline" className="w-full" onClick={() => setPicker(true)}>
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

/** Tonal hero for the workout in progress or today's scheduled template (Google Fit style). */
function WorkoutHero({ active, scheduled, names, start }: { active?: Workout; scheduled?: WorkoutTemplate; names: Map<string, string>; start: StartFn }) {
  const nav = useNavigate()
  const now = useNow(30_000)
  if (!active && !scheduled) return null
  const totalSets = active?.entries.reduce((a, e) => a + e.sets.length, 0) ?? 0
  return (
    <section className="flex flex-col gap-5 rounded-xl bg-primary-container p-5 text-on-primary-container sm:flex-row sm:items-end sm:justify-between sm:p-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-label-large">
          {active ? <Timer filled className="size-5" /> : <CalendarDays filled className="size-5" />}
          {active ? 'In progress' : 'Scheduled today'}
        </div>
        <h2 className="mt-2 text-headline-small">{active?.name ?? scheduled?.name}</h2>
        <p className="mt-1 line-clamp-2 text-body-medium text-on-primary-container/80">
          {active
            ? `Started ${format(active.startedAt, 'p')} · ${formatDuration(now - active.startedAt)} · ${doneSets(active)}/${plural(totalSets, 'set')}`
            : scheduled?.exercises.map((e) => names.get(e.exerciseId)).filter(Boolean).join(' · ') || 'No exercises in this template yet'}
        </p>
      </div>
      {active ? (
        <Button className="hidden shrink-0 md:inline-flex" onClick={() => nav(`/gym/workout/${active.id}`)}>
          <Play filled /> Resume
        </Button>
      ) : (
        <Button className="hidden shrink-0 md:inline-flex" onClick={() => start(scheduled)}>
          <Play filled /> Start
        </Button>
      )}
    </section>
  )
}

function StartTab({ start }: { start: StartFn }) {
  const templates = useTable('workoutTemplates') ?? []
  const workouts = useTable('workouts') ?? []
  const exercises = useTable('exercises') ?? []
  const settings = useSettings()
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const active = workouts.find((w) => !w.endedAt)
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const todayTpl = templates.find((t) => t.id === settings.gymSchedule[String(new Date().getDay())])

  return (
    <div className="grid gap-6">
      <WorkoutHero active={active} scheduled={todayTpl} names={names} start={start} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <SectionTitle className="py-0">Templates</SectionTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => start()} disabled={Boolean(active)}>
              <Play /> Empty workout
            </Button>
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Plus /> Template
            </Button>
          </div>
        </div>
        {templates.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <Card key={t.id} className="flex flex-col p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-title-medium">{t.name}</h3>
                    <p className="text-body-small text-on-surface-variant">
                      {plural(t.exercises.length, 'exercise')} · {plural(t.exercises.reduce((a, e) => a + e.sets, 0), 'set')}
                    </p>
                  </div>
                  <IconButton label="Edit template" className="-mt-2 -mr-2" onClick={() => setEditing(t)}>
                    <Pencil />
                  </IconButton>
                </div>
                <ul className="mt-3 grid flex-1 content-start gap-1 text-body-medium text-on-surface-variant">
                  {t.exercises.map((e, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{names.get(e.exerciseId) ?? '—'}</span>
                      <span className="tabular shrink-0">
                        {e.sets} × {e.reps}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" className="mt-4 self-start" onClick={() => start(t)} disabled={Boolean(active)}>
                  <Play filled /> Start
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low">
            <EmptyState
              icon={<Dumbbell />}
              title="No templates yet"
              text="Save your usual routine as a template to start it in one tap."
              className="py-8"
            />
          </div>
        )}
      </section>

      <ScheduleCard templates={templates} />
      <TemplateDialog open={creating || Boolean(editing)} template={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  )
}

/** Weekly gym schedule that shows on the Today screen. */
function ScheduleCard({ templates }: { templates: WorkoutTemplate[] }) {
  const settings = useSettings()
  const today = new Date().getDay()
  return (
    <Card>
      <CardHeader className="block">
        <CardTitle>
          <CalendarDays /> Weekly schedule
        </CardTitle>
        <p className="mt-0.5 text-body-small text-on-surface-variant">Scheduled workouts show up on Today.</p>
      </CardHeader>
      <CardContent className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-7">
        {orderedWeekdays(settings.weekStart).map((d) => (
          <label key={d} className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-1.5">
            <span className={`w-10 shrink-0 text-label-large lg:w-auto lg:text-center ${d === today ? 'text-primary' : 'text-on-surface-variant'}`}>
              {WEEKDAYS_SHORT[d]}
            </span>
            <Select
              className="h-10 flex-1 [&>select]:pl-3 [&>select]:text-body-medium lg:[&>select]:pr-8"
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

function prLabel(kind: 'weight' | '1rm' | 'reps') {
  return kind === 'reps' ? ' reps' : kind === '1rm' ? ' kg e1RM' : ' kg'
}

function HistoryTab() {
  const workouts = useTable('workouts') ?? []
  const exercises = useTable('exercises') ?? []
  const nav = useNavigate()
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const done = workouts.filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt)
  const { prs } = useMemo(() => detectPRs(workouts), [workouts])
  if (!done.length) return <EmptyState icon={<Dumbbell />} title="No workouts yet" text="Finish a workout and it shows up here." />
  const months = new Map<string, Workout[]>()
  for (const w of done) {
    const key = format(w.startedAt, 'MMMM yyyy')
    months.set(key, [...(months.get(key) ?? []), w])
  }
  return (
    <div className="grid gap-4">
      {[...months.entries()].map(([month, list]) => (
        <section key={month}>
          <SectionTitle>{month}</SectionTitle>
          <div className="grid gap-0.5 overflow-hidden rounded-lg">
            {list.map((w) => {
              const mine = prs.filter((p) => p.workoutId === w.id)
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => nav(`/gym/workout/${w.id}`)}
                  className="state-layer flex w-full items-start gap-4 bg-surface-container-low px-4 py-3 text-left"
                >
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                    <span className="text-label-small">{format(w.startedAt, 'EEE')}</span>
                    <span className="-mt-0.5 text-title-medium tabular">{format(w.startedAt, 'd')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-title-medium text-on-surface">{w.name}</span>
                    <span className="block truncate text-body-medium text-on-surface-variant">
                      {[format(w.startedAt, 'p'), ...w.entries.map((e) => names.get(e.exerciseId)).filter(Boolean)].join(' · ')}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Badge>
                        <Timer /> {formatDuration((w.endedAt ?? w.startedAt) - w.startedAt)}
                      </Badge>
                      <Badge className="tabular">{Math.round(workoutVolume(w)).toLocaleString()} kg</Badge>
                      <Badge className="tabular">{plural(doneSets(w), 'set')}</Badge>
                      {mine.map((p) => (
                        <Badge key={p.exerciseId + p.kind} variant="tertiary">
                          <Trophy filled /> {names.get(p.exerciseId)} {p.value}
                          {prLabel(p.kind)}
                        </Badge>
                      ))}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function ExercisesTab() {
  const exercises = useTable('exercises') ?? []
  const { confirm, node } = useConfirm()
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add a custom exercise</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <AddExerciseForm />
        </CardContent>
      </Card>
      {groupByMuscle(exercises).map(([muscle, items]) => (
        <section key={muscle}>
          <SectionTitle>{muscle}</SectionTitle>
          <div className="grid gap-0.5 overflow-hidden rounded-lg md:grid-cols-2">
            {items.map((e: Exercise) => (
              <ListItem
                key={e.id}
                className="bg-surface-container-low pr-2"
                headline={
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{e.name}</span>
                    {e.isCustom && <Badge variant="secondary">Custom</Badge>}
                  </span>
                }
                supporting={e.equipment}
                trailing={
                  <IconButton label="Delete exercise" onClick={async () => (await confirm(`Delete ${e.name}?`)) && remove('exercises', e.id)}>
                    <Trash2 />
                  </IconButton>
                }
              />
            ))}
          </div>
        </section>
      ))}
      {node}
    </div>
  )
}

/** Progress chart per exercise (best weight over time). */
function ProgressTab() {
  const workouts = useTable('workouts') ?? []
  const exercises = useTable('exercises') ?? []
  const used = exercises.filter((e) => workouts.some((w) => w.endedAt && w.entries.some((x) => x.exerciseId === e.id && x.sets.some((s) => s.done))))
  const [sel, setSel] = useState('')
  const id = sel || used[0]?.id || ''
  const data = exerciseProgress(id, workouts).map((p) => ({ ...p, date: format(p.at, 'd MMM') }))
  const { bests } = useMemo(() => detectPRs(workouts), [workouts])
  const best = bests.get(id)
  if (!used.length) return <EmptyState icon={<ShowChart />} title="No progress yet" text="Log a few workouts to see your strength over time." />
  return (
    <div className="grid gap-4">
      <Field label="Exercise" className="max-w-sm">
        <Select value={id} onChange={(e) => setSel(e.target.value)}>
          {used.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </Field>
      {best && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Best weight" value={`${best.weight} kg`} />
          <Stat label="Est. 1RM" value={`${Math.round(best.oneRm)} kg`} />
          <Stat label="Best reps" value={best.reps} />
        </div>
      )}
      <Card>
        <CardHeader className="flex-wrap">
          <CardTitle>Strength over time</CardTitle>
          <div className="flex items-center gap-4 text-label-medium text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-4 rounded-full bg-primary" /> Best weight
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-tertiary" /> Est. 1RM
            </span>
          </div>
        </CardHeader>
        <CardContent className="h-64 px-2">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--md-outline-variant)" />
              <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} width={36} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--md-on-surface-variant)' }} cursor={{ stroke: 'var(--md-outline-variant)' }} />
              <Line
                type="monotone"
                dataKey="weight"
                name="Best weight (kg)"
                stroke="var(--md-primary)"
                strokeWidth={3}
                dot={{ r: 3, fill: 'var(--md-primary)', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="oneRm"
                name="Est. 1RM (kg)"
                stroke="var(--md-tertiary)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

const MEASURES = ['waist', 'chest', 'arms', 'hips', 'thighs']
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Body weight and measurements log with chart. */
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
  const latest = data[data.length - 1]
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <MonitorWeight /> Log body stats
          </CardTitle>
          {existing && <Badge variant="secondary">Editing this day</Badge>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 pt-2 sm:grid-cols-4">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value || ymd())} />
            </Field>
            <Field label="Weight (kg)">
              <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70.5" />
            </Field>
            {MEASURES.map((k) => (
              <Field key={k} label={`${capital(k)} (cm)`}>
                <Input inputMode="decimal" value={m[k] ?? ''} onChange={(e) => setM({ ...m, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={submit}>{existing ? 'Update entry' : 'Save entry'}</Button>
          </div>
        </CardContent>
      </Card>
      {data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Weight</CardTitle>
            {latest && <span className="tabular text-title-large text-on-surface">{latest.weight} kg</span>}
          </CardHeader>
          <CardContent className="h-64 px-2">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--md-outline-variant)" />
                <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={axisTick} width={36} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--md-on-surface-variant)' }} cursor={{ stroke: 'var(--md-outline-variant)' }} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Weight (kg)"
                  stroke="var(--md-primary)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: 'var(--md-primary)', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={<MonitorWeight />} title="No body logs yet" text="Log your weight to see the trend." />
      )}
      {logs.length > 0 && (
        <section>
          <SectionTitle>Entries</SectionTitle>
          <div className="grid gap-0.5 overflow-hidden rounded-lg">
            {[...logs].reverse().slice(0, 30).map((l) => (
              <ListItem
                key={l.id}
                className="bg-surface-container-low pr-2"
                headline={format(new Date(l.date + 'T12:00'), 'EEE, d MMM yyyy')}
                supporting={
                  Object.keys(l.measurements).length
                    ? Object.entries(l.measurements)
                        .map(([k, v]) => `${capital(k)} ${v}`)
                        .join(' · ')
                    : undefined
                }
                trailing={
                  <>
                    {l.weightKg != null && <span className="tabular text-title-small text-on-surface">{l.weightKg} kg</span>}
                    <IconButton label="Delete entry" onClick={() => remove('bodyLogs', l.id)}>
                      <Trash2 />
                    </IconButton>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function GymPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'start'
  const workouts = useTable('workouts') ?? []
  const start = useStartWorkout()
  const active = workouts.some((w) => !w.endedAt)
  useNewParam(() => start('scheduled'))
  const week = workouts.filter((w) => w.endedAt && w.startedAt > Date.now() - 7 * 86_400_000)
  return (
    <div>
      <PageHeader
        title="Gym"
        subtitle={`${week.length} workout${week.length === 1 ? '' : 's'} this week · ${Math.round(week.reduce((a, w) => a + workoutVolume(w), 0)).toLocaleString()} kg`}
        fab={{ icon: <Play filled />, label: active ? 'Resume workout' : 'Start workout', onClick: () => start('scheduled') }}
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        className="-mx-4 mb-5 md:mx-0"
        options={[
          { value: 'start', label: 'Workout' },
          { value: 'history', label: 'History' },
          { value: 'progress', label: 'Progress' },
          { value: 'body', label: 'Body' },
          { value: 'exercises', label: 'Exercises' },
        ]}
      />
      {tab === 'start' && <StartTab start={start} />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'progress' && <ProgressTab />}
      {tab === 'body' && <BodyTab />}
      {tab === 'exercises' && <ExercisesTab />}
    </div>
  )
}
