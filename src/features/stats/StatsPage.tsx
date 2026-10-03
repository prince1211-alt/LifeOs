import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek, endOfMonth } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckSquare, ChevronLeft, ChevronRight, Dumbbell, Flame, ShieldOff, Timer } from 'lucide-react'
import { useNow, useSettings, useTable } from '@/lib/hooks'
import { habitLogId, isDone, isDueOn } from '@/lib/habits'
import { bestStreakMs, quitStats } from '@/lib/quit'
import { workoutVolume } from '@/lib/gym'
import { formatDuration, ymd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/form'
import { PageHeader, Stat } from '@/components/ui/misc'

const chartStyle = { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }
const axis = { tick: { fontSize: 10 }, stroke: 'var(--muted-foreground)' }

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-52">{children}</CardContent>
    </Card>
  )
}

export function StatsPage() {
  const settings = useSettings()
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

  return (
    <div>
      <PageHeader title="Stats & insights" subtitle={`${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
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
        <Button size="icon" variant="ghost" onClick={() => setOffset(offset - 1)} aria-label="Previous">
          <ChevronLeft />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next">
          <ChevronRight />
        </Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Tasks completed" value={totals.completed} />
        <Stat label="Habit success" value={totals.habit == null ? '—' : `${totals.habit}%`} />
        <Stat label="Workouts" value={totals.workouts} />
        <Stat label="Focus hours" value={totals.focusH} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Tasks completed" icon={<CheckSquare className="h-4 w-4 text-primary" />}>
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis allowDecimals={false} width={24} {...axis} />
              <Tooltip contentStyle={chartStyle} />
              <Bar dataKey="completed" name="Completed" fill="var(--primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Habit success %" icon={<Flame className="h-4 w-4 text-orange-500" />}>
          <ResponsiveContainer>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis domain={[0, 100]} width={28} {...axis} />
              <Tooltip contentStyle={chartStyle} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="habitPct" name="Success" stroke="#f97316" strokeWidth={2} connectNulls dot={range === 'week'} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Gym volume (kg)" icon={<Dumbbell className="h-4 w-4 text-primary" />}>
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis width={36} {...axis} />
              <Tooltip contentStyle={chartStyle} />
              <Bar dataKey="volume" name="Volume (kg)" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Focus hours" icon={<Timer className="h-4 w-4 text-primary" />}>
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis width={24} {...axis} />
              <Tooltip contentStyle={chartStyle} />
              <Bar dataKey="focusH" name="Hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            <ShieldOff className="h-4 w-4 text-primary" /> Quit streaks
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {goals.map((g) => {
            const s = quitStats(g, relapses, now)
            const best = bestStreakMs(g, relapses, now)
            const max = Math.max(best, 1)
            return (
              <div key={g.id} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">No {g.name.toLowerCase()}</span>
                  <span className="text-muted-foreground">
                    now {formatDuration(s.elapsed)} · best {formatDuration(best)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(s.elapsed / max) * 100}%` }} />
                </div>
              </div>
            )
          })}
          {!goals.length && <p className="text-sm text-muted-foreground">No quit goals yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
