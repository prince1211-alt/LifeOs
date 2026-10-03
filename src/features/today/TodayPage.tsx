import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, format, formatDistanceToNowStrict } from 'date-fns'
import {
  AddTask,
  AlarmClock,
  Celebration,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Dumbbell,
  EventRepeat,
  Flame,
  Moon,
  Pause,
  Play,
  Plus,
  ShieldOff,
  Spa,
  Star,
  Timer,
} from '@/components/icons'
import { useMediaQuery, useNewParam, useNow, useSettings, useTable, useToday } from '@/lib/hooks'
import type { Habit, HabitLog, Task } from '@/lib/types'
import { habitLogId, isDone, isDueOn, computeStreak, type Streak } from '@/lib/habits'
import { quitStats } from '@/lib/quit'
import { clock, cn, formatDuration, formatTime, parseYmd, rupees, ymd } from '@/lib/utils'
import { Button, buttonVariants, Fab, IconButton } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, EmptyState, Progress, ProgressRing } from '@/components/ui/misc'
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

function greeting(h: number) {
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function streakLabel({ current, unit }: Streak) {
  if (!current) return 'No streak yet'
  return `${current}-${unit === 'weeks' ? 'week' : 'day'} streak`
}

/** Card header: icon + title-medium title, trailing chevron to open the module. */
function ModuleHeader({ icon, title, module, to }: { icon: ReactNode; title: string; module: string; to: string }) {
  const nav = useNavigate()
  return (
    <CardHeader className="min-h-14 py-2 pr-2">
      <CardTitle>
        <span className="flex text-primary">{icon}</span>
        {title}
      </CardTitle>
      <IconButton
        label={`Open ${module}`}
        onClick={(e) => {
          e.stopPropagation()
          nav(to)
        }}
      >
        <ChevronRight />
      </IconButton>
    </CardHeader>
  )
}

/** Summary chip on the tonal hero. */
function HeroChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="tabular inline-flex h-8 items-center gap-1.5 rounded-sm bg-on-primary-container/10 px-3 text-label-large [&_svg]:size-[18px]">
      {icon}
      {children}
    </span>
  )
}

/** Group of task rows inside the tasks card (Google Tasks style list). */
function TaskGroup({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div>
      {label && <h4 className="flex items-center gap-1.5 px-2 pt-1 pb-2 text-title-small text-primary [&_svg]:size-[18px]">{label}</h4>}
      <div className="flex flex-col gap-0.5 overflow-hidden rounded-md">{children}</div>
    </div>
  )
}

/** Compact habit check-in row: tinted emoji avatar, name, streak, round check button. */
function HabitRow({ habit, log, date, streak }: { habit: Habit; log?: HabitLog; date: string; streak: Streak }) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-2 py-1.5">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ background: `color-mix(in srgb, ${habit.color} 18%, transparent)` }}
        aria-hidden
      >
        {habit.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-large text-on-surface">{habit.name}</p>
        <p className="flex items-center gap-1 text-body-small text-on-surface-variant">
          <Flame filled={streak.current > 0} className="size-3.5" style={{ color: habit.color }} />
          {streakLabel(streak)}
        </p>
      </div>
      <HabitCheck habit={habit} log={log} date={date} size="sm" />
    </li>
  )
}

/** Alarm time in Google Clock style: big digits, smaller am/pm. */
function AlarmTime({ text }: { text: string }) {
  const [digits, suffix] = text.split(' ')
  return (
    <p className="tabular text-display-small text-on-surface">
      {digits}
      {suffix && <span className="ml-1 text-title-large text-on-surface-variant">{suffix}</span>}
    </p>
  )
}

/** One-line status row used inside module cards: tonal icon disc, headline, supporting text, action. */
function StatusRow({
  icon,
  tone = 'secondary',
  headline,
  supporting,
  action,
}: {
  icon: ReactNode
  tone?: 'secondary' | 'success'
  headline: ReactNode
  supporting?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
          tone === 'success' ? 'bg-success-container text-on-success-container' : 'bg-secondary-container text-on-secondary-container',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-large text-on-surface">{headline}</p>
        {supporting && <p className="text-body-medium text-on-surface-variant">{supporting}</p>}
      </div>
      {action}
    </div>
  )
}

export function TodayPage() {
  const now = useNow(1000)
  const today = useToday()
  const settings = useSettings()
  const user = useApp((s) => s.user)
  const nav = useNavigate()
  const wide = useMediaQuery('(min-width: 768px)')
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
  const [creating, setCreating] = useState(false)
  const [dismissedCarry, setDismissedCarry] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  useNewParam(() => setCreating(true))

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
  const pomoActive = pomo.running || Boolean(pomo.startedAt)

  const pin = (t: Task) => setPinned(t, !t.pinned, open)
  const newTaskFab = { icon: <Plus />, label: 'New task', onClick: () => setCreating(true) }

  return (
    <div className="grid gap-4">
      {/* Hero: date, greeting, progress ring */}
      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 rounded-xl bg-primary-container p-5 text-on-primary-container sm:p-6 md:gap-x-8 md:p-8">
        <div className="min-w-0 sm:self-end">
          <p className="text-title-small opacity-80">{format(now, 'EEEE, d MMMM')}</p>
          <h1 className="mt-1 text-headline-small break-words md:text-headline-large">
            {greeting(new Date(now).getHours())}
            {user?.mode === 'google' && user.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div className="flex sm:row-span-2">
          <ProgressRing
            value={progress}
            size={wide ? 128 : 96}
            stroke={wide ? 12 : 9}
            track="color-mix(in srgb, var(--md-on-primary-container) 14%, transparent)"
          >
            <span className="tabular text-title-large md:text-headline-medium">{Math.round(progress * 100)}%</span>
            <span className="text-label-small opacity-80">done</span>
          </ProgressRing>
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:self-start">
          <HeroChip icon={<CheckSquare />}>
            {doneToday.length}/{taskTotal} tasks
          </HeroChip>
          <HeroChip icon={<Flame />}>
            {habitsDone.length}/{dueHabits.length} habits
          </HeroChip>
        </div>
      </section>

      {/* Banner: carry over yesterday's unfinished tasks */}
      {unfinishedYesterday.length > 0 && dismissedCarry !== today && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface-container-high py-3 pr-2 pl-4">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container [&_svg]:size-5">
              <EventRepeat />
            </span>
            <p className="text-body-medium text-on-surface">
              {unfinishedYesterday.length} unfinished task{unfinishedYesterday.length > 1 ? 's' : ''} from yesterday. Move to today?
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => setDismissedCarry(today)}>
              Not now
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await moveToToday(unfinishedYesterday)
                toast(`Moved ${unfinishedYesterday.length} task(s) to today`)
              }}
            >
              Move to today
            </Button>
          </div>
        </div>
      )}

      {/* Quick add (search-bar pill) with the primary action beside it on desktop */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <QuickAdd defaultDate={today} />
        </div>
        <Fab {...newTaskFab} className="hidden shrink-0 shadow-elevation-1 hover:shadow-elevation-2 md:inline-flex" />
      </div>
      <Fab {...newTaskFab} fixed />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid gap-4">
          {/* Tasks */}
          <Card>
            <ModuleHeader icon={<CheckSquare />} title="Today's tasks" module="tasks" to="/tasks" />
            <CardContent className="grid gap-3 px-2 pb-2">
              {mustDo.length > 0 && (
                <TaskGroup
                  label={
                    <>
                      <Star filled /> Must do
                    </>
                  }
                >
                  {mustDo.map((t) => (
                    <TaskItem key={t.id} task={t} compact onOpen={setEditing} onPin={pin} />
                  ))}
                </TaskGroup>
              )}
              {rest.length > 0 && (
                <TaskGroup label={mustDo.length > 0 ? 'Also today' : undefined}>
                  {rest.slice(0, 8).map((t) => (
                    <TaskItem key={t.id} task={t} compact onOpen={setEditing} onPin={pin} />
                  ))}
                </TaskGroup>
              )}
              {rest.length > 8 && (
                <Link to="/tasks" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'justify-self-start')}>
                  +{rest.length - 8} more
                </Link>
              )}
              {!todayTasks.length &&
                (doneToday.length ? (
                  <EmptyState icon={<Celebration />} title="All done for today" text="Nice work. Enjoy the rest of your day." className="py-8" />
                ) : (
                  <EmptyState
                    icon={<AddTask />}
                    title="No tasks for today"
                    text="Add one above. Star up to 3 as “must do”."
                    className="py-8"
                  />
                ))}
            </CardContent>
          </Card>

          {/* Habits */}
          <Card>
            <ModuleHeader icon={<Flame />} title="Habits due today" module="habits" to="/habits" />
            <CardContent className="px-2 pb-2">
              {dueHabits.length ? (
                <ul className="flex flex-col gap-0.5">
                  {dueHabits.map((h) => (
                    <HabitRow
                      key={h.id}
                      habit={h}
                      log={logs.find((l) => l.id === habitLogId(h.id, today))}
                      date={today}
                      streak={computeStreak(h, logs, parseYmd(today), settings.weekStart)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-2 pb-2 text-body-medium text-on-surface-variant">No habits due today.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {/* Next alarm */}
          <Card className="state-layer cursor-pointer" onClick={() => nav('/alarms')}>
            <ModuleHeader icon={<AlarmClock />} title="Next alarm" module="alarms" to="/alarms" />
            <CardContent>
              {next ? (
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <AlarmTime text={formatTime(next.alarm.time, settings.timeFormat)} />
                    <p className="truncate text-body-medium text-on-surface-variant">
                      {next.alarm.label || 'Alarm'} · {describeRepeat(next.alarm.repeatDays)}
                    </p>
                  </div>
                  <Badge variant="secondary">in {formatDistanceToNowStrict(next.at)}</Badge>
                </div>
              ) : (
                <p className="text-body-medium text-on-surface-variant">No alarm set.</p>
              )}
            </CardContent>
          </Card>

          {/* Focus */}
          <Card>
            <ModuleHeader icon={<Timer />} title="Focus" module="focus" to="/focus" />
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                {pomoActive ? (
                  <>
                    <p className="tabular text-display-small text-on-surface">{clock(pomoLeft)}</p>
                    <p className="text-body-medium text-on-surface-variant">
                      {PHASE_LABEL[pomo.phase]} · {focusMin} min today
                    </p>
                  </>
                ) : (
                  <>
                    <p className="tabular text-display-small text-on-surface">
                      {focusMin}
                      <span className="ml-1 text-title-large text-on-surface-variant">min</span>
                    </p>
                    <p className="text-body-medium text-on-surface-variant">focused today</p>
                  </>
                )}
              </div>
              {pomo.running ? (
                <Button variant="outline" onClick={pomo.pause}>
                  <Pause /> Pause
                </Button>
              ) : (
                <Button variant="secondary" onClick={pomo.start}>
                  <Play /> {pomo.startedAt ? 'Resume' : 'Start'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Workout */}
          <Card>
            <ModuleHeader icon={<Dumbbell />} title="Workout" module="gym" to="/gym" />
            <CardContent>
              {activeWorkout ? (
                <StatusRow
                  icon={<Dumbbell />}
                  headline={activeWorkout.name}
                  supporting="In progress"
                  action={
                    <Button variant="secondary" onClick={() => nav(`/gym/workout/${activeWorkout.id}`)}>
                      <Play /> Resume
                    </Button>
                  }
                />
              ) : workoutDone ? (
                <StatusRow icon={<CheckCircle filled />} tone="success" headline={workoutDone.name} supporting="Done today" />
              ) : tpl ? (
                <StatusRow
                  icon={<Dumbbell />}
                  headline={tpl.name}
                  supporting="Scheduled for today"
                  action={
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        const w = await startWorkout(tpl)
                        nav(`/gym/workout/${w.id}`)
                      }}
                    >
                      <Play /> Start
                    </Button>
                  }
                />
              ) : (
                <StatusRow icon={<Spa />} headline="Rest day" supporting="Set a weekly schedule in Gym." />
              )}
            </CardContent>
          </Card>

          {/* Quit */}
          <Card className="state-layer cursor-pointer" onClick={() => nav('/quit')}>
            <ModuleHeader icon={<ShieldOff />} title="Quit counters" module="quit" to="/quit" />
            <CardContent className="@container">
              {goals.length ? (
                <div className="grid gap-2 @sm:grid-cols-2">
                  {goals.map((g) => {
                    const s = quitStats(g, relapses, now)
                    return (
                      <div key={g.id} className="min-w-0 rounded-md bg-surface-container p-4">
                        <p className="truncate text-label-large text-on-surface-variant">No {g.name.toLowerCase()}</p>
                        <p className="tabular mt-1 text-headline-small text-on-surface">{formatDuration(s.elapsed)}</p>
                        <Progress value={s.nextProgress} className="mt-3" />
                        <p className="mt-2 text-body-small text-on-surface-variant">
                          {[g.costPerDay > 0 ? `${rupees(s.moneySaved)} saved` : null, s.next ? `Next: ${s.next.label}` : 'All milestones reached']
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-body-medium text-on-surface-variant">No quit goals yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {user?.mode === 'google' && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
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
      <TaskDialog open={creating} task={null} defaults={{ dueDate: today }} onClose={() => setCreating(false)} />
    </div>
  )
}
