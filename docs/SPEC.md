# LifeOS — Personal Productivity Web App Spec

Oct 3, 2026 · @Prince

## Overview

LifeOS is one browser-only web app for your whole day: alarms, today's tasks, good habits, quitting bad habits, gym and time management. There is no backend server; all data lives in your own Google account.

**Main idea:** one "Today" screen that pulls everything together, with a separate module for each feature.

**Core constraints**

- **Fully client-side:** a static site (HTML + JS), hosted free on Vercel, Netlify or GitHub Pages.
- **Login with Google:** your Gmail account signs you in through Google Identity Services.
- **Storage in your Google account:** data is saved as JSON files in Google Drive's hidden app folder (`appDataFolder`). It uses the same Google account storage (15 GB free) that Gmail uses, and you never see or accidentally delete it.
- **Offline-first:** every change saves to the browser (IndexedDB) instantly, then syncs to Drive in the background.
- **Installable:** works as a PWA on phone and desktop.

**Why Drive app folder and not Gmail itself:** the Gmail API only handles emails and drafts, so it cannot store app data cleanly. Drive's app folder is Google's official place for app data, and it shares the same storage quota.

## Tech stack

Recommended stack: React + Vite + TypeScript with IndexedDB locally and Google APIs for login, storage and email. All of it runs in the browser.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | React + Vite + TypeScript | Fast builds; Claude Code works well with it |
| Styling | Tailwind CSS + shadcn/ui | Clean UI quickly, dark mode built in |
| Routing | React Router | One route per module |
| State | Zustand | Simple global store |
| Local database | Dexie.js (IndexedDB) | Offline storage, fast queries |
| Login | Google Identity Services (token client) | Browser-only OAuth, no client secret |
| Cloud storage | Google Drive API v3, `appDataFolder` | Hidden app data in your Google account |
| Email | Gmail API | Send daily summary to yourself |
| Calendar (optional) | Google Calendar API | Phone reminders even when the app is closed |
| Charts | Recharts | Habit, gym and focus charts |
| Dates | date-fns | Streaks, recurrence, time math |
| PWA | vite-plugin-pwa | Install on phone, offline cache |
| Sound | HTML5 Audio | Alarm and rest-timer sounds |
| Hosting | Vercel or Netlify | Free static hosting with HTTPS |

## Feature list

Ten modules. Build the **MVP** items first; **Later** items come after the app works end to end.

### 1. Today dashboard (home)

- Date, greeting and a progress ring (tasks done %, habits done).
- Next alarm with countdown.
- Today's tasks, with top 3 "must do" pinned.
- Habits due today with one-tap check-in.
- Quit counters, e.g. "No smoking: 12 days".
- Today's workout (if scheduled) with a Start button.
- Focus minutes today and a Start Pomodoro button.
- Quick-add bar for a new task.
- Yesterday's unfinished tasks: "Move to today?" prompt.

### 2. Tasks (to-do)

**MVP**

- Add, edit, delete: title, notes, due date, time, priority (P1–P4), tags.
- Subtasks as a checklist.
- Recurring tasks: daily, weekdays, weekly, monthly, custom.
- Views: Today, Upcoming, All, Completed.
- Overdue tasks carry over automatically.

**Later**

- Eisenhower matrix view (urgent × important).
- Drag-and-drop reorder.
- Natural-language quick add ("gym tomorrow 6pm").

### 3. Alarms and reminders

**MVP**

- Create alarm: time, label, repeat days, sound, volume, on/off.
- Full-screen ring screen with big Snooze and Dismiss buttons.
- Browser notification plus sound when it rings.
- Task reminders: notify X minutes before a task's time.

**Later**

- Wake-up challenge: solve a small maths problem to dismiss.
- Gradual volume increase.
- Mirror alarms to Google Calendar so your phone reminds you even when the app is closed.

### 4. Good habit tracker

**MVP**

- Create habit: name, icon, colour, type (yes/no or count, e.g. 8 glasses of water), schedule (daily, chosen days, X times a week).
- One-tap check-in with undo.
- Current streak and best streak.
- Calendar heatmap (GitHub-style).
- Optional reminder time.

**Later**

- Habit stacking: "after brushing → 10 push-ups".
- Skip or freeze a day (sick day) without breaking the streak.
- Weekly success % chart.

### 5. Quit bad habits

**MVP**

- Create quit goal: name (smoking, junk food, reels), start date, optional cost per day (₹) and minutes wasted per day.
- Live timer: "5 days 4 hrs clean".
- Money saved and time saved counters.
- Relapse button: logs it, resets the timer, keeps history.
- Urge log: trigger, intensity (1–5), what you did instead.
- Milestone badges: 1 day, 3 days, 1 week, 1 month, 3 months.

**Later**

- Trigger insights, e.g. "most urges around 10 pm".
- Link a replacement habit that opens when you log an urge.
- "Why I'm quitting" note shown during an urge.

### 6. Gym tracker

**MVP**

- Exercise library: common exercises preloaded plus custom, grouped by muscle.
- Workout templates (Push, Pull, Legs, or your own).
- Live logging: sets × reps × weight (kg), tick each set.
- Rest timer that starts after each set, with sound.
- Workout history with duration and total volume.
- Personal records detected automatically.

**Later**

- Progress chart per exercise (best weight over time).
- Body weight and measurements log with chart.
- Weekly gym schedule that shows on the Today screen.
- Last session's numbers shown while you log.

### 7. Time management

**MVP**

- Pomodoro timer: 25/5 default, custom lengths, long break after 4 rounds.
- Link a focus session to a task.
- Time-blocking day planner: drag tasks into hourly slots.
- Time log by category (Work, Study, Gym, etc.).

**Later**

- Weekly review: planned vs actual time.
- Full-screen focus mode.
- Daily and weekly time reports.

### 8. Gmail and Google integration

**MVP**

- Sign in with Google; show name and photo.
- Sync all data to the Drive app folder.
- Daily summary email to yourself (morning plan or night report), sent through the Gmail API while the app is open.

**Later**

- Turn starred emails into tasks (needs Gmail read access; see Google setup).
- Push time blocks and alarms to Google Calendar.

### 9. Stats and insights

- Weekly and monthly view: tasks completed, habit success %, quit streaks, workouts, focus hours.
- One simple chart per module.

### 10. Settings

- Theme (light/dark), week start day, 12/24-hour time.
- Default Pomodoro lengths and alarm sound.
- Notification permission check with a Test button.
- Sync status (last synced time) and Sync now.
- Export and import all data as JSON, delete all data, sign out.

## App flow

Every visit takes one path: open, sign in once, load and sync, then land on Today. Onboarding runs only when your Drive has no LifeOS data yet.

&#91;embedded content: app flow · login, sync, onboarding, 8 modules\]

A returning visit skips sign-in and loads from local storage first, so Today opens without waiting for Drive.

**First-time onboarding**

1. Allow notifications and tap "Enable alarm sound".
2. Set a wake-up alarm.
3. Pick up to 3 good habits.
4. Add one quit goal (optional).
5. Choose your gym days.

**Navigation**

- Mobile: bottom nav with Today, Tasks, Habits, Gym and More (Alarms, Quit, Focus, Stats, Settings).
- Desktop: sidebar with all 9 pages.
- Every card on Today opens its module.

**Daily loop**

1. **Morning:** alarm rings → Dismiss → Today shows the plan; the morning summary email goes out.
2. **Day:** work through tasks in Pomodoro sessions; task reminders fire; log the gym session from a template with the rest timer.
3. **Urges:** log them in Quit; a relapse resets the timer but keeps history.
4. **Night:** tick habits, review the day, send the night report. Data is already synced.

## Storage and sync

The browser (IndexedDB) is the working copy; Drive's app folder is the backup and the bridge between devices. The UI never waits for the network.

**Files in Drive `appDataFolder`** (one JSON file per module keeps uploads small)

| File | Holds |
| --- | --- |
| `meta.json` | Schema version, last sync time, device id |
| `settings.json` | User preferences |
| `tasks.json` | Tasks and subtasks |
| `alarms.json` | Alarms |
| `habits.json` | Habits and daily check-ins |
| `quit.json` | Quit goals, relapses, urge logs |
| `gym.json` | Exercises, templates, workouts, body logs |
| `time.json` | Focus sessions and time blocks |

**Sync rules**

1. **On login:** list files in `appDataFolder`; create any that are missing.
2. **First load:** download each file and merge it with IndexedDB record by record. The record with the newer `updatedAt` wins.
3. **Every edit:** write to IndexedDB first (UI updates instantly), set `updatedAt`, mark that module as dirty.
4. **Upload:** after 5 seconds of no edits, upload only the dirty files.
5. **Flush:** also upload when the tab is hidden or closed, and on Sync now.
6. **Deletes:** soft delete with `deletedAt`, so other devices learn about it; purge after 30 days.
7. **Offline:** keep dirty flags and retry when the browser comes back online.
8. **Expired login:** Google access tokens last about 1 hour. Request a new one silently; if that fails, show a "Reconnect Google" banner. Local data stays safe meanwhile.

## Data model

Fourteen entities. Every record also has `id` (UUID), `createdAt`, `updatedAt` and `deletedAt` for sync.

| Entity | File | Key fields |
| --- | --- | --- |
| Task | tasks | title, notes, dueDate, dueTime, priority (1–4), tags\[\], subtasks\[{id, title, done}\], recurrence, status, completedAt, reminderMinutesBefore |
| Alarm | alarms | time (HH:mm), label, repeatDays\[0–6\], sound, volume, enabled, snoozeMinutes, linkedTaskId? |
| Habit | habits | name, icon, color, type (check / count), target, schedule {kind, days\[\], timesPerWeek}, reminderTime |
| HabitLog | habits | habitId, date (YYYY-MM-DD), value |
| QuitGoal | quit | name, startDate, costPerDay (₹), minutesPerDay, reason |
| Relapse | quit | quitGoalId, at, note |
| UrgeLog | quit | quitGoalId, at, trigger, intensity (1–5), action |
| Exercise | gym | name, muscleGroup, equipment, isCustom |
| WorkoutTemplate | gym | name, exercises\[{exerciseId, sets, reps}\] |
| Workout | gym | templateId?, startedAt, endedAt, entries\[{exerciseId, sets\[{reps, weightKg, done}\]}\], notes |
| BodyLog | gym | date, weightKg, measurements {} |
| FocusSession | time | taskId?, category, startedAt, durationMin, type (focus / break) |
| TimeBlock | time | date, start, end, title, taskId?, category |
| Settings | settings | theme, weekStart, timeFormat, pomodoro {focus, short, long}, defaultSound, summaryEmail {enabled, time} |

Streaks, PRs, money saved and stats are calculated from these records, not stored.

## Google Cloud setup

You need one Google Cloud project and one OAuth Client ID. Do this once, before Phase 1.

1. Open Google Cloud Console and create a project named "LifeOS".
2. In APIs & Services → Library, enable **Google Drive API** and **Gmail API** (add **Google Calendar API** only if you build the calendar features).
3. Set up the OAuth consent screen: user type External, add app name and your email.
4. Keep publishing status on **Testing** and add your own Gmail as a test user. This is enough for personal use.
5. Create credentials → OAuth client ID → type **Web application**.
6. Add Authorized JavaScript origins: `http://localhost:5173` and your live URL (e.g. `https://your-app.vercel.app`).
7. Put the Client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`. A client-side app uses no client secret; never put one in frontend code.

**Scopes to request**

| Scope | Used for | When |
| --- | --- | --- |
| `openid email profile` | Name and photo | Phase 1 |
| `https://www.googleapis.com/auth/drive.appdata` | Hidden app data folder | Phase 1 |
| `https://www.googleapis.com/auth/gmail.send` | Daily summary email | Phase 8 |
| `https://www.googleapis.com/auth/gmail.readonly` | Starred emails → tasks | Later |
| `https://www.googleapis.com/auth/calendar.events` | Alarms and blocks to Calendar | Later |

Ask for each scope only when its feature is first used (incremental consent). Gmail read access is a restricted scope: fine in Testing mode for yourself, but a public launch needs Google verification. In Testing mode, Google shows an "unverified app" warning at login; click Continue.

## Build phases for Claude Code

Build in 10 phases, one phase per Claude Code session. Test and commit after each phase before starting the next.

**How to use this with Claude Code**

- Export this doc as Markdown and save it in your repo as `docs/SPEC.md`.
- Create a `CLAUDE.md` in the repo root with: "Read docs/SPEC.md before any work. Fully client-side, no backend. TypeScript strict. Keep each module in src/features/\<module>."
- Paste one prompt below per session. Ask Claude Code to list what it built and how to test it at the end.
- Run `git commit` after each working phase so you can roll back.

| Phase | Builds | Done when |
| --- | --- | --- |
| 0 | Project setup, layout, routes | All pages open from the nav |
| 1 | Google login, IndexedDB, Drive sync | Data survives refresh and shows on a 2nd device |
| 2 | Tasks + Today dashboard | You can plan and finish a day |
| 3 | Good habits | Streaks and heatmap correct |
| 4 | Quit bad habits | Timer, savings, relapse history work |
| 5 | Alarms + reminders | Alarm rings with tab in background |
| 6 | Gym tracker | Full workout logged with rest timer |
| 7 | Time management | Pomodoro + day planner work |
| 8 | Gmail summary email | Summary arrives in your inbox |
| 9 | Stats, settings, polish | Export/import works, PWA installs |

### Phase 0 — Setup

```
Create a React + Vite + TypeScript app called LifeOS with Tailwind CSS, shadcn/ui, React Router, Zustand, Dexie, date-fns, Recharts and vite-plugin-pwa. It must be fully client-side with no backend. Build an app shell with a sidebar on desktop and a bottom nav on mobile, routes /today /tasks /alarms /habits /quit /gym /focus /stats /settings with placeholder pages, and a light/dark theme toggle. Follow docs/SPEC.md.
```

### Phase 1 — Login, local database, Drive sync

```
Implement Google sign-in with the Google Identity Services token client (no backend, no client secret, Client ID from VITE_GOOGLE_CLIENT_ID). Request openid email profile and drive.appdata. Keep the access token in memory and silently re-request it when it expires; show a "Reconnect Google" banner if that fails. Create the Dexie schema for all entities in the Data model section of docs/SPEC.md. Build a sync service exactly as described in the Storage and sync section: one JSON file per module in appDataFolder, merge by updatedAt per record, soft deletes, 5-second debounced upload of dirty modules, flush on visibilitychange, retry when online. Show sync status and a Sync now button in the header.
```

### Phase 2 — Tasks and Today

```
Build the Tasks module and the Today dashboard from docs/SPEC.md (MVP items only). Tasks: CRUD, subtasks, priority P1-P4, tags, due date and time, recurring rules, views Today/Upcoming/All/Completed, overdue carry-over. Today: progress ring, pinned top 3, quick-add bar, "move yesterday's unfinished tasks to today" prompt, and placeholder cards for alarms, habits, quit, gym and focus that later phases will fill.
```

### Phase 3 — Good habits

```
Build the Good habit tracker MVP from docs/SPEC.md: create habits (check or count type, daily / chosen days / X per week schedule), one-tap check-in with undo, current and best streak that respect the schedule, a GitHub-style calendar heatmap, and the Today card. Write unit tests for the streak logic.
```

### Phase 4 — Quit bad habits

```
Build the Quit bad habits MVP from docs/SPEC.md: quit goals with start date, cost per day in rupees and minutes per day; a live "clean for" timer; money and time saved; relapse button that resets the timer and keeps history; urge log with trigger, intensity 1-5 and action taken; milestone badges at 1, 3, 7, 30 and 90 days; and the Today card.
```

### Phase 5 — Alarms and reminders

```
Build the Alarms MVP from docs/SPEC.md. Create, edit and toggle alarms with repeat days, sound and volume. Check due alarms every few seconds against the real clock time (Date.now), not a countdown, so background-tab throttling only delays by seconds. When due: play sound in a loop, show a browser notification, and open a full-screen ring screen with Snooze and Dismiss. Add an "Enable alarm sound" button that unlocks audio after one user tap. Request a Screen Wake Lock while an alarm is armed on mobile. Add task reminders X minutes before a task's time. Show next alarm on Today.
```

### Phase 6 — Gym tracker

```
Build the Gym tracker MVP from docs/SPEC.md: a preloaded exercise library grouped by muscle plus custom exercises, workout templates, a live workout screen logging sets x reps x weight in kg with tick-off, an auto-starting rest timer with sound, workout history with duration and total volume, automatic personal records, and the Today card.
```

### Phase 7 — Time management

```
Build the Time management MVP from docs/SPEC.md: a Pomodoro timer (25/5 default, custom lengths, long break after 4) that can be linked to a task and is saved as FocusSession records; a time-blocking day planner where tasks are dragged into hourly slots; and a time log by category. Show focus minutes on Today.
```

### Phase 8 — Gmail summary

```
Add a daily summary email using the Gmail API (gmail.send scope, requested only when the user turns this feature on). Build the email as simple HTML: today's tasks, habits due, quit streaks, planned workout. Send it on the first app open of the day (morning plan) and offer a "Send night report" button. Add the on/off switch and send time to Settings.
```

### Phase 9 — Stats, settings, polish

```
Build the Stats page (weekly and monthly charts per module) and complete Settings from docs/SPEC.md: theme, week start, 12/24-hour time, Pomodoro defaults, notification test button, export and import all data as JSON, delete all data, sign out. Add PWA icons and manifest, empty states for every page, and check the whole app on a phone-sized screen.
```

## Limitations and workarounds

The biggest trade-off of "no backend": the app cannot wake itself up. Alarms and emails only fire while the app is open somewhere.

| Limitation | Why | Workaround |
| --- | --- | --- |
| Alarm won't ring if the browser or tab is closed | Web pages can't run when closed; push notifications need a server | Keep LifeOS open as a pinned tab or installed PWA; mirror alarms to Google Calendar reminders |
| Background tabs slow down timers | Browsers throttle hidden tabs, up to about once a minute | Compare against real clock time, not a countdown; minute accuracy is fine for alarms |
| Phone screen lock can pause the page | Mobile browsers suspend background pages | Screen Wake Lock while an alarm is armed; Calendar mirror as backup |
| Alarm sound may not play | Browsers block audio until the user taps the page once | "Enable alarm sound" button, tapped once per session |
| Login token expires about every hour | Browser-only login gets no refresh token | Silent re-request; local-first storage means nothing is lost |
| Summary email can't send at a fixed time | No server to trigger it | Send on first open of the day, or by button at night |
| Two devices editing the same item at once | Last write wins | Per-record timestamps keep any loss to that one item |
| Gmail read scope is restricted | Google policy | Stay in Testing mode for personal use; verify only if going public |
