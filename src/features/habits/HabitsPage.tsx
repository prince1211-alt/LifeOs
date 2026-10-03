import { useEffect, useMemo, useState } from 'react'
import { addDays, startOfWeek, subWeeks, format } from 'date-fns'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Flame, Link2, Pause, Pencil, Plus, Trash2, Trophy } from 'lucide-react'
import { useSettings, useTable, useToday } from '@/lib/hooks'
import type { Habit, HabitLog, HabitScheduleKind } from '@/lib/types'
import { computeStreak, habitLogId, HABIT_COLORS, HABIT_ICONS, isDone, isDueOn, successRate } from '@/lib/habits'
import { remove, save } from '@/lib/repo'
import { cn, formatTime, parseYmd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { DayPicker, Field, Input, Segmented, Select } from '@/components/ui/form'
import { Badge, EmptyState, PageHeader, Stat } from '@/components/ui/misc'
import { Heatmap } from './Heatmap'
import { toggleSkip } from './actions'
import { HabitCheck, describeSchedule } from './HabitCheck'

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)

function WeekStrip({ habit, logs, weekStart }: { habit: Habit; logs: HabitLog[]; weekStart: 0 | 1 }) {
  const ws = startOfWeek(new Date(), { weekStartsOn: weekStart })
  const map = new Map(logs.filter((l) => l.habitId === habit.id).map((l) => [l.date, l]))
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  return (
    <div className="flex gap-1">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i)
        const key = format(d, 'yyyy-MM-dd')
        const l = map.get(key)
        const done = isDone(habit, l)
        return (
          <div key={key} className="flex flex-col items-center gap-0.5">
            <span className={cn('text-[9px] text-muted-foreground', key === todayKey && 'font-bold text-foreground')}>
              {format(d, 'EEEEE')}
            </span>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: done ? habit.color : l?.skipped ? 'var(--border)' : 'var(--muted)' }}
            />
          </div>
        )
      })}
    </div>
  )
}

function HabitRow({ habit, logs, onOpen }: { habit: Habit; logs: HabitLog[]; onOpen: () => void }) {
  const settings = useSettings()
  const today = useToday()
  const streak = computeStreak(habit, logs, parseYmd(today), settings.weekStart)
  const log = logs.find((l) => l.id === habitLogId(habit.id, today))
  const after = habit.stackAfter
  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/30" onClick={onOpen}>
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: habit.color + '22' }}>
          {habit.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{habit.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{describeSchedule(habit)}</span>
            <span className="flex items-center gap-0.5 text-orange-500">
              <Flame className="h-3 w-3" />
              {streak.current} {streak.unit === 'weeks' ? 'wk' : 'd'}
            </span>
            {habit.reminderTime && <span>⏰ {formatTime(habit.reminderTime, settings.timeFormat)}</span>}
            {after && <span className="flex items-center gap-0.5"><Link2 className="h-3 w-3" /> after {after}</span>}
          </div>
          <div className="mt-1.5 hidden sm:block">
            <WeekStrip habit={habit} logs={logs} weekStart={settings.weekStart} />
          </div>
        </div>
        <HabitCheck habit={habit} log={log} date={today} />
      </div>
    </Card>
  )
}

function HabitDetail({ habit, logs, onClose, onEdit }: { habit: Habit; logs: HabitLog[]; onClose: () => void; onEdit: () => void }) {
  const settings = useSettings()
  const today = useToday()
  const streak = computeStreak(habit, logs, parseYmd(today), settings.weekStart)
  const { confirm, node } = useConfirm()
  const log = logs.find((l) => l.id === habitLogId(habit.id, today))
  const last30 = successRate(habit, logs, addDays(parseYmd(today), -29), parseYmd(today))
  const weekly = useMemo(() => {
    const ws = startOfWeek(parseYmd(today), { weekStartsOn: settings.weekStart })
    return Array.from({ length: 8 }, (_, i) => {
      const from = subWeeks(ws, 7 - i)
      const to = addDays(from, 6)
      const rate = successRate(habit, logs, from, to > parseYmd(today) ? parseYmd(today) : to)
      return { week: format(from, 'd MMM'), pct: rate == null ? 0 : Math.round(rate * 100) }
    })
  }, [habit, logs, today, settings.weekStart])

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="text-xl">{habit.icon}</span> {habit.name}
        </span>
      }
      className="sm:max-w-2xl"
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto text-destructive"
            onClick={async () => {
              if (await confirm(`Delete “${habit.name}” and its history?`)) {
                await remove('habits', habit.id)
                onClose()
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {describeSchedule(habit)}
            {habit.type === 'count' && ` · target ${habit.target}`}
            {(habit.stackAfter || habit.stackAfterHabitId) && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Link2 className="h-3 w-3" /> after {habit.stackAfter}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleSkip(habit, today)}>
              <Pause /> {log?.skipped ? 'Unskip today' : 'Skip today'}
            </Button>
            <HabitCheck habit={habit} log={log} date={today} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Current streak" value={<span className="flex items-center gap-1"><Flame className="h-4 w-4 text-orange-500" />{streak.current}</span>} sub={streak.unit} />
          <Stat label="Best streak" value={<span className="flex items-center gap-1"><Trophy className="h-4 w-4 text-amber-500" />{streak.best}</span>} sub={streak.unit} />
          <Stat label="Last 30 days" value={pct(last30)} sub="success" />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">History</h4>
          <Heatmap habit={habit} logs={logs} weeks={26} weekStart={settings.weekStart} />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Weekly success</h4>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={weekly}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
                <Bar dataKey="pct" fill={habit.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {node}
    </Dialog>
  )
}

export function HabitDialog({ habit, open, onClose }: { habit: Habit | null; open: boolean; onClose: () => void }) {
  const settings = useSettings()
  const habits = useTable('habits') ?? []
  const blank: Partial<Habit> = {
    name: '',
    icon: HABIT_ICONS[0],
    color: HABIT_COLORS[0],
    type: 'check',
    target: 1,
    schedule: { kind: 'daily', days: [1, 2, 3, 4, 5], timesPerWeek: 3 },
    reminderTime: null,
    stackAfter: '',
    stackAfterHabitId: null,
  }
  const [d, setD] = useState<Partial<Habit>>(blank)
  useEffect(() => {
    if (open) setD(habit ?? blank)
  }, [open, habit?.id])
  const set = (p: Partial<Habit>) => setD((x) => ({ ...x, ...p }))
  const sched = d.schedule ?? blank.schedule!

  const submit = async () => {
    if (!d.name?.trim()) return
    const linked = habits.find((h) => h.id === d.stackAfterHabitId)
    await save('habits', {
      ...d,
      name: d.name.trim(),
      target: d.type === 'count' ? Math.max(1, d.target ?? 1) : 1,
      stackAfter: linked ? linked.name : d.stackAfter?.trim() ?? '',
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={habit ? 'Edit habit' : 'New habit'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!d.name?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name">
          <Input autoFocus value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Drink water" />
        </Field>
        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {HABIT_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => set({ icon: i })}
                className={cn('h-9 w-9 rounded-lg text-lg', d.icon === i ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted')}
              >
                {i}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => set({ color: c })}
                className={cn('h-8 w-8 rounded-full', d.color === c && 'ring-2 ring-offset-2 ring-offset-card')}
                style={{ background: c, ['--tw-ring-color' as string]: c }}
              />
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={d.type} onChange={(e) => set({ type: e.target.value as Habit['type'] })}>
              <option value="check">Yes / no</option>
              <option value="count">Count (e.g. glasses)</option>
            </Select>
          </Field>
          {d.type === 'count' && (
            <Field label="Daily target">
              <Input type="number" min={1} value={d.target ?? 1} onChange={(e) => set({ target: Number(e.target.value) || 1 })} />
            </Field>
          )}
        </div>
        <Field label="Schedule">
          <Segmented<HabitScheduleKind>
            value={sched.kind}
            onChange={(kind) => set({ schedule: { ...sched, kind } })}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'days', label: 'Chosen days' },
              { value: 'weekly', label: 'X per week' },
            ]}
          />
        </Field>
        {sched.kind === 'days' && (
          <DayPicker value={sched.days} onChange={(days) => set({ schedule: { ...sched, days } })} weekStart={settings.weekStart} />
        )}
        {sched.kind === 'weekly' && (
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="number"
              min={1}
              max={7}
              className="w-20"
              value={sched.timesPerWeek}
              onChange={(e) => set({ schedule: { ...sched, timesPerWeek: Math.min(7, Math.max(1, Number(e.target.value) || 1)) } })}
            />
            times a week
          </div>
        )}
        <Field label="Reminder time (optional)">
          <Input type="time" value={d.reminderTime ?? ''} onChange={(e) => set({ reminderTime: e.target.value || null })} />
        </Field>
        <Field label="Habit stacking — do this after… (optional)">
          <div className="grid gap-2">
            <Select value={d.stackAfterHabitId ?? ''} onChange={(e) => set({ stackAfterHabitId: e.target.value || null })}>
              <option value="">Not linked to another habit</option>
              {habits
                .filter((h) => h.id !== habit?.id)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.icon} {h.name}
                  </option>
                ))}
            </Select>
            {!d.stackAfterHabitId && (
              <Input value={d.stackAfter ?? ''} onChange={(e) => set({ stackAfter: e.target.value })} placeholder="or a cue, e.g. brushing teeth" />
            )}
          </div>
        </Field>
      </div>
    </Dialog>
  )
}

export function HabitsPage() {
  const habits = useTable('habits')
  const logs = useTable('habitLogs') ?? []
  const settings = useSettings()
  const today = useToday()
  const [view, setView] = useState<'today' | 'all'>('today')
  const [detail, setDetail] = useState<string | null>(null)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [creating, setCreating] = useState(false)

  const active = (habits ?? []).filter((h) => !h.archived)
  const due = active.filter((h) => isDueOn(h, logs, parseYmd(today), settings.weekStart))
  const list = view === 'today' ? due : active
  const doneToday = due.filter((h) => isDone(h, logs.find((l) => l.id === habitLogId(h.id, today)))).length

  const overall = useMemo(() => {
    const ws = startOfWeek(parseYmd(today), { weekStartsOn: settings.weekStart })
    return Array.from({ length: 8 }, (_, i) => {
      const from = subWeeks(ws, 7 - i)
      const to = addDays(from, 6) > parseYmd(today) ? parseYmd(today) : addDays(from, 6)
      const rates = active.map((h) => successRate(h, logs, from, to)).filter((r): r is number => r != null)
      return { week: format(from, 'd MMM'), pct: rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : 0 }
    })
  }, [active, logs, today, settings.weekStart])

  const detailHabit = active.find((h) => h.id === detail)

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle={due.length ? `${doneToday} of ${due.length} done today` : 'Build good habits, one day at a time'}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New habit
          </Button>
        }
      />
      <Segmented
        value={view}
        onChange={setView}
        className="mb-4"
        options={[
          { value: 'today', label: `Due today (${due.length})` },
          { value: 'all', label: `All (${active.length})` },
        ]}
      />
      {habits === undefined ? null : list.length ? (
        <div className="grid gap-2">
          {list.map((h) => (
            <HabitRow key={h.id} habit={h} logs={logs} onOpen={() => setDetail(h.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Flame />}
          title={active.length ? 'Nothing due today' : 'No habits yet'}
          text={active.length ? 'Enjoy the rest day.' : 'Start small: one glass of water, ten push-ups, five pages.'}
          action={!active.length && <Button onClick={() => setCreating(true)}><Plus /> Add a habit</Button>}
        />
      )}

      {active.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Weekly success — all habits</CardTitle>
            <Badge>last 8 weeks</Badge>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer>
              <BarChart data={overall}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
                <Bar dataKey="pct" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {detailHabit && (
        <HabitDetail
          habit={detailHabit}
          logs={logs}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detailHabit)
            setDetail(null)
          }}
        />
      )}
      <HabitDialog open={creating || Boolean(editing)} habit={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  )
}
