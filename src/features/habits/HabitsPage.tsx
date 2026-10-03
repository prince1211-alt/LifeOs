import { useEffect, useMemo, useState } from 'react'
import { addDays, startOfWeek, subWeeks, format } from 'date-fns'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bell, Check, EventRepeat, Flame, Link2, Pause, Pencil, Plus, Target, Trash2, Trophy } from '@/components/icons'
import { useNewParam, useSettings, useTable, useToday } from '@/lib/hooks'
import type { Habit, HabitLog, HabitScheduleKind } from '@/lib/types'
import { computeStreak, habitLogId, HABIT_COLORS, HABIT_ICONS, isDone, isDueOn, successRate } from '@/lib/habits'
import { remove, save } from '@/lib/repo'
import { cn, formatTime, parseYmd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { DayPicker, Field, Input, Segmented, Select, Tabs } from '@/components/ui/form'
import { Badge, EmptyState, PageHeader, SectionTitle, Stat } from '@/components/ui/misc'
import { Heatmap } from './Heatmap'
import { toggleSkip } from './actions'
import { HabitAvatar, HabitCheck, describeSchedule, habitTint } from './HabitCheck'

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)

const axis = { tick: { fontSize: 11, fill: 'var(--md-on-surface-variant)' }, axisLine: false, tickLine: false } as const
const tooltipStyle = { background: 'var(--md-surface-container-high)', border: 'none', borderRadius: 8, color: 'var(--md-on-surface)' }

/** Weekly success % bars (M3 chart colours, rounded tops). */
function WeeklyChart({ data, color }: { data: { week: string; pct: number }[]; color: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--md-outline-variant)" />
        <XAxis dataKey="week" {...axis} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} width={40} tickFormatter={(v) => `${v}%`} {...axis} />
        <Tooltip
          formatter={(v) => `${v}%`}
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--md-on-surface)', fillOpacity: 0.08 }}
        />
        <Bar dataKey="pct" name="Success" fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** This week's check-ins as dots, with weekday letters on larger screens. */
function WeekStrip({ habit, logs, weekStart, today }: { habit: Habit; logs: HabitLog[]; weekStart: 0 | 1; today: string }) {
  const ws = startOfWeek(parseYmd(today), { weekStartsOn: weekStart })
  const map = new Map(logs.filter((l) => l.habitId === habit.id).map((l) => [l.date, l]))
  return (
    <span aria-hidden className="mt-2 flex gap-1.5 text-label-small sm:gap-2">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i)
        const key = format(d, 'yyyy-MM-dd')
        const l = map.get(key)
        const done = isDone(habit, l)
        const isToday = key === today
        const future = key > today
        return (
          <span key={key} className="flex flex-col items-center gap-1">
            <span className={cn('hidden h-4 sm:block', isToday ? 'text-primary' : 'text-on-surface-variant')}>{format(d, 'EEEEE')}</span>
            <span
              className="size-2.5 rounded-full"
              style={{
                background: done ? habit.color : l?.skipped ? 'var(--md-outline)' : future ? 'transparent' : 'var(--md-surface-container-highest)',
                boxShadow: future && !done ? 'inset 0 0 0 1px var(--md-outline-variant)' : undefined,
                outline: isToday ? '1.5px solid var(--md-primary)' : undefined,
                outlineOffset: 1.5,
              }}
            />
          </span>
        )
      })}
    </span>
  )
}

/** Tab label with an M3 count pill (matches the Tasks tabs). */
function TabLabel({ text, count, active }: { text: string; count: number; active: boolean }) {
  return (
    <>
      {text}
      {count > 0 && (
        <span
          className={cn(
            'tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-label-small',
            active ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant',
          )}
        >
          {count}
        </span>
      )}
    </>
  )
}

function HabitRow({ habit, logs, onOpen }: { habit: Habit; logs: HabitLog[]; onOpen: () => void }) {
  const settings = useSettings()
  const today = useToday()
  const streak = computeStreak(habit, logs, parseYmd(today), settings.weekStart)
  const log = logs.find((l) => l.id === habitLogId(habit.id, today))
  const after = habit.stackAfter
  return (
    <li className="flex items-center gap-2 bg-surface-container-low pr-4">
      <button type="button" onClick={onOpen} className="state-layer flex min-w-0 flex-1 items-center gap-4 self-stretch py-3 pl-4 text-left">
        <HabitAvatar habit={habit} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-title-medium text-on-surface">{habit.name}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body-small text-on-surface-variant">
            <span>{describeSchedule(habit)}</span>
            <span className="flex items-center gap-1">
              <Flame filled={streak.current > 0} className="size-4" style={{ color: habit.color }} />
              {streak.current} {streak.unit === 'weeks' ? 'wk' : 'd'}
            </span>
            {habit.reminderTime && (
              <span className="flex items-center gap-1">
                <Bell className="size-4" />
                {formatTime(habit.reminderTime, settings.timeFormat)}
              </span>
            )}
            {after && (
              <span className="flex min-w-0 items-center gap-1">
                <Link2 className="size-4" />
                <span className="truncate">after {after}</span>
              </span>
            )}
          </span>
          <WeekStrip habit={habit} logs={logs} weekStart={settings.weekStart} today={today} />
        </span>
      </button>
      <HabitCheck habit={habit} log={log} date={today} />
    </li>
  )
}

function HabitDetail({ habit, logs, onClose, onEdit }: { habit: Habit; logs: HabitLog[]; onClose: () => void; onEdit: () => void }) {
  const settings = useSettings()
  const today = useToday()
  const streak = computeStreak(habit, logs, parseYmd(today), settings.weekStart)
  const unit = (n: number) => (n === 1 ? streak.unit.slice(0, -1) : streak.unit)
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
  const done = isDone(habit, log)
  const status = log?.skipped
    ? 'Skipped'
    : done
      ? 'Done'
      : habit.type === 'count'
        ? `${log?.value ?? 0} of ${habit.target}`
        : 'Not done yet'

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <HabitAvatar habit={habit} />
          <span className="min-w-0 truncate">{habit.name}</span>
        </span>
      }
      className="sm:max-w-2xl"
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto -ml-3 text-error"
            onClick={async () => {
              if (await confirm(`Delete “${habit.name}” and its history?`)) {
                await remove('habits', habit.id)
                onClose()
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2">
          <Badge>
            <EventRepeat /> {describeSchedule(habit)}
          </Badge>
          {habit.type === 'count' && (
            <Badge>
              <Target /> Target {habit.target}
            </Badge>
          )}
          {habit.reminderTime && (
            <Badge>
              <Bell /> {formatTime(habit.reminderTime, settings.timeFormat)}
            </Badge>
          )}
          {(habit.stackAfter || habit.stackAfterHabitId) && (
            <Badge>
              <Link2 /> After {habit.stackAfter}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container py-3 pr-3 pl-4">
          <div className="min-w-0 flex-1">
            <div className="text-title-small text-on-surface">Today</div>
            <div className="text-body-small text-on-surface-variant">{status}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => toggleSkip(habit, today)}>
            <Pause /> {log?.skipped ? 'Unskip today' : 'Skip today'}
          </Button>
          <HabitCheck habit={habit} log={log} date={today} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat
            className="p-3"
            label="Streak"
            value={
              <span className="flex items-center gap-1">
                <Flame filled className="size-5" style={{ color: habit.color }} />
                {streak.current}
              </span>
            }
            sub={unit(streak.current)}
          />
          <Stat
            className="p-3"
            label="Best"
            value={
              <span className="flex items-center gap-1">
                <Trophy filled className="size-5 text-tertiary" />
                {streak.best}
              </span>
            }
            sub={unit(streak.best)}
          />
          <Stat className="p-3" label="Last 30 days" value={pct(last30)} sub="success" />
        </div>
        <section>
          <SectionTitle>History</SectionTitle>
          <Heatmap habit={habit} logs={logs} weeks={26} weekStart={settings.weekStart} />
        </section>
        <section>
          <SectionTitle>Weekly success</SectionTitle>
          <div className="h-44">
            <WeeklyChart data={weekly} color={habit.color} />
          </div>
        </section>
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
  const color = d.color ?? HABIT_COLORS[0]

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
          <Button variant="ghost" onClick={submit} disabled={!d.name?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5 pt-2">
        <Field label="Name">
          <Input autoFocus value={d.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Drink water" />
        </Field>
        <Field plain label="Icon">
          <div className="flex flex-wrap gap-2">
            {HABIT_ICONS.map((i) => {
              const on = d.icon === i
              return (
                <span key={i} className="relative">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ icon: i })}
                    className="state-layer flex size-11 items-center justify-center rounded-full text-xl transition-colors"
                    style={{
                      background: on ? habitTint(color, 24) : 'var(--md-surface-container-highest)',
                      boxShadow: on ? `inset 0 0 0 2px ${color}` : undefined,
                    }}
                  >
                    {i}
                  </button>
                  {on && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-0.5 -bottom-0.5 flex size-[18px] items-center justify-center rounded-full text-white"
                      style={{ background: color, boxShadow: '0 0 0 2px var(--field-bg, var(--md-surface))' }}
                    >
                      <Check className="size-3.5" />
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </Field>
        <Field plain label="Colour">
          <div className="flex flex-wrap gap-3">
            {HABIT_COLORS.map((c) => {
              const on = d.color === c
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={on}
                  onClick={() => set({ color: c })}
                  className="state-layer flex size-10 items-center justify-center rounded-full text-white"
                  style={{ background: c, boxShadow: on ? `0 0 0 2px var(--field-bg, var(--md-surface)), 0 0 0 4px ${c}` : undefined }}
                >
                  {on && <Check className="size-5" />}
                </button>
              )
            })}
          </div>
        </Field>
        <Field plain label="Type">
          <Segmented<Habit['type']>
            value={d.type ?? 'check'}
            onChange={(type) => set({ type })}
            className="w-full"
            options={[
              { value: 'check', label: 'Yes / no' },
              { value: 'count', label: 'Count' },
            ]}
          />
        </Field>
        {d.type === 'count' && (
          <Field label="Daily target" supporting="For example 8 glasses of water">
            <Input type="number" min={1} value={d.target ?? 1} onChange={(e) => set({ target: Number(e.target.value) || 1 })} />
          </Field>
        )}
        <Field plain label="Schedule">
          <Segmented<HabitScheduleKind>
            value={sched.kind}
            onChange={(kind) => set({ schedule: { ...sched, kind } })}
            className="w-full"
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'days', label: 'Chosen days' },
              { value: 'weekly', label: 'X per week' },
            ]}
          />
          {sched.kind === 'days' && (
            <DayPicker value={sched.days} onChange={(days) => set({ schedule: { ...sched, days } })} weekStart={settings.weekStart} />
          )}
        </Field>
        {sched.kind === 'weekly' && (
          <Field label="Times a week" className="max-w-40">
            <Input
              type="number"
              min={1}
              max={7}
              value={sched.timesPerWeek}
              onChange={(e) => set({ schedule: { ...sched, timesPerWeek: Math.min(7, Math.max(1, Number(e.target.value) || 1)) } })}
            />
          </Field>
        )}
        <Field label="Reminder time" supporting="Optional">
          <Input type="time" value={d.reminderTime ?? ''} onChange={(e) => set({ reminderTime: e.target.value || null })} />
        </Field>
        <Field label="Habit stacking: do this after…" supporting="Optional. Linking to a habit you already do makes this one stick.">
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
        </Field>
        {!d.stackAfterHabitId && (
          <Field label="Or after a cue">
            <Input value={d.stackAfter ?? ''} onChange={(e) => set({ stackAfter: e.target.value })} placeholder="e.g. brushing teeth" />
          </Field>
        )}
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
  useNewParam(() => setCreating(true))

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
        fab={{ icon: <Plus />, label: 'New habit', onClick: () => setCreating(true) }}
      />
      <Tabs
        value={view}
        onChange={setView}
        className="mb-4"
        options={[
          { value: 'today', label: <TabLabel text="Due today" count={due.length} active={view === 'today'} /> },
          { value: 'all', label: <TabLabel text="All" count={active.length} active={view === 'all'} /> },
        ]}
      />
      {habits === undefined ? null : list.length ? (
        <ul className="flex flex-col gap-0.5 overflow-hidden rounded-lg">
          {list.map((h) => (
            <HabitRow key={h.id} habit={h} logs={logs} onOpen={() => setDetail(h.id)} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Flame />}
          title={active.length ? 'Nothing due today' : 'No habits yet'}
          text={active.length ? 'Enjoy the rest day.' : 'Start small: one glass of water, ten push-ups, five pages.'}
        />
      )}

      {active.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Weekly success</CardTitle>
              <p className="text-body-small text-on-surface-variant">All habits · last 8 weeks</p>
            </div>
          </CardHeader>
          <CardContent className="h-52">
            <WeeklyChart data={overall} color="var(--md-primary)" />
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
