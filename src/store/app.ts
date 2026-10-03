import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserProfile {
  mode: 'google' | 'local'
  name: string
  email: string
  picture: string
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'local'

export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

export interface Ringing {
  kind: 'alarm'
  alarmId: string
  label: string
  sound: string
  volume: number
  snoozeMinutes: number
  challenge: boolean
  gradual: boolean
  firedAt: number
}

interface AppState {
  user: UserProfile | null
  needsReconnect: boolean
  sync: { status: SyncStatus; lastSyncedAt: number | null; error: string | null }
  audioUnlocked: boolean
  ringing: Ringing | null
  toasts: Toast[]
  setUser: (u: UserProfile | null) => void
  setNeedsReconnect: (v: boolean) => void
  setSync: (s: Partial<AppState['sync']>) => void
  setAudioUnlocked: (v: boolean) => void
  setRinging: (r: Ringing | null) => void
  toast: (text: string, action?: Toast['action']) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      needsReconnect: false,
      sync: { status: 'idle', lastSyncedAt: null, error: null },
      audioUnlocked: false,
      ringing: null,
      toasts: [],
      setUser: (user) => set({ user }),
      setNeedsReconnect: (needsReconnect) => set({ needsReconnect }),
      setSync: (s) => set((st) => ({ sync: { ...st.sync, ...s } })),
      setAudioUnlocked: (audioUnlocked) => set({ audioUnlocked }),
      setRinging: (ringing) => set({ ringing }),
      toast: (text, action) => {
        const id = ++toastId
        // Material shows one snackbar at a time; a new one replaces the old.
        set({ toasts: [{ id, text, action }] })
        setTimeout(() => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })), 5000)
      },
      dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'lifeos-app',
      partialize: (s) => ({ user: s.user, sync: { ...s.sync, status: 'idle' as SyncStatus, error: null } }),
    },
  ),
)

export const toast = (text: string, action?: Toast['action']) => useApp.getState().toast(text, action)
