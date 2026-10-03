import { describe, expect, it } from 'vitest'
import { bestStreakMs, quitStats, urgeInsights } from './quit'
import type { QuitGoal, Relapse, UrgeLog } from './types'

const DAY = 86_400_000
const goal: QuitGoal = { id: 'g', name: 'Smoking', startDate: 0, costPerDay: 100, minutesPerDay: 30, reason: '', createdAt: 0, updatedAt: 0 }
const relapse = (at: number): Relapse => ({ id: String(at), quitGoalId: 'g', at, note: '', createdAt: 0, updatedAt: 0 })

describe('quit', () => {
  it('computes savings and milestones from the last relapse', () => {
    const s = quitStats(goal, [relapse(2 * DAY)], 10 * DAY)
    expect(s.days).toBe(8)
    expect(s.moneySaved).toBe(800)
    expect(s.minutesSaved).toBe(240)
    expect(s.reached.map((m) => m.days)).toEqual([1, 3, 7])
    expect(s.next?.days).toBe(30)
    expect(s.relapseCount).toBe(1)
  })
  it('best streak spans relapses', () => {
    expect(bestStreakMs(goal, [relapse(5 * DAY), relapse(6 * DAY)], 8 * DAY)).toBe(5 * DAY)
  })
  it('finds the peak urge hour', () => {
    const u = (h: number): UrgeLog => ({
      id: String(h), quitGoalId: 'g', at: new Date(2026, 0, 1, h).getTime(), trigger: 'Stress', intensity: 3, action: '', createdAt: 0, updatedAt: 0,
    })
    const r = urgeInsights([u(22), u(22), u(9)])
    expect(r.peakHour).toBe(22)
    expect(r.topTriggers[0]).toEqual(['stress', 3])
  })
})
