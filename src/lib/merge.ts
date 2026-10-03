import type { SyncFields } from './types'

export const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000

export interface MergeResult<R> {
  /** What the Drive file should hold after the merge. */
  merged: R[]
  /** Records to write into IndexedDB (remote copy is newer or new). */
  toLocal: R[]
  /** Ids to hard-delete locally (soft-deleted more than 30 days ago). */
  purgeLocal: string[]
  /** True when the Drive file is behind the merged result and must be uploaded. */
  remoteStale: boolean
}

/** Record-by-record merge: the copy with the newer updatedAt wins. */
export function mergeRecords<R extends SyncFields>(local: R[], remote: R[], now = Date.now()): MergeResult<R> {
  const L = new Map(local.map((r) => [r.id, r]))
  const R = new Map(remote.filter((r) => r && typeof r.id === 'string').map((r) => [r.id, r]))
  const ids = new Set([...L.keys(), ...R.keys()])
  const out: MergeResult<R> = { merged: [], toLocal: [], purgeLocal: [], remoteStale: false }

  for (const id of ids) {
    const l = L.get(id)
    const r = R.get(id)
    const winner = !l ? r! : !r ? l : (r.updatedAt ?? 0) > (l.updatedAt ?? 0) ? r : l

    if (winner.deletedAt && now - winner.deletedAt > PURGE_AFTER_MS) {
      if (l) out.purgeLocal.push(id)
      if (r) out.remoteStale = true
      continue
    }
    out.merged.push(winner)
    if (winner === r && (!l || (l.updatedAt ?? 0) < (r.updatedAt ?? 0))) out.toLocal.push(r)
    if (winner === l && (!r || (r.updatedAt ?? 0) < (l.updatedAt ?? 0))) out.remoteStale = true
  }
  return out
}
