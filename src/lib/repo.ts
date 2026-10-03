import { db, kvGet, kvSet } from './db'
import { TABLE_MODULE, type EntityMap, type ModuleName, type TableName } from './types'
import { uid } from './utils'

/** Edits notify the sync scheduler through this hook (set by sync.ts). */
type DirtyListener = (module: ModuleName) => void
const listeners = new Set<DirtyListener>()
export function onDirty(fn: DirtyListener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Dirty map: module → timestamp of its latest local edit. */
export async function getDirty(): Promise<Partial<Record<ModuleName, number>>> {
  return kvGet('dirty', {})
}

export async function markDirty(module: ModuleName) {
  const dirty = await getDirty()
  dirty[module] = Date.now()
  await kvSet('dirty', dirty)
  listeners.forEach((l) => l(module))
}

/** Clear a module's dirty flag only if nothing was edited since `stamp`. */
export async function clearDirty(module: ModuleName, stamp: number | undefined) {
  await db.transaction('rw', db.kv, async () => {
    const dirty = await getDirty()
    if (dirty[module] === stamp) {
      delete dirty[module]
      await kvSet('dirty', dirty)
    }
  })
}

function nextStamp(prev?: number) {
  const now = Date.now()
  return prev && prev >= now ? prev + 1 : now
}

function table<T extends TableName>(name: T) {
  return db.table(name) as unknown as import('dexie').Table<EntityMap[T], string>
}

/** Create or update a record. Sets sync fields and marks the module dirty. */
export async function save<T extends TableName>(
  name: T,
  data: Partial<EntityMap[T]> & { id?: string },
): Promise<EntityMap[T]> {
  const t = table(name)
  const existing = data.id ? await t.get(data.id) : undefined
  const now = Date.now()
  const rec = {
    ...(existing ?? { createdAt: now, deletedAt: null }),
    ...data,
    id: data.id ?? uid(),
    updatedAt: nextStamp(existing?.updatedAt),
  } as EntityMap[T]
  await t.put(rec)
  await markDirty(TABLE_MODULE[name])
  return rec
}

export async function saveMany<T extends TableName>(name: T, items: (Partial<EntityMap[T]> & { id?: string })[]) {
  const out: EntityMap[T][] = []
  for (const item of items) out.push(await save(name, item))
  return out
}

/** Soft delete so other devices learn about it; purged after 30 days by sync. */
export async function remove(name: TableName, id: string) {
  const t = table(name)
  const existing = await t.get(id)
  if (!existing) return
  await t.put({ ...existing, deletedAt: Date.now(), updatedAt: nextStamp(existing.updatedAt) })
  await markDirty(TABLE_MODULE[name])
}

export async function hardRemove(name: TableName, id: string) {
  await table(name).delete(id)
}

/** All live (not soft-deleted) records of a table. */
export async function all<T extends TableName>(name: T): Promise<EntityMap[T][]> {
  return (await table(name).toArray()).filter((r) => !r.deletedAt)
}

export const alive = <R extends { deletedAt?: number | null }>(rows: R[] | undefined) =>
  (rows ?? []).filter((r) => !r.deletedAt)
