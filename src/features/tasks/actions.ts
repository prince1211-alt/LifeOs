import { addDays } from 'date-fns'
import { save, remove } from '@/lib/repo'
import { nextOccurrence } from '@/lib/recurrence'
import type { Task } from '@/lib/types'
import { toast } from '@/store/app'
import { ymd } from '@/lib/utils'

export function newTask(p: Partial<Task> = {}): Partial<Task> {
  return {
    title: '',
    notes: '',
    dueDate: null,
    dueTime: null,
    priority: 4,
    tags: [],
    subtasks: [],
    recurrence: { kind: 'none' },
    status: 'open',
    completedAt: null,
    reminderMinutesBefore: null,
    pinned: false,
    order: Date.now(),
    ...p,
  }
}

export async function createTask(p: Partial<Task>) {
  return save('tasks', newTask(p))
}

/**
 * Complete a task. A recurring task logs a completed copy (for history/stats)
 * and moves itself to the next occurrence with subtasks reset.
 */
export async function completeTask(t: Task, opts: { silent?: boolean } = {}) {
  const now = Date.now()
  const today = ymd()
  if (t.recurrence.kind !== 'none') {
    const from = !t.dueDate || t.dueDate < today ? today : t.dueDate
    const next = nextOccurrence(t.recurrence, from)
    const copy = await save('tasks', {
      ...t,
      id: undefined,
      createdAt: now,
      recurrence: { kind: 'none' },
      status: 'done',
      completedAt: now,
      seriesId: t.seriesId ?? t.id,
      pinned: false,
      reminderMinutesBefore: null,
    })
    await save('tasks', { id: t.id, dueDate: next, subtasks: t.subtasks.map((s) => ({ ...s, done: false })) })
    if (!opts.silent)
      toast(`Done. Next: ${next}`, {
        label: 'Undo',
        run: async () => {
          await remove('tasks', copy.id)
          await save('tasks', { id: t.id, dueDate: t.dueDate, subtasks: t.subtasks })
        },
      })
    return
  }
  await save('tasks', { id: t.id, status: 'done', completedAt: now })
  if (!opts.silent) toast(`Completed “${t.title}”`, { label: 'Undo', run: () => reopenTask(t) })
}

export async function reopenTask(t: Task) {
  await save('tasks', { id: t.id, status: 'open', completedAt: null })
}

export async function toggleTask(t: Task) {
  if (t.status === 'done') return reopenTask(t)
  return completeTask(t)
}

export async function deleteTask(t: Task) {
  await remove('tasks', t.id)
  toast(`Deleted “${t.title}”`, { label: 'Undo', run: () => save('tasks', { id: t.id, deletedAt: null }) })
}

export async function moveToToday(tasks: Task[]) {
  const today = ymd()
  for (const t of tasks) await save('tasks', { id: t.id, dueDate: today })
}

export async function setPinned(t: Task, pinned: boolean, allOpen: Task[]) {
  if (pinned && allOpen.filter((x) => x.pinned && x.id !== t.id).length >= 3) {
    toast('Only 3 “must do” tasks. Unpin one first.')
    return
  }
  await save('tasks', { id: t.id, pinned })
}

export const PRIORITY_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#3b82f6',
  4: '#94a3b8',
}

export function sortTasks(list: Task[]): Task[] {
  return [...list].sort(
    (a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      (a.order ?? 0) - (b.order ?? 0) ||
      a.priority - b.priority ||
      (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99'),
  )
}

export function isOverdue(t: Task, today = ymd()) {
  return t.status === 'open' && Boolean(t.dueDate) && t.dueDate! < today
}

/** Eisenhower: urgent = overdue, today or tomorrow; important = P1/P2. */
export function quadrantOf(t: Task, today = new Date()) {
  const urgent = Boolean(t.dueDate) && t.dueDate! <= ymd(addDays(today, 1))
  const important = t.priority <= 2
  return (important ? (urgent ? 'do' : 'schedule') : urgent ? 'delegate' : 'eliminate') as Quadrant
}

export type Quadrant = 'do' | 'schedule' | 'delegate' | 'eliminate'

export async function moveToQuadrant(t: Task, q: Quadrant) {
  const important = q === 'do' || q === 'schedule'
  const urgent = q === 'do' || q === 'delegate'
  const today = new Date()
  const wasUrgent = Boolean(t.dueDate) && t.dueDate! <= ymd(addDays(today, 1))
  await save('tasks', {
    id: t.id,
    priority: important ? (t.priority <= 2 ? t.priority : 2) : t.priority >= 3 ? t.priority : 3,
    dueDate: urgent ? (wasUrgent ? t.dueDate : ymd(today)) : wasUrgent ? ymd(addDays(today, 7)) : t.dueDate,
  })
}
