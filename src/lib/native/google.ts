// Android app: Google blocks its web sign-in popup inside app WebViews, so we use
// Android's own Google sign-in (Credential Manager + Authorization API) via
// @capgo/capacitor-social-login. It needs an "Android" OAuth client (package
// name + signing SHA-1) in the same Google Cloud project as the web client.
import { SocialLogin } from '@capgo/capacitor-social-login'

const SCOPES_KEY = 'lifeos-native-scopes'
const DEFAULTS = new Set(['openid', 'email', 'profile'])

let initialised: Promise<void> | null = null

function init(clientId: string) {
  initialised ??= SocialLogin.initialize({ google: { webClientId: clientId, mode: 'online' } })
  return initialised
}

/** Scopes granted earlier on this device, so silent refreshes keep Gmail/Calendar access. */
export function nativeGrantedScopes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SCOPES_KEY) || '[]')
  } catch {
    return []
  }
}

export interface NativeToken {
  token: string
  expiresAt: number
  scopes: string[]
  profile: { name: string; email: string; picture: string }
}

function parseExpiry(expires?: string): number {
  if (!expires) return Date.now() + 55 * 60_000
  const n = Number(expires)
  const ms = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(expires)
  return Number.isFinite(ms) && ms > Date.now() ? ms - 60_000 : Date.now() + 55 * 60_000
}

export async function nativeRequestToken(clientId: string, scopes: string[], interactive: boolean): Promise<NativeToken> {
  await init(clientId)
  const extra = [...new Set([...nativeGrantedScopes(), ...scopes])].filter((s) => !DEFAULTS.has(s))
  const res = await SocialLogin.login({
    provider: 'google',
    // Silent refresh: the bottom-sheet flow auto-selects the already-authorised account.
    options: interactive ? { scopes: extra } : { scopes: extra, style: 'bottom', filterByAuthorizedAccounts: true, autoSelectEnabled: true },
  })
  const r = res.result as {
    accessToken: { token: string; expires?: string } | null
    profile?: { name: string | null; email: string | null; imageUrl: string | null }
  }
  if (!r.accessToken?.token) throw new Error('Google did not return access to Drive. Try again and allow access.')
  try {
    localStorage.setItem(SCOPES_KEY, JSON.stringify(extra))
  } catch {
    /* storage blocked */
  }
  return {
    token: r.accessToken.token,
    expiresAt: parseExpiry(r.accessToken.expires),
    scopes: [...DEFAULTS, ...extra],
    profile: { name: r.profile?.name ?? '', email: r.profile?.email ?? '', picture: r.profile?.imageUrl ?? '' },
  }
}

export async function nativeSignOut() {
  try {
    localStorage.removeItem(SCOPES_KEY)
    await SocialLogin.logout({ provider: 'google' })
  } catch {
    /* already signed out */
  }
}
