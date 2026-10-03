// Data model from docs/SPEC.md. Every record carries sync fields.
export interface SyncFields {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export type Priority = 1 | 2 | 3 | 4

export type RecurrenceKind = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'

export interface Recurrence {
  kind: RecurrenceKind
  /** custom: repeat every N days (when no days chosen) */
  interval?: number
  /** weekly/custom: weekdays 0 (Sun) – 6 (Sat) */
  days?: number[]
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task extends SyncFields {
  title: string
  notes: string
  dueDate: string | null // YYYY-MM-DD
  dueTime: string | null // HH:mm
  priority: Priority
  tags: string[]
  subtasks: Subtask[]
  recurrence: Recurrence
  status: 'open' | 'done'
  completedAt: number | null
  reminderMinutesBefore: number | null
  pinned?: boolean
  order?: number
  seriesId?: string | null
  source?: { kind: 'gmail'; messageId: string } | null
}

export interface Alarm extends SyncFields {
  time: string // HH:mm
  label: string
  repeatDays: number[] // empty = one-off
  sound: string
  volume: number // 0–1
  enabled: boolean
  snoozeMinutes: number
  linkedTaskId?: string | null
  /** Later: maths challenge to dismiss */
  challenge?: boolean
  /** Later: fade volume in over 30s */
  gradual?: boolean
  calendarEventId?: string | null
}

export type HabitScheduleKind = 'daily' | 'days' | 'weekly'

export interface Habit extends SyncFields {
  name: string
  icon: string
  color: string
  type: 'check' | 'count'
  target: number
  schedule: { kind: HabitScheduleKind; days: number[]; timesPerWeek: number }
  reminderTime: string | null
  /** Later: habit stacking cue, e.g. "brushing teeth" */
  stackAfter?: string
  stackAfterHabitId?: string | null
  archived?: boolean
}

export interface HabitLog extends SyncFields {
  habitId: string
  date: string // YYYY-MM-DD
  value: number
  /** Later: a skipped/frozen day keeps the streak alive */
  skipped?: boolean
}

export interface QuitGoal extends SyncFields {
  name: string
  startDate: number // epoch ms
  costPerDay: number // ₹
  minutesPerDay: number
  reason: string
  replacementHabitId?: string | null
}

export interface Relapse extends SyncFields {
  quitGoalId: string
  at: number
  note: string
}

export interface UrgeLog extends SyncFields {
  quitGoalId: string
  at: number
  trigger: string
  intensity: number // 1–5
  action: string
}

export interface Exercise extends SyncFields {
  name: string
  muscleGroup: string
  equipment: string
  isCustom: boolean
}

export interface WorkoutTemplate extends SyncFields {
  name: string
  exercises: { exerciseId: string; sets: number; reps: number }[]
}

export interface WorkoutSet {
  reps: number
  weightKg: number
  done: boolean
}

export interface Workout extends SyncFields {
  templateId?: string | null
  name: string
  startedAt: number
  endedAt: number | null
  entries: { exerciseId: string; sets: WorkoutSet[] }[]
  notes: string
}

export interface BodyLog extends SyncFields {
  date: string
  weightKg: number | null
  measurements: Record<string, number>
}

export interface FocusSession extends SyncFields {
  taskId?: string | null
  category: string
  startedAt: number
  durationMin: number
  type: 'focus' | 'break'
  manual?: boolean
}

export interface TimeBlock extends SyncFields {
  date: string
  start: string // HH:mm
  end: string // HH:mm
  title: string
  taskId?: string | null
  category: string
  calendarEventId?: string | null
}

export interface Settings extends SyncFields {
  theme: 'light' | 'dark' | 'system'
  weekStart: 0 | 1
  timeFormat: '12' | '24'
  pomodoro: { focus: number; short: number; long: number; longEvery: number }
  defaultSound: string
  restSeconds: number
  summaryEmail: { enabled: boolean; time: string; lastMorningDate: string | null }
  calendarMirror: boolean
  keepAwake: boolean
  /** weekday (0–6) → workout template id */
  gymSchedule: Record<string, string>
  categories: string[]
  onboardedAt: number | null
}

export interface EntityMap {
  tasks: Task
  alarms: Alarm
  habits: Habit
  habitLogs: HabitLog
  quitGoals: QuitGoal
  relapses: Relapse
  urgeLogs: UrgeLog
  exercises: Exercise
  workoutTemplates: WorkoutTemplate
  workouts: Workout
  bodyLogs: BodyLog
  focusSessions: FocusSession
  timeBlocks: TimeBlock
  settings: Settings
}

export type TableName = keyof EntityMap

export type ModuleName = 'settings' | 'tasks' | 'alarms' | 'habits' | 'quit' | 'gym' | 'time'

/** Which Drive file each table lives in. */
export const MODULE_TABLES: Record<ModuleName, TableName[]> = {
  settings: ['settings'],
  tasks: ['tasks'],
  alarms: ['alarms'],
  habits: ['habits', 'habitLogs'],
  quit: ['quitGoals', 'relapses', 'urgeLogs'],
  gym: ['exercises', 'workoutTemplates', 'workouts', 'bodyLogs'],
  time: ['focusSessions', 'timeBlocks'],
}

export const MODULES = Object.keys(MODULE_TABLES) as ModuleName[]

export const TABLE_MODULE = Object.fromEntries(
  MODULES.flatMap((m) => MODULE_TABLES[m].map((t) => [t, m])),
) as Record<TableName, ModuleName>
