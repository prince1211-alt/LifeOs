import { describe, expect, it } from 'vitest'
import { nextOccurrence } from './recurrence'

describe('nextOccurrence', () => {
  it('daily, weekdays, monthly', () => {
    expect(nextOccurrence({ kind: 'daily' }, '2026-10-03')).toBe('2026-10-04')
    expect(nextOccurrence({ kind: 'weekdays' }, '2026-10-02')).toBe('2026-10-05') // Fri → Mon
    expect(nextOccurrence({ kind: 'monthly' }, '2026-01-31')).toBe('2026-02-28')
    expect(nextOccurrence({ kind: 'none' }, '2026-10-03')).toBeNull()
  })
  it('weekly on chosen days and custom intervals', () => {
    expect(nextOccurrence({ kind: 'weekly', days: [1, 4] }, '2026-10-05')).toBe('2026-10-08') // Mon → Thu
    expect(nextOccurrence({ kind: 'weekly' }, '2026-10-05')).toBe('2026-10-12')
    expect(nextOccurrence({ kind: 'custom', interval: 3 }, '2026-10-05')).toBe('2026-10-08')
  })
})
