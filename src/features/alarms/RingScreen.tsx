import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlarmClock, BellOff, Snooze, Volume2 } from '@/components/icons'
import { useApp } from '@/store/app'
import { useNow, useSettings } from '@/lib/hooks'
import { dismiss, snooze } from './AlarmEngine'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
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
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={ringing.label || 'Alarm'}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between gap-8 overflow-y-auto bg-linear-to-b from-primary-container via-surface-container-low to-surface-container-lowest px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] text-on-surface"
    >
      <div className="flex flex-col items-center gap-2 pt-4 text-center">
        <div className="animate-ring-pulse mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary">
          <AlarmClock filled className="size-8" />
        </div>
        <div className="text-title-medium text-on-surface-variant">{format(now, 'EEEE, d MMMM')}</div>
        <div className="tabular text-display-large" style={{ fontSize: 'clamp(64px, 24vw, 128px)', lineHeight: 1.05 }}>
          {format(now, settings.timeFormat === '24' ? 'HH:mm' : 'h:mm')}
          {settings.timeFormat !== '24' && <span className="ml-2 text-headline-medium">{format(now, 'a').toLowerCase()}</span>}
        </div>
        <div className="mt-2 text-headline-small">{ringing.label}</div>
        {!audioUnlocked && (
          <Button variant="secondary" className="mt-4" onClick={() => playAlarmSound(ringing.sound, ringing.volume, ringing.gradual)}>
            <Volume2 /> Tap to play sound
          </Button>
        )}
      </div>

      {solving ? (
        <form
          className="w-full max-w-sm rounded-xl bg-surface-container-high p-6 [--field-bg:var(--md-surface-container-high)]"
          onSubmit={(e) => {
            e.preventDefault()
            tryDismiss()
          }}
        >
          <p className="text-center text-title-small text-on-surface-variant">Solve to dismiss</p>
          <div className="tabular mt-2 mb-6 text-center text-display-small text-on-surface">{problem.text} = ?</div>
          <Field label="Answer" supporting={wrong ? <span className="text-error">Not quite — try again.</span> : undefined}>
            <Input
              autoFocus
              inputMode="numeric"
              aria-label="Answer"
              aria-invalid={wrong || undefined}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value)
                setWrong(false)
              }}
              className="tabular h-16 text-center text-headline-medium"
            />
          </Field>
          <Button type="submit" className="mt-4 h-14 w-full">
            <span className="text-title-medium">Check answer</span>
          </Button>
        </form>
      ) : null}

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          className="h-16 w-full sm:flex-1 [&_svg]:size-6"
          onClick={() => snooze(ringing.alarmId, ringing.snoozeMinutes)}
        >
          <Snooze /> <span className="text-title-medium">Snooze {ringing.snoozeMinutes} min</span>
        </Button>
        {!solving && (
          <Button className="h-16 w-full sm:flex-1 [&_svg]:size-6" onClick={tryDismiss}>
            <BellOff /> <span className="text-title-medium">Dismiss</span>
          </Button>
        )}
      </div>
    </div>
  )
}
