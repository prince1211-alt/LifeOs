import { db } from '@/lib/db'
import { save } from '@/lib/repo'
import { detectPRs, lastSessionSets } from '@/lib/gym'
import type { Workout, WorkoutTemplate } from '@/lib/types'
import { toast } from '@/store/app'

/** Start a workout from a template, prefilling weights from the last session. */
export async function startWorkout(template?: WorkoutTemplate): Promise<Workout> {
  const history = (await db.workouts.toArray()).filter((w) => !w.deletedAt)
  const active = history.find((w) => !w.endedAt)
  if (active) return active
  const entries = (template?.exercises ?? []).map((e) => {
    const last = lastSessionSets(e.exerciseId, history)
    return {
      exerciseId: e.exerciseId,
      sets: Array.from({ length: Math.max(1, e.sets) }, (_, i) => ({
        reps: last?.[i]?.reps ?? e.reps,
        weightKg: last?.[i]?.weightKg ?? last?.[last.length - 1]?.weightKg ?? 0,
        done: false,
      })),
    }
  })
  return save('workouts', {
    templateId: template?.id ?? null,
    name: template?.name ?? 'Workout',
    startedAt: Date.now(),
    endedAt: null,
    entries,
    notes: '',
  })
}

/** Finish: drop empty exercises, stamp end time and announce new PRs. */
export async function finishWorkout(w: Workout) {
  const entries = w.entries
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length)
  const done = await save('workouts', { id: w.id, entries, endedAt: Date.now() })
  const all = (await db.workouts.toArray()).filter((x) => !x.deletedAt)
  const { prs } = detectPRs(all)
  const mine = prs.filter((p) => p.workoutId === done.id)
  if (mine.length) {
    const names = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]))
    toast(`🏆 New PR${mine.length > 1 ? 's' : ''}: ${mine.map((p) => `${names.get(p.exerciseId)} ${p.value}${p.kind === 'reps' ? ' reps' : ' kg'}`).join(', ')}`)
  } else toast('Workout saved 💪')
  return done
}
