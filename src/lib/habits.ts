import { addDays, differenceInCalendarDays, getDay, startOfWeek } from 'date-fns'
import type { Habit, HabitLog } from './types'
import { parseYmd, ymd } from './utils'

export type LogIndex = Map<string, HabitLog> // date → log (one habit)

export function indexLogs(logs: HabitLog[], habitId: string): LogIndex {
  const m: LogIndex = new Map()
  for (const l of logs) if (l.habitId === habitId && !l.deletedAt) m.set(l.date, l)
  return m
}

export const habitLogId = (habitId: string, date: string) => `${habitId}_${date}`

export function isDone(h: Habit, log?: HabitLog) {
  return Boolean(log && !log.skipped && log.value >= Math.max(1, h.target))
}

/** Daily / chosen-days habits: is `date` a scheduled day? (weekly habits: any day) */
export function isScheduled(h: Habit, date: Date): boolean {
  if (h.schedule.kind === 'days') return h.schedule.days.includes(getDay(date))
  return true
}

function firstDay(h: Habit, idx: LogIndex): Date {
  let first = new Date(h.createdAt || Date.now())
  for (const d of idx.keys()) if (d < ymd(first)) first = parseYmd(d)
  return parseYmd(ymd(first))
}

export interface Streak {
  current: number
  best: number
  unit: 'days' | 'weeks'
}

/**
 * Streaks respect the schedule: unscheduled days are ignored, skipped
 * ("freeze") days don't break the streak, and an unfinished today is still open.
 */
export function computeStreak(h: Habit, logs: HabitLog[], today = new Date(), weekStart: 0 | 1 = 1): Streak {
  const idx = indexLogs(logs, h.id)
  const start = firstDay(h, idx)
  const todayKey = ymd(today)
  if (h.schedule.kind === 'weekly') return weeklyStreak(h, idx, start, today, weekStart)

  // Walk forward from the first day to today, tracking runs.
  let run = 0
  let best = 0
  const total = differenceInCalendarDays(today, start)
  for (let i = 0; i <= total; i++) {
    const d = addDays(start, i)
    if (!isScheduled(h, d)) continue
    const key = ymd(d)
    const log = idx.get(key)
    if (isDone(h, log)) {
      run++
      best = Math.max(best, run)
    } else if (log?.skipped) {
      continue
    } else if (key !== todayKey) {
      run = 0
    }
  }
  return { current: run, best, unit: 'days' }
}

function weeklyStreak(h: Habit, idx: LogIndex, start: Date, today: Date, weekStart: 0 | 1): Streak {
  const need = Math.max(1, h.schedule.timesPerWeek || 1)
  const thisWeek = startOfWeek(today, { weekStartsOn: weekStart })
  let w = startOfWeek(start, { weekStartsOn: weekStart })
  let run = 0
  let best = 0
  while (w <= thisWeek) {
    let done = 0
    let skipped = false
    for (let i = 0; i < 7; i++) {
      const log = idx.get(ymd(addDays(w, i)))
      if (isDone(h, log)) done++
      if (log?.skipped) skipped = true
    }
    const current = w.getTime() === thisWeek.getTime()
    if (done >= need) {
      run++
      best = Math.max(best, run)
    } else if (!skipped && !current) {
      run = 0
    }
    w = addDays(w, 7)
  }
  return { current: run, best, unit: 'weeks' }
}

/** Should the habit show as "due" on the Today screen? */
export function isDueOn(h: Habit, logs: HabitLog[], date = new Date(), weekStart: 0 | 1 = 1): boolean {
  if (h.archived) return false
  if (h.schedule.kind !== 'weekly') return isScheduled(h, date)
  const idx = indexLogs(logs, h.id)
  const ws = startOfWeek(date, { weekStartsOn: weekStart })
  let done = 0
  for (let i = 0; i < 7; i++) {
    const key = ymd(addDays(ws, i))
    if (key !== ymd(date) && isDone(h, idx.get(key))) done++
  }
  return done < Math.max(1, h.schedule.timesPerWeek)
}

/** Success rate (0–1) for a habit over [from, to] inclusive. */
export function successRate(h: Habit, logs: HabitLog[], from: Date, to: Date): number | null {
  const idx = indexLogs(logs, h.id)
  const created = parseYmd(ymd(new Date(h.createdAt || 0)))
  const begin = from < created ? created : from
  if (begin > to) return null
  if (h.schedule.kind === 'weekly') {
    const days = differenceInCalendarDays(to, begin) + 1
    const expected = (Math.max(1, h.schedule.timesPerWeek) * days) / 7
    let done = 0
    for (let i = 0; i < days; i++) if (isDone(h, idx.get(ymd(addDays(begin, i))))) done++
    return Math.min(1, done / Math.max(1, expected))
  }
  let due = 0
  let done = 0
  for (let d = begin; d <= to; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue
    const log = idx.get(ymd(d))
    if (log?.skipped) continue
    due++
    if (isDone(h, log)) done++
  }
  return due ? done / due : null
}

export const HABIT_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#14b8a6', '#eab308', '#ec4899']
export const HABIT_ICONS = ['💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '🦷', '✍️', '🎯', '🌅', '🚶', '🧠', '🎸', '🙏', '☀️']
