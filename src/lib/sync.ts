// Offline-first sync: IndexedDB is the working copy, Drive appDataFolder is the
// backup and the bridge between devices. The UI never waits for the network.
import { db, kvGet, kvSet } from './db'
import { clearDirty, getDirty, onDirty } from './repo'
import { mergeRecords } from './merge'
import { MODULES, MODULE_TABLES, type ModuleName, type SyncFields, type TableName } from './types'
import { createJson, deleteFile, downloadJson, listAppFiles, updateJson } from './google/drive'
import { useApp } from '@/store/app'
import { uid } from './utils'

export const SCHEMA_VERSION = 1
const DEBOUNCE_MS = 5000

interface ModuleFile {
  app: 'lifeos'
  module: ModuleName
  schemaVersion: number
  updatedAt: number
  deviceId: string
  tables: Partial<Record<TableName, SyncFields[]>>
}

interface MetaFile {
  app: 'lifeos'
  schemaVersion: number
  lastSync: number
  deviceId: string
}

const fileName = (m: ModuleName | 'meta') => `${m}.json`

export async function deviceId(): Promise<string> {
  let id = await kvGet<string | null>('deviceId', null)
  if (!id) {
    id = uid()
    await kvSet('deviceId', id)
  }
  return id
}

const canSync = () => useApp.getState().user?.mode === 'google'

// One sync at a time; calls made while one is running are chained after it.
let chain: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn)
  chain = next.catch(() => undefined)
  return next
}

async function syncModule(m: ModuleName, fileIds: Record<string, string>) {
  const stamp = (await getDirty())[m]
  const fileId = fileIds[fileName(m)]
  const remote = fileId ? await downloadJson<ModuleFile>(fileId) : null
  const did = await deviceId()
  const now = Date.now()
  let stale = !fileId || stamp !== undefined
  const tables: ModuleFile['tables'] = {}

  const dexieTables = MODULE_TABLES[m].map((t) => db.table(t))
  await db.transaction('rw', dexieTables, async () => {
    for (const t of MODULE_TABLES[m]) {
      const local = (await db.table(t).toArray()) as SyncFields[]
      const res = mergeRecords(local, (remote?.tables?.[t] ?? []) as SyncFields[], now)
      if (res.toLocal.length) await db.table(t).bulkPut(res.toLocal)
      if (res.purgeLocal.length) await db.table(t).bulkDelete(res.purgeLocal)
      if (res.remoteStale) stale = true
      tables[t] = res.merged
    }
  })

  if (stale) {
    const file: ModuleFile = { app: 'lifeos', module: m, schemaVersion: SCHEMA_VERSION, updatedAt: now, deviceId: did, tables }
    if (fileId) await updateJson(fileId, file)
    else fileIds[fileName(m)] = (await createJson(fileName(m), file)).id
  }
  await clearDirty(m, stamp)
}

async function run(modules: ModuleName[] | 'all'): Promise<{ hadRemoteData: boolean }> {
  const app = useApp.getState()
  if (!canSync()) {
    app.setSync({ status: 'local' })
    return { hadRemoteData: false }
  }
  if (!navigator.onLine) {
    app.setSync({ status: 'offline' })
    return { hadRemoteData: false }
  }
  app.setSync({ status: 'syncing', error: null })
  try {
    let fileIds = await kvGet<Record<string, string>>('fileIds', {})
    let hadRemoteData = false
    const full = modules === 'all' || !Object.keys(fileIds).length
    if (full) {
      // On login / full sync: list the folder and create anything missing.
      const files = await listAppFiles()
      fileIds = Object.fromEntries(files.map((f) => [f.name, f.id]))
      hadRemoteData = MODULES.some((m) => fileIds[fileName(m)])
    }
    const list = full ? MODULES : (modules as ModuleName[])
    for (const m of list) await syncModule(m, fileIds)
    if (full) {
      const meta: MetaFile = { app: 'lifeos', schemaVersion: SCHEMA_VERSION, lastSync: Date.now(), deviceId: await deviceId() }
      const metaId = fileIds[fileName('meta')]
      if (metaId) await updateJson(metaId, meta)
      else fileIds[fileName('meta')] = (await createJson(fileName('meta'), meta)).id
    }
    await kvSet('fileIds', fileIds)
    app.setSync({ status: 'idle', lastSyncedAt: Date.now(), error: null })
    return { hadRemoteData }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    app.setSync({ status: navigator.onLine ? 'error' : 'offline', error: msg })
    throw e
  }
}

/** Download everything, merge, upload what changed ("Sync now" and login). */
export function fullSync() {
  return serial(() => run('all'))
}

/** Upload only modules with local edits. */
export function syncDirty() {
  return serial(async () => {
    const dirty = Object.keys(await getDirty()) as ModuleName[]
    if (!dirty.length) return { hadRemoteData: false }
    return run(dirty)
  })
}

let timer: ReturnType<typeof setTimeout> | undefined
let started = false

export function startSyncScheduler() {
  if (started) return
  started = true
  const quiet = (p: Promise<unknown>) => p.catch(() => undefined)
  onDirty(() => {
    if (!canSync()) return
    clearTimeout(timer)
    timer = setTimeout(() => quiet(syncDirty()), DEBOUNCE_MS)
  })
  const flush = () => {
    if (!canSync()) return
    clearTimeout(timer)
    quiet(syncDirty())
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return flush()
    // Coming back: pull changes made on other devices.
    const last = useApp.getState().sync.lastSyncedAt ?? 0
    if (canSync() && Date.now() - last > 2 * 60_000) quiet(fullSync())
  })
  window.addEventListener('pagehide', flush)
  window.addEventListener('online', () => canSync() && quiet(syncDirty()))
  window.addEventListener('offline', () => canSync() && useApp.getState().setSync({ status: 'offline' }))
}

/** Wipe every local table (used by sign out and "Delete all data"). */
export async function clearLocalData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      if (t.name === 'kv') {
        const id = await db.kv.get('deviceId')
        await t.clear()
        if (id) await db.kv.put(id)
      } else await t.clear()
    }
  })
}

/** Remove LifeOS data from Drive too (Settings → Delete all data). */
export async function deleteRemoteData() {
  if (!canSync()) return
  const files = await listAppFiles()
  for (const f of files) await deleteFile(f.id)
  await kvSet('fileIds', {})
}
