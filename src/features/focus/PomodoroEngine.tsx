import { useEffect } from 'react'
import { usePomodoro } from './pomodoro'

/** Ticks the Pomodoro from anywhere in the app. */
export function PomodoroEngine() {
  useEffect(() => {
    const id = setInterval(() => usePomodoro.getState().tick(), 1000)
    const onVis = () => document.visibilityState === 'visible' && usePomodoro.getState().tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return null
}
