// Natural-language quick add (Later): "gym tomorrow 6pm p1 #health every monday"
import { addDays, addMonths, getDay } from 'date-fns'
import type { Priority, Recurrence } from './types'
import { ymd } from './utils'

export interface ParsedTask {
  title: string
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  tags: string[]
  recurrence: Recurrence
}

const DAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
}
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10,
  november: 10, dec: 11, december: 11,
}
const DAY_RE = Object.keys(DAY_NAMES).sort((a, b) => b.length - a.length).join('|')
const FULL_DAY_RE = Object.keys(DAY_NAMES).filter((d) => d.endsWith('day')).join('|')
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

const pad = (n: number) => String(n).padStart(2, '0')

/** The coming `day` (never today). */
function nextWeekday(now: Date, day: number): Date {
  return addDays(now, (day - getDay(now) + 7) % 7 || 7)
}

export function parseQuickAdd(input: string, now = new Date()): ParsedTask {
  let s = ` ${input.trim()} `
  let dueDate: string | null = null
  let dueTime: string | null = null
  let priority: Priority = 4
  const tags: string[] = []
  let recurrence: Recurrence = { kind: 'none' }

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = s.match(re)
    if (m && fn(m) !== false) s = s.replace(m[0], ' ')
  }

  // Tags and priority
  for (const m of s.matchAll(/\s#([\p{L}\p{N}_-]+)/gu)) tags.push(m[1].toLowerCase())
  s = s.replace(/\s#[\p{L}\p{N}_-]+/gu, ' ')
  take(/\s(?:p|!)([1-4])(?=\s)/i, (m) => {
    priority = Number(m[1]) as Priority
  })

  // Recurrence
  take(/\s(?:every\s?day|daily)(?=\s)/i, () => {
    recurrence = { kind: 'daily' }
  })
  take(/\s(?:every\s+weekday|weekdays)(?=\s)/i, () => {
    recurrence = { kind: 'weekdays' }
  })
  take(/\s(?:every\s+week|weekly)(?=\s)/i, () => {
    recurrence = { kind: 'weekly', days: [getDay(now)] }
  })
  take(/\s(?:every\s+month|monthly)(?=\s)/i, () => {
    recurrence = { kind: 'monthly' }
  })
  take(/\severy\s+(\d+)\s+days?(?=\s)/i, (m) => {
    recurrence = { kind: 'custom', interval: Number(m[1]) }
  })
  take(new RegExp(`\\severy\\s+((?:(?:${DAY_RE})(?:\\s*(?:,|and)\\s*)?)+)(?=\\s)`, 'i'), (m) => {
    const days = m[1]
      .toLowerCase()
      .split(/\s*(?:,|and|\s)\s*/)
      .filter((x) => x in DAY_NAMES)
      .map((x) => DAY_NAMES[x])
    recurrence = { kind: 'weekly', days: [...new Set(days)].sort() }
    dueDate ??= ymd(days.includes(getDay(now)) ? now : addDays(now, Math.min(...days.map((d) => (d - getDay(now) + 7) % 7))))
  })

  // Time: 6pm, 6:30 pm, 18:00, at 6, noon, morning…
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i, (m) => {
    let h = Number(m[1]) % 12
    if (m[3].toLowerCase() === 'pm') h += 12
    const min = Number(m[2] ?? 0)
    if (h > 23 || min > 59) return false
    dueTime = `${pad(h)}:${pad(min)}`
  })
  if (!dueTime)
    take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, (m) => {
      dueTime = `${pad(Number(m[1]))}:${m[2]}`
    })
  if (!dueTime)
    take(/\sat\s+(\d{1,2})(?=\s)/i, (m) => {
      const h = Number(m[1])
      if (h > 23) return false
      dueTime = `${pad(h >= 1 && h <= 7 ? h + 12 : h)}:00` // "at 6" → 6 pm
    })
  if (!dueTime)
    take(/\s(noon|midnight|morning|afternoon|evening|tonight)(?=\s)/i, (m) => {
      const map: Record<string, string> = {
        noon: '12:00', midnight: '00:00', morning: '09:00', afternoon: '15:00', evening: '18:00', tonight: '20:00',
      }
      const k = m[1].toLowerCase()
      dueTime = map[k]
      if (k === 'tonight') dueDate ??= ymd(now)
    })

  // Date
  take(/\s(today|tod)(?=\s)/i, () => {
    dueDate = ymd(now)
  })
  take(/\s(tomorrow|tmrw|tmr)(?=\s)/i, () => {
    dueDate = ymd(addDays(now, 1))
  })
  take(/\sday after tomorrow(?=\s)/i, () => {
    dueDate = ymd(addDays(now, 2))
  })
  take(/\sin\s+(\d+)\s+(day|days|week|weeks|month|months)(?=\s)/i, (m) => {
    const n = Number(m[1])
    const unit = m[2].toLowerCase()
    dueDate = ymd(unit.startsWith('month') ? addMonths(now, n) : addDays(now, unit.startsWith('week') ? n * 7 : n))
  })
  take(/\snext\s+week(?=\s)/i, () => {
    dueDate = ymd(nextWeekday(now, 1))
  })
  // Full names anywhere ("monday"); short names only after on/next ("on sat") so words like "sun" stay in the title.
  take(new RegExp(`\\s(?:(?:on|next)\\s+(${DAY_RE})|(${FULL_DAY_RE}))(?=\\s)`, 'i'), (m) => {
    dueDate = ymd(nextWeekday(now, DAY_NAMES[(m[1] ?? m[2]).toLowerCase()]))
  })
  take(new RegExp(`\\s(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})(?=\\s)`, 'i'), (m) => {
    dueDate = ymd(futureDate(now, MONTHS[m[2].toLowerCase()], Number(m[1])))
  })
  take(new RegExp(`\\s(?:on\\s+)?(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'), (m) => {
    dueDate = ymd(futureDate(now, MONTHS[m[1].toLowerCase()], Number(m[2])))
  })
  take(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (m) => {
    // Day/month order, as used in India.
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    if (month > 11 || day > 31) return false
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined
    dueDate = ymd(year ? new Date(year, month, day) : futureDate(now, month, day))
  })

  if (dueTime && !dueDate) {
    const [h, m] = (dueTime as string).split(':').map(Number)
    const passed = h * 60 + m <= now.getHours() * 60 + now.getMinutes()
    dueDate = ymd(passed ? addDays(now, 1) : now)
  }
  if (recurrence.kind !== 'none' && !dueDate) dueDate = ymd(now)

  const title = s.replace(/\s+/g, ' ').trim()
  return { title: title || input.trim(), dueDate, dueTime, priority, tags, recurrence }
}

function futureDate(now: Date, month: number, day: number): Date {
  const d = new Date(now.getFullYear(), month, day)
  if (ymd(d) < ymd(now)) d.setFullYear(d.getFullYear() + 1)
  return d
}
