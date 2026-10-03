import { useMemo, useState } from 'react'
import { CalendarDays, Clock, Flag, Plus, Repeat, Sparkles, Tag } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/misc'
import { parseQuickAdd } from '@/lib/nlp'
import { describeRecurrence } from '@/lib/recurrence'
import { formatTime } from '@/lib/utils'
import { useSettings } from '@/lib/hooks'
import { createTask, PRIORITY_COLORS } from './actions'
import { dueLabel } from './TaskItem'
import { toast } from '@/store/app'

/** Quick-add bar with natural-language parsing ("gym tomorrow 6pm p1 #health"), styled like Google's search bar. */
export function QuickAdd({ defaultDate, placeholder }: { defaultDate?: string; placeholder?: string }) {
  const [text, setText] = useState('')
  const settings = useSettings()
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text])
  const hasSmart =
    parsed &&
    (parsed.dueDate || parsed.dueTime || parsed.priority < 4 || parsed.tags.length || parsed.recurrence.kind !== 'none')

  const submit = async () => {
    if (!parsed?.title) return
    setText('')
    await createTask({
      title: parsed.title,
      dueDate: parsed.dueDate ?? defaultDate ?? null,
      dueTime: parsed.dueTime,
      priority: parsed.priority,
      tags: parsed.tags,
      recurrence: parsed.recurrence,
    })
    toast(`Added “${parsed.title}”`)
  }

  return (
    <div>
      <form
        className="group flex h-14 items-center gap-3 rounded-xl bg-surface-container-high pr-2 pl-4 transition-[background-color,box-shadow] duration-200 ease-standard focus-within:bg-surface-container-highest focus-within:shadow-elevation-1"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Plus className="text-on-surface-variant transition-colors group-focus-within:text-primary" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? 'Add a task — try “gym tomorrow 6pm p1 #health”'}
          className="h-full min-w-0 flex-1 truncate bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant focus-visible:outline-none"
          aria-label="Quick add task"
          enterKeyHint="done"
        />
        {text.trim() && (
          <Button type="submit" className="animate-md-fade" disabled={!parsed?.title}>
            Add
          </Button>
        )}
      </form>
      {hasSmart && parsed && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2" aria-live="polite">
          <Sparkles className="size-4 text-primary" />
          <span className="mr-0.5 max-w-full truncate text-label-large text-on-surface">{parsed.title}</span>
          {parsed.dueDate && (
            <Badge variant="primary">
              <CalendarDays />
              {dueLabel(parsed.dueDate)}
            </Badge>
          )}
          {parsed.dueTime && (
            <Badge variant="primary">
              <Clock />
              {formatTime(parsed.dueTime, settings.timeFormat)}
            </Badge>
          )}
          {parsed.priority < 4 && (
            <Badge variant="outline" style={{ color: PRIORITY_COLORS[parsed.priority] }}>
              <Flag filled />P{parsed.priority}
            </Badge>
          )}
          {parsed.recurrence.kind !== 'none' && (
            <Badge variant="secondary">
              <Repeat />
              {describeRecurrence(parsed.recurrence)}
            </Badge>
          )}
          {parsed.tags.map((t) => (
            <Badge key={t} variant="outline">
              <Tag />
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
