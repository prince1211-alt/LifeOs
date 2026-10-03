import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { CheckCircle, CheckSquare, DoneAll, Event, Plus, Search, X } from '@/components/icons'
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
import { useNewParam, useTable, useToday } from '@/lib/hooks'
import type { Task } from '@/lib/types'
import { save } from '@/lib/repo'
import { parseYmd, cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/button'
import { Chip, Tabs } from '@/components/ui/form'
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/misc'
import { QuickAdd } from './QuickAdd'
import { DragHandle, TaskItem } from './TaskItem'
import { TaskDialog } from './TaskDialog'
import { moveToQuadrant, quadrantOf, setPinned, sortTasks, type Quadrant } from './actions'

type View = 'today' | 'upcoming' | 'all' | 'completed' | 'matrix'

/** Google Tasks list: rows separated by 2px gaps, outer corners rounded. Children clip themselves so drags are never cut off. */
const LIST = 'grid gap-0.5 [&>*]:overflow-hidden [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg'

function SortableTask({ task, onOpen, onPin }: { task: Task; onOpen: (t: Task) => void; onPin: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 rounded-md shadow-elevation-3')}
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
        <div className={LIST}>
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} onOpen={onOpen} onPin={onPin} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/** Tonal quadrants; the role colour is only an accent bar and heading so no quadrant reads as an error state. */
const QUADRANTS: { id: Quadrant; title: string; hint: string; accent: string; text: string }[] = [
  { id: 'do', title: 'Do first', hint: 'Urgent & important', accent: 'bg-error', text: 'text-error' },
  { id: 'schedule', title: 'Schedule', hint: 'Important, not urgent', accent: 'bg-primary', text: 'text-primary' },
  { id: 'delegate', title: 'Delegate', hint: 'Urgent, not important', accent: 'bg-tertiary', text: 'text-tertiary' },
  { id: 'eliminate', title: 'Eliminate', hint: 'Neither', accent: 'bg-outline', text: 'text-on-surface-variant' },
]

function DraggableTask({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && 'relative z-20 overflow-hidden rounded-md shadow-elevation-3')}
    >
      <TaskItem task={task} onOpen={onOpen} compact dragHandle={<DragHandle {...attributes} {...listeners} />} />
    </div>
  )
}

function QuadrantBox({ q, tasks, onOpen }: { q: (typeof QUADRANTS)[number]; tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: q.id })
  return (
    <section
      ref={setNodeRef}
      aria-label={q.title}
      className={cn(
        'relative flex min-h-44 flex-col gap-2 rounded-lg py-3 transition-[background-color,box-shadow] duration-200',
        isOver ? 'bg-surface-container-high ring-2 ring-primary' : 'bg-surface-container-low',
      )}
    >
      <span aria-hidden className={cn('absolute top-3 bottom-3 left-0 z-[1] w-1 rounded-r-full', q.accent)} />
      <header className="flex items-baseline gap-2 px-4 pt-1">
        <h3 className={cn('text-title-small', q.text)}>{q.title}</h3>
        {tasks.length > 0 && <span className="tabular text-label-medium text-on-surface-variant">{tasks.length}</span>}
        <span className="ml-auto text-body-small text-on-surface-variant">{q.hint}</span>
      </header>
      {tasks.length ? (
        <div className="divide-y divide-outline-variant">
          {tasks.map((t) => (
            <DraggableTask key={t.id} task={t} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center pb-4 text-body-small text-on-surface-variant">Drop tasks here</p>
      )}
    </section>
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
      <p className="mb-3 px-1 text-body-small text-on-surface-variant">
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

/** Small Google-style search field: tonal pill, leading search icon, clear button. */
function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-64 sm:shrink-0">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-on-surface-variant" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tasks"
        aria-label="Search tasks"
        enterKeyHint="search"
        className="h-10 w-full rounded-full bg-surface-container-high pr-11 pl-11 text-body-medium text-on-surface outline-none transition-[background-color,box-shadow] duration-200 ease-standard placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:shadow-elevation-1 focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <span className="absolute inset-y-0 right-1 flex items-center">
          <IconButton label="Clear search" size="icon-sm" onClick={() => onChange('')}>
            <X />
          </IconButton>
        </span>
      )}
    </div>
  )
}

function TabLabel({ text, count, active }: { text: string; count?: number; active: boolean }) {
  return (
    <>
      {text}
      {Boolean(count) && (
        <span
          className={
            active
              ? 'tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-label-small text-on-primary'
              : 'tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-highest px-1.5 text-label-small text-on-surface-variant'
          }
        >
          {count}
        </span>
      )}
    </>
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
  useNewParam(() => setCreating(true))

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
  const overdueCount = open.filter((t) => t.dueDate && t.dueDate < today).length

  const groups = new Map<string, Task[]>()
  for (const t of upcoming) groups.set(t.dueDate!, [...(groups.get(t.dueDate!) ?? []), t])
  const tomorrow = format(addDays(parseYmd(today), 1), 'yyyy-MM-dd')

  const tab = (value: View, text: string, count?: number) => ({
    value,
    label: <TabLabel text={text} count={count} active={view === value} />,
  })

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={
          <>
            {open.length} open · <span className={overdueCount ? 'text-error' : undefined}>{overdueCount} overdue</span>
          </>
        }
        fab={{ icon: <Plus />, label: 'New task', onClick: () => setCreating(true) }}
      />
      <QuickAdd defaultDate={view === 'today' ? today : undefined} />

      <Tabs
        value={view}
        onChange={setView}
        className="-mx-4 mt-4 scroll-px-4 px-4 md:mx-0 md:px-0"
        options={[
          tab('today', 'Today', todayList.length),
          tab('upcoming', 'Upcoming', upcoming.length),
          tab('all', 'All', allList.length),
          tab('completed', 'Completed'),
          tab('matrix', 'Matrix'),
        ]}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={search} onChange={setSearch} />
        {allTags.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:min-w-0 sm:flex-1 sm:flex-wrap sm:overflow-visible sm:px-0">
            {allTags.map((t) => (
              <Chip key={t} selected={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? '' : t)}>
                #{t}
              </Chip>
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
            <div className="grid gap-4">
              {[...groups].map(([date, list]) => (
                <section key={date}>
                  <SectionTitle>
                    {date === tomorrow ? 'Tomorrow · ' : ''}
                    {format(parseYmd(date), 'EEEE d MMM')}
                  </SectionTitle>
                  <div className={LIST}>
                    {sortTasks(list).map((t) => (
                      <TaskItem key={t.id} task={t} onOpen={onOpen} onPin={onPin} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Event />} title="No upcoming tasks" text="Tasks with a future due date show here." />
          )
        ) : view === 'all' ? (
          allList.length ? (
            <SortableList tasks={allList} onOpen={onOpen} onPin={onPin} />
          ) : (
            <EmptyState icon={<DoneAll />} title="No open tasks" text="You're all clear." />
          )
        ) : view === 'completed' ? (
          completed.length ? (
            <div className={LIST}>
              {completed.slice(0, 200).map((t) => (
                <TaskItem key={t.id} task={t} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle />} title="Nothing completed yet" text="Finished tasks are kept here." />
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
