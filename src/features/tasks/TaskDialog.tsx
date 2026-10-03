import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox, DayPicker, Field, Input, Select, Switch, Textarea } from '@/components/ui/form'
import type { Priority, RecurrenceKind, Task } from '@/lib/types'
import { save } from '@/lib/repo'
import { cn, uid, ymd } from '@/lib/utils'
import { useSettings } from '@/lib/hooks'
import { deleteTask, newTask, PRIORITY_COLORS } from './actions'

const REMINDERS = [
  { v: '', l: 'No reminder' },
  { v: '0', l: 'At time of task' },
  { v: '5', l: '5 min before' },
  { v: '10', l: '10 min before' },
  { v: '15', l: '15 min before' },
  { v: '30', l: '30 min before' },
  { v: '60', l: '1 hour before' },
  { v: '1440', l: '1 day before' },
]

export function TaskDialog({
  task,
  open,
  onClose,
  defaults,
}: {
  task: Task | null
  open: boolean
  onClose: () => void
  defaults?: Partial<Task>
}) {
  const settings = useSettings()
  const [draft, setDraft] = useState<Partial<Task>>(() => task ?? newTask(defaults))
  const [tagText, setTagText] = useState('')
  const [subText, setSubText] = useState('')

  useEffect(() => {
    if (open) {
      const d = task ?? newTask(defaults)
      setDraft(d)
      setTagText((d.tags ?? []).join(', '))
      setSubText('')
    }
  }, [open, task?.id])

  const set = (p: Partial<Task>) => setDraft((d) => ({ ...d, ...p }))
  const rec = draft.recurrence ?? { kind: 'none' as RecurrenceKind }

  const submit = async () => {
    if (!draft.title?.trim()) return
    const tags = tagText
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim().toLowerCase())
      .filter(Boolean)
    const subtasks = [...(draft.subtasks ?? [])]
    if (subText.trim()) subtasks.push({ id: uid(), title: subText.trim(), done: false })
    await save('tasks', { ...draft, title: draft.title.trim(), tags, subtasks })
    onClose()
  }

  const addSub = () => {
    if (!subText.trim()) return
    set({ subtasks: [...(draft.subtasks ?? []), { id: uid(), title: subText.trim(), done: false }] })
    setSubText('')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      footer={
        <>
          {task && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={async () => {
                await deleteTask(task)
                onClose()
              }}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!draft.title?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Title">
          <Input autoFocus value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="What needs doing?" />
        </Field>
        <Field label="Notes">
          <Textarea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <Input type="date" value={draft.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
          </Field>
          <Field label="Time">
            <Input type="time" value={draft.dueTime ?? ''} onChange={(e) => set({ dueTime: e.target.value || null })} />
          </Field>
        </div>
        <Field label="Priority">
          <div className="flex gap-2">
            {([1, 2, 3, 4] as Priority[]).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => set({ priority: p })}
                className={cn(
                  'h-9 flex-1 rounded-md border text-sm font-semibold transition-colors',
                  draft.priority === p ? 'border-transparent text-white' : 'hover:bg-muted',
                )}
                style={draft.priority === p ? { background: PRIORITY_COLORS[p] } : { color: PRIORITY_COLORS[p] }}
              >
                P{p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tags (comma separated)">
          <Input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="work, health" />
        </Field>
        <Field label="Subtasks">
          <div className="grid gap-1.5">
            {(draft.subtasks ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <Checkbox
                  checked={s.done}
                  onChange={(v) => set({ subtasks: draft.subtasks!.map((x) => (x.id === s.id ? { ...x, done: v } : x)) })}
                />
                <Input
                  className="h-8"
                  value={s.title}
                  onChange={(e) =>
                    set({ subtasks: draft.subtasks!.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })
                  }
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => set({ subtasks: draft.subtasks!.filter((x) => x.id !== s.id) })}
                  aria-label="Remove subtask"
                >
                  <X />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                className="h-8"
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSub()
                  }
                }}
                placeholder="Add a step"
              />
              <Button size="sm" variant="outline" onClick={addSub}>
                <Plus />
              </Button>
            </div>
          </div>
        </Field>
        <Field label="Repeat">
          <Select
            value={rec.kind}
            onChange={(e) => {
              const kind = e.target.value as RecurrenceKind
              set({
                recurrence: {
                  kind,
                  days: kind === 'weekly' || kind === 'custom' ? rec.days ?? [] : undefined,
                  interval: kind === 'custom' ? rec.interval ?? 2 : undefined,
                },
                dueDate: kind !== 'none' && !draft.dueDate ? ymd() : draft.dueDate,
              })
            }}
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays (Mon–Fri)</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </Select>
        </Field>
        {(rec.kind === 'weekly' || rec.kind === 'custom') && (
          <div className="grid gap-2">
            <DayPicker value={rec.days ?? []} onChange={(days) => set({ recurrence: { ...rec, days } })} weekStart={settings.weekStart} />
            {rec.kind === 'custom' && !(rec.days ?? []).length && (
              <div className="flex items-center gap-2 text-sm">
                Every
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-20"
                  value={rec.interval ?? 1}
                  onChange={(e) => set({ recurrence: { ...rec, interval: Math.max(1, Number(e.target.value) || 1) } })}
                />
                days
              </div>
            )}
          </div>
        )}
        <Field label="Reminder">
          <Select
            value={draft.reminderMinutesBefore == null ? '' : String(draft.reminderMinutesBefore)}
            onChange={(e) => set({ reminderMinutesBefore: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={!draft.dueTime}
          >
            {REMINDERS.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </Select>
          {!draft.dueTime && <span className="text-xs text-muted-foreground">Set a time to get a reminder.</span>}
        </Field>
        <label className="flex items-center justify-between text-sm">
          Must do today (pinned)
          <Switch checked={Boolean(draft.pinned)} onChange={(pinned) => set({ pinned })} />
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}
