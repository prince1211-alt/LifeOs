import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for Drive's appDataFolder.
const files = new Map<string, { name: string; body: string }>()
let nextId = 1
vi.mock('./google/drive', () => ({
  listAppFiles: async () => [...files.entries()].map(([id, f]) => ({ id, name: f.name })),
  downloadJson: async (id: string) => JSON.parse(files.get(id)!.body),
  createJson: async (name: string, data: unknown) => {
    const id = `f${nextId++}`
    files.set(id, { name, body: JSON.stringify(data) })
    return { id, name }
  },
  updateJson: async (id: string, data: unknown) => {
    files.get(id)!.body = JSON.stringify(data)
  },
  deleteFile: async (id: string) => void files.delete(id),
}))

const { db, ensureSeed } = await import('./db')
const { save, remove, getDirty } = await import('./repo')
const { fullSync, syncDirty, clearLocalData } = await import('./sync')
const { useApp } = await import('@/store/app')

const remoteTasks = () => {
  const f = [...files.values()].find((x) => x.name === 'tasks.json')
  return f ? (JSON.parse(f.body).tables.tasks as { id: string; title: string; deletedAt?: number }[]) : []
}

describe('Drive sync', () => {
  beforeEach(async () => {
    files.clear()
    await clearLocalData()
    await ensureSeed()
    useApp.setState({ user: { mode: 'google', name: 'T', email: 't@example.com', picture: '' } })
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
  })

  it('creates one file per module plus meta on first sync', async () => {
    const res = await fullSync()
    expect(res.hadRemoteData).toBe(false)
    expect([...files.values()].map((f) => f.name).sort()).toEqual(
      ['alarms', 'gym', 'habits', 'meta', 'quit', 'settings', 'tasks', 'time'].map((m) => `${m}.json`),
    )
  })

  it('uploads dirty modules and clears the dirty flag', async () => {
    await fullSync()
    await save('tasks', { title: 'Buy milk', status: 'open' })
    expect(Object.keys(await getDirty())).toEqual(['tasks'])
    await syncDirty()
    expect(remoteTasks().map((t) => t.title)).toEqual(['Buy milk'])
    expect(await getDirty()).toEqual({})
  })

  it('restores data on a fresh device and merges by updatedAt', async () => {
    const t = await save('tasks', { title: 'Old title', status: 'open' })
    await fullSync()
    // Another device edits the same task later.
    const f = [...files.entries()].find(([, x]) => x.name === 'tasks.json')!
    const body = JSON.parse(f[1].body)
    body.tables.tasks[0] = { ...body.tables.tasks[0], title: 'New title', updatedAt: t.updatedAt + 1000 }
    f[1].body = JSON.stringify(body)
    // Fresh device: empty local DB.
    await clearLocalData()
    await ensureSeed()
    const res = await fullSync()
    expect(res.hadRemoteData).toBe(true)
    expect((await db.tasks.get(t.id))?.title).toBe('New title')
  })

  it('propagates soft deletes', async () => {
    const t = await save('tasks', { title: 'Temp', status: 'open' })
    await fullSync()
    await remove('tasks', t.id)
    await syncDirty()
    expect(remoteTasks()[0].deletedAt).toBeTypeOf('number')
  })

  it('does nothing in local-only mode', async () => {
    useApp.setState({ user: { mode: 'local', name: 'You', email: '', picture: '' } })
    await fullSync()
    expect(files.size).toBe(0)
    expect(useApp.getState().sync.status).toBe('local')
  })
})
