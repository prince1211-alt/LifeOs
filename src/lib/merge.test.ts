import { describe, expect, it } from 'vitest'
import { mergeRecords, PURGE_AFTER_MS } from './merge'

const r = (id: string, updatedAt: number, extra: object = {}) => ({ id, createdAt: 0, updatedAt, ...extra })

describe('mergeRecords', () => {
  it('newer updatedAt wins per record', () => {
    const res = mergeRecords([r('a', 5, { v: 'local' }), r('b', 1, { v: 'local' })], [r('a', 3, { v: 'remote' }), r('b', 9, { v: 'remote' })])
    expect(res.merged.find((x) => x.id === 'a')).toMatchObject({ v: 'local' })
    expect(res.merged.find((x) => x.id === 'b')).toMatchObject({ v: 'remote' })
    expect(res.toLocal.map((x) => x.id)).toEqual(['b'])
    expect(res.remoteStale).toBe(true)
  })
  it('adds records that exist on one side only', () => {
    const res = mergeRecords([r('a', 1)], [r('b', 1)])
    expect(res.merged.map((x) => x.id).sort()).toEqual(['a', 'b'])
    expect(res.toLocal.map((x) => x.id)).toEqual(['b'])
    expect(res.remoteStale).toBe(true)
  })
  it('identical data needs no upload', () => {
    const res = mergeRecords([r('a', 1)], [r('a', 1)])
    expect(res.remoteStale).toBe(false)
    expect(res.toLocal).toEqual([])
  })
  it('soft deletes propagate and purge after 30 days', () => {
    const now = 100 * 86_400_000
    const fresh = mergeRecords([r('a', 1)], [r('a', 2, { deletedAt: now - 1000 })], now)
    expect(fresh.toLocal[0]).toMatchObject({ deletedAt: now - 1000 })
    const old = mergeRecords([r('a', 2, { deletedAt: now - PURGE_AFTER_MS - 1 })], [r('a', 1)], now)
    expect(old.merged).toEqual([])
    expect(old.purgeLocal).toEqual(['a'])
    expect(old.remoteStale).toBe(true)
  })
})
