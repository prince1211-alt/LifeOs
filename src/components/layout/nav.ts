import {
  AlarmClock,
  BarChart3,
  CheckSquare,
  Dumbbell,
  Flame,
  Home,
  Settings,
  ShieldOff,
  Timer,
  type IconComponent,
} from '@/components/icons'

export interface NavItem {
  to: string
  label: string
  icon: IconComponent
}

export const NAV: NavItem[] = [
  { to: '/today', label: 'Today', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/gym', label: 'Gym', icon: Dumbbell },
  { to: '/alarms', label: 'Alarms', icon: AlarmClock },
  { to: '/quit', label: 'Quit', icon: ShieldOff },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** Phone navigation bar: Today, Tasks, Habits, Gym and More. */
export const MOBILE_MAIN = ['/today', '/tasks', '/habits', '/gym']
export const MOBILE_MORE = ['/alarms', '/quit', '/focus', '/stats', '/settings']

/** "New" menu (Google Drive style). Pages open their create dialog when the URL has ?new=1. */
export const CREATE_ACTIONS: NavItem[] = [
  { to: '/tasks?new=1', label: 'Task', icon: CheckSquare },
  { to: '/habits?new=1', label: 'Habit', icon: Flame },
  { to: '/alarms?new=1', label: 'Alarm', icon: AlarmClock },
  { to: '/quit?new=1', label: 'Quit goal', icon: ShieldOff },
  { to: '/gym?new=1', label: 'Workout', icon: Dumbbell },
  { to: '/focus?new=1', label: 'Focus session', icon: Timer },
]

export function titleFor(pathname: string): string {
  if (pathname.startsWith('/gym/workout')) return 'Workout'
  return NAV.find((n) => pathname.startsWith(n.to))?.label ?? 'LifeOS'
}
