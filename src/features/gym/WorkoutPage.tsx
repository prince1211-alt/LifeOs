import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, History, Plus, Timer, Trash2, Trophy, X } from '@/components/icons'
import { db } from '@/lib/db'
import { useNow, useSettings, useTable } from '@/lib/hooks'
import { save, remove } from '@/lib/repo'
import { detectPRs, lastSessionSets, workoutVolume } from '@/lib/gym'
import type { Workout, WorkoutSet } from '@/lib/types'
import { cn, formatDuration } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/form'
import { Badge } from '@/components/ui/misc'
import { useConfirm } from '@/components/ui/dialog'
import { ExercisePicker } from './ExercisePicker'
import { finishWorkout } from './actions'
import { useRest } from './rest'

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
      className="tabular h-9 px-2 text-center"
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
  const now = useNow(1000)
  const [picker, setPicker] = useState(false)
  const { confirm, node } = useConfirm()
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])
  const bests = useMemo(() => detectPRs(history.filter((w) => w.id !== id)).bests, [history, id])

  if (workout === undefined) return null
  if (!workout || workout.deletedAt)
    return (
      <div className="py-10 text-center">
        <p>Workout not found.</p>
        <Button className="mt-3" onClick={() => nav('/gym')}>
          Back to gym
        </Button>
      </div>
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

  return (
    <div className="pb-10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Input
            value={workout.name}
            onChange={(e) => save('workouts', { id: workout.id, name: e.target.value })}
            className="h-auto border-0 bg-transparent px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
            aria-label="Workout name"
          />
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              {formatDuration((workout.endedAt ?? now) - workout.startedAt, { seconds: !finished })}
            </span>
            <span>
              {doneSets}/{totalSets} sets
            </span>
            <span>{Math.round(workoutVolume(workout)).toLocaleString()} kg volume</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="text-destructive"
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
              variant="success"
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

      <div className="grid gap-3">
        {workout.entries.map((entry, ei) => {
          const last = lastSessionSets(entry.exerciseId, history, workout.id)
          const best = bests.get(entry.exerciseId)
          return (
            <Card key={`${entry.exerciseId}-${ei}`} className="p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{names.get(entry.exerciseId) ?? 'Exercise'}</h3>
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {last && (
                      <span className="flex items-center gap-1">
                        <History className="h-3 w-3" /> Last: {last.map((s) => `${s.weightKg}×${s.reps}`).join(', ')}
                      </span>
                    )}
                    {best && best.weight > 0 && (
                      <Badge variant="warning">
                        <Trophy className="h-3 w-3" /> PR {best.weight} kg
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove exercise"
                  onClick={() => update(workout.entries.filter((_, i) => i !== ei))}
                >
                  <X />
                </Button>
              </div>
              <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2 text-xs text-muted-foreground">
                <span>Set</span>
                <span className="text-center">kg</span>
                <span className="text-center">Reps</span>
                <span />
              </div>
              {entry.sets.map((s, si) => {
                const isPr = s.done && best && s.weightKg > best.weight
                return (
                  <div
                    key={si}
                    className={cn('mt-1.5 grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2 rounded-lg', s.done && 'bg-success/10')}
                  >
                    <span className="text-center text-sm font-semibold">{isPr ? '🏆' : si + 1}</span>
                    <NumberCell value={s.weightKg} step={2.5} label="Weight in kg" onChange={(weightKg) => setSet(ei, si, { weightKg })} />
                    <NumberCell value={s.reps} step={1} label="Reps" onChange={(reps) => setSet(ei, si, { reps: Math.round(reps) })} />
                    <button
                      onClick={() => toggleDone(ei, si)}
                      aria-label={s.done ? 'Untick set' : 'Tick set'}
                      className={cn(
                        'flex h-9 w-11 items-center justify-center rounded-md border-2 transition-colors',
                        s.done ? 'border-success bg-success text-white' : 'border-input hover:border-success',
                      )}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                )
              })}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
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
                    size="sm"
                    variant="ghost"
                    onClick={() => update(workout.entries.map((e, i) => (i === ei ? { ...e, sets: e.sets.slice(0, -1) } : e)))}
                  >
                    Remove set
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
        <Button variant="outline" onClick={() => setPicker(true)}>
          <Plus /> Add exercise
        </Button>
        <Textarea
          placeholder="Notes (how did it feel?)"
          defaultValue={workout.notes}
          onBlur={(e) => e.target.value !== workout.notes && save('workouts', { id: workout.id, notes: e.target.value })}
        />
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
