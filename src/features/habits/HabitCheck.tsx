import { Minus, Plus } from 'lucide-react'
import type { Habit, HabitLog } from '@/lib/types'
import { isDone } from '@/lib/habits'
import { cn, WEEKDAYS_SHORT } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { checkIn, setCount } from './actions'

export function describeSchedule(h: Habit) {
  if (h.schedule.kind === 'daily') return 'Every day'
  if (h.schedule.kind === 'weekly') return `${h.schedule.timesPerWeek}× a week`
  return h.schedule.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')
}

/** Check-in control: one tap for yes/no habits, − / + for count habits. */
export function HabitCheck({ habit, log, date, size = 'md' }: { habit: Habit; log?: HabitLog; date: string; size?: 'sm' | 'md' }) {
  const done = isDone(habit, log)
  const big = size === 'md'
  if (habit.type === 'count') {
    const value = log && !log.skipped ? log.value : 0
    return (
      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Decrease"
          disabled={!value}
          onClick={(e) => {
            e.stopPropagation()
            setCount(habit, date, value - 1)
          }}
        >
          <Minus />
        </Button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            checkIn(habit, date)
          }}
          className={cn(
            'tabular flex items-center justify-center rounded-full border-2 font-semibold transition-colors',
            big ? 'h-11 min-w-11 px-2 text-sm' : 'h-8 min-w-8 px-1.5 text-xs',
          )}
          style={{ borderColor: habit.color, background: done ? habit.color : undefined, color: done ? 'white' : undefined }}
          aria-label={`Add one to ${habit.name}`}
        >
          {value}/{habit.target}
        </button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Increase"
          onClick={(e) => {
            e.stopPropagation()
            checkIn(habit, date)
          }}
        >
          <Plus />
        </Button>
      </div>
    )
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        checkIn(habit, date)
      }}
      aria-pressed={done}
      aria-label={done ? `Undo ${habit.name}` : `Check in ${habit.name}`}
      className={cn(
        'flex items-center justify-center rounded-full border-2 transition-all active:scale-90',
        big ? 'h-11 w-11 text-xl' : 'h-8 w-8 text-sm',
      )}
      style={{ borderColor: habit.color, background: done ? habit.color : undefined }}
    >
      {done ? (
        <svg viewBox="0 0 24 24" className={big ? 'h-6 w-6' : 'h-4 w-4'} fill="none" stroke="white" strokeWidth={3}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : (
        <span className="opacity-70">{habit.icon}</span>
      )}
    </button>
  )
}

