import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { DEFAULT_SETTINGS } from './seed'
import type { EntityMap, Settings, TableName } from './types'

/** Live list of a table's non-deleted records. */
export function useTable<T extends TableName>(name: T): EntityMap[T][] | undefined {
  return useLiveQuery(
    async () => ((await db.table(name).toArray()) as EntityMap[T][]).filter((r) => !r.deletedAt),
    [name],
  )
}

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('settings'), [])
  if (!s) return DEFAULT_SETTINGS
  // Fill any keys added after the record was created.
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...s.pomodoro },
    summaryEmail: { ...DEFAULT_SETTINGS.summaryEmail, ...s.summaryEmail },
  }
}

/** Re-render every `ms` (live timers, countdowns). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

/** Current calendar day key; updates at midnight. */
export function useToday(): string {
  const now = useNow(30_000)
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
