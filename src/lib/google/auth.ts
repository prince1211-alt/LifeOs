// Google Identity Services token client: browser-only OAuth, no client secret.
// The access token lives in memory only and is re-requested when it expires.
import { useApp } from '@/store/app'
import { isNative } from '../native/platform'

export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export const SCOPES = {
  profile: ['openid', 'email', 'profile'],
  drive: ['https://www.googleapis.com/auth/drive.appdata'],
  gmailSend: ['https://www.googleapis.com/auth/gmail.send'],
  gmailRead: ['https://www.googleapis.com/auth/gmail.readonly'],
  calendar: ['https://www.googleapis.com/auth/calendar.events'],
}

export const BASE_SCOPES = [...SCOPES.profile, ...SCOPES.drive]

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  scope?: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken: (o?: Record<string, unknown>) => void
}

interface GoogleOAuth2 {
  initTokenClient: (c: Record<string, unknown>) => TokenClient
  revoke: (token: string, done?: () => void) => void
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } }
  }
}

let gisPromise: Promise<void> | null = null
let client: TokenClient | null = null
let pending: { resolve: (r: TokenResponse) => void; reject: (e: Error) => void } | null = null

let token: string | null = null
let expiresAt = 0
const granted = new Set<string>()

export function isConfigured() {
  return Boolean(CLIENT_ID)
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        gisPromise = null
        reject(new Error('Could not load Google sign-in. Check your connection.'))
      }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

async function getClient(): Promise<TokenClient> {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')
  await loadGis()
  if (!client) {
    client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: BASE_SCOPES.join(' '),
      callback: (r: TokenResponse) => {
        const p = pending
        pending = null
        if (!p) return
        if (r.error || !r.access_token) p.reject(new Error(r.error_description || r.error || 'Sign-in failed'))
        else p.resolve(r)
      },
      error_callback: (e: { type?: string; message?: string }) => {
        const p = pending
        pending = null
        p?.reject(new Error(e.type === 'popup_failed_to_open' ? 'popup_blocked' : e.message || e.type || 'Sign-in cancelled'))
      },
    })
  }
  return client
}

/**
 * Ask Google for an access token covering `scopes`.
 * interactive=false tries a silent re-request (no consent screen).
 */
async function requestToken(scopes: string[], interactive: boolean): Promise<string> {
  if (isNative) {
    if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')
    const { nativeRequestToken } = await import('../native/google')
    const r = await nativeRequestToken(CLIENT_ID, [...BASE_SCOPES, ...granted, ...scopes], interactive)
    token = r.token
    expiresAt = r.expiresAt
    r.scopes.forEach((s) => granted.add(s))
    useApp.getState().setNeedsReconnect(false)
    return token
  }
  const c = await getClient()
  if (pending) pending.reject(new Error('superseded'))
  const user = useApp.getState().user
  const all = Array.from(new Set([...BASE_SCOPES, ...granted, ...scopes]))
  const res = await new Promise<TokenResponse>((resolve, reject) => {
    const mine = {
      resolve: (r: TokenResponse) => {
        clearTimeout(timer)
        resolve(r)
      },
      reject: (e: Error) => {
        clearTimeout(timer)
        reject(e)
      },
    }
    const timer = setTimeout(() => {
      if (pending === mine) pending = null
      reject(new Error('Google sign-in timed out'))
    }, 120_000)
    pending = mine
    c.requestAccessToken({
      scope: all.join(' '),
      include_granted_scopes: true,
      prompt: interactive ? (user?.email ? '' : 'select_account') : '',
      login_hint: user?.email || undefined,
    })
  })
  token = res.access_token!
  expiresAt = Date.now() + (Number(res.expires_in) || 3600) * 1000 - 60_000
  ;(res.scope || '').split(' ').filter(Boolean).forEach((s) => granted.add(s))
  useApp.getState().setNeedsReconnect(false)
  return token
}

export function hasScopes(scopes: string[]) {
  return scopes.every((s) => granted.has(s))
}

export function hasValidToken() {
  return Boolean(token) && Date.now() < expiresAt
}

/** Returns a usable token, re-requesting silently; flags "Reconnect Google" on failure. */
export async function getToken(scopes: string[] = [], interactive = false): Promise<string> {
  if (token && Date.now() < expiresAt && hasScopes(scopes)) return token
  // In the app a background refresh can show Google's account sheet; after one miss, wait for "Reconnect".
  if (!interactive && isNative && useApp.getState().needsReconnect) throw new Error('Reconnect Google to continue syncing')
  try {
    return await requestToken(scopes, interactive)
  } catch (e) {
    if (!interactive) useApp.getState().setNeedsReconnect(true)
    throw e
  }
}

/** Interactive sign-in: needs a user gesture so the popup isn't blocked. */
export async function signIn() {
  const t = await requestToken(BASE_SCOPES, true)
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${t}` },
  })
  if (!res.ok) throw new Error('Could not read your Google profile')
  const info = (await res.json()) as { name?: string; email?: string; picture?: string }
  useApp.getState().setUser({
    mode: 'google',
    name: info.name || info.email || 'You',
    email: info.email || '',
    picture: info.picture || '',
  })
}

/** Request an extra scope the first time a feature needs it (incremental consent). */
export async function ensureScopes(scopes: string[]) {
  if (hasScopes(scopes) && hasValidToken()) return
  await requestToken(scopes, true)
}

export function signOutGoogle() {
  if (isNative) void import('../native/google').then((m) => m.nativeSignOut())
  else if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token)
  token = null
  expiresAt = 0
  granted.clear()
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** fetch() with the Google token; retries once after a silent token refresh on 401. */
export async function gfetch(url: string, init: RequestInit = {}, scopes: string[] = []): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const t = await getToken(scopes)
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${t}` },
    })
    if (res.status === 401 && attempt === 0) {
      token = null
      continue
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`
      try {
        const body = (await res.json()) as { error?: { message?: string } }
        if (body.error?.message) msg = body.error.message
      } catch {
        /* not JSON */
      }
      throw new GoogleApiError(msg, res.status)
    }
    return res
  }
  throw new GoogleApiError('Unauthorized', 401)
}
