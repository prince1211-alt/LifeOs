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
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { to: '/today', label: 'Today', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/alarms', label: 'Alarms', icon: AlarmClock },
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/quit', label: 'Quit', icon: ShieldOff },
  { to: '/gym', label: 'Gym', icon: Dumbbell },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** Mobile bottom nav: Today, Tasks, Habits, Gym and More. */
export const MOBILE_MAIN = ['/today', '/tasks', '/habits', '/gym']
export const MOBILE_MORE = ['/alarms', '/quit', '/focus', '/stats', '/settings']
