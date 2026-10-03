import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db } from '@/lib/db'
import { save } from '@/lib/repo'
import { playOnce } from '@/lib/audio'
import { notify } from '@/lib/notify'
import { DEFAULT_SETTINGS } from '@/lib/seed'

export type Phase = 'focus' | 'short' | 'long'

interface PomodoroState {
  phase: Phase
  running: boolean
  endsAt: number | null
  remainingMs: number
  phaseMs: number
  /** focus rounds finished in the current cycle */
  round: number
  taskId: string | null
  category: string
  startedAt: number | null
  setTask: (taskId: string | null) => void
  setCategory: (c: string) => void
  start: () => void
  pause: () => void
  reset: () => Promise<void>
  skip: () => Promise<void>
  /** finish early and log what was done */
  stopAndLog: () => Promise<void>
  tick: () => Promise<void>
}

async function lengths() {
  const s = await db.settings.get('settings')
  return { ...DEFAULT_SETTINGS.pomodoro, ...s?.pomodoro }
}

async function phaseLength(p: Phase) {
  const l = await lengths()
  return (p === 'focus' ? l.focus : p === 'short' ? l.short : l.long) * 60_000
}

export const PHASE_LABEL: Record<Phase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }

/** Pomodoro timer stored as an end time, so it keeps correct time in background tabs. */
export const usePomodoro = create<PomodoroState>()(
  persist(
    (set, get) => {
      const record = async (ms: number) => {
        const { phase, taskId, category, startedAt } = get()
        const minutes = Math.round(ms / 60_000)
        if (minutes < 1) return
        await save('focusSessions', {
          taskId,
          category: phase === 'focus' ? category : 'Break',
          startedAt: startedAt ?? Date.now() - ms,
          durationMin: minutes,
          type: phase === 'focus' ? 'focus' : 'break',
        })
      }
      const advance = async (completed: boolean) => {
        const { phase, round } = get()
        const l = await lengths()
        let next: Phase = 'focus'
        let nextRound = round
        if (phase === 'focus') {
          nextRound = completed ? round + 1 : round
          next = completed && nextRound % l.longEvery === 0 ? 'long' : 'short'
        } else if (phase === 'long') nextRound = 0
        const ms = await phaseLength(next)
        set({ phase: next, round: nextRound, running: false, endsAt: null, remainingMs: ms, phaseMs: ms, startedAt: null })
      }
      return {
        phase: 'focus',
        running: false,
        endsAt: null,
        remainingMs: 25 * 60_000,
        phaseMs: 25 * 60_000,
        round: 0,
        taskId: null,
        category: 'Work',
        startedAt: null,
        setTask: (taskId) => set({ taskId }),
        setCategory: (category) => set({ category }),
        start: () => {
          const { remainingMs, startedAt } = get()
          set({ running: true, endsAt: Date.now() + remainingMs, startedAt: startedAt ?? Date.now() })
        },
        pause: () => {
          const { endsAt } = get()
          if (endsAt) set({ running: false, endsAt: null, remainingMs: Math.max(0, endsAt - Date.now()) })
        },
        reset: async () => {
          const ms = await phaseLength(get().phase)
          set({ running: false, endsAt: null, remainingMs: ms, phaseMs: ms, startedAt: null })
        },
        skip: async () => advance(false),
        stopAndLog: async () => {
          const { phaseMs, remainingMs, endsAt, phase } = get()
          const left = endsAt ? Math.max(0, endsAt - Date.now()) : remainingMs
          await record(phaseMs - left)
          await advance(phase !== 'focus' || phaseMs - left >= phaseMs * 0.5)
        },
        tick: async () => {
          const { running, endsAt, phase, phaseMs } = get()
          if (!running || !endsAt || Date.now() < endsAt) return
          set({ running: false, endsAt: null })
          await record(phaseMs)
          playOnce('bell', 0.9)
          notify(
            phase === 'focus' ? 'Focus session done 🎉' : 'Break over',
            phase === 'focus' ? 'Take a break.' : 'Ready for the next focus round?',
            { tag: 'pomodoro', url: '/focus' },
          )
          await advance(true)
        },
      }
    },
    {
      name: 'lifeos-pomodoro',
      partialize: (s) => ({
        phase: s.phase,
        running: s.running,
        endsAt: s.endsAt,
        remainingMs: s.remainingMs,
        phaseMs: s.phaseMs,
        round: s.round,
        taskId: s.taskId,
        category: s.category,
        startedAt: s.startedAt,
      }),
    },
  ),
)

/** Keep phase lengths in step with Settings while idle. */
export async function syncIdleLength() {
  const s = usePomodoro.getState()
  if (s.running || s.startedAt) return
  const ms = await phaseLength(s.phase)
  if (ms !== s.phaseMs) usePomodoro.setState({ remainingMs: ms, phaseMs: ms })
}
