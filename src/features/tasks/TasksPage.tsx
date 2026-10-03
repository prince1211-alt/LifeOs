import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { CheckSquare, Grid2x2, List, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDndSensors } from '@/components/dnd'
import { CSS } from '@dnd-kit/utilities'
import { useTable, useToday } from '@/lib/hooks'
import type { Task } from '@/lib/types'
import { save } from '@/lib/repo'
import { parseYmd, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Segmented, Input } from '@/components/ui/form'
import { EmptyState, PageHeader, Badge } from '@/components/ui/misc'
import { QuickAdd } from './QuickAdd'
import { DragHandle, TaskItem } from './TaskItem'
import { TaskDialog } from './TaskDialog'
import { moveToQuadrant, quadrantOf, setPinned, sortTasks, type Quadrant } from './actions'

type View = 'today' | 'upcoming' | 'all' | 'completed' | 'matrix'

function SortableTask({ task, onOpen, onPin }: { task: Task; onOpen: (t: Task) => void; onPin: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 opacity-80 shadow-lg')}
    >
      <TaskItem task={task} onOpen={onOpen} onPin={onPin} dragHandle={<DragHandle {...attributes} {...listeners} />} />
    </div>
  )
}

function SortableList({ tasks, onOpen, onPin }: { tasks: Task[]; onOpen: (t: Task) => void; onPin: (t: Task) => void }) {
  const sensors = useDndSensors()
  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = tasks.findIndex((t) => t.id === e.active.id)
    const to = tasks.findIndex((t) => t.id === e.over!.id)
    const next = arrayMove(tasks, from, to)
    // Pinned tasks always sort first, so a drag across that boundary toggles the pin.
    const moved = next[to]
    const neighbour = next[to + 1] ?? next[to - 1]
    const pinned = neighbour ? Boolean(neighbour.pinned) : Boolean(moved.pinned)
    await Promise.all(
      next.map((t, i) =>
        t.id === moved.id
          ? save('tasks', { id: t.id, order: i, pinned })
          : t.order !== i
            ? save('tasks', { id: t.id, order: i })
            : null,
      ),
    )
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2">
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} onOpen={onOpen} onPin={onPin} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

const QUADRANTS: { id: Quadrant; title: string; hint: string; cls: string }[] = [
  { id: 'do', title: 'Do first', hint: 'Urgent & important', cls: 'border-red-500/40 bg-red-500/5' },
  { id: 'schedule', title: 'Schedule', hint: 'Important, not urgent', cls: 'border-blue-500/40 bg-blue-500/5' },
  { id: 'delegate', title: 'Delegate', hint: 'Urgent, not important', cls: 'border-amber-500/40 bg-amber-500/5' },
  { id: 'eliminate', title: 'Eliminate', hint: 'Neither', cls: 'border-slate-500/40 bg-slate-500/5' },
]

function DraggableTask({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && 'relative z-20 opacity-80 shadow-lg')}
    >
      <TaskItem task={task} onOpen={onOpen} compact dragHandle={<DragHandle {...attributes} {...listeners} />} />
    </div>
  )
}

function QuadrantBox({ q, tasks, onOpen }: { q: (typeof QUADRANTS)[number]; tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: q.id })
  return (
    <div ref={setNodeRef} className={cn('min-h-40 rounded-xl border-2 p-3 transition-colors', q.cls, isOver && 'ring-2 ring-primary')}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-semibold">{q.title}</h3>
        <span className="text-xs text-muted-foreground">{q.hint}</span>
      </div>
      <div className="grid gap-2">
        {tasks.map((t) => (
          <DraggableTask key={t.id} task={t} onOpen={onOpen} />
        ))}
        {!tasks.length && <p className="py-4 text-center text-xs text-muted-foreground">Drop tasks here</p>}
      </div>
    </div>
  )
}

function Matrix({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const sensors = useDndSensors()
  const by = (q: Quadrant) => sortTasks(tasks.filter((t) => quadrantOf(t) === q))
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={(e) => {
        const t = tasks.find((x) => x.id === e.active.id)
        if (t && e.over && quadrantOf(t) !== e.over.id) moveToQuadrant(t, e.over.id as Quadrant)
      }}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Urgent = due by tomorrow. Important = P1 or P2. Drag a task to change its priority or date.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {QUADRANTS.map((q) => (
          <QuadrantBox key={q.id} q={q} tasks={by(q.id)} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  )
}

export function TasksPage() {
  const tasks = useTable('tasks')
  const today = useToday()
  const [view, setView] = useState<View>('today')
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')

  const open = useMemo(() => (tasks ?? []).filter((t) => t.status === 'open'), [tasks])
  const allTags = useMemo(() => [...new Set((tasks ?? []).flatMap((t) => t.tags))].sort(), [tasks])

  const filtered = (list: Task[]) =>
    list.filter(
      (t) =>
        (!tagFilter || t.tags.includes(tagFilter)) &&
        (!search || `${t.title} ${t.notes}`.toLowerCase().includes(search.toLowerCase())),
    )

  const onPin = (t: Task) => setPinned(t, !t.pinned, open)
  const onOpen = (t: Task) => setEditing(t)

  // Overdue tasks carry over into Today automatically.
  const todayList = sortTasks(filtered(open.filter((t) => t.dueDate && t.dueDate <= today)))
  const upcoming = filtered(open.filter((t) => t.dueDate && t.dueDate > today)).sort(
    (a, b) => a.dueDate!.localeCompare(b.dueDate!) || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99'),
  )
  const allList = sortTasks(filtered(open))
  const completed = filtered((tasks ?? []).filter((t) => t.status === 'done')).sort(
    (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0),
  )

  const groups = new Map<string, Task[]>()
  for (const t of upcoming) groups.set(t.dueDate!, [...(groups.get(t.dueDate!) ?? []), t])

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${open.length} open · ${open.filter((t) => t.dueDate && t.dueDate < today).length} overdue`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New task
          </Button>
        }
      />
      <QuickAdd defaultDate={view === 'today' ? today : undefined} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          className="overflow-x-auto"
          options={[
            { value: 'today', label: `Today${todayList.length ? ` (${todayList.length})` : ''}` },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'all', label: <span className="flex items-center gap-1"><List className="h-3.5 w-3.5" />All</span> },
            { value: 'completed', label: 'Completed' },
            { value: 'matrix', label: <span className="flex items-center gap-1"><Grid2x2 className="h-3.5 w-3.5" />Matrix</span> },
          ]}
        />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-9 w-40" />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((t) => (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? '' : t)}>
                <Badge variant={tagFilter === t ? 'primary' : 'outline'}>#{t}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        {tasks === undefined ? null : view === 'today' ? (
          todayList.length ? (
            <SortableList tasks={todayList} onOpen={onOpen} onPin={onPin} />
          ) : (
            <EmptyState icon={<CheckSquare />} title="Nothing due today" text="Add a task above or check Upcoming." />
          )
        ) : view === 'upcoming' ? (
          groups.size ? (
            <div className="grid gap-5">
              {[...groups].map(([date, list]) => (
                <section key={date}>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                    {date === format(addDays(parseYmd(today), 1), 'yyyy-MM-dd') ? 'Tomorrow · ' : ''}
                    {format(parseYmd(date), 'EEEE d MMM')}
                  </h3>
                  <div className="grid gap-2">
                    {sortTasks(list).map((t) => (
                      <TaskItem key={t.id} task={t} onOpen={onOpen} onPin={onPin} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckSquare />} title="No upcoming tasks" text="Tasks with a future due date show here." />
          )
        ) : view === 'all' ? (
          allList.length ? (
            <SortableList tasks={allList} onOpen={onOpen} onPin={onPin} />
          ) : (
            <EmptyState icon={<CheckSquare />} title="No open tasks" text="You're all clear." />
          )
        ) : view === 'completed' ? (
          completed.length ? (
            <div className="grid gap-2">
              {completed.slice(0, 200).map((t) => (
                <TaskItem key={t.id} task={t} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckSquare />} title="Nothing completed yet" text="Finished tasks are kept here." />
          )
        ) : (
          <Matrix tasks={filtered(open)} onOpen={onOpen} />
        )}
      </div>

      <TaskDialog open={Boolean(editing)} task={editing} onClose={() => setEditing(null)} />
      <TaskDialog
        open={creating}
        task={null}
        onClose={() => setCreating(false)}
        defaults={{ dueDate: view === 'today' ? today : null }}
      />
    </div>
  )
}
