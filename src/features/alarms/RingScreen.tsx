import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlarmClock, BellOff, Moon } from '@/components/icons'
import { useApp } from '@/store/app'
import { useNow, useSettings } from '@/lib/hooks'
import { dismiss, snooze } from './AlarmEngine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { playAlarmSound } from '@/lib/audio'

function makeProblem() {
  const a = 12 + Math.floor(Math.random() * 30)
  const b = 3 + Math.floor(Math.random() * 7)
  const c = 10 + Math.floor(Math.random() * 40)
  return { text: `${a} × ${b} + ${c}`, answer: a * b + c }
}

/** Full-screen ring screen with big Snooze and Dismiss buttons. */
export function RingScreen() {
  const ringing = useApp((s) => s.ringing)
  const audioUnlocked = useApp((s) => s.audioUnlocked)
  const settings = useSettings()
  const now = useNow(1000)
  const [solving, setSolving] = useState(false)
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(false)
  const problem = useMemo(() => makeProblem(), [ringing?.firedAt, solving])

  useEffect(() => {
    setSolving(false)
    setAnswer('')
    setWrong(false)
  }, [ringing?.firedAt])

  if (!ringing) return null

  const tryDismiss = () => {
    if (ringing.challenge && !solving) return setSolving(true)
    if (ringing.challenge && Number(answer) !== problem.answer) {
      setWrong(true)
      setAnswer('')
      return
    }
    dismiss(ringing.alarmId)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-indigo-950 via-slate-900 to-black px-6 py-12 text-white">
      <div className="flex flex-col items-center gap-2 pt-6">
        <AlarmClock className="animate-ring-pulse h-12 w-12 text-indigo-300" />
        <div className="tabular text-7xl font-bold tracking-tight sm:text-8xl">
          {format(now, settings.timeFormat === '24' ? 'HH:mm' : 'h:mm')}
        </div>
        <div className="text-lg text-indigo-200">{format(now, 'EEEE, d MMMM')}</div>
        <div className="mt-4 text-2xl font-semibold">{ringing.label}</div>
        {!audioUnlocked && (
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => playAlarmSound(ringing.sound, ringing.volume, ringing.gradual)}
          >
            Tap to play sound
          </Button>
        )}
      </div>

      {solving ? (
        <form
          className="flex w-full max-w-sm flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            tryDismiss()
          }}
        >
          <p className="text-center text-indigo-200">Solve to dismiss</p>
          <div className="tabular text-center text-4xl font-bold">{problem.text} = ?</div>
          <Input
            autoFocus
            inputMode="numeric"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setWrong(false)
            }}
            className="h-14 border-white/20 bg-white/10 text-center text-2xl text-white"
          />
          {wrong && <p className="text-center text-sm text-red-300">Not quite — try again.</p>}
          <Button type="submit" size="lg" className="h-14 bg-white text-lg text-slate-900 hover:bg-white/90">
            Check answer
          </Button>
        </form>
      ) : null}

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button
          size="lg"
          className="h-16 rounded-2xl bg-indigo-500 text-xl hover:bg-indigo-400"
          onClick={() => snooze(ringing.alarmId, ringing.snoozeMinutes)}
        >
          <Moon className="!size-6" /> Snooze {ringing.snoozeMinutes} min
        </Button>
        {!solving && (
          <Button size="lg" className="h-16 rounded-2xl bg-white text-xl text-slate-900 hover:bg-white/90" onClick={tryDismiss}>
            <BellOff className="!size-6" /> Dismiss
          </Button>
        )}
      </div>
    </div>
  )
}
