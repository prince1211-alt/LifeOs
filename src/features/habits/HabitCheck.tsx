import { Check, Minus, Plus } from '@/components/icons'
import type { Habit, HabitLog } from '@/lib/types'
import { isDone } from '@/lib/habits'
import { cn, WEEKDAYS_SHORT } from '@/lib/utils'
import { IconButton } from '@/components/ui/button'
import { checkIn, setCount } from './actions'

export function describeSchedule(h: Habit) {
  if (h.schedule.kind === 'daily') return 'Every day'
  if (h.schedule.kind === 'weekly') return `${h.schedule.timesPerWeek}× a week`
  return h.schedule.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')
}

/** Habit colour mixed into the surface, for icon discs and tonal fills. */
export const habitTint = (color: string, amount = 20) => `color-mix(in srgb, ${color} ${amount}%, transparent)`

/** Round avatar with the habit's emoji on a tint of its colour (Google Fit style). */
export function HabitAvatar({ habit, className }: { habit: Pick<Habit, 'icon' | 'color'>; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-xl', className)}
      style={{ background: habitTint(habit.color) }}
    >
      {habit.icon}
    </span>
  )
}

/** Check-in control: one tap for yes/no habits, − n/target + for count habits. */
export function HabitCheck({ habit, log, date, size = 'md' }: { habit: Habit; log?: HabitLog; date: string; size?: 'sm' | 'md' }) {
  const done = isDone(habit, log)
  const big = size === 'md'
  if (habit.type === 'count') {
    const value = log && !log.skipped ? log.value : 0
    const fill = Math.round(Math.min(1, value / Math.max(1, habit.target)) * 100)
    return (
      <div className="flex shrink-0 items-center">
        <IconButton
          label="Decrease"
          size="icon-sm"
          disabled={!value}
          onClick={(e) => {
            e.stopPropagation()
            setCount(habit, date, value - 1)
          }}
        >
          <Minus />
        </IconButton>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            checkIn(habit, date)
          }}
          className={cn(
            'state-layer tabular flex items-center justify-center rounded-full border-2 transition-colors duration-200 ease-standard',
            big ? 'h-10 min-w-14 px-2.5 text-label-large' : 'h-8 min-w-12 px-2 text-label-medium',
          )}
          style={{
            borderColor: habit.color,
            background: done
              ? habit.color
              : `linear-gradient(to right, ${habitTint(habit.color, 28)} ${fill}%, transparent ${fill}%)`,
            color: done ? '#fff' : 'var(--md-on-surface)',
          }}
          aria-label={`Add one to ${habit.name}`}
        >
          {value}/{habit.target}
        </button>
        <IconButton
          label="Increase"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation()
            checkIn(habit, date)
          }}
        >
          <Plus />
        </IconButton>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        checkIn(habit, date)
      }}
      aria-pressed={done}
      aria-label={done ? `Undo ${habit.name}` : `Check in ${habit.name}`}
      className={cn(
        'state-layer group flex shrink-0 items-center justify-center rounded-full border-2 transition-[background-color,transform] duration-200 ease-standard active:scale-90',
        big ? 'size-11 [&_svg]:size-6' : 'size-10 [&_svg]:size-5',
      )}
      style={{ borderColor: habit.color, background: done ? habit.color : undefined, color: done ? '#fff' : habit.color }}
    >
      <Check className={cn('transition-opacity duration-200', done ? 'opacity-100' : 'opacity-0 group-hover:opacity-50')} />
    </button>
  )
}
