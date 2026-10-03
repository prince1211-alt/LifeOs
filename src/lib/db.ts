import Dexie, { type EntityTable } from 'dexie'
import type {
  Alarm,
  BodyLog,
  Exercise,
  FocusSession,
  Habit,
  HabitLog,
  QuitGoal,
  Relapse,
  Settings,
  Task,
  TimeBlock,
  UrgeLog,
  Workout,
  WorkoutTemplate,
} from './types'
import { SEED_EXERCISES, SEED_TEMPLATES, DEFAULT_SETTINGS } from './seed'

export interface KV {
  key: string
  value: unknown
}

export class LifeDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  alarms!: EntityTable<Alarm, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  quitGoals!: EntityTable<QuitGoal, 'id'>
  relapses!: EntityTable<Relapse, 'id'>
  urgeLogs!: EntityTable<UrgeLog, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  bodyLogs!: EntityTable<BodyLog, 'id'>
  focusSessions!: EntityTable<FocusSession, 'id'>
  timeBlocks!: EntityTable<TimeBlock, 'id'>
  settings!: EntityTable<Settings, 'id'>
  kv!: EntityTable<KV, 'key'>

  constructor(name = 'lifeos') {
    super(name)
    this.version(1).stores({
      tasks: 'id, updatedAt, dueDate, status, completedAt',
      alarms: 'id, updatedAt',
      habits: 'id, updatedAt',
      habitLogs: 'id, updatedAt, habitId, date',
      quitGoals: 'id, updatedAt',
      relapses: 'id, updatedAt, quitGoalId, at',
      urgeLogs: 'id, updatedAt, quitGoalId, at',
      exercises: 'id, updatedAt, muscleGroup',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, updatedAt, startedAt',
      bodyLogs: 'id, updatedAt, date',
      focusSessions: 'id, updatedAt, startedAt',
      timeBlocks: 'id, updatedAt, date',
      settings: 'id',
      kv: 'key',
    })
  }
}

export const db = new LifeDB()

/**
 * Add the preloaded exercises, templates and default settings if missing.
 * Seeds use fixed ids and updatedAt 0, so any synced copy always wins and
 * two devices never create duplicates.
 */
export async function ensureSeed(target: LifeDB = db) {
  await target.transaction('rw', target.exercises, target.workoutTemplates, target.settings, async () => {
    const haveEx = new Set(await target.exercises.toCollection().primaryKeys())
    const ex = SEED_EXERCISES.filter((e) => !haveEx.has(e.id))
    if (ex.length) await target.exercises.bulkAdd(ex)
    const haveTpl = new Set(await target.workoutTemplates.toCollection().primaryKeys())
    const tpl = SEED_TEMPLATES.filter((t) => !haveTpl.has(t.id))
    if (tpl.length) await target.workoutTemplates.bulkAdd(tpl)
    if (!(await target.settings.get('settings'))) await target.settings.add({ ...DEFAULT_SETTINGS })
  })
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key)
  return row ? (row.value as T) : fallback
}

export async function kvSet(key: string, value: unknown) {
  await db.kv.put({ key, value })
}
