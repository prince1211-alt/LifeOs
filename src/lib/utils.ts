import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { format } from 'date-fns'

// The M3 type-scale utilities (text-title-medium…) are font sizes, not colours,
// so they must not override (or be overridden by) text-on-surface and friends.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [(v: string) => /^(display|headline|title|body|label)-(large|medium|small)$/.test(v)] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Local calendar date as YYYY-MM-DD. */
export function ymd(d: Date | number = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function hm(d: Date | number = new Date()): string {
  return format(d, 'HH:mm')
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function timeFromMinutes(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function formatTime(time: string, fmt: '12' | '24'): string {
  if (fmt === '24') return time
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatDuration(ms: number, opts: { seconds?: boolean } = {}): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts: string[] = []
  if (d) parts.push(`${d} ${d === 1 ? 'day' : 'days'}`)
  if (h || d) parts.push(`${h} hr${h === 1 ? '' : 's'}`)
  if (!d) parts.push(`${m} min`)
  if (opts.seconds && !d) parts.push(`${s} s`)
  return parts.join(' ')
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function orderedWeekdays(weekStart: 0 | 1): number[] {
  return weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]
}

export function rupees(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
