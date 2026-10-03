// Google Drive v3, hidden appDataFolder. One JSON file per module.
import { gfetch, SCOPES } from './auth'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export interface DriveFile {
  id: string
  name: string
  modifiedTime?: string
}

export async function listAppFiles(): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const q = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageSize: '100',
    })
    if (pageToken) q.set('pageToken', pageToken)
    const res = await gfetch(`${API}/files?${q}`, {}, SCOPES.drive)
    const body = (await res.json()) as { files: DriveFile[]; nextPageToken?: string }
    files.push(...body.files)
    pageToken = body.nextPageToken
  } while (pageToken)
  return files
}

export async function downloadJson<T>(id: string): Promise<T | null> {
  const res = await gfetch(`${API}/files/${id}?alt=media`, {}, SCOPES.drive)
  const text = await res.text()
  if (!text.trim()) return null
  return JSON.parse(text) as T
}

export async function createJson(name: string, data: unknown): Promise<DriveFile> {
  const boundary = 'lifeos' + Math.random().toString(36).slice(2)
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(data) +
    `\r\n--${boundary}--`
  const res = await gfetch(
    `${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`,
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    SCOPES.drive,
  )
  return (await res.json()) as DriveFile
}

export async function updateJson(id: string, data: unknown): Promise<void> {
  await gfetch(
    `${UPLOAD}/files/${id}?uploadType=media`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
    SCOPES.drive,
  )
}

export async function deleteFile(id: string): Promise<void> {
  await gfetch(`${API}/files/${id}`, { method: 'DELETE' }, SCOPES.drive)
}
