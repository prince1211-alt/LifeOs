import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './nlp'

// Saturday 3 Oct 2026, 10:00
const now = new Date(2026, 9, 3, 10, 0)

describe('parseQuickAdd', () => {
  it('parses "gym tomorrow 6pm"', () => {
    expect(parseQuickAdd('gym tomorrow 6pm', now)).toMatchObject({ title: 'gym', dueDate: '2026-10-04', dueTime: '18:00' })
  })
  it('handles priority and tags', () => {
    const r = parseQuickAdd('Pay rent p1 #home #money', now)
    expect(r).toMatchObject({ title: 'Pay rent', priority: 1, tags: ['home', 'money'], dueDate: null })
  })
  it('handles weekdays and 24h time', () => {
    expect(parseQuickAdd('call mom monday 18:30', now)).toMatchObject({ title: 'call mom', dueDate: '2026-10-05', dueTime: '18:30' })
    expect(parseQuickAdd('dinner on sat', now).dueDate).toBe('2026-10-10')
  })
  it('keeps short day words in titles', () => {
    expect(parseQuickAdd('sun salutation', now)).toMatchObject({ title: 'sun salutation', dueDate: null })
  })
  it('handles recurrence', () => {
    expect(parseQuickAdd('meditate every day 7am', now)).toMatchObject({
      title: 'meditate',
      recurrence: { kind: 'daily' },
      dueTime: '07:00',
      dueDate: '2026-10-04',
    })
    expect(parseQuickAdd('team sync every mon and wed', now)).toMatchObject({
      title: 'team sync',
      recurrence: { kind: 'weekly', days: [1, 3] },
      dueDate: '2026-10-05',
    })
  })
  it('handles explicit dates', () => {
    expect(parseQuickAdd('exam 12 oct', now).dueDate).toBe('2026-10-12')
    expect(parseQuickAdd('renew passport jan 5', now).dueDate).toBe('2027-01-05')
    expect(parseQuickAdd('bill 15/10', now).dueDate).toBe('2026-10-15')
    expect(parseQuickAdd('trip in 2 weeks', now).dueDate).toBe('2026-10-17')
  })
  it('time alone means today, or tomorrow if passed', () => {
    expect(parseQuickAdd('read at 9pm', now)).toMatchObject({ dueDate: '2026-10-03', dueTime: '21:00' })
    expect(parseQuickAdd('stretch 8am', now)).toMatchObject({ dueDate: '2026-10-04', dueTime: '08:00' })
  })
})
