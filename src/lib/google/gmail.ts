// Gmail API: send the daily summary to yourself; Later: starred emails → tasks.
import { gfetch, SCOPES } from './auth'

const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

const base64Url = (s: string) => base64Utf8(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function buildMime(to: string, subject: string, html: string): string {
  return [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${base64Utf8(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Utf8(html).replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n')
}

export async function sendEmail(to: string, subject: string, html: string) {
  await gfetch(
    `${API}/messages/send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: base64Url(buildMime(to, subject, html)) }),
    },
    SCOPES.gmailSend,
  )
}

export interface StarredEmail {
  id: string
  subject: string
  from: string
  snippet: string
}

export async function listStarred(max = 20): Promise<StarredEmail[]> {
  const q = new URLSearchParams({ q: 'is:starred', maxResults: String(max) })
  const res = await gfetch(`${API}/messages?${q}`, {}, SCOPES.gmailRead)
  const body = (await res.json()) as { messages?: { id: string }[] }
  const out: StarredEmail[] = []
  for (const m of body.messages ?? []) {
    const r = await gfetch(
      `${API}/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
      {},
      SCOPES.gmailRead,
    )
    const msg = (await r.json()) as {
      id: string
      snippet?: string
      payload?: { headers?: { name: string; value: string }[] }
    }
    const h = (n: string) => msg.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? ''
    out.push({ id: msg.id, subject: h('subject') || '(no subject)', from: h('from'), snippet: msg.snippet ?? '' })
  }
  return out
}
