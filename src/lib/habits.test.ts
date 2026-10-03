import { describe, expect, it } from 'vitest'
import { computeStreak, isDueOn, successRate, habitLogId } from './habits'
import type { Habit, HabitLog } from './types'

const day = (s: string) => new Date(`${s}T12:00:00`)

function habit(p: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Water',
    icon: '💧',
    color: '#000',
    type: 'check',
    target: 1,
    schedule: { kind: 'daily', days: [], timesPerWeek: 3 },
    reminderTime: null,
    createdAt: day('2026-09-01').getTime(),
    updatedAt: 0,
    ...p,
  }
}

const log = (date: string, value = 1, skipped = false): HabitLog => ({
  id: habitLogId('h1', date),
  habitId: 'h1',
  date,
  value,
  skipped,
  createdAt: 0,
  updatedAt: 0,
})

describe('daily streaks', () => {
  it('counts consecutive days and keeps today open', () => {
    const logs = ['2026-09-07', '2026-09-08', '2026-09-09'].map((d) => log(d))
    // Today (10th) not done yet: streak still 3.
    expect(computeStreak(habit(), logs, day('2026-09-10'))).toEqual({ current: 3, best: 3, unit: 'days' })
    // Done today: 4.
    expect(computeStreak(habit(), [...logs, log('2026-09-10')], day('2026-09-10')).current).toBe(4)
  })

  it('resets after a missed day but remembers the best', () => {
    const logs = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05'].map((d) => log(d))
    expect(computeStreak(habit(), logs, day('2026-09-05'))).toEqual({ current: 1, best: 3, unit: 'days' })
    expect(computeStreak(habit(), logs, day('2026-09-07')).current).toBe(0)
  })

  it('a skipped (freeze) day does not break the streak', () => {
    const logs = [log('2026-09-01'), log('2026-09-02', 0, true), log('2026-09-03')]
    expect(computeStreak(habit(), logs, day('2026-09-03')).current).toBe(2)
  })

  it('count habits need the target', () => {
    const h = habit({ type: 'count', target: 8 })
    const logs = [log('2026-09-01', 8), log('2026-09-02', 5)]
    expect(computeStreak(h, logs, day('2026-09-03'))).toMatchObject({ current: 0, best: 1 })
  })
})

describe('chosen-days schedule', () => {
  // Mon/Wed/Fri. 2026-09-07 is a Monday.
  const h = habit({ schedule: { kind: 'days', days: [1, 3, 5], timesPerWeek: 0 }, createdAt: day('2026-09-07').getTime() })
  it('ignores unscheduled days', () => {
    const logs = ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14'].map((d) => log(d))
    expect(computeStreak(h, logs, day('2026-09-15')).current).toBe(4)
  })
  it('breaks on a missed scheduled day', () => {
    const logs = ['2026-09-07', '2026-09-11'].map((d) => log(d))
    expect(computeStreak(h, logs, day('2026-09-12'))).toMatchObject({ current: 1, best: 1 })
  })
  it('is due only on scheduled days', () => {
    expect(isDueOn(h, [], day('2026-09-07'))).toBe(true)
    expect(isDueOn(h, [], day('2026-09-08'))).toBe(false)
  })
})

describe('X times a week', () => {
  const h = habit({ schedule: { kind: 'weekly', days: [], timesPerWeek: 2 }, createdAt: day('2026-08-31').getTime() })
  it('counts weeks that hit the target; current week stays open', () => {
    // Weeks start Monday: 08-31, 09-07, 09-14
    const logs = ['2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10', '2026-09-14'].map((d) => log(d))
    expect(computeStreak(h, logs, day('2026-09-15'))).toEqual({ current: 2, best: 2, unit: 'weeks' })
  })
  it('a missed week resets', () => {
    const logs = ['2026-09-01', '2026-09-03', '2026-09-08'].map((d) => log(d))
    expect(computeStreak(h, logs, day('2026-09-15')).current).toBe(0)
  })
  it('is no longer due once the weekly target is met', () => {
    const logs = ['2026-09-14', '2026-09-15'].map((d) => log(d))
    expect(isDueOn(h, logs, day('2026-09-16'))).toBe(false)
    expect(isDueOn(h, logs.slice(0, 1), day('2026-09-16'))).toBe(true)
  })
})

describe('successRate', () => {
  it('is done / scheduled', () => {
    const logs = ['2026-09-01', '2026-09-02'].map((d) => log(d))
    expect(successRate(habit(), logs, day('2026-09-01'), day('2026-09-04'))).toBe(0.5)
  })
})
