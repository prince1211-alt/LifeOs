import { addDays, format, startOfWeek } from 'date-fns'
import type { Habit, HabitLog } from '@/lib/types'
import { indexLogs, isScheduled } from '@/lib/habits'
import { ymd } from '@/lib/utils'

/** GitHub-style calendar heatmap: columns are weeks, rows are weekdays. */
export function Heatmap({ habit, logs, weeks = 20, weekStart = 1 }: { habit: Habit; logs: HabitLog[]; weeks?: number; weekStart?: 0 | 1 }) {
  const idx = indexLogs(logs, habit.id)
  const today = new Date()
  const end = startOfWeek(today, { weekStartsOn: weekStart })
  const start = addDays(end, -7 * (weeks - 1))
  const todayKey = ymd(today)
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const target = Math.max(1, habit.target)
  const dayLabels = Array.from({ length: 7 }, (_, d) => format(addDays(start, d), 'EEEEE'))

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-[3px]">
        <div className="mr-1 grid grid-rows-7 gap-[3px] text-[9px] leading-[11px] text-muted-foreground">
          {dayLabels.map((l, i) => (
            <span key={i} className="h-[11px]">
              {i % 2 === 0 ? l : ''}
            </span>
          ))}
        </div>
        {cols.map((col, w) => (
          <div key={w} className="grid grid-rows-7 gap-[3px]">
            {col.map((d) => {
              const key = ymd(d)
              const log = idx.get(key)
              const future = key > todayKey
              const ratio = log && !log.skipped ? Math.min(1, log.value / target) : 0
              const scheduled = isScheduled(habit, d)
              return (
                <div
                  key={key}
                  title={`${format(d, 'EEE d MMM')}${log?.skipped ? ' · skipped' : log ? ` · ${log.value}/${target}` : ''}`}
                  className="h-[11px] w-[11px] rounded-[2px]"
                  style={{
                    background: future
                      ? 'transparent'
                      : log?.skipped
                        ? 'repeating-linear-gradient(45deg, var(--muted), var(--muted) 2px, var(--border) 2px, var(--border) 4px)'
                        : ratio > 0
                          ? habit.color
                          : 'var(--muted)',
                    opacity: ratio > 0 ? 0.35 + 0.65 * ratio : scheduled ? 1 : 0.4,
                    outline: key === todayKey ? '1px solid var(--foreground)' : undefined,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
