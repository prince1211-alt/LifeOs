import { useMemo, useState } from 'react'
import { CalendarDays, Clock, Flag, Plus, Repeat, Sparkles, Tag } from '@/components/icons'
import { Input } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/misc'
import { parseQuickAdd } from '@/lib/nlp'
import { describeRecurrence } from '@/lib/recurrence'
import { formatTime } from '@/lib/utils'
import { useSettings } from '@/lib/hooks'
import { createTask, PRIORITY_COLORS } from './actions'
import { dueLabel } from './TaskItem'
import { toast } from '@/store/app'

/** Quick-add bar with natural-language parsing ("gym tomorrow 6pm p1 #health"). */
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
    <div className="rounded-xl border bg-card p-2 shadow-sm">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Plus className="ml-1 h-5 w-5 shrink-0 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? 'Add a task — try “gym tomorrow 6pm p1 #health”'}
          className="border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          aria-label="Quick add task"
        />
        <Button type="submit" size="sm" disabled={!parsed?.title}>
          Add
        </Button>
      </form>
      {hasSmart && parsed && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pt-2 pb-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">{parsed.title}</span>
          {parsed.dueDate && (
            <Badge variant="primary">
              <CalendarDays className="h-3 w-3" />
              {dueLabel(parsed.dueDate)}
            </Badge>
          )}
          {parsed.dueTime && (
            <Badge variant="primary">
              <Clock className="h-3 w-3" />
              {formatTime(parsed.dueTime, settings.timeFormat)}
            </Badge>
          )}
          {parsed.priority < 4 && (
            <Badge variant="outline" style={{ color: PRIORITY_COLORS[parsed.priority] }}>
              <Flag className="h-3 w-3" />P{parsed.priority}
            </Badge>
          )}
          {parsed.recurrence.kind !== 'none' && (
            <Badge>
              <Repeat className="h-3 w-3" />
              {describeRecurrence(parsed.recurrence)}
            </Badge>
          )}
          {parsed.tags.map((t) => (
            <Badge key={t} variant="outline">
              <Tag className="h-3 w-3" />
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
