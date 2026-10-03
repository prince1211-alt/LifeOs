import { addDays, addMonths, getDay } from 'date-fns'
import type { Recurrence } from './types'
import { parseYmd, ymd } from './utils'

/** Next due date strictly after `from` (YYYY-MM-DD) for a recurrence rule. */
export function nextOccurrence(rule: Recurrence, from: string): string | null {
  const d = parseYmd(from)
  switch (rule.kind) {
    case 'none':
      return null
    case 'daily':
      return ymd(addDays(d, 1))
    case 'weekdays': {
      let n = addDays(d, 1)
      while (getDay(n) === 0 || getDay(n) === 6) n = addDays(n, 1)
      return ymd(n)
    }
    case 'weekly':
    case 'custom': {
      const days = rule.days?.length ? rule.days : null
      if (!days) {
        const step = rule.kind === 'weekly' ? 7 : Math.max(1, rule.interval ?? 1)
        return ymd(addDays(d, step))
      }
      let n = addDays(d, 1)
      for (let i = 0; i < 7 && !days.includes(getDay(n)); i++) n = addDays(n, 1)
      return ymd(n)
    }
    case 'monthly':
      return ymd(addMonths(d, 1))
  }
}

export function describeRecurrence(rule: Recurrence): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  switch (rule.kind) {
    case 'none':
      return ''
    case 'daily':
      return 'Every day'
    case 'weekdays':
      return 'Weekdays'
    case 'weekly':
      return rule.days?.length ? `Weekly on ${rule.days.map((x) => names[x]).join(', ')}` : 'Every week'
    case 'monthly':
      return 'Every month'
    case 'custom':
      return rule.days?.length
        ? `On ${rule.days.map((x) => names[x]).join(', ')}`
        : `Every ${rule.interval ?? 1} days`
  }
}
