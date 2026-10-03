import type { Exercise, Settings, WorkoutTemplate } from './types'

const EXERCISES: [string, string, string][] = [
  // [name, muscleGroup, equipment]
  ['Bench Press', 'Chest', 'Barbell'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbell'],
  ['Dumbbell Fly', 'Chest', 'Dumbbell'],
  ['Push-up', 'Chest', 'Bodyweight'],
  ['Cable Crossover', 'Chest', 'Cable'],
  ['Deadlift', 'Back', 'Barbell'],
  ['Pull-up', 'Back', 'Bodyweight'],
  ['Barbell Row', 'Back', 'Barbell'],
  ['Lat Pulldown', 'Back', 'Cable'],
  ['Seated Cable Row', 'Back', 'Cable'],
  ['One-arm Dumbbell Row', 'Back', 'Dumbbell'],
  ['Overhead Press', 'Shoulders', 'Barbell'],
  ['Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell'],
  ['Lateral Raise', 'Shoulders', 'Dumbbell'],
  ['Face Pull', 'Shoulders', 'Cable'],
  ['Rear Delt Fly', 'Shoulders', 'Dumbbell'],
  ['Barbell Curl', 'Arms', 'Barbell'],
  ['Dumbbell Curl', 'Arms', 'Dumbbell'],
  ['Hammer Curl', 'Arms', 'Dumbbell'],
  ['Tricep Pushdown', 'Arms', 'Cable'],
  ['Skull Crusher', 'Arms', 'Barbell'],
  ['Dips', 'Arms', 'Bodyweight'],
  ['Squat', 'Legs', 'Barbell'],
  ['Leg Press', 'Legs', 'Machine'],
  ['Romanian Deadlift', 'Legs', 'Barbell'],
  ['Lunge', 'Legs', 'Dumbbell'],
  ['Leg Extension', 'Legs', 'Machine'],
  ['Leg Curl', 'Legs', 'Machine'],
  ['Calf Raise', 'Legs', 'Machine'],
  ['Hip Thrust', 'Legs', 'Barbell'],
  ['Plank', 'Core', 'Bodyweight'],
  ['Crunch', 'Core', 'Bodyweight'],
  ['Hanging Leg Raise', 'Core', 'Bodyweight'],
  ['Russian Twist', 'Core', 'Bodyweight'],
  ['Running', 'Cardio', 'None'],
  ['Cycling', 'Cardio', 'Machine'],
  ['Rowing Machine', 'Cardio', 'Machine'],
  ['Jump Rope', 'Cardio', 'None'],
]

export const exId = (name: string) => 'ex-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')

export const SEED_EXERCISES: Exercise[] = EXERCISES.map(([name, muscleGroup, equipment]) => ({
  id: exId(name),
  name,
  muscleGroup,
  equipment,
  isCustom: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
}))

const tpl = (id: string, name: string, items: [string, number, number][]): WorkoutTemplate => ({
  id,
  name,
  exercises: items.map(([n, sets, reps]) => ({ exerciseId: exId(n), sets, reps })),
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
})

export const SEED_TEMPLATES: WorkoutTemplate[] = [
  tpl('tpl-push', 'Push', [
    ['Bench Press', 4, 8],
    ['Overhead Press', 3, 8],
    ['Incline Dumbbell Press', 3, 10],
    ['Lateral Raise', 3, 15],
    ['Tricep Pushdown', 3, 12],
  ]),
  tpl('tpl-pull', 'Pull', [
    ['Deadlift', 3, 5],
    ['Pull-up', 3, 8],
    ['Barbell Row', 3, 10],
    ['Face Pull', 3, 15],
    ['Barbell Curl', 3, 12],
  ]),
  tpl('tpl-legs', 'Legs', [
    ['Squat', 4, 8],
    ['Romanian Deadlift', 3, 10],
    ['Leg Press', 3, 12],
    ['Leg Curl', 3, 12],
    ['Calf Raise', 4, 15],
  ]),
]

export const DEFAULT_CATEGORIES = ['Work', 'Study', 'Gym', 'Personal', 'Chores', 'Reading']

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  theme: 'system',
  themeColor: '#0b57d0',
  weekStart: 1,
  timeFormat: '12',
  pomodoro: { focus: 25, short: 5, long: 15, longEvery: 4 },
  defaultSound: 'classic',
  restSeconds: 90,
  summaryEmail: { enabled: false, time: '07:00', lastMorningDate: null },
  calendarMirror: false,
  keepAwake: true,
  gymSchedule: {},
  categories: DEFAULT_CATEGORIES,
  onboardedAt: null,
}
