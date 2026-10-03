import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Spa,
  Square,
  Timer,
  Trash2,
} from '@/components/icons'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useMediaQuery, useNewParam, useNow, useSettings, useTable } from '@/lib/hooks'
import type { FocusSession, Task, TimeBlock } from '@/lib/types'
import { remove, save } from '@/lib/repo'
import { clock, cn, formatTime, minutesOf, parseYmd, timeFromMinutes, ymd } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Segmented, Select, Tabs } from '@/components/ui/form'
import { Badge, EmptyState, ListItem, PageHeader, Progress, ProgressRing, SectionTitle, Stat } from '@/components/ui/misc'
import { PHASE_LABEL, syncIdleLength, usePomodoro } from './pomodoro'
import { useDndSensors } from '@/components/dnd'
import { blockToEvent, upsertEvent } from '@/lib/google/calendar'
import { useApp, toast } from '@/store/app'

type Tab = 'timer' | 'planner' | 'log' | 'review'

const tooltipStyle = {
  background: 'var(--md-surface-container-high)',
  border: 'none',
  borderRadius: 8,
  color: 'var(--md-on-surface)',
  fontSize: 12,
}
const axisTick = { fontSize: 11, fill: 'var(--md-on-surface-variant)' }
const legendText = (value: string) => <span style={{ color: 'var(--md-on-surface-variant)' }}>{value}</span>

/** Category data colours (Google Calendar event palette). */
const CAT_COLORS = ['#3f51b5', '#33b679', '#f4511e', '#e67c73', '#039be5', '#f6bf26', '#8e24aa', '#d50000']
export const catColor = (cats: string[], c: string) => CAT_COLORS[Math.max(0, cats.indexOf(c)) % CAT_COLORS.length]
/** A data colour mixed into a surface, for tinted containers that stay legible in light and dark. */
const tint = (color: string, pct: number, surface = 'var(--md-surface-container-low)') => `color-mix(in srgb, ${color} ${pct}%, ${surface})`

function PomodoroTimer() {
  const p = usePomodoro()
  const settings = useSettings()
  const tasks = (useTable('tasks') ?? []).filter((t) => t.status === 'open')
  const now = useNow(250)
  const wide = useMediaQuery('(min-width: 640px)')
  const [full, setFull] = useState(false)
  const left = p.running && p.endsAt ? Math.max(0, p.endsAt - now) : p.remainingMs
  const task = tasks.find((t) => t.id === p.taskId)
  const color = p.phase === 'focus' ? 'var(--md-primary)' : 'var(--md-tertiary)'
  const longEvery = settings.pomodoro.longEvery
  const done = p.phase === 'long' ? longEvery : p.round % longEvery
  const playLabel = p.running ? 'Pause' : p.startedAt ? 'Resume' : 'Start'

  useEffect(() => {
    syncIdleLength()
  }, [settings.pomodoro.focus, settings.pomodoro.short, settings.pomodoro.long, p.phase])

  useEffect(() => {
    document.title = p.running ? `${clock(left)} · ${PHASE_LABEL[p.phase]} — LifeOS` : 'LifeOS'
  }, [p.running, left, p.phase])
  useEffect(() => () => void (document.title = 'LifeOS'), [])

  const toggleFull = async () => {
    const next = !full
    setFull(next)
    try {
      if (next) await document.documentElement.requestFullscreen?.()
      else if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      /* fullscreen not allowed; overlay still works */
    }
  }
  useEffect(() => {
    const onFs = () => !document.fullscreenElement && setFull(false)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Google Clock style: tonal side buttons around a big play/pause button that morphs from circle to squircle.
  const controls = (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center justify-end">
          <IconButton label="Reset" variant="secondary" size="icon-lg" onClick={() => p.reset()}>
            <RotateCcw />
          </IconButton>
        </div>
        <button
          type="button"
          title={playLabel}
          onClick={() => (p.running ? p.pause() : p.start())}
          className={cn(
            'state-layer flex h-24 w-24 items-center justify-center bg-primary-container text-on-primary-container shadow-elevation-1 transition-[border-radius,box-shadow] duration-300 ease-standard hover:shadow-elevation-2 [&_svg]:size-10',
            p.running ? 'rounded-xl' : 'rounded-[48px]',
          )}
        >
          {p.running ? <Pause filled /> : <Play filled />}
          <span className="sr-only">{playLabel}</span>
        </button>
        <div className="flex items-center justify-start">
          <IconButton label="Skip phase" title="Skip to next phase" variant="secondary" size="icon-lg" onClick={() => p.skip()}>
            <SkipForward />
          </IconButton>
        </div>
      </div>
      <div className="flex h-10 items-center">
        {p.startedAt && (
          <Button variant="ghost" title="Stop and log time so far" onClick={() => p.stopAndLog()}>
            <Square filled /> Stop and log
          </Button>
        )}
      </div>
    </div>
  )

  const dots = (
    <div className="flex justify-center gap-2" role="img" aria-label={`${done} of ${longEvery} focus rounds done`}>
      {Array.from({ length: longEvery }, (_, i) => (
        <span key={i} className={cn('h-2.5 w-2.5 rounded-full transition-colors', i < done ? 'bg-primary' : 'bg-outline-variant')} />
      ))}
    </div>
  )

  if (full)
    return (
      <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-8 bg-surface p-6 text-on-surface">
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
          <IconButton label="Exit focus mode" onClick={toggleFull}>
            <Minimize2 />
          </IconButton>
        </div>
        <div className="text-title-large text-on-surface-variant">{PHASE_LABEL[p.phase]}</div>
        <div className="tabular text-display-large" style={{ color, fontSize: 'clamp(72px, 22vw, 176px)', lineHeight: 1 }}>
          {clock(left)}
        </div>
        {task && <div className="max-w-xl text-center text-headline-small">{task.title}</div>}
        {dots}
        {controls}
      </div>
    )

  return (
    <div className="flex flex-col items-center gap-6">
      <Segmented
        value={p.phase}
        onChange={async (phase) => {
          if (p.running) return
          usePomodoro.setState({ phase, startedAt: null })
          await p.reset()
        }}
        options={[
          { value: 'focus', label: 'Focus' },
          { value: 'short', label: 'Short break' },
          { value: 'long', label: 'Long break' },
        ]}
      />
      <ProgressRing value={1 - left / p.phaseMs} size={wide ? 320 : 272} stroke={wide ? 12 : 10} color={color}>
        <div className="text-label-large text-on-surface-variant">{PHASE_LABEL[p.phase]}</div>
        <div className="tabular text-display-medium text-on-surface sm:text-display-large">{clock(left)}</div>
        {task && <div className="mt-1 max-w-[70%] truncate text-body-medium text-on-surface-variant">{task.title}</div>}
      </ProgressRing>
      {dots}
      {controls}
      <div className="grid w-full max-w-md gap-5 pt-2 sm:grid-cols-2">
        <Field label="Working on">
          <Select value={p.taskId ?? ''} onChange={(e) => p.setTask(e.target.value || null)}>
            <option value="">No task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={p.category} onChange={(e) => p.setCategory(e.target.value)}>
            {settings.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Button variant="ghost" onClick={toggleFull}>
        <Maximize2 /> Full-screen focus mode
      </Button>
    </div>
  )
}

function DraggableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `task:${task.id}` })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'flex h-10 max-w-full cursor-grab touch-none items-center gap-1.5 rounded-sm bg-surface-container-low pr-3 pl-1.5 text-on-surface shadow-elevation-1 active:cursor-grabbing md:w-full',
        isDragging && 'relative z-30 shadow-elevation-3',
      )}
    >
      <GripVertical className="size-5 shrink-0 text-on-surface-variant" />
      <span className="truncate text-label-large">{task.title}</span>
    </div>
  )
}

function HourSlot({ hour, children, onAdd }: { hour: number; children: React.ReactNode; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour:${hour}` })
  const settings = useSettings()
  return (
    <div
      ref={setNodeRef}
      className={cn('flex min-h-14 gap-3 border-t border-outline-variant py-1 transition-colors first:border-t-0', isOver && 'rounded-sm bg-primary/10')}
    >
      <div className="tabular w-16 shrink-0 pt-1.5 text-right text-label-medium text-on-surface-variant">
        {formatTime(timeFromMinutes(hour * 60), settings.timeFormat)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {children}
        <button
          type="button"
          onClick={onAdd}
          className="state-layer flex h-8 items-center gap-1 rounded-sm px-2 text-label-medium text-transparent hover:text-on-surface-variant focus-visible:text-on-surface-variant [&_svg]:size-4"
        >
          <Plus /> Add block
        </button>
      </div>
    </div>
  )
}

function BlockDialog({ block, open, onClose, date }: { block: Partial<TimeBlock> | null; open: boolean; onClose: () => void; date: string }) {
  const settings = useSettings()
  const [d, setD] = useState<Partial<TimeBlock>>({})
  useEffect(() => {
    if (open && block) setD(block)
  }, [open, block])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={d.id ? 'Edit time block' : 'New time block'}
      footer={
        <>
          {d.id && (
            <Button
              variant="ghost"
              className="mr-auto -ml-3 text-error"
              onClick={async () => {
                await remove('timeBlocks', d.id!)
                onClose()
              }}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            disabled={!d.title?.trim() || !d.start || !d.end || d.end <= d.start}
            onClick={async () => {
              await save('timeBlocks', { ...d, date: d.date ?? date, title: d.title!.trim() })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <Field label="Title">
          <Input autoFocus value={d.title ?? ''} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="time" value={d.start ?? ''} onChange={(e) => setD({ ...d, start: e.target.value })} />
          </Field>
          <Field label="End">
            <Input type="time" value={d.end ?? ''} onChange={(e) => setD({ ...d, end: e.target.value })} />
          </Field>
        </div>
        <Field label="Category">
          <Select value={d.category ?? 'Work'} onChange={(e) => setD({ ...d, category: e.target.value })}>
            {settings.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  )
}

function dayTitle(date: string) {
  const d = parseYmd(date)
  const today = new Date()
  const relative = { [ymd(today)]: 'Today', [ymd(addDays(today, 1))]: 'Tomorrow', [ymd(addDays(today, -1))]: 'Yesterday' }[date]
  const day = format(d, d.getFullYear() === today.getFullYear() ? 'd MMM' : 'd MMM yyyy')
  return `${relative ?? format(d, 'EEE')}, ${day}`
}

/** Google Calendar style day switcher: Today, previous/next, the date as a title and a calendar button for the native picker. */
function DayNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const picker = useRef<HTMLInputElement>(null)
  const openPicker = () => {
    const el = picker.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button variant="outline" className="mr-1 px-4" onClick={() => onChange(ymd())}>
        Today
      </Button>
      <IconButton label="Previous day" onClick={() => onChange(ymd(addDays(parseYmd(date), -1)))}>
        <ChevronLeft />
      </IconButton>
      <IconButton label="Next day" onClick={() => onChange(ymd(addDays(parseYmd(date), 1)))}>
        <ChevronRight />
      </IconButton>
      <h2 className="tabular ml-1 min-w-0 truncate text-title-medium text-on-surface" aria-live="polite">
        {dayTitle(date)}
      </h2>
      <div className="relative shrink-0">
        <IconButton label="Choose date" onClick={openPicker}>
          <CalendarDays />
        </IconButton>
        <input
          ref={picker}
          type="date"
          value={date}
          onChange={(e) => onChange(e.target.value || ymd())}
          aria-label="Date"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 size-full opacity-0"
        />
      </div>
    </div>
  )
}

/** Time-blocking day planner: drag tasks into hourly slots. `newBlock` changes when the page FAB asks for a new block. */
function Planner({ newBlock }: { newBlock: number }) {
  const settings = useSettings()
  const user = useApp((s) => s.user)
  const [date, setDate] = useState(ymd())
  const tasks = useTable('tasks') ?? []
  const blocks = (useTable('timeBlocks') ?? []).filter((b) => b.date === date).sort((a, b) => a.start.localeCompare(b.start))
  const [editing, setEditing] = useState<Partial<TimeBlock> | null>(null)
  const sensors = useDndSensors()
  const scheduledIds = new Set(blocks.map((b) => b.taskId))
  const candidates = tasks.filter((t) => t.status === 'open' && (!t.dueDate || t.dueDate <= date) && !scheduledIds.has(t.id))
  const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00 – 23:00
  const draft = (hour: number): Partial<TimeBlock> => ({
    date,
    start: timeFromMinutes(hour * 60),
    end: timeFromMinutes(Math.min(hour * 60 + 60, 24 * 60 - 1)),
    title: '',
    category: 'Work',
  })

  const handledNew = useRef(newBlock)
  useEffect(() => {
    if (newBlock === handledNew.current) return
    handledNew.current = newBlock
    setEditing(draft(Math.min(23, new Date().getHours() + 1)))
  }, [newBlock])

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return
    const hour = Number(String(e.over.id).split(':')[1])
    const [kind, id] = String(e.active.id).split(':')
    if (kind === 'task') {
      const t = tasks.find((x) => x.id === id)
      if (!t) return
      await save('timeBlocks', {
        date,
        start: timeFromMinutes(hour * 60),
        end: timeFromMinutes(Math.min(hour * 60 + 60, 24 * 60 - 1)),
        title: t.title,
        taskId: t.id,
        category: t.tags.find((tag) => settings.categories.map((c) => c.toLowerCase()).includes(tag))
          ? settings.categories.find((c) => t.tags.includes(c.toLowerCase()))!
          : 'Work',
      })
    } else if (kind === 'block') {
      const b = blocks.find((x) => x.id === id)
      if (!b) return
      const len = minutesOf(b.end) - minutesOf(b.start)
      await save('timeBlocks', { id: b.id, start: timeFromMinutes(hour * 60), end: timeFromMinutes(Math.min(hour * 60 + len, 24 * 60 - 1)) })
    }
  }

  const pushToCalendar = async () => {
    try {
      for (const b of blocks) {
        const id = await upsertEvent(b.calendarEventId, blockToEvent(b))
        if (id !== b.calendarEventId) await save('timeBlocks', { id: b.id, calendarEventId: id })
      }
      toast(`Pushed ${blocks.length} block${blocks.length === 1 ? '' : 's'} to Google Calendar`)
    } catch (e) {
      toast(`Calendar: ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <DayNav date={date} onChange={setDate} />
        {user?.mode === 'google' && settings.calendarMirror && blocks.length > 0 && (
          <Button variant="secondary" onClick={pushToCalendar}>
            <CalendarPlus /> Push to Google Calendar
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start md:gap-6">
        <div>
          <SectionTitle>Tasks to place</SectionTitle>
          {candidates.length ? (
            <div className="flex flex-wrap gap-2 md:flex-col">
              {candidates.map((t) => (
                <DraggableTask key={t.id} task={t} />
              ))}
            </div>
          ) : (
            <p className="px-1 text-body-medium text-on-surface-variant">No unscheduled tasks for this day.</p>
          )}
          <p className="mt-3 px-1 text-body-small text-on-surface-variant">Drag a task into an hour. Tap a block to edit its time.</p>
        </div>
        <Card className="px-2 py-1 md:px-3">
          {hours.map((h) => (
            <HourSlot key={h} hour={h} onAdd={() => setEditing(draft(h))}>
              {blocks
                .filter((b) => Math.floor(minutesOf(b.start) / 60) === h)
                .map((b) => (
                  <BlockChip key={b.id} block={b} onOpen={() => setEditing(b)} color={catColor(settings.categories, b.category)} />
                ))}
            </HourSlot>
          ))}
        </Card>
      </div>
      <BlockDialog open={Boolean(editing)} block={editing} date={date} onClose={() => setEditing(null)} />
    </DndContext>
  )
}

function BlockChip({ block, onOpen, color }: { block: TimeBlock; onOpen: () => void; color: string }) {
  const settings = useSettings()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `block:${block.id}` })
  const len = minutesOf(block.end) - minutesOf(block.start)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), background: tint(color, 18), minHeight: Math.max(32, (len / 60) * 48) }}
      className={cn('state-layer flex touch-none items-stretch gap-2.5 rounded-sm py-1.5 pr-2 pl-1.5 text-on-surface', isDragging && 'z-30 shadow-elevation-3')}
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
        <span className="truncate text-title-small">{block.title}</span>
        <span className="tabular shrink-0 text-label-medium text-on-surface-variant">
          {formatTime(block.start, settings.timeFormat)}–{formatTime(block.end, settings.timeFormat)}
        </span>
      </span>
    </div>
  )
}

/** Time log by category, with manual entries. */
function TimeLog() {
  const settings = useSettings()
  const sessions = useTable('focusSessions') ?? []
  const tasks = useTable('tasks') ?? []
  const [cat, setCat] = useState(settings.categories[0] ?? 'Work')
  const [mins, setMins] = useState('30')
  const [date, setDate] = useState(ymd())
  const today = ymd()
  const ws = startOfWeek(new Date(), { weekStartsOn: settings.weekStart }).getTime()
  const focus = sessions.filter((s) => s.type === 'focus')
  const totals = (from: number) => {
    const m = new Map<string, number>()
    for (const s of focus) if (s.startedAt >= from) m.set(s.category, (m.get(s.category) ?? 0) + s.durationMin)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const summaries: [string, [string, number][]][] = [
    ['Today', totals(parseYmd(today).getTime())],
    ['This week', totals(ws)],
  ]
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 30)
  const taskName = new Map(tasks.map((t) => [t.id, t.title]))

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Log time manually</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-2 items-center gap-4 pt-2 sm:grid-cols-[1fr_7rem_11rem_auto]"
            onSubmit={async (e) => {
              e.preventDefault()
              const n = Number(mins)
              if (!n) return
              const start = parseYmd(date)
              start.setHours(12)
              await save('focusSessions', { category: cat, durationMin: n, startedAt: start.getTime(), type: 'focus', manual: true, taskId: null })
              toast(`Logged ${n} min of ${cat}`)
            }}
          >
            <Field label="Category">
              <Select value={cat} onChange={(e) => setCat(e.target.value)}>
                {settings.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Minutes">
              <Input type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} aria-label="Minutes" />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value || ymd())} aria-label="Date" />
            </Field>
            <Button type="submit" className="justify-self-start">
              <Plus /> Log
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {summaries.map(([label, rows]) => {
          const total = rows.reduce((a, r) => a + r[1], 0)
          const max = Math.max(...rows.map((r) => r[1]))
          return (
            <Card key={label}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
                <Badge variant="secondary">{Math.round((total / 60) * 10) / 10} h</Badge>
              </CardHeader>
              <CardContent className="grid gap-3">
                {rows.map(([c, m]) => (
                  <div key={c} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-body-medium">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: catColor(settings.categories, c) }} />
                      <span className="truncate">{c}</span>
                    </span>
                    <Progress value={m / max} color={catColor(settings.categories, c)} className="h-2" />
                    <span className="tabular text-right text-label-medium text-on-surface-variant">{m} min</span>
                  </div>
                ))}
                {!rows.length && <p className="text-body-medium text-on-surface-variant">Nothing logged yet.</p>}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <section>
        <SectionTitle>Recent sessions</SectionTitle>
        {recent.length ? (
          <div className="flex flex-col gap-0.5 overflow-hidden rounded-lg">
            {recent.map((s: FocusSession) => (
              <ListItem
                key={s.id}
                className="bg-surface-container-low"
                leading={
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface"
                    style={{
                      background:
                        s.type === 'focus' ? tint(catColor(settings.categories, s.category), 24) : 'var(--md-surface-container-highest)',
                    }}
                  >
                    {s.type === 'focus' ? <Timer /> : <Spa />}
                  </span>
                }
                headline={
                  <>
                    {s.category}
                    {s.taskId && taskName.get(s.taskId) && <span className="text-on-surface-variant"> · {taskName.get(s.taskId)}</span>}
                  </>
                }
                supporting={`${format(s.startedAt, 'd MMM, p')} · ${s.durationMin} min`}
                trailing={
                  <>
                    {s.manual && <Badge>Manual</Badge>}
                    <IconButton label="Delete session" className="-mr-2" onClick={() => remove('focusSessions', s.id)}>
                      <Trash2 />
                    </IconButton>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Timer />} title="No sessions yet" text="Start a Pomodoro or log time manually." />
        )}
      </section>
    </div>
  )
}

/** Weekly review (planned vs actual) and daily focus report. */
function Review() {
  const settings = useSettings()
  const sessions = (useTable('focusSessions') ?? []).filter((s) => s.type === 'focus')
  const blocks = useTable('timeBlocks') ?? []
  const [offset, setOffset] = useState(0)
  const ws = addDays(startOfWeek(new Date(), { weekStartsOn: settings.weekStart }), offset * 7)
  const we = addDays(ws, 7)
  const inWeek = (t: number) => t >= ws.getTime() && t < we.getTime()

  const byCat = useMemo(() => {
    const m = new Map<string, { category: string; planned: number; actual: number }>()
    const get = (c: string) => m.get(c) ?? m.set(c, { category: c, planned: 0, actual: 0 }).get(c)!
    for (const b of blocks) if (inWeek(parseYmd(b.date).getTime())) get(b.category).planned += (minutesOf(b.end) - minutesOf(b.start)) / 60
    for (const s of sessions) if (inWeek(s.startedAt)) get(s.category).actual += s.durationMin / 60
    return [...m.values()].map((r) => ({ ...r, planned: Math.round(r.planned * 10) / 10, actual: Math.round(r.actual * 10) / 10 }))
  }, [blocks, sessions, offset])

  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i)
    const key = ymd(d)
    return {
      day: format(d, 'EEE'),
      minutes: sessions.filter((s) => ymd(s.startedAt) === key).reduce((a, s) => a + s.durationMin, 0),
    }
  })
  const planned = byCat.reduce((a, r) => a + r.planned, 0)
  const actual = byCat.reduce((a, r) => a + r.actual, 0)
  const cursor = { fill: 'var(--md-on-surface)', fillOpacity: 0.08 }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-1">
        <IconButton label="Previous week" onClick={() => setOffset(offset - 1)}>
          <ChevronLeft />
        </IconButton>
        <span className="min-w-36 text-center text-title-medium">
          {format(ws, 'd MMM')} – {format(addDays(we, -1), 'd MMM')}
        </span>
        <IconButton label="Next week" onClick={() => setOffset(offset + 1)} disabled={offset >= 0}>
          <ChevronRight />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Planned" value={`${Math.round(planned * 10) / 10} h`} />
        <Stat label="Actual focus" value={`${Math.round(actual * 10) / 10} h`} />
        <Stat label="Follow-through" value={planned ? `${Math.round((actual / planned) * 100)}%` : '—'} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Planned vs actual by category</CardTitle>
          <span className="text-label-medium text-on-surface-variant">Hours</span>
        </CardHeader>
        <CardContent className="h-64">
          {byCat.length ? (
            <ResponsiveContainer>
              <BarChart data={byCat} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--md-outline-variant)" />
                <XAxis dataKey="category" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} width={28} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--md-on-surface)' }} itemStyle={{ color: 'var(--md-on-surface)' }} cursor={cursor} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={legendText} />
                <Bar dataKey="planned" name="Planned" fill="var(--md-tertiary)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="actual" name="Actual" fill="var(--md-primary)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-center text-body-medium text-on-surface-variant">
              Plan time blocks and run focus sessions to compare.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Daily focus</CardTitle>
          <span className="text-label-medium text-on-surface-variant">Minutes</span>
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid vertical={false} stroke="var(--md-outline-variant)" />
              <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} width={28} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--md-on-surface)' }} itemStyle={{ color: 'var(--md-on-surface)' }} cursor={cursor} />
              <Bar dataKey="minutes" name="Focus min" fill="var(--md-primary)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

export function FocusPage() {
  const [tab, setTab] = useState<Tab>('timer')
  const [newBlock, setNewBlock] = useState(0)
  useNewParam(() => setTab('timer'))
  const sessions = useTable('focusSessions') ?? []
  const today = ymd()
  const todayMin = sessions.filter((s) => s.type === 'focus' && ymd(s.startedAt) === today).reduce((a, s) => a + s.durationMin, 0)
  return (
    <div>
      <PageHeader
        title="Focus & time"
        subtitle={`${todayMin} focus minutes today`}
        fab={tab === 'planner' ? { icon: <Plus />, label: 'New block', onClick: () => setNewBlock((n) => n + 1) } : undefined}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        className="-mx-4 mb-6 md:mx-0"
        options={[
          { value: 'timer', label: 'Pomodoro' },
          { value: 'planner', label: 'Day planner' },
          { value: 'log', label: 'Time log' },
          { value: 'review', label: 'Weekly review' },
        ]}
      />
      {tab === 'timer' && <PomodoroTimer />}
      {tab === 'planner' && <Planner newBlock={newBlock} />}
      {tab === 'log' && <TimeLog />}
      {tab === 'review' && <Review />}
    </div>
  )
}
