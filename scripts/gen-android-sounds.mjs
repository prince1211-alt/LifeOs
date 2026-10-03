// Writes the notification sounds Android plays when LifeOS is closed
// (android/app/src/main/res/raw). Same voices as src/lib/audio.ts.
import { writeFileSync } from 'node:fs'

const RATE = 22050
const OUT = 'android/app/src/main/res/raw'
const sine = (f, t) => Math.sin(2 * Math.PI * f * t)
const env = (t, len, a = 0.01, r = 0.05) => (t < 0 || t > len ? 0 : Math.min(1, t / a, (len - t) / r))
const synth = (seconds, voice) => Float32Array.from({ length: Math.floor(seconds * RATE) }, (_, i) => voice(i / RATE))

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(RATE, 24)
  buf.writeUInt32LE(RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 0x7fff), 44 + i * 2))
  return buf
}

// Alarm: classic double beep, 30 seconds, getting louder over the first 10 s.
const alarm = synth(30, (t) => {
  const p = t % 1
  const on = env(p, 0.15, 0.005, 0.01) + env(p - 0.25, 0.15, 0.005, 0.01)
  return 0.5 * Math.min(1, 0.35 + t / 10) * on * Math.sign(sine(880, t))
})
const chime = synth(2, (t) =>
  [523.25, 659.25, 783.99].reduce((a, f, i) => a + (t >= i * 0.25 ? 0.3 * Math.exp(-3 * (t - i * 0.25)) * sine(f, t) : 0), 0),
)
const bell = synth(1.6, (t) => 0.55 * Math.exp(-4 * t) * (sine(1046.5, t) + 0.4 * sine(2093, t) + 0.2 * sine(3140, t)))

writeFileSync(`${OUT}/lifeos_alarm.wav`, wav(alarm))
writeFileSync(`${OUT}/lifeos_chime.wav`, wav(chime))
writeFileSync(`${OUT}/lifeos_bell.wav`, wav(bell))
console.log('sounds written')
