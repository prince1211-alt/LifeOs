import { useEffect, useRef } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import type { Habit, HabitLog } from '@/lib/types'
import { indexLogs, isScheduled } from '@/lib/habits'
import { ymd } from '@/lib/utils'
import { habitTint } from './HabitCheck'

const CELL = 12
const SKIPPED = 'repeating-linear-gradient(45deg, var(--md-outline-variant) 0 2px, transparent 2px 4px)'
const EMPTY = 'var(--md-outline-variant)'
const UNSCHEDULED = 'color-mix(in srgb, var(--md-outline-variant) 40%, transparent)'

/** Calendar heatmap: columns are weeks, rows are weekdays, newest week on the right. */
export function Heatmap({ habit, logs, weeks = 20, weekStart = 1 }: { habit: Habit; logs: HabitLog[]; weeks?: number; weekStart?: 0 | 1 }) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks])

  const idx = indexLogs(logs, habit.id)
  const today = new Date()
  const end = startOfWeek(today, { weekStartsOn: weekStart })
  const start = addDays(end, -7 * (weeks - 1))
  const todayKey = ymd(today)
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const target = Math.max(1, habit.target)
  const dayLabels = Array.from({ length: 7 }, (_, d) => format(addDays(start, d), 'EEEEE'))
  const hasFirst = (w: number) => cols[w]?.some((d) => d.getDate() === 1) ?? false
  const monthLabel = (w: number) => {
    const first = cols[w].find((d) => d.getDate() === 1)
    if (first) return format(first, 'MMM')
    return w === 0 && !hasFirst(1) && !hasFirst(2) ? format(cols[0][0], 'MMM') : ''
  }

  return (
    <div className="grid gap-3">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div
          className="inline-grid grid-flow-col gap-[3px] text-label-small text-on-surface-variant"
          style={{ gridTemplateRows: `16px repeat(7, ${CELL}px)`, gridTemplateColumns: `auto repeat(${weeks}, ${CELL}px)` }}
        >
          <span className="sticky left-0 z-10 bg-[var(--field-bg,var(--md-surface))]" />
          {dayLabels.map((l, i) => (
            <span key={i} className="sticky left-0 z-10 flex items-center bg-[var(--field-bg,var(--md-surface))] pr-1.5">
              {i % 2 === 0 ? l : ''}
            </span>
          ))}
          {cols.flatMap((col, w) => [
            <span key={`m${w}`} className="whitespace-nowrap">
              {monthLabel(w)}
            </span>,
            ...col.map((d) => {
              const key = ymd(d)
              const log = idx.get(key)
              const future = key > todayKey
              const ratio = log && !log.skipped ? Math.min(1, log.value / target) : 0
              return (
                <span
                  key={key}
                  title={`${format(d, 'EEE d MMM')}${log?.skipped ? ' · skipped' : log ? ` · ${log.value}/${target}` : ''}`}
                  className="rounded-xs"
                  style={{
                    background: future
                      ? 'transparent'
                      : log?.skipped
                        ? SKIPPED
                        : ratio > 0
                          ? ratio >= 1
                            ? habit.color
                            : habitTint(habit.color, Math.round(35 + 50 * ratio))
                          : isScheduled(habit, d)
                            ? EMPTY
                            : UNSCHEDULED,
                    outline: key === todayKey ? '2px solid var(--md-primary)' : undefined,
                  }}
                />
              )
            }),
          ])}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-small text-on-surface-variant">
        <LegendItem background={habit.color} label="Done" />
        {habit.type === 'count' && <LegendItem background={habitTint(habit.color, 60)} label="Partly" />}
        <LegendItem background={SKIPPED} label="Skipped" />
        <LegendItem background={EMPTY} label="Not done" />
      </div>
    </div>
  )
}

function LegendItem({ background, label }: { background: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-xs" style={{ background }} />
      {label}
    </span>
  )
}
