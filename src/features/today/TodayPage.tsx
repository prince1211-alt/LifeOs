import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { AlarmClock, ArrowRight, CheckSquare, Dumbbell, Flame, Moon, Pause, Play, ShieldOff, Star, Timer } from 'lucide-react'
import { useNow, useSettings, useTable, useToday } from '@/lib/hooks'
import type { Task } from '@/lib/types'
import { habitLogId, isDone, isDueOn, computeStreak } from '@/lib/habits'
import { quitStats } from '@/lib/quit'
import { clock, formatDuration, formatTime, parseYmd, rupees } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, ProgressRing } from '@/components/ui/misc'
import { useApp, toast } from '@/store/app'
import { QuickAdd } from '../tasks/QuickAdd'
import { TaskItem } from '../tasks/TaskItem'
import { TaskDialog } from '../tasks/TaskDialog'
import { moveToToday, setPinned, sortTasks } from '../tasks/actions'
import { HabitCheck } from '../habits/HabitCheck'
import { describeRepeat, nextAlarm } from '../alarms/schedule'
import { usePomodoro, PHASE_LABEL } from '../focus/pomodoro'
import { startWorkout } from '../gym/actions'
import { sendSummary } from '../summary/summary'
import { addDays } from 'date-fns'
import { ymd } from '@/lib/utils'

function greeting(h: number) {
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ModuleLink({ to }: { to: string }) {
  return (
    <Link to={to} className="text-muted-foreground hover:text-foreground" aria-label="Open module">
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

export function TodayPage() {
  const now = useNow(1000)
  const today = useToday()
  const settings = useSettings()
  const user = useApp((s) => s.user)
  const nav = useNavigate()
  const tasks = useTable('tasks') ?? []
  const habits = useTable('habits') ?? []
  const logs = useTable('habitLogs') ?? []
  const goals = useTable('quitGoals') ?? []
  const relapses = useTable('relapses') ?? []
  const alarms = useTable('alarms') ?? []
  const workouts = useTable('workouts') ?? []
  const templates = useTable('workoutTemplates') ?? []
  const sessions = useTable('focusSessions') ?? []
  const pomo = usePomodoro()
  const [editing, setEditing] = useState<Task | null>(null)
  const [dismissedCarry, setDismissedCarry] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const open = tasks.filter((t) => t.status === 'open')
  const todayTasks = sortTasks(open.filter((t) => t.dueDate && t.dueDate <= today))
  const mustDo = todayTasks.filter((t) => t.pinned).slice(0, 3)
  const rest = todayTasks.filter((t) => !mustDo.includes(t))
  const doneToday = tasks.filter((t) => t.status === 'done' && t.completedAt && ymd(t.completedAt) === today)
  const yesterday = ymd(addDays(parseYmd(today), -1))
  const unfinishedYesterday = open.filter((t) => t.dueDate === yesterday)

  const dueHabits = habits.filter((h) => isDueOn(h, logs, parseYmd(today), settings.weekStart))
  const habitsDone = dueHabits.filter((h) => isDone(h, logs.find((l) => l.id === habitLogId(h.id, today))))

  const taskTotal = todayTasks.length + doneToday.length
  const progress = taskTotal + dueHabits.length ? (doneToday.length + habitsDone.length) / (taskTotal + dueHabits.length) : 0

  const next = nextAlarm(alarms, now)
  const tpl = templates.find((t) => t.id === settings.gymSchedule[String(new Date(now).getDay())])
  const activeWorkout = workouts.find((w) => !w.endedAt)
  const workoutDone = workouts.find((w) => w.endedAt && ymd(w.startedAt) === today)
  const focusMin = sessions.filter((s) => s.type === 'focus' && ymd(s.startedAt) === today).reduce((a, s) => a + s.durationMin, 0)
  const pomoLeft = pomo.running && pomo.endsAt ? Math.max(0, pomo.endsAt - now) : pomo.remainingMs

  return (
    <div className="grid gap-4">
      {/* Header: date, greeting, progress ring */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{format(now, 'EEEE, d MMMM')}</div>
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {greeting(new Date(now).getHours())}
              {user?.mode === 'google' && user.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="primary">
                <CheckSquare className="h-3 w-3" /> {doneToday.length}/{taskTotal} tasks
              </Badge>
              <Badge variant="success">
                <Flame className="h-3 w-3" /> {habitsDone.length}/{dueHabits.length} habits
              </Badge>
            </div>
          </div>
          <ProgressRing value={progress} size={92} stroke={9}>
            <span className="text-xl font-bold">{Math.round(progress * 100)}%</span>
            <span className="text-[10px] text-muted-foreground">done</span>
          </ProgressRing>
        </div>
      </Card>

      {unfinishedYesterday.length > 0 && dismissedCarry !== today && (
        <Card className="border-warning/50 bg-warning/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <b>{unfinishedYesterday.length}</b> unfinished task{unfinishedYesterday.length > 1 ? 's' : ''} from yesterday. Move to today?
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDismissedCarry(today)}>
                Not now
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await moveToToday(unfinishedYesterday)
                  toast(`Moved ${unfinishedYesterday.length} task(s) to today`)
                }}
              >
                Move to today
              </Button>
            </div>
          </div>
        </Card>
      )}

      <QuickAdd defaultDate={today} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>
              <CheckSquare className="h-4 w-4 text-primary" /> Today's tasks
            </CardTitle>
            <ModuleLink to="/tasks" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {mustDo.length > 0 && (
              <div className="grid gap-1.5">
                <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3 fill-current" /> Must do
                </div>
                {mustDo.map((t) => (
                  <TaskItem key={t.id} task={t} compact onOpen={setEditing} onPin={(x) => setPinned(x, !x.pinned, open)} />
                ))}
              </div>
            )}
            <div className="grid gap-1.5">
              {mustDo.length > 0 && rest.length > 0 && <div className="text-xs font-semibold text-muted-foreground">Also today</div>}
              {rest.slice(0, 8).map((t) => (
                <TaskItem key={t.id} task={t} compact onOpen={setEditing} onPin={(x) => setPinned(x, !x.pinned, open)} />
              ))}
              {rest.length > 8 && (
                <Link to="/tasks" className="text-xs text-primary">
                  +{rest.length - 8} more
                </Link>
              )}
            </div>
            {!todayTasks.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {doneToday.length ? '🎉 All done for today!' : 'No tasks for today. Add one above — star up to 3 as “must do”.'}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          {/* Next alarm */}
          <Card className="cursor-pointer" onClick={() => nav('/alarms')}>
            <CardHeader>
              <CardTitle>
                <AlarmClock className="h-4 w-4 text-primary" /> Next alarm
              </CardTitle>
              <ModuleLink to="/alarms" />
            </CardHeader>
            <CardContent>
              {next ? (
                <div className="flex items-end justify-between">
                  <div>
                    <div className="tabular text-3xl font-bold">{formatTime(next.alarm.time, settings.timeFormat)}</div>
                    <div className="text-xs text-muted-foreground">
                      {next.alarm.label || 'Alarm'} · {describeRepeat(next.alarm.repeatDays)}
                    </div>
                  </div>
                  <Badge variant="primary">in {formatDistanceToNowStrict(next.at)}</Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No alarm set.</p>
              )}
            </CardContent>
          </Card>

          {/* Focus */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Timer className="h-4 w-4 text-primary" /> Focus
              </CardTitle>
              <ModuleLink to="/focus" />
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <div className="tabular text-2xl font-bold">{focusMin} min</div>
                <div className="text-xs text-muted-foreground">focused today</div>
              </div>
              <div className="flex items-center gap-2">
                {(pomo.running || pomo.startedAt) && (
                  <span className="tabular text-sm font-semibold">
                    {PHASE_LABEL[pomo.phase]} {clock(pomoLeft)}
                  </span>
                )}
                {pomo.running ? (
                  <Button size="sm" variant="outline" onClick={pomo.pause}>
                    <Pause /> Pause
                  </Button>
                ) : (
                  <Button size="sm" onClick={pomo.start}>
                    <Play /> {pomo.startedAt ? 'Resume' : 'Start Pomodoro'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Workout */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Dumbbell className="h-4 w-4 text-primary" /> Workout
              </CardTitle>
              <ModuleLink to="/gym" />
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              {activeWorkout ? (
                <>
                  <span className="text-sm">{activeWorkout.name} in progress</span>
                  <Button size="sm" onClick={() => nav(`/gym/workout/${activeWorkout.id}`)}>
                    <Play /> Resume
                  </Button>
                </>
              ) : workoutDone ? (
                <span className="text-sm">✅ {workoutDone.name} done today</span>
              ) : tpl ? (
                <>
                  <span className="text-sm">
                    Scheduled: <b>{tpl.name}</b>
                  </span>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const w = await startWorkout(tpl)
                      nav(`/gym/workout/${w.id}`)
                    }}
                  >
                    <Play /> Start
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Rest day. Set a weekly schedule in Gym.</span>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Habits */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Flame className="h-4 w-4 text-orange-500" /> Habits due today
            </CardTitle>
            <ModuleLink to="/habits" />
          </CardHeader>
          <CardContent className="grid gap-2">
            {dueHabits.map((h) => {
              const log = logs.find((l) => l.id === habitLogId(h.id, today))
              const st = computeStreak(h, logs, parseYmd(today), settings.weekStart)
              return (
                <div key={h.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {h.icon} {h.name}
                    </div>
                    <div className="text-xs text-orange-500">
                      🔥 {st.current} {st.unit === 'weeks' ? 'wk' : 'd'}
                    </div>
                  </div>
                  <HabitCheck habit={h} log={log} date={today} size="sm" />
                </div>
              )
            })}
            {!dueHabits.length && <p className="text-sm text-muted-foreground">No habits due today.</p>}
          </CardContent>
        </Card>

        {/* Quit */}
        <Card className="cursor-pointer" onClick={() => nav('/quit')}>
          <CardHeader>
            <CardTitle>
              <ShieldOff className="h-4 w-4 text-primary" /> Quit counters
            </CardTitle>
            <ModuleLink to="/quit" />
          </CardHeader>
          <CardContent className="grid gap-2">
            {goals.map((g) => {
              const s = quitStats(g, relapses, now)
              return (
                <div key={g.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">No {g.name.toLowerCase()}</span>
                  <span className="tabular text-right">
                    <b>{formatDuration(s.elapsed)}</b>
                    {g.costPerDay > 0 && <span className="block text-xs text-muted-foreground">{rupees(s.moneySaved)} saved</span>}
                  </span>
                </div>
              )
            })}
            {!goals.length && <p className="text-sm text-muted-foreground">No quit goals yet.</p>}
          </CardContent>
        </Card>
      </div>

      {user?.mode === 'google' && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={sending}
            onClick={async () => {
              setSending(true)
              try {
                await sendSummary('night')
                toast('Night report sent to your inbox ✉️')
              } catch (e) {
                toast(`Could not send: ${e instanceof Error ? e.message : e}`)
              } finally {
                setSending(false)
              }
            }}
          >
            <Moon /> {sending ? 'Sending…' : 'Send night report'}
          </Button>
        </div>
      )}

      <TaskDialog open={Boolean(editing)} task={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
