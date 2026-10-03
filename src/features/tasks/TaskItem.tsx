import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { Bell, GripVertical, ListChecks, Mail, Repeat, Star } from '@/components/icons'
import type { Task } from '@/lib/types'
import { cn, formatTime, parseYmd } from '@/lib/utils'
import { Checkbox } from '@/components/ui/form'
import { Badge } from '@/components/ui/misc'
import { describeRecurrence } from '@/lib/recurrence'
import { isOverdue, PRIORITY_COLORS, toggleTask } from './actions'
import { useSettings } from '@/lib/hooks'

export function dueLabel(date: string) {
  const d = parseYmd(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE d MMM')
}

export function TaskItem({
  task,
  onOpen,
  onPin,
  dragHandle,
  compact = false,
}: {
  task: Task
  onOpen: (t: Task) => void
  onPin?: (t: Task) => void
  dragHandle?: React.ReactNode
  compact?: boolean
}) {
  const settings = useSettings()
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const subDone = task.subtasks.filter((s) => s.done).length
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40',
        done && 'opacity-60',
      )}
    >
      {dragHandle}
      <Checkbox
        checked={done}
        onChange={() => toggleTask(task)}
        color={PRIORITY_COLORS[task.priority]}
        className="mt-0.5"
        label={done ? 'Mark as not done' : 'Mark as done'}
      />
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
        <div className={cn('text-sm font-medium break-words', done && 'line-through')}>{task.title}</div>
        {!compact && task.notes && <div className="line-clamp-1 text-xs text-muted-foreground">{task.notes}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.dueDate && (
            <Badge variant={overdue ? 'destructive' : task.dueDate && isToday(parseYmd(task.dueDate)) ? 'primary' : 'default'}>
              {overdue ? 'Overdue · ' : ''}
              {dueLabel(task.dueDate)}
              {task.dueTime && ` · ${formatTime(task.dueTime, settings.timeFormat)}`}
            </Badge>
          )}
          {task.priority < 4 && (
            <Badge style={{ color: PRIORITY_COLORS[task.priority] }} variant="outline">
              P{task.priority}
            </Badge>
          )}
          {task.recurrence.kind !== 'none' && (
            <Badge>
              <Repeat className="h-3 w-3" /> {describeRecurrence(task.recurrence)}
            </Badge>
          )}
          {task.subtasks.length > 0 && (
            <Badge>
              <ListChecks className="h-3 w-3" /> {subDone}/{task.subtasks.length}
            </Badge>
          )}
          {task.reminderMinutesBefore != null && task.dueTime && (
            <Badge>
              <Bell className="h-3 w-3" />
              {task.reminderMinutesBefore}m
            </Badge>
          )}
          {task.source?.kind === 'gmail' && (
            <Badge>
              <Mail className="h-3 w-3" /> Email
            </Badge>
          )}
          {task.tags.map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
        </div>
      </button>
      {onPin && !done && (
        <button
          onClick={() => onPin(task)}
          className={cn(
            'rounded-md p-1 transition-opacity',
            task.pinned ? 'text-amber-500' : 'text-muted-foreground opacity-40 hover:opacity-100',
          )}
          aria-label={task.pinned ? 'Unpin from must do' : 'Pin as must do'}
          title={task.pinned ? 'Must do (tap to unpin)' : 'Pin as must do'}
        >
          <Star className={cn('h-4 w-4', task.pinned && 'fill-current')} />
        </button>
      )}
    </div>
  )
}

export function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="mt-0.5 -ml-1 cursor-grab touch-none text-muted-foreground opacity-50 hover:opacity-100 active:cursor-grabbing"
      aria-label="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}
