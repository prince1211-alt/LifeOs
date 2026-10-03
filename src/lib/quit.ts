import type { QuitGoal, Relapse, UrgeLog } from './types'

const DAY = 86_400_000

export const MILESTONES = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
]

/** Clean since the start date or the latest relapse, whichever is later. */
export function cleanSince(goal: QuitGoal, relapses: Relapse[]): number {
  let since = goal.startDate
  for (const r of relapses) if (r.quitGoalId === goal.id && !r.deletedAt && r.at > since) since = r.at
  return since
}

export function quitStats(goal: QuitGoal, relapses: Relapse[], now = Date.now()) {
  const since = cleanSince(goal, relapses)
  const elapsed = Math.max(0, now - since)
  const days = elapsed / DAY
  const reached = MILESTONES.filter((m) => days >= m.days)
  const next = MILESTONES.find((m) => days < m.days) ?? null
  const prevDays = reached.length ? reached[reached.length - 1].days : 0
  return {
    since,
    elapsed,
    days,
    moneySaved: days * (goal.costPerDay || 0),
    minutesSaved: days * (goal.minutesPerDay || 0),
    reached,
    next,
    nextProgress: next ? (days - prevDays) / (next.days - prevDays) : 1,
    relapseCount: relapses.filter((r) => r.quitGoalId === goal.id && !r.deletedAt).length,
  }
}

/** Longest clean run between start, relapses and now. */
export function bestStreakMs(goal: QuitGoal, relapses: Relapse[], now = Date.now()): number {
  const points = [
    goal.startDate,
    ...relapses.filter((r) => r.quitGoalId === goal.id && !r.deletedAt && r.at >= goal.startDate).map((r) => r.at),
  ].sort((a, b) => a - b)
  let best = 0
  for (let i = 0; i < points.length; i++) best = Math.max(best, (points[i + 1] ?? now) - points[i])
  return best
}

export function formatHour(h: number) {
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`
}

/** Later: trigger insights, e.g. "most urges around 10 pm". */
export function urgeInsights(urges: UrgeLog[]) {
  const live = urges.filter((u) => !u.deletedAt)
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  const triggers = new Map<string, number>()
  let intensity = 0
  for (const u of live) {
    byHour[new Date(u.at).getHours()].count++
    const t = u.trigger.trim().toLowerCase()
    if (t) triggers.set(t, (triggers.get(t) ?? 0) + 1)
    intensity += u.intensity
  }
  const peak = live.length ? byHour.reduce((a, b) => (b.count > a.count ? b : a)) : null
  const topTriggers = [...triggers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  return {
    total: live.length,
    byHour,
    peakHour: peak && peak.count > 0 ? peak.hour : null,
    topTriggers,
    avgIntensity: live.length ? intensity / live.length : 0,
  }
}
