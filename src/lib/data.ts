import { db } from './db'
import { markDirty } from './repo'
import { mergeRecords } from './merge'
import { MODULES, MODULE_TABLES, TABLE_MODULE, type SyncFields, type TableName } from './types'

const TABLES = MODULES.flatMap((m) => MODULE_TABLES[m])

export interface ExportFile {
  app: 'lifeos'
  version: 1
  exportedAt: number
  tables: Partial<Record<TableName, SyncFields[]>>
}

export async function exportAll(): Promise<ExportFile> {
  const tables: ExportFile['tables'] = {}
  for (const t of TABLES) tables[t] = (await db.table(t).toArray()) as SyncFields[]
  return { app: 'lifeos', version: 1, exportedAt: Date.now(), tables }
}

/** Import a JSON export, merging record by record (newer updatedAt wins). */
export async function importAll(file: unknown): Promise<number> {
  const f = file as Partial<ExportFile>
  if (!f || f.app !== 'lifeos' || typeof f.tables !== 'object') throw new Error('This is not a LifeOS export file')
  let count = 0
  const touched = new Set<string>()
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const incoming = (f.tables?.[t] ?? []).filter((r) => r && typeof r.id === 'string')
      if (!incoming.length) continue
      const res = mergeRecords((await db.table(t).toArray()) as SyncFields[], incoming)
      if (res.toLocal.length) {
        await db.table(t).bulkPut(res.toLocal)
        count += res.toLocal.length
        touched.add(TABLE_MODULE[t])
      }
    }
  })
  for (const m of touched) await markDirty(m as (typeof MODULES)[number])
  return count
}
