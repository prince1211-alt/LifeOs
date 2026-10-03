import type { Workout, WorkoutSet } from './types'

export const setVolume = (s: WorkoutSet) => (s.done ? s.reps * s.weightKg : 0)

export function workoutVolume(w: Workout): number {
  return w.entries.reduce((sum, e) => sum + e.sets.reduce((a, s) => a + setVolume(s), 0), 0)
}

export function doneSets(w: Workout): number {
  return w.entries.reduce((sum, e) => sum + e.sets.filter((s) => s.done).length, 0)
}

/** Epley estimated one-rep max. */
export const est1RM = (weightKg: number, reps: number) => (reps <= 1 ? weightKg : weightKg * (1 + reps / 30))

export interface PR {
  exerciseId: string
  kind: 'weight' | '1rm' | 'reps'
  value: number
  workoutId: string
  at: number
}

export interface Best {
  weight: number
  oneRm: number
  reps: number
}

/**
 * Walk finished workouts in order and record every time an exercise beats its
 * previous best weight, estimated 1RM or (bodyweight) reps. A first-ever
 * session sets a baseline, not a PR.
 */
export function detectPRs(workouts: Workout[]): { prs: PR[]; bests: Map<string, Best> } {
  const done = workouts.filter((w) => w.endedAt && !w.deletedAt).sort((a, b) => a.startedAt - b.startedAt)
  const bests = new Map<string, Best>()
  const prs: PR[] = []
  for (const w of done) {
    for (const e of w.entries) {
      const sets = e.sets.filter((s) => s.done && s.reps > 0)
      if (!sets.length) continue
      const weight = Math.max(...sets.map((s) => s.weightKg))
      const oneRm = Math.max(...sets.map((s) => est1RM(s.weightKg, s.reps)))
      const reps = Math.max(...sets.map((s) => s.reps))
      const prev = bests.get(e.exerciseId)
      if (prev) {
        const at = w.startedAt
        if (weight > prev.weight) prs.push({ exerciseId: e.exerciseId, kind: 'weight', value: weight, workoutId: w.id, at })
        else if (oneRm > prev.oneRm + 0.01)
          prs.push({ exerciseId: e.exerciseId, kind: '1rm', value: Math.round(oneRm * 10) / 10, workoutId: w.id, at })
        else if (weight === 0 && prev.weight === 0 && reps > prev.reps)
          prs.push({ exerciseId: e.exerciseId, kind: 'reps', value: reps, workoutId: w.id, at })
      }
      bests.set(e.exerciseId, {
        weight: Math.max(weight, prev?.weight ?? 0),
        oneRm: Math.max(oneRm, prev?.oneRm ?? 0),
        reps: Math.max(reps, prev?.reps ?? 0),
      })
    }
  }
  return { prs, bests }
}

/** Later: last session's numbers for an exercise, shown while logging. */
export function lastSessionSets(exerciseId: string, workouts: Workout[], excludeId?: string): WorkoutSet[] | null {
  const prior = workouts
    .filter((w) => w.endedAt && !w.deletedAt && w.id !== excludeId)
    .sort((a, b) => b.startedAt - a.startedAt)
  for (const w of prior) {
    const e = w.entries.find((x) => x.exerciseId === exerciseId)
    const sets = e?.sets.filter((s) => s.done)
    if (sets?.length) return sets
  }
  return null
}

/** Later: best weight per session for one exercise, for the progress chart. */
export function exerciseProgress(exerciseId: string, workouts: Workout[]) {
  return workouts
    .filter((w) => w.endedAt && !w.deletedAt)
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((w) => {
      const sets = w.entries.find((e) => e.exerciseId === exerciseId)?.sets.filter((s) => s.done) ?? []
      if (!sets.length) return []
      return [
        {
          at: w.startedAt,
          weight: Math.max(...sets.map((s) => s.weightKg)),
          oneRm: Math.round(Math.max(...sets.map((s) => est1RM(s.weightKg, s.reps))) * 10) / 10,
        },
      ]
    })
}
