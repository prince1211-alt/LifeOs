# LifeOS

Read docs/SPEC.md before any work.

- Fully client-side, no backend. Data lives in IndexedDB (Dexie) and syncs to Google Drive `appDataFolder`.
- TypeScript strict. Keep each module in `src/features/<module>`.
- All writes go through `src/lib/repo.ts` so `updatedAt` is set and the module is marked dirty for sync.
- Shared logic (streaks, recurrence, quick-add parsing, PRs, sync merge) lives in `src/lib` with unit tests next to it.
- Checks: `npm run typecheck`, `npm test`, `npm run build`.
