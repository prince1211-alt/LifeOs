import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RestState {
  endsAt: number | null
  total: number
  start: (seconds: number) => void
  add: (seconds: number) => void
  stop: () => void
}

/** Rest timer state; stored as an end time so it survives tab throttling and reloads. */
export const useRest = create<RestState>()(
  persist(
    (set, get) => ({
      endsAt: null,
      total: 0,
      start: (seconds) => set({ endsAt: Date.now() + seconds * 1000, total: seconds }),
      add: (seconds) => {
        const { endsAt, total } = get()
        if (endsAt) set({ endsAt: Math.max(Date.now(), endsAt + seconds * 1000), total: Math.max(1, total + seconds) })
      },
      stop: () => set({ endsAt: null }),
    }),
    { name: 'lifeos-rest' },
  ),
)
