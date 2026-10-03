import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, Dumbbell, History, Plus, Timer, Trash2, Trophy, X } from '@/components/icons'
import { db } from '@/lib/db'
import { useNow, useSettings, useTable } from '@/lib/hooks'
import { save, remove } from '@/lib/repo'
import { detectPRs, lastSessionSets, workoutVolume } from '@/lib/gym'
import type { Workout, WorkoutSet } from '@/lib/types'
import { cn, formatDuration } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/form'
import { Badge, EmptyState } from '@/components/ui/misc'
import { useConfirm } from '@/components/ui/dialog'
import { ExercisePicker } from './ExercisePicker'
import { finishWorkout } from './actions'
import { useRest } from './rest'

/** Set number, weight, reps and the done toggle. */
const SET_GRID = 'grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-3'

function NumberCell({ value, onChange, step, label }: { value: number; onChange: (v: number) => void; step: number; label: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <Input
      inputMode="decimal"
      aria-label={label}
      value={text}
      step={step}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = Number(text.replace(',', '.'))
        if (Number.isFinite(n) && n >= 0) onChange(n)
        else setText(String(value))
      }}
      onFocus={(e) => e.target.select()}
      className="tabular h-10 px-2 text-center"
    />
  )
}

export function WorkoutPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const settings = useSettings()
  const workout = useLiveQuery(() => (id ? db.workouts.get(id) : undefined), [id])
  const exercises = useTable('exercises') ?? []
  const history = useTable('workouts') ?? []
  const startRest = useRest((s) => s.start)
  const resting = useRest((s) => Boolean(s.endsAt))
  const now = useNow(1000)
  const [picker, setPicker] = useState(false)
  const { confirm, node } = useConfirm()
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])
  const bests = useMemo(() => detectPRs(history.filter((w) => w.id !== id)).bests, [history, id])

  if (workout === undefined) return null
  if (!workout || workout.deletedAt)
    return (
      <EmptyState
        icon={<Dumbbell />}
        title="Workout not found"
        text="It may have been discarded on another device."
        action={<Button onClick={() => nav('/gym')}>Back to gym</Button>}
      />
    )

  const finished = Boolean(workout.endedAt)
  const update = (entries: Workout['entries']) => save('workouts', { id: workout.id, entries })
  const setSet = (ei: number, si: number, patch: Partial<WorkoutSet>) =>
    update(workout.entries.map((e, i) => (i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e)))

  const toggleDone = (ei: number, si: number) => {
    const s = workout.entries[ei].sets[si]
    setSet(ei, si, { done: !s.done })
    if (!s.done && !finished) startRest(settings.restSeconds)
  }

  const doneSets = workout.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)
  const totalSets = workout.entries.reduce((a, e) => a + e.sets.length, 0)

  // While resting, leave room at the bottom so the floating rest timer never covers the last card.
  return (
    <div className={cn('mx-auto max-w-2xl', resting ? 'pb-44 md:pb-24' : 'pb-6')}>
      <div className="mb-6">
        <div className="flex items-center gap-1">
          <IconButton label="Back to gym" className="-ml-2 shrink-0" onClick={() => nav(finished ? '/gym?tab=history' : '/gym')}>
            <ArrowLeft />
          </IconButton>
          <input
            value={workout.name}
            onChange={(e) => save('workouts', { id: workout.id, name: e.target.value })}
            aria-label="Workout name"
            className="h-12 min-w-0 flex-1 border-b border-transparent bg-transparent px-2 text-headline-small text-on-surface transition-colors outline-none hover:border-outline-variant focus:border-primary focus:shadow-[inset_0_-1px_0_var(--md-primary)] focus-visible:outline-none md:text-headline-medium"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-3">
          <Badge variant={finished ? 'default' : 'secondary'} className="tabular">
            <Timer /> {formatDuration((workout.endedAt ?? now) - workout.startedAt, { seconds: !finished })}
          </Badge>
          <Badge className="tabular">
            {doneSets}/{totalSets} {totalSets === 1 ? 'set' : 'sets'}
          </Badge>
          <Badge className="tabular">{Math.round(workoutVolume(workout)).toLocaleString()} kg</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-error"
              onClick={async () => {
                if (await confirm(finished ? 'Delete this workout from history?' : 'Discard this workout?')) {
                  await remove('workouts', workout.id)
                  useRest.getState().stop()
                  nav('/gym')
                }
              }}
            >
              <Trash2 /> {finished ? 'Delete' : 'Discard'}
            </Button>
            {!finished && (
              <Button
                disabled={!doneSets}
                onClick={async () => {
                  await finishWorkout(workout)
                  useRest.getState().stop()
                  nav('/gym?tab=history')
                }}
              >
                <Check /> Finish
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {workout.entries.map((entry, ei) => {
          const last = lastSessionSets(entry.exerciseId, history, workout.id)
          const best = bests.get(entry.exerciseId)
          return (
            <Card key={`${entry.exerciseId}-${ei}`} className="px-4 pt-4 pb-2">
              <div className="mb-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-title-medium text-on-surface">{names.get(entry.exerciseId) ?? 'Exercise'}</h3>
                  {(last || (best && best.weight > 0)) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {last && (
                        <span className="flex items-center gap-1 text-body-small text-on-surface-variant">
                          <History className="size-4" /> Last: {last.map((s) => `${s.weightKg}×${s.reps}`).join(', ')}
                        </span>
                      )}
                      {best && best.weight > 0 && (
                        <Badge variant="tertiary">
                          <Trophy filled /> PR {best.weight} kg
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <IconButton
                  label="Remove exercise"
                  className="-mt-2 -mr-2"
                  onClick={() => update(workout.entries.filter((_, i) => i !== ei))}
                >
                  <X />
                </IconButton>
              </div>
              <div className={`${SET_GRID} px-2 pb-1 text-center text-label-medium text-on-surface-variant`}>
                <span>Set</span>
                <span>kg</span>
                <span>Reps</span>
                <span>Done</span>
              </div>
              <div className="grid gap-1">
                {entry.sets.map((s, si) => {
                  const isPr = s.done && best && s.weightKg > best.weight
                  return (
                    <div
                      key={si}
                      className={cn(SET_GRID, 'rounded-md px-2 py-1 transition-colors duration-200', s.done && 'bg-success-container/60')}
                    >
                      <span className="flex justify-center text-title-small text-on-surface-variant tabular">
                        {isPr ? (
                          <span className="flex text-tertiary" title="New PR">
                            <Trophy filled className="size-5" />
                            <span className="sr-only">Set {si + 1}, new PR</span>
                          </span>
                        ) : (
                          si + 1
                        )}
                      </span>
                      <NumberCell value={s.weightKg} step={2.5} label="Weight in kg" onChange={(weightKg) => setSet(ei, si, { weightKg })} />
                      <NumberCell value={s.reps} step={1} label="Reps" onChange={(reps) => setSet(ei, si, { reps: Math.round(reps) })} />
                      <button
                        type="button"
                        onClick={() => toggleDone(ei, si)}
                        aria-label={s.done ? 'Untick set' : 'Tick set'}
                        aria-pressed={s.done}
                        className={cn(
                          'state-layer flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200',
                          s.done ? 'bg-success text-on-success' : 'border-2 border-outline text-on-surface-variant/60',
                        )}
                      >
                        <Check className="size-6" />
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 -ml-3 flex gap-1">
                <Button
                  variant="ghost"
                  className="px-3"
                  onClick={() => {
                    const prev = entry.sets[entry.sets.length - 1]
                    update(
                      workout.entries.map((e, i) =>
                        i === ei ? { ...e, sets: [...e.sets, { reps: prev?.reps ?? 10, weightKg: prev?.weightKg ?? 0, done: false }] } : e,
                      ),
                    )
                  }}
                >
                  <Plus /> Add set
                </Button>
                {entry.sets.length > 1 && (
                  <Button
                    variant="ghost"
                    className="px-3"
                    onClick={() => update(workout.entries.map((e, i) => (i === ei ? { ...e, sets: e.sets.slice(0, -1) } : e)))}
                  >
                    Remove set
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
        {!workout.entries.length && (
          <p className="px-1 py-4 text-center text-body-medium text-on-surface-variant">No exercises yet. Add one to start logging sets.</p>
        )}
        <Button variant="outline" className="w-full" onClick={() => setPicker(true)}>
          <Plus /> Add exercise
        </Button>
        <Field label="Notes" className="mt-3">
          <Textarea
            placeholder="How did it feel?"
            defaultValue={workout.notes}
            onBlur={(e) => e.target.value !== workout.notes && save('workouts', { id: workout.id, notes: e.target.value })}
          />
        </Field>
      </div>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(ex) => {
          const last = lastSessionSets(ex.id, history, workout.id)
          const sets = last?.length
            ? last.map((s) => ({ reps: s.reps, weightKg: s.weightKg, done: false }))
            : Array.from({ length: 3 }, () => ({ reps: 10, weightKg: 0, done: false }))
          update([...workout.entries, { exerciseId: ex.id, sets }])
        }}
      />
      {node}
    </div>
  )
}
