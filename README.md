# LifeOS

One browser-only web app for your whole day: alarms, tasks, good habits, quitting bad habits, gym and time management.
There is no backend: data lives in your browser (IndexedDB) and syncs to a hidden app folder in your own Google Drive.

Full spec: [`docs/SPEC.md`](docs/SPEC.md).

## Features

| Module | MVP | Later (also built) |
| --- | --- | --- |
| **Today** | Greeting, progress ring, next alarm, tasks with 3 pinned "must do", habit check-in, quit counters, workout, focus, quick-add, "move yesterday's tasks?" | Night report button |
| **Tasks** | CRUD, subtasks, P1–P4, tags, due date/time, recurring rules, Today/Upcoming/All/Completed, overdue carry-over | Eisenhower matrix (drag between quadrants), drag-and-drop reorder, natural-language quick add (`gym tomorrow 6pm p1 #health`) |
| **Alarms** | Time, label, repeat days, sound, volume, on/off, full-screen ring screen, Snooze/Dismiss, notification + sound, task reminders | Maths wake-up challenge, gradual volume, mirror to Google Calendar |
| **Habits** | Check or count type, daily / chosen days / X per week, one-tap check-in with undo, current + best streak, GitHub-style heatmap, reminder time | Habit stacking, skip/freeze a day, weekly success % chart |
| **Quit** | Start date, ₹ cost and minutes per day, live clean timer, money/time saved, relapse button with history, urge log, milestone badges | Trigger insights (peak hour, top triggers), replacement habit, "Why I'm quitting" shown during an urge |
| **Gym** | Preloaded exercise library + custom, templates (Push/Pull/Legs), live sets × reps × kg, auto rest timer with sound, history with duration/volume, automatic PRs | Progress chart per exercise, body weight + measurements log, weekly schedule on Today, last session's numbers while logging |
| **Focus** | Pomodoro (25/5, long break after 4), link to a task, drag-to-schedule day planner, time log by category | Weekly review (planned vs actual), full-screen focus mode, daily/weekly reports |
| **Google** | Sign in with Google, Drive `appDataFolder` sync, daily summary email via Gmail | Starred emails → tasks, push time blocks and alarms to Calendar |
| **Stats** | Weekly/monthly charts for tasks, habits, gym volume, focus hours, quit streaks | |
| **Settings** | Theme, week start, 12/24 h, Pomodoro defaults, alarm sound, notification test, sync status + Sync now, JSON export/import, delete all data, sign out | PWA install |

A **"Use on this device only"** mode works without any Google setup (data stays in the browser).

## Design

LifeOS follows **Material Design 3**, the design system of Google's own apps: Google Sans Flex, Material Symbols icons,
Material You dynamic colour (pick a theme colour in Settings), a Gmail/Drive-style navigation drawer with a **New** menu,
a phone navigation bar, FABs, bottom sheets and snackbars. Rules and components: [`docs/DESIGN.md`](docs/DESIGN.md).

## Tech stack

React 19 + Vite + TypeScript (strict) · Tailwind CSS v4 with Material 3 components · Material Symbols · Google Sans Flex · @material/material-color-utilities · React Router · Zustand · Dexie (IndexedDB) ·
Google Identity Services, Drive v3, Gmail, Calendar · Recharts · date-fns · dnd-kit · vite-plugin-pwa (injectManifest service worker).

## Getting started

```bash
npm install
cp .env.example .env      # add your Google OAuth Client ID (optional for local-only mode)
npm run dev               # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build (with service worker) to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (streaks, recurrence, quick-add parser, sync merge, PRs, quit stats) |
| `npm run typecheck` | TypeScript only |

## Google Cloud setup (once)

1. In Google Cloud Console create a project "LifeOS".
2. APIs & Services → Library: enable **Google Drive API** and **Gmail API** (and **Google Calendar API** for the calendar features).
3. OAuth consent screen: External, add app name and your email. Keep it in **Testing** and add your Gmail as a test user.
4. Credentials → Create OAuth client ID → **Web application**.
5. Authorized JavaScript origins: `http://localhost:5173`, `http://localhost:4173` and your live URL (e.g. `https://your-app.vercel.app`).
6. Put the Client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`. Never add a client secret to a frontend app.

Scopes are requested only when a feature first needs them (incremental consent):
`openid email profile` + `drive.appdata` at sign-in, `gmail.send` when you turn on the summary email,
`calendar.events` when you turn on Calendar mirroring, `gmail.readonly` for starred-email import.
In Testing mode Google shows an "unverified app" warning — click Continue.

## Deploy

Static hosting with HTTPS (needed for service workers and notifications):

- **Vercel**: import the repo, set `VITE_GOOGLE_CLIENT_ID`, deploy. `vercel.json` rewrites routes to `index.html`.
- **Netlify**: build `npm run build`, publish `dist`. `public/_redirects` handles routes.

Add the deployed URL to the OAuth client's authorized origins.

## How sync works

- Every edit writes to IndexedDB first (`src/lib/repo.ts`), stamps `updatedAt` and marks its module dirty.
- After 5 s without edits, dirty modules upload; also on tab hide/close, on reconnect and on **Sync now**.
- One JSON file per module in Drive `appDataFolder` (`tasks.json`, `habits.json`, …, `meta.json`).
- Merges are record by record; the newer `updatedAt` wins. Deletes are soft (`deletedAt`) and purged after 30 days.
- Access tokens last ~1 hour; LifeOS re-requests silently and shows **Reconnect Google** if that fails. Local data stays safe.

## Android app (APK)

The same app is packaged for Android with [Capacitor](https://capacitorjs.com). On Android, alarms, snoozes,
task and habit reminders, and the Pomodoro/rest timers are **scheduled system notifications**, so they ring
even when LifeOS is closed or the phone is locked.

**Download:** https://github.com/prince1211-alt/LifeOs/releases/latest/download/LifeOS.apk
(open on the phone → tap the file → allow "Install unknown apps" for your browser when asked).

The APK is built by GitHub Actions (`.github/workflows/android.yml`) on every push to `main` and published as a
release. Every build is signed with the same key, so updates install over the old version and keep your data.

### One-time setup

| Where | What | Why |
| --- | --- | --- |
| GitHub → Settings → Secrets and variables → Actions → **Secrets** | `LIFEOS_KEYSTORE_PASSWORD` = the keystore password | Unlocks the committed, encrypted signing key `android/app/lifeos-release.p12` |
| Same page → **Variables** | `VITE_GOOGLE_CLIENT_ID` = your Web client ID | Google sign-in inside the app |
| Google Cloud → Google Auth Platform → Clients → **Create client → Android** | Package name `app.lifeos.android`, SHA-1 `15:9B:EA:EB:60:36:33:73:2D:65:55:56:5B:5B:34:0A:41:88:5B:60` | Lets the app use Android's Google sign-in (same project as the Web client) |

Without the secret the workflow still builds a debug-signed APK (artifact only, no release); without the variable the
app works in "this device only" mode.

### Build locally

Needs JDK 21 and the Android SDK (or Android Studio):

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug    # → android/app/build/outputs/apk/debug/app-debug.apk
```

Native code: `android/` (MainActivity forwards Google consent results to the sign-in plugin),
`src/lib/native/` (notification scheduling, Google sign-in, back button, status bar),
`scripts/gen-android-sounds.mjs` (notification sounds).

## Known limits (no backend)

- On the **web**, alarms and the summary email only fire while LifeOS is open (pinned tab or installed PWA). The **Android app** rings alarms and reminders even when closed; the summary email still sends when the app opens.
- Browsers block sound until one tap per session — use **Enable alarm sound**.
- On phones, a Screen Wake Lock is requested while an alarm is armed so the page isn't suspended.

## Project layout

```
src/
  lib/            data model, Dexie DB, repo (writes), sync + merge, Google APIs, streaks, recurrence, NLP, gym, quit
  features/<module>/   today, tasks, alarms, habits, quit, gym, focus, stats, settings, onboarding, auth, summary
  components/     app shell, nav, shadcn-style UI primitives
  sw.ts           service worker (offline cache + notification clicks)
```
