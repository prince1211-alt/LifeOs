import { useEffect, useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarPlus, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, Plus, RotateCcw, SkipForward, Square, Timer, Trash2 } from 'lucide-react'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useNow, useSettings, useTable } from '@/lib/hooks'
import type { FocusSession, Task, TimeBlock } from '@/lib/types'
import { remove, save } from '@/lib/repo'
import { clock, cn, formatTime, minutesOf, parseYmd, timeFromMinutes, ymd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Segmented, Select } from '@/components/ui/form'
import { Badge, EmptyState, PageHeader, ProgressRing, Stat } from '@/components/ui/misc'
import { PHASE_LABEL, syncIdleLength, usePomodoro } from './pomodoro'
import { useDndSensors } from '@/components/dnd'
import { blockToEvent, upsertEvent } from '@/lib/google/calendar'
import { useApp, toast } from '@/store/app'

type Tab = 'timer' | 'planner' | 'log' | 'review'
const chartStyle = { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }
const CAT_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#a855f7', '#ef4444']
export const catColor = (cats: string[], c: string) => CAT_COLORS[Math.max(0, cats.indexOf(c)) % CAT_COLORS.length]

function PomodoroTimer() {
  const p = usePomodoro()
  const settings = useSettings()
  const tasks = (useTable('tasks') ?? []).filter((t) => t.status === 'open')
  const now = useNow(250)
  const [full, setFull] = useState(false)
  const left = p.running && p.endsAt ? Math.max(0, p.endsAt - now) : p.remainingMs
  const task = tasks.find((t) => t.id === p.taskId)
  const color = p.phase === 'focus' ? 'var(--primary)' : 'var(--success)'

  useEffect(() => {
    syncIdleLength()
  }, [settings.pomodoro.focus, settings.pomodoro.short, settings.pomodoro.long, p.phase])

  useEffect(() => {
    document.title = p.running ? `${clock(left)} · ${PHASE_LABEL[p.phase]} — LifeOS` : 'LifeOS'
  }, [p.running, left, p.phase])
  useEffect(() => () => void (document.title = 'LifeOS'), [])

  // Later: full-screen focus mode.
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

  const controls = (
    <div className="flex items-center justify-center gap-2">
      <Button size="icon" variant="ghost" onClick={() => p.reset()} aria-label="Reset">
        <RotateCcw />
      </Button>
      {p.running ? (
        <Button size="lg" className="w-36" onClick={p.pause}>
          <Pause /> Pause
        </Button>
      ) : (
        <Button size="lg" className="w-36" onClick={p.start}>
          <Play /> {p.startedAt ? 'Resume' : 'Start'}
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={() => p.skip()} aria-label="Skip phase" title="Skip to next phase">
        <SkipForward />
      </Button>
      {p.startedAt && (
        <Button size="icon" variant="ghost" onClick={() => p.stopAndLog()} aria-label="Stop and log" title="Stop and log time so far">
          <Square />
        </Button>
      )}
    </div>
  )

  const dots = (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: settings.pomodoro.longEvery }, (_, i) => (
        <span key={i} className={cn('h-2 w-2 rounded-full', i < p.round % settings.pomodoro.longEvery || (p.phase === 'long' && i < settings.pomodoro.longEvery) ? 'bg-primary' : 'bg-muted')} />
      ))}
    </div>
  )

  if (full)
    return (
      <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-8 bg-background p-6">
        <Button size="icon" variant="ghost" className="absolute top-4 right-4" onClick={toggleFull} aria-label="Exit focus mode">
          <Minimize2 />
        </Button>
        <div className="text-lg font-medium text-muted-foreground">{PHASE_LABEL[p.phase]}</div>
        <div className="tabular text-8xl font-bold tracking-tight sm:text-9xl" style={{ color }}>
          {clock(left)}
        </div>
        {task && <div className="max-w-xl text-center text-xl">{task.title}</div>}
        {dots}
        {controls}
      </div>
    )

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-4">
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
        <ProgressRing value={1 - left / p.phaseMs} size={240} stroke={14} color={color}>
          <div className="tabular text-5xl font-bold">{clock(left)}</div>
          <div className="text-sm text-muted-foreground">{PHASE_LABEL[p.phase]}</div>
        </ProgressRing>
        {dots}
        {controls}
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
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
        <Button variant="outline" size="sm" onClick={toggleFull}>
          <Maximize2 /> Full-screen focus mode
        </Button>
      </div>
    </Card>
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
      className={cn('cursor-grab touch-none rounded-lg border bg-card px-3 py-2 text-sm shadow-sm active:cursor-grabbing', isDragging && 'z-30 opacity-80 shadow-lg')}
    >
      {task.title}
    </div>
  )
}

function HourSlot({ hour, children, onAdd }: { hour: number; children: React.ReactNode; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour:${hour}` })
  const settings = useSettings()
  return (
    <div ref={setNodeRef} className={cn('flex min-h-12 gap-2 border-t py-1', isOver && 'bg-primary/10')}>
      <div className="w-14 shrink-0 pt-1 text-right text-xs text-muted-foreground">{formatTime(timeFromMinutes(hour * 60), settings.timeFormat)}</div>
      <div className="flex flex-1 flex-col gap-1">
        {children}
        <button onClick={onAdd} className="h-6 rounded text-left text-xs text-transparent hover:bg-muted hover:text-muted-foreground">
          + add block
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
              className="mr-auto text-destructive"
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
      <div className="grid gap-3">
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

/** Time-blocking day planner: drag tasks into hourly slots. */
function Planner() {
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setDate(ymd(addDays(parseYmd(date), -1)))} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value || ymd())} className="h-9 w-40" />
          <Button size="icon" variant="ghost" onClick={() => setDate(ymd(addDays(parseYmd(date), 1)))} aria-label="Next day">
            <ChevronRight />
          </Button>
          {date !== ymd() && (
            <Button size="sm" variant="ghost" onClick={() => setDate(ymd())}>
              Today
            </Button>
          )}
        </div>
        {user?.mode === 'google' && settings.calendarMirror && blocks.length > 0 && (
          <Button size="sm" variant="outline" onClick={pushToCalendar}>
            <CalendarPlus /> Push to Google Calendar
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Tasks to place</h3>
          <div className="grid gap-1.5">
            {candidates.map((t) => (
              <DraggableTask key={t.id} task={t} />
            ))}
            {!candidates.length && <p className="text-xs text-muted-foreground">No unscheduled tasks for this day.</p>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Drag a task into an hour. Tap a block to edit its time.</p>
        </div>
        <Card className="p-2">
          {hours.map((h) => (
            <HourSlot
              key={h}
              hour={h}
              onAdd={() => setEditing({ date, start: timeFromMinutes(h * 60), end: timeFromMinutes(h * 60 + 60), title: '', category: 'Work' })}
            >
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
      style={{ transform: CSS.Translate.toString(transform), borderLeftColor: color, minHeight: Math.max(28, (len / 60) * 44) }}
      className={cn('flex touch-none items-start justify-between gap-2 rounded-md border border-l-4 bg-muted/60 px-2 py-1 text-sm', isDragging && 'z-30 opacity-80 shadow-lg')}
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      <span className="font-medium">{block.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatTime(block.start, settings.timeFormat)}–{formatTime(block.end, settings.timeFormat)}
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
  const todayTotals = totals(parseYmd(today).getTime())
  const weekTotals = totals(ws)
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 30)
  const taskName = new Map(tasks.map((t) => [t.id, t.title]))

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Log time manually</h3>
        <form
          className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_6rem_10rem_auto]"
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
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            {settings.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Input type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} aria-label="Minutes" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value || ymd())} />
          <Button type="submit">
            <Plus /> Log
          </Button>
        </form>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['Today', todayTotals],
          ['This week', weekTotals],
        ].map(([label, rows]) => (
          <Card key={label as string}>
            <CardHeader>
              <CardTitle>{label as string}</CardTitle>
              <Badge>{Math.round(((rows as [string, number][]).reduce((a, r) => a + r[1], 0) / 60) * 10) / 10} h</Badge>
            </CardHeader>
            <CardContent className="grid gap-2">
              {(rows as [string, number][]).map(([c, m]) => {
                const max = Math.max(...(rows as [string, number][]).map((r) => r[1]))
                return (
                  <div key={c} className="grid grid-cols-[5rem_1fr_3.5rem] items-center gap-2 text-sm">
                    <span className="truncate">{c}</span>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full" style={{ width: `${(m / max) * 100}%`, background: catColor(settings.categories, c) }} />
                    </div>
                    <span className="tabular text-right text-xs text-muted-foreground">{m} min</span>
                  </div>
                )
              })}
              {!(rows as unknown[]).length && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5">
          {recent.map((s: FocusSession) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
              <span>
                <span className="font-medium">{s.category}</span>
                {s.taskId && taskName.get(s.taskId) && <span className="text-muted-foreground"> · {taskName.get(s.taskId)}</span>}
                {s.manual && <Badge className="ml-1.5">manual</Badge>}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {format(s.startedAt, 'd MMM, p')} · {s.durationMin} min
                <button aria-label="Delete session" className="hover:text-destructive" onClick={() => remove('focusSessions', s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))}
          {!recent.length && <EmptyState icon={<Timer />} title="No sessions yet" text="Start a Pomodoro or log time manually." />}
        </CardContent>
      </Card>
    </div>
  )
}

/** Later: weekly review (planned vs actual) and daily/weekly time reports. */
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

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setOffset(offset - 1)} aria-label="Previous week">
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium">
          {format(ws, 'd MMM')} – {format(addDays(we, -1), 'd MMM')}
        </span>
        <Button size="icon" variant="ghost" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next week">
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Planned" value={`${Math.round(planned * 10) / 10} h`} />
        <Stat label="Actual focus" value={`${Math.round(actual * 10) / 10} h`} />
        <Stat label="Follow-through" value={planned ? `${Math.round((actual / planned) * 100)}%` : '—'} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Planned vs actual by category (hours)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {byCat.length ? (
            <ResponsiveContainer>
              <BarChart data={byCat}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} width={28} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={chartStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="planned" name="Planned" fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Plan time blocks and run focus sessions to compare.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Daily focus (minutes)</CardTitle>
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer>
            <BarChart data={daily}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} width={28} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={chartStyle} />
              <Bar dataKey="minutes" name="Focus min" fill="var(--primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

export function FocusPage() {
  const [tab, setTab] = useState<Tab>('timer')
  const sessions = useTable('focusSessions') ?? []
  const today = ymd()
  const todayMin = sessions.filter((s) => s.type === 'focus' && ymd(s.startedAt) === today).reduce((a, s) => a + s.durationMin, 0)
  return (
    <div>
      <PageHeader title="Focus & time" subtitle={`${todayMin} focus minutes today`} />
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-4 w-full overflow-x-auto sm:w-auto"
        options={[
          { value: 'timer', label: 'Pomodoro' },
          { value: 'planner', label: 'Day planner' },
          { value: 'log', label: 'Time log' },
          { value: 'review', label: 'Weekly review' },
        ]}
      />
      {tab === 'timer' && <PomodoroTimer />}
      {tab === 'planner' && <Planner />}
      {tab === 'log' && <TimeLog />}
      {tab === 'review' && <Review />}
    </div>
  )
}
