import { useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from '@/components/icons'
import { Dialog } from '@/components/ui/dialog'
import { Button, IconButton } from '@/components/ui/button'
import { Checkbox, DayPicker, Field, Input, Segmented, Select, Switch, Textarea } from '@/components/ui/form'
import type { Priority, RecurrenceKind, Task } from '@/lib/types'
import { save } from '@/lib/repo'
import { uid, ymd } from '@/lib/utils'
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

const PRIORITY_OPTIONS = ([1, 2, 3, 4] as Priority[]).map((p) => ({
  value: String(p),
  label: (
    <>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />P{p}
    </>
  ),
}))

/** Borderless text input for checklist rows; the underline appears on focus. */
const STEP_INPUT =
  'h-10 min-w-0 flex-1 border-b border-transparent bg-transparent text-body-large outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary focus-visible:outline-none'

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
              className="mr-auto -ml-3 text-error"
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
          <Button variant="ghost" onClick={submit} disabled={!draft.title?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="grid gap-5 pt-2"
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
        <Field label="Priority" plain>
          <Segmented
            value={String(draft.priority ?? 4)}
            onChange={(v) => set({ priority: Number(v) as Priority })}
            options={PRIORITY_OPTIONS}
            className="w-full"
          />
        </Field>
        <Field label="Tags" supporting="Separate with commas">
          <Input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="work, health" />
        </Field>
        <Field label="Subtasks" plain>
          <div className="grid">
            {(draft.subtasks ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-4 pl-2">
                <Checkbox
                  checked={s.done}
                  label={s.title || 'Step'}
                  onChange={(v) => set({ subtasks: draft.subtasks!.map((x) => (x.id === s.id ? { ...x, done: v } : x)) })}
                />
                <input
                  aria-label="Step"
                  className={
                    s.done ? `${STEP_INPUT} text-on-surface-variant line-through` : `${STEP_INPUT} text-on-surface`
                  }
                  value={s.title}
                  onChange={(e) =>
                    set({ subtasks: draft.subtasks!.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })
                  }
                />
                <IconButton
                  label="Remove subtask"
                  onClick={() => set({ subtasks: draft.subtasks!.filter((x) => x.id !== s.id) })}
                >
                  <X />
                </IconButton>
              </div>
            ))}
            <div className="flex items-center gap-4 pl-2">
              <Plus className="text-primary" />
              <input
                aria-label="Add a step"
                className={`${STEP_INPUT} text-on-surface`}
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
              <IconButton label="Add step" onClick={addSub} disabled={!subText.trim()}>
                <Check />
              </IconButton>
            </div>
          </div>
        </Field>
        <div className="grid gap-3">
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
            <DayPicker value={rec.days ?? []} onChange={(days) => set({ recurrence: { ...rec, days } })} weekStart={settings.weekStart} />
          )}
          {rec.kind === 'custom' && !(rec.days ?? []).length && (
            <div className="flex items-center gap-3 text-body-large text-on-surface">
              Every
              <Input
                type="number"
                min={1}
                aria-label="Repeat every N days"
                className="h-10 w-20 text-center"
                value={rec.interval ?? 1}
                onChange={(e) => set({ recurrence: { ...rec, interval: Math.max(1, Number(e.target.value) || 1) } })}
              />
              days
            </div>
          )}
        </div>
        <Field label="Reminder" supporting={draft.dueTime ? undefined : 'Set a time to get a reminder.'}>
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
        </Field>
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-body-large text-on-surface">Must do today (pinned)</span>
            <span className="block text-body-medium text-on-surface-variant">Pinned tasks stay at the top of your lists</span>
          </span>
          <Switch label="Must do today (pinned)" checked={Boolean(draft.pinned)} onChange={(pinned) => set({ pinned })} />
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}
