import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek, endOfMonth } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckSquare, ChevronLeft, ChevronRight, Dumbbell, Flame, Plus, ShieldOff, Timer } from '@/components/icons'
import { useNow, useSettings, useTable } from '@/lib/hooks'
import { habitLogId, isDone, isDueOn } from '@/lib/habits'
import { bestStreakMs, quitStats } from '@/lib/quit'
import { workoutVolume } from '@/lib/gym'
import { formatDuration, ymd } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/form'
import { Divider, EmptyState, PageHeader, Progress, SectionTitle, Stat } from '@/components/ui/misc'

const tooltipStyle = {
  background: 'var(--md-surface-container-high)',
  border: 'none',
  borderRadius: 8,
  color: 'var(--md-on-surface)',
  fontSize: 12,
  boxShadow: 'var(--md-elevation-2)',
}
const tooltipProps = {
  contentStyle: tooltipStyle,
  labelStyle: { color: 'var(--md-on-surface)', fontWeight: 500 },
  itemStyle: { color: 'var(--md-on-surface-variant)' },
  cursor: { fill: 'var(--md-on-surface)', fillOpacity: 0.08 },
}
const axis = {
  tick: { fontSize: 11, fill: 'var(--md-on-surface-variant)' },
  stroke: 'var(--md-outline-variant)',
  tickLine: false,
}
const yAxis = { ...axis, axisLine: false }
const grid = <CartesianGrid stroke="var(--md-outline-variant)" vertical={false} />

function ChartCard({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span style={{ color }}>{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-56 pl-1">{children}</CardContent>
    </Card>
  )
}

export function StatsPage() {
  const settings = useSettings()
  const nav = useNavigate()
  const now = useNow(60_000)
  const [range, setRange] = useState<'week' | 'month'>('week')
  const [offset, setOffset] = useState(0)
  const tasks = useTable('tasks') ?? []
  const habits = useTable('habits') ?? []
  const logs = useTable('habitLogs') ?? []
  const goals = useTable('quitGoals') ?? []
  const relapses = useTable('relapses') ?? []
  const workouts = useTable('workouts') ?? []
  const sessions = useTable('focusSessions') ?? []

  const { from, to } = useMemo(() => {
    const base = new Date()
    if (range === 'week') {
      const f = addDays(startOfWeek(base, { weekStartsOn: settings.weekStart }), offset * 7)
      return { from: f, to: addDays(f, 6) }
    }
    const m = new Date(base.getFullYear(), base.getMonth() + offset, 1)
    return { from: startOfMonth(m), to: endOfMonth(m) }
  }, [range, offset, settings.weekStart])

  const days = Array.from({ length: differenceInCalendarDays(to, from) + 1 }, (_, i) => addDays(from, i))
  const todayKey = ymd(now)
  const label = (d: Date) => (range === 'week' ? format(d, 'EEE') : format(d, 'd'))
  const period =
    range === 'week'
      ? `${format(from, from.getMonth() === to.getMonth() ? 'd' : 'd MMM')} – ${format(to, from.getFullYear() === new Date(now).getFullYear() ? 'd MMM' : 'd MMM yyyy')}`
      : format(from, from.getFullYear() === new Date(now).getFullYear() ? 'MMMM' : 'MMMM yyyy')

  const daily = days.map((d) => {
    const key = ymd(d)
    const future = key > todayKey
    const completed = tasks.filter((t) => t.status === 'done' && t.completedAt && ymd(t.completedAt) === key).length
    const due = habits.filter((h) => !h.archived && h.createdAt <= d.getTime() + 86_400_000 && isDueOn(h, logs, d, settings.weekStart))
    const done = due.filter((h) => isDone(h, logs.find((l) => l.id === habitLogId(h.id, key)))).length
    const focus = sessions.filter((s) => s.type === 'focus' && ymd(s.startedAt) === key).reduce((a, s) => a + s.durationMin, 0)
    const dayWorkouts = workouts.filter((w) => w.endedAt && ymd(w.startedAt) === key)
    return {
      label: label(d),
      completed,
      habitPct: future || !due.length ? null : Math.round((done / due.length) * 100),
      focusMin: Math.round(focus),
      focusH: Math.round((focus / 60) * 10) / 10,
      volume: Math.round(dayWorkouts.reduce((a, w) => a + workoutVolume(w), 0)),
      workouts: dayWorkouts.length,
    }
  })

  const totals = {
    completed: daily.reduce((a, d) => a + d.completed, 0),
    habit: (() => {
      const v = daily.filter((d) => d.habitPct != null)
      return v.length ? Math.round(v.reduce((a, d) => a + d.habitPct!, 0) / v.length) : null
    })(),
    focusH: Math.round(daily.reduce((a, d) => a + d.focusH, 0) * 10) / 10,
    workouts: daily.reduce((a, d) => a + d.workouts, 0),
  }
  // Short sessions read better in minutes; switch to whole-hour ticks once a day passes two hours.
  const focusInHours = daily.some((d) => d.focusMin >= 120)

  return (
    <div>
      <PageHeader title="Stats & insights" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          className="w-full sm:w-auto"
          value={range}
          onChange={(r) => {
            setRange(r)
            setOffset(0)
          }}
          options={[
            { value: 'week', label: 'Weekly' },
            { value: 'month', label: 'Monthly' },
          ]}
        />
        <div className="flex items-center justify-between gap-1 sm:justify-end">
          <IconButton label="Previous" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft />
          </IconButton>
          <span className="tabular min-w-36 text-center text-title-medium text-on-surface" aria-live="polite">
            {period}
          </span>
          <IconButton label="Next" onClick={() => setOffset(offset + 1)} disabled={offset >= 0}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tasks completed" value={totals.completed} />
        <Stat label="Habit success" value={totals.habit == null ? '—' : `${totals.habit}%`} />
        <Stat label="Workouts" value={totals.workouts} />
        <Stat label="Focus hours" value={totals.focusH} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <ChartCard title="Tasks completed" icon={<CheckSquare />} color="var(--md-primary)">
          <ResponsiveContainer>
            <BarChart data={daily}>
              {grid}
              <XAxis dataKey="label" {...axis} />
              <YAxis allowDecimals={false} width={28} {...yAxis} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="completed" name="Completed" fill="var(--md-primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Habit success" icon={<Flame />} color="var(--md-tertiary)">
          <ResponsiveContainer>
            <LineChart data={daily}>
              {grid}
              <XAxis dataKey="label" {...axis} />
              <YAxis domain={[0, 100]} width={32} {...yAxis} />
              <Tooltip {...tooltipProps} cursor={{ stroke: 'var(--md-outline)' }} formatter={(v) => `${v}%`} />
              <Line
                type="monotone"
                dataKey="habitPct"
                name="Success"
                stroke="var(--md-tertiary)"
                strokeWidth={3}
                connectNulls
                dot={range === 'week' ? { r: 3, fill: 'var(--md-tertiary)', strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: 'var(--md-tertiary)', stroke: 'var(--md-surface-container-low)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Gym volume (kg)" icon={<Dumbbell />} color="var(--md-secondary)">
          <ResponsiveContainer>
            <BarChart data={daily}>
              {grid}
              <XAxis dataKey="label" {...axis} />
              <YAxis width={40} {...yAxis} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="volume" name="Volume (kg)" fill="var(--md-secondary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={focusInHours ? 'Focus hours' : 'Focus minutes'} icon={<Timer />} color="var(--md-primary)">
          <ResponsiveContainer>
            <BarChart data={daily}>
              {grid}
              <XAxis dataKey="label" {...axis} />
              <YAxis allowDecimals={false} width={32} {...yAxis} />
              <Tooltip {...tooltipProps} />
              <Bar
                dataKey={focusInHours ? 'focusH' : 'focusMin'}
                name={focusInHours ? 'Hours' : 'Minutes'}
                fill="var(--md-primary)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <SectionTitle className="mt-6">Quit streaks</SectionTitle>
      <div className="overflow-hidden rounded-lg bg-surface-container-low">
        {goals.map((g, i) => {
          const s = quitStats(g, relapses, now)
          const best = bestStreakMs(g, relapses, now)
          return (
            <div key={g.id}>
              {i > 0 && <Divider inset />}
              <div className="flex items-start gap-4 px-4 py-3">
                <ShieldOff className="mt-0.5 size-6 text-on-surface-variant" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-body-large text-on-surface">No {g.name.toLowerCase()}</span>
                    <span className="tabular text-body-medium text-on-surface-variant">{formatDuration(s.elapsed)}</span>
                  </div>
                  <Progress className="mt-2.5" value={s.nextProgress} />
                  <p className="tabular mt-1.5 text-body-small text-on-surface-variant">
                    {s.next ? `Next: ${s.next.label}` : 'All milestones reached'} · Best {formatDuration(best)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        {!goals.length && (
          <EmptyState
            className="py-8"
            icon={<ShieldOff />}
            title="No quit goals yet"
            text="Clean-time streaks show up here once you start quitting something."
            action={
              <Button variant="secondary" onClick={() => nav('/quit?new=1')}>
                <Plus /> New quit goal
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
