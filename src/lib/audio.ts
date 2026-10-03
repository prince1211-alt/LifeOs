// Sounds are synthesised once into small WAV blobs and played with HTML5 Audio,
// so no audio files ship with the app and volume works everywhere.
import { useApp } from '@/store/app'

export const SOUNDS: { id: string; name: string }[] = [
  { id: 'classic', name: 'Classic beep' },
  { id: 'chime', name: 'Chime' },
  { id: 'digital', name: 'Digital' },
  { id: 'gentle', name: 'Gentle rise' },
  { id: 'bell', name: 'Bell' },
]

const RATE = 22050

type Voice = (t: number) => number

function synth(seconds: number, voice: Voice): Float32Array {
  const n = Math.floor(seconds * RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = voice(i / RATE)
  return out
}

const sine = (f: number, t: number) => Math.sin(2 * Math.PI * f * t)
const env = (t: number, len: number, attack = 0.01, release = 0.05) =>
  t < 0 || t > len ? 0 : Math.min(1, t / attack, (len - t) / release)

const VOICES: Record<string, () => Float32Array> = {
  classic: () =>
    synth(1, (t) => {
      const p = t % 1
      const on = env(p, 0.15, 0.005, 0.01) + env(p - 0.25, 0.15, 0.005, 0.01)
      return 0.35 * on * Math.sign(sine(880, t))
    }),
  chime: () =>
    synth(2, (t) =>
      [523.25, 659.25, 783.99].reduce(
        (a, f, i) => a + (t >= i * 0.25 ? 0.3 * Math.exp(-3 * (t - i * 0.25)) * sine(f, t) : 0),
        0,
      ),
    ),
  digital: () =>
    synth(1, (t) => {
      const p = t % 0.25
      return t % 1 < 0.75 ? 0.45 * env(p, 0.08, 0.002, 0.005) * Math.sign(sine(1760, t)) : 0
    }),
  gentle: () =>
    synth(3, (t) => {
      const f = 392 + 100 * Math.min(1, t / 3)
      return 0.5 * env(t % 1.5, 1.4, 0.3, 0.4) * (sine(f, t) + 0.3 * sine(f * 2, t))
    }),
  bell: () => synth(1.6, (t) => 0.55 * Math.exp(-4 * t) * (sine(1046.5, t) + 0.4 * sine(2093, t) + 0.2 * sine(3140, t))),
  silent: () => new Float32Array(RATE / 10),
}

function toWav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, RATE, true)
  v.setUint32(28, RATE * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  return new Blob([buf], { type: 'audio/wav' })
}

const urls = new Map<string, string>()
export function soundUrl(id: string): string {
  const key = id in VOICES ? id : 'classic'
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(toWav(VOICES[key]())))
  return urls.get(key)!
}

// One shared element, "unlocked" by a user tap, so alarms can play later.
let alarmEl: HTMLAudioElement | null = null
let fxEl: HTMLAudioElement | null = null
const el = () => (alarmEl ??= new Audio())
const fx = () => (fxEl ??= new Audio())

/** "Enable alarm sound": must run inside a user gesture. */
export async function unlockAudio(): Promise<boolean> {
  try {
    for (const a of [el(), fx()]) {
      a.src = soundUrl('silent')
      a.volume = 0
      await a.play()
      a.pause()
    }
    useApp.getState().setAudioUnlocked(true)
    return true
  } catch {
    return false
  }
}

let fade: ReturnType<typeof setInterval> | undefined

/** Loop an alarm sound until stopAlarmSound(). Gradual: fade in over 30 s. */
export function playAlarmSound(id: string, volume: number, gradual = false) {
  const a = el()
  clearInterval(fade)
  a.src = soundUrl(id)
  a.loop = true
  const target = Math.max(0.05, Math.min(1, volume))
  a.volume = gradual ? 0.05 : target
  a.play().catch(() => useApp.getState().setAudioUnlocked(false))
  if (gradual) {
    const started = Date.now()
    fade = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / 30_000)
      a.volume = 0.05 + (target - 0.05) * p
      if (p >= 1) clearInterval(fade)
    }, 500)
  }
}

export function stopAlarmSound() {
  clearInterval(fade)
  if (alarmEl) {
    alarmEl.pause()
    alarmEl.loop = false
    alarmEl.currentTime = 0
  }
}

/** One-shot effect (rest timer, Pomodoro, preview). */
export function playOnce(id: string, volume = 0.8) {
  const a = fx()
  a.loop = false
  a.src = soundUrl(id)
  a.volume = Math.max(0, Math.min(1, volume))
  a.play().catch(() => undefined)
}
