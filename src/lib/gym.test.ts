import { describe, expect, it } from 'vitest'
import { detectPRs, lastSessionSets, workoutVolume } from './gym'
import type { Workout } from './types'

const w = (id: string, startedAt: number, sets: [number, number, boolean][]): Workout => ({
  id,
  name: 'Push',
  startedAt,
  endedAt: startedAt + 3600_000,
  entries: [{ exerciseId: 'bench', sets: sets.map(([reps, weightKg, done]) => ({ reps, weightKg, done })) }],
  notes: '',
  createdAt: 0,
  updatedAt: 0,
})

describe('gym', () => {
  it('volume counts only done sets', () => {
    expect(workoutVolume(w('1', 0, [[10, 50, true], [8, 60, false]]))).toBe(500)
  })
  it('detects weight PRs after a baseline', () => {
    const { prs, bests } = detectPRs([w('1', 1, [[8, 60, true]]), w('2', 2, [[5, 70, true]]), w('3', 3, [[5, 65, true]])])
    expect(prs).toEqual([{ exerciseId: 'bench', kind: 'weight', value: 70, workoutId: '2', at: 2 }])
    expect(bests.get('bench')?.weight).toBe(70)
  })
  it('finds last session sets', () => {
    const list = [w('1', 1, [[8, 60, true]]), w('2', 2, [[5, 70, true]])]
    expect(lastSessionSets('bench', list, '2')).toEqual([{ reps: 8, weightKg: 60, done: true }])
  })
})
