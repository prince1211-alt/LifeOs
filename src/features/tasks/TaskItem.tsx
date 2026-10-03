import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { Bell, Flag, GripVertical, ListChecks, Mail, Repeat, Star } from '@/components/icons'
import type { Task } from '@/lib/types'
import { cn, formatTime, parseYmd } from '@/lib/utils'
import { IconButton } from '@/components/ui/button'
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

/** Google Tasks style row: round check, title, metadata chips, star. Sits inside a tonal list container. */
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
  const flagged = task.priority < 4
  const reminder = task.reminderMinutesBefore != null && Boolean(task.dueTime)
  const hasMeta =
    Boolean(task.dueDate) ||
    flagged ||
    task.recurrence.kind !== 'none' ||
    task.subtasks.length > 0 ||
    reminder ||
    task.source?.kind === 'gmail' ||
    task.tags.length > 0

  return (
    <div
      className={cn(
        'state-layer group flex items-start gap-3 bg-surface-container-low pr-4 text-on-surface',
        dragHandle ? 'pl-1' : 'pl-4',
        compact ? 'py-2.5' : 'py-3',
      )}
    >
      {dragHandle}
      <Checkbox
        checked={done}
        onChange={() => toggleTask(task)}
        color={flagged ? PRIORITY_COLORS[task.priority] : undefined}
        label={done ? 'Mark as not done' : 'Mark as done'}
      />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
        <span
          className={
            done
              ? 'block text-body-large break-words text-on-surface-variant line-through'
              : 'block text-body-large break-words text-on-surface'
          }
        >
          {task.title}
        </span>
        {!compact && task.notes && <span className="line-clamp-1 text-body-medium text-on-surface-variant">{task.notes}</span>}
        {hasMeta && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {task.dueDate && (
              <Badge variant={overdue ? 'destructive' : !done && isToday(parseYmd(task.dueDate)) ? 'primary' : 'outline'}>
                {overdue ? 'Overdue · ' : ''}
                {dueLabel(task.dueDate)}
                {task.dueTime && ` · ${formatTime(task.dueTime, settings.timeFormat)}`}
              </Badge>
            )}
            {flagged && (
              <Badge variant="outline" style={{ color: PRIORITY_COLORS[task.priority] }}>
                <Flag filled />P{task.priority}
              </Badge>
            )}
            {task.recurrence.kind !== 'none' && (
              <Badge>
                <Repeat /> {describeRecurrence(task.recurrence)}
              </Badge>
            )}
            {task.subtasks.length > 0 && (
              <Badge>
                <ListChecks /> {subDone}/{task.subtasks.length}
              </Badge>
            )}
            {reminder && (
              <Badge>
                <Bell />
                {task.reminderMinutesBefore}m
              </Badge>
            )}
            {task.source?.kind === 'gmail' && (
              <Badge>
                <Mail /> Email
              </Badge>
            )}
            {task.tags.map((t) => (
              <Badge key={t} variant="outline">
                #{t}
              </Badge>
            ))}
          </span>
        )}
      </button>
      {onPin && !done && (
        <IconButton
          label={task.pinned ? 'Unpin from must do' : 'Pin as must do'}
          onClick={() => onPin(task)}
          className={cn(
            '-my-2 -mr-2',
            task.pinned
              ? 'text-primary'
              : 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100',
          )}
        >
          <Star filled={Boolean(task.pinned)} />
        </IconButton>
      )}
    </div>
  )
}

/** Drag handle for sortable rows: always visible on touch, revealed on hover with a mouse. */
export function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="-my-2 flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-on-surface-variant transition-opacity active:cursor-grabbing pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
      aria-label="Drag to reorder"
    >
      <GripVertical size={20} />
    </button>
  )
}
