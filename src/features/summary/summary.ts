// Daily summary email (morning plan / night report), sent with the Gmail API.
import { format } from 'date-fns'
import { db } from '@/lib/db'
import { save } from '@/lib/repo'
import { computeStreak, habitLogId, isDone, isDueOn } from '@/lib/habits'
import { quitStats } from '@/lib/quit'
import { workoutVolume } from '@/lib/gym'
import { formatDuration, formatTime, rupees, ymd } from '@/lib/utils'
import { ensureScopes, SCOPES } from '@/lib/google/auth'
import { sendEmail } from '@/lib/google/gmail'
import { useApp, toast } from '@/store/app'
import { DEFAULT_SETTINGS } from '@/lib/seed'
import { nextAlarm } from '../alarms/schedule'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function buildSummary(kind: 'morning' | 'night', now = new Date()) {
  const live = <T extends { deletedAt?: number | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt)
  const [tasks, habits, logs, goals, relapses, workouts, templates, sessions, alarms, s] = await Promise.all([
    db.tasks.toArray().then(live),
    db.habits.toArray().then(live),
    db.habitLogs.toArray().then(live),
    db.quitGoals.toArray().then(live),
    db.relapses.toArray().then(live),
    db.workouts.toArray().then(live),
    db.workoutTemplates.toArray().then(live),
    db.focusSessions.toArray().then(live),
    db.alarms.toArray().then(live),
    db.settings.get('settings'),
  ])
  const settings = { ...DEFAULT_SETTINGS, ...s }
  const today = ymd(now)
  const tf = settings.timeFormat

  const open = tasks.filter((t) => t.status === 'open' && t.dueDate && t.dueDate <= today).sort((a, b) => a.priority - b.priority)
  const doneToday = tasks.filter((t) => t.status === 'done' && t.completedAt && ymd(t.completedAt) === today)
  const dueHabits = habits.filter((h) => !h.archived && isDueOn(h, logs, now, settings.weekStart))
  const habitDone = dueHabits.filter((h) => isDone(h, logs.find((l) => l.id === habitLogId(h.id, today))))
  const tplId = settings.gymSchedule[String(now.getDay())]
  const plannedWorkout = templates.find((t) => t.id === tplId)
  const workoutsToday = workouts.filter((w) => w.endedAt && ymd(w.startedAt) === today)
  const focusMin = sessions.filter((x) => x.type === 'focus' && ymd(x.startedAt) === today).reduce((a, x) => a + x.durationMin, 0)
  const next = nextAlarm(alarms, now.getTime())

  const li = (s: string) => `<li style="margin:4px 0">${s}</li>`
  const section = (title: string, body: string) =>
    `<h3 style="margin:20px 0 6px;font-size:15px;color:#4338ca">${title}</h3>${body}`
  const list = (items: string[], empty: string) =>
    items.length ? `<ul style="padding-left:18px;margin:0">${items.join('')}</ul>` : `<p style="margin:0;color:#64748b">${empty}</p>`

  const parts: string[] = []
  if (kind === 'morning') {
    parts.push(
      section(
        `Today's tasks (${open.length})`,
        list(
          open.map((t) =>
            li(
              `${t.pinned ? '⭐ ' : ''}<b>${esc(t.title)}</b>${t.dueTime ? ` · ${formatTime(t.dueTime, tf)}` : ''}${t.priority < 4 ? ` · P${t.priority}` : ''}${t.dueDate! < today ? ' · <span style="color:#dc2626">overdue</span>' : ''}`,
            ),
          ),
          'Nothing due today.',
        ),
      ),
    )
    parts.push(section(`Habits due (${dueHabits.length})`, list(dueHabits.map((h) => li(`${h.icon} ${esc(h.name)} — 🔥 ${computeStreak(h, logs, now, settings.weekStart).current}`)), 'No habits due.')))
  } else {
    parts.push(
      section(
        `Tasks: ${doneToday.length} done, ${open.length} left`,
        list([...doneToday.map((t) => li(`✅ ${esc(t.title)}`)), ...open.map((t) => li(`⬜ ${esc(t.title)}`))], 'No tasks today.'),
      ),
    )
    parts.push(
      section(
        `Habits: ${habitDone.length}/${dueHabits.length}`,
        list(dueHabits.map((h) => li(`${habitDone.includes(h) ? '✅' : '⬜'} ${h.icon} ${esc(h.name)}`)), 'No habits due.'),
      ),
    )
    parts.push(section('Focus', `<p style="margin:0">${focusMin} minutes of focused work.</p>`))
  }
  parts.push(
    section(
      'Quit streaks',
      list(
        goals.map((g) => {
          const st = quitStats(g, relapses, now.getTime())
          return li(`No ${esc(g.name.toLowerCase())}: <b>${formatDuration(st.elapsed)}</b>${g.costPerDay ? ` · ${rupees(st.moneySaved)} saved` : ''}`)
        }),
        'No quit goals yet.',
      ),
    ),
  )
  parts.push(
    section(
      'Gym',
      workoutsToday.length
        ? list(workoutsToday.map((w) => li(`${esc(w.name)} · ${Math.round(workoutVolume(w))} kg volume`)), '')
        : `<p style="margin:0">${plannedWorkout ? `Planned: <b>${esc(plannedWorkout.name)}</b>` : 'Rest day.'}</p>`,
    ),
  )
  if (kind === 'night' && next) parts.push(section('Next alarm', `<p style="margin:0">⏰ ${format(next.at, tf === '24' ? 'EEE HH:mm' : 'EEE h:mm a')} — ${esc(next.alarm.label || 'Alarm')}</p>`))

  const title = kind === 'morning' ? `☀️ Your plan for ${format(now, 'EEEE d MMM')}` : `🌙 Night report — ${format(now, 'EEEE d MMM')}`
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0">
<h2 style="margin:0 0 4px;font-size:20px">${title}</h2>
<p style="margin:0;color:#64748b;font-size:13px">From LifeOS</p>
${parts.join('\n')}
</div></div></body></html>`
  return { subject: title.replace(/^[^\w]+/, '').trim() + ' · LifeOS', html }
}

export async function sendSummary(kind: 'morning' | 'night', interactive = true) {
  const user = useApp.getState().user
  if (user?.mode !== 'google' || !user.email) throw new Error('Sign in with Google to send email')
  if (interactive) await ensureScopes(SCOPES.gmailSend)
  const { subject, html } = await buildSummary(kind)
  await sendEmail(user.email, subject, html)
}

/** Send the morning plan on the first app open of the day, after the chosen time. */
export async function maybeSendMorning() {
  const user = useApp.getState().user
  if (user?.mode !== 'google') return
  const s = await db.settings.get('settings')
  const cfg = { ...DEFAULT_SETTINGS.summaryEmail, ...s?.summaryEmail }
  const today = ymd()
  if (!cfg.enabled || cfg.lastMorningDate === today) return
  if (format(new Date(), 'HH:mm') < cfg.time) return
  try {
    // Mark first (synced) so another device doesn't send a duplicate.
    await save('settings', { id: 'settings', summaryEmail: { ...cfg, lastMorningDate: today } })
    await sendSummary('morning', false)
    toast('Morning plan sent to your inbox ✉️')
  } catch (e) {
    await save('settings', { id: 'settings', summaryEmail: { ...cfg, lastMorningDate: cfg.lastMorningDate } })
    console.warn('Morning summary not sent', e)
  }
}
