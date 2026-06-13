# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (port 5890)
```bash
cd backend && npm run dev      # nodemon auto-reload
cd backend && npm start        # plain node
```

### Frontend — React (port 4200) ← **active development target**
```bash
cd frontend-react && npm start          # Vite dev server
cd frontend-react && npm run build      # production build
cd frontend-react && npm run build:mobile  # mobile build (Capacitor)
```

> **Do all frontend work in `frontend-react/`** (React + Vite + TypeScript).  
> The legacy Angular app in `frontend/` is frozen — do not modify it.

### Production build (from repo root)
```bash
npm run build    # builds React app, outputs to frontend-react/dist
```

Vercel runs `npm run build` automatically on deploy. No test suite exists — testing is manual.

## Architecture

Full-stack app: React frontend (Vite) + Node/Express backend + MongoDB Atlas. In production both are served under the same Vercel domain; the backend rewrites `/api/*` to `backend/src/app.js`.

**Frontend** (`frontend-react/src/`)
- React 18 + TypeScript + Vite.
- Token and user stored in `localStorage` under keys `renmito-token` / `renmito-user`.
- All API calls use `environment.apiBase` (never hardcode `/api`).

> The legacy Angular app in `frontend/` is no longer actively developed.

**Backend** (`backend/src/`)
- Standard controller → service → model layering. Routes in `routes/`, handlers in `controllers/`, business logic in `services/`, Mongoose schemas in `models/`.
- MongoDB connection is lazy (opened on first request) — required for Vercel's serverless model.
- On cold start, `seedDefaults.js` and `seedEnhancements.js` upsert system-wide `DefaultLogType` and `Enhancement` documents.
- All routes except `/api/auth/*` require a valid JWT Bearer token (7-day expiry, validated in `middleware/authMiddleware.js`).

**API base URLs**
- Dev: `http://localhost:5890/api` (set in `frontend-react/src/environments/environment.ts`)
- Prod: `/api` (set in `environment.prod.ts`, same domain)
- Mobile: `https://renmito.vercel.app/api` (set in `environment.mobile.ts`)

## Core Data Models

**TimeLog** — a single time entry.
- `entryType: 'range' | 'point'`: range logs have start/end; point logs are a single timestamp.
- `logTypeSource: 'DefaultLogType' | 'LogType'`: tells Mongoose which collection to populate `logTypeId` from.
- `status: 'running' | 'completed' | 'cancelled'`; running logs use `lastHeartbeatAt`.

**DefaultLogType vs LogType** — `DefaultLogType` is seeded from `backend/src/data/defaultLogTypes.json` and is read-only/shared across all users. `LogType` is user-created.

**Journey + JourneyEntry** — habit/metric tracker.
- `trackerType: 'point-log'`: user enters values manually.
- `trackerType: 'derived'`: values are auto-computed from matching `TimeLogs` (see `derivedFrom.valueMetric`: `duration`, `count`, `start-time`, `end-time`). Re-sync via `POST /api/journeys/:id/resync`.

**DayLevelMetadata** — per-date metadata: day classification (`working`, `holiday`, `wfh`, etc.) and snapshots of important logs (wake, meals, sleep).

**UserPreference** — palette/theme presets, `activeLog` (running timer), and quick-start shortcuts.

## Key Patterns

**Adding a new API resource**: create model → service → controller → route → mount in `app.js`.

**Log creation side-effect**: `logs.service.js` calls `journeys.service.syncLogEntry()` after every log create/update/delete so derived journeys stay consistent.

**Derived journey resync**: rebuilds all `JourneyEntry` documents for a journey by querying `TimeLogs` filtered by `logTypeId` and computing values from `valueMetric`.

**Theme/palette**: active palette is stored in `UserPreference.palette`; custom presets in `UserPreference.customPresets` (max 10).

**Performance profiler**: startup HTTP calls are wrapped in `performance.mark()` / `performance.measure()`. Output appears in DevTools User Timings or the `[Renmito Perf]` console group.

## Environment Variables

**Backend `.env`** (copy from `backend/.env.example`):
```
DB_USERNAME=
DB_PASSWORD=
JWT_SECRET=          # min 32 random chars
MASTER_KEY=          # optional: bypasses bcrypt for any account (dev use)
CORS_ORIGIN=http://localhost:4200,https://localhost,capacitor://localhost
PORT=5890
```

**Frontend** — controlled by `frontend-react/src/environments/environment*.ts`, no `.env` needed locally.

**CORS_ORIGIN default** (when unset) covers web + mobile: `http://localhost:4200,https://localhost,capacitor://localhost`. Vercel production uses `*`.

## Mobile App (Android — Capacitor)

A native Android app is maintained alongside the web app using **Capacitor 8**. The Android project lives at `frontend-react/android/`. The web app and mobile app share the same React codebase.

**Key files:**
- `frontend-react/capacitor.config.ts` — app ID `com.renmito.app`, `webDir: dist`
- `frontend-react/src/environments/environment.mobile.ts` — uses absolute API URL `https://renmito.vercel.app/api` (not relative `/api`)

**Mobile build workflow:**
```bash
cd frontend-react
npm run android:build   # vite build --mode mobile + cap sync android
npm run android:open    # above + opens Android Studio (then Build → Build APK)
```

**Implicit rules — apply these whenever touching the frontend:**

1. **Layout / spacing changes**: Any padding, margin, or top-bar height change must preserve `env(safe-area-inset-top)` on `.top-strip` so content stays below the Android status bar. Pattern: `padding-top: calc(Xpx + env(safe-area-inset-top))`.

2. **New top-level UI chrome** (headers, banners, sticky bars added above the main content): Add `padding-top: env(safe-area-inset-top)` to the outermost element. Bottom chrome (tab bars, FABs): use `padding-bottom: env(safe-area-inset-bottom)`.

3. **New environment variable usage**: If a component reads from `environment.*`, add the same key to `environment.mobile.ts` with the correct production value.

4. **New API base URL references**: Never hardcode `/api` — always use `environment.apiBase`. The mobile build uses the absolute Vercel URL; relative paths break in a Capacitor WebView.

5. **After any frontend change**: remind to run `npm run android:build` from `frontend-react/` and rebuild the APK in Android Studio to get the change on device.

6. **CORS changes** (new origins, new methods): Update `backend/src/config.js` CORS default and `backend/.env.example` to keep mobile origins (`https://localhost`, `capacitor://localhost`) in the allowed list.

7. **No unused variables/imports**: The mobile build runs `tsc -b` with strict settings — any declared-but-unused variable, state, import, or function is a hard error (`TS6133`). After removing a feature or refactoring, always delete all related state, mutations, imports, and helper functions. Run `npx tsc -b --noEmit` from `frontend-react/` to verify before committing.

8. **Never gitignore frontend env files that contain non-secret config**: `frontend-react/.env.production` and `frontend-react/.env.mobile` must be committed. They contain only the API base URL — no secrets. If they are missing from git, Vercel builds without them, `VITE_API_BASE` is `undefined`, and every API call hits the wrong path (returns HTML instead of JSON). Rule: if an `.env.*` file has no credentials, commit it.

9. **`?? []` does not protect against wrong-type API responses**: `someApiData ?? []` only falls back for `null`/`undefined`. If the API returns a truthy non-array (e.g. an HTML string or an error object with HTTP 200), `??` passes it through and `.map()`/`.filter()` will crash. Always normalize array-returning fetch functions with `Array.isArray(res.data) ? res.data : []` at the hook level.

10. **Verify the API base URL is baked correctly into every Vercel build**: After any change to `vercel.json` or build pipeline, confirm `ENV.apiBase` resolves to `/api` in the production bundle (not `undefined`). A quick check: open DevTools on the deployed site, run `fetch('/api/health')` in the console — if it returns JSON the routing is correct; if it returns HTML the base URL is broken.

## Frontend Code Registry

**Workflow rule**: Before modifying any feature or introducing new functionality, consult this registry to identify the affected files and their dependencies. Then confirm the scope with the user before making any changes.

All paths are relative to `frontend-react/src/`.

---

### Feature: Logger (Daily Time Logging)
**Route**: `/logger`

| Role | File |
|------|------|
| Page | `pages/LoggerPage.tsx` + `.css` |
| Date navigation card | `components/logger/HeroDateCard.tsx` + `.css` |
| Coverage / time metrics | `components/logger/MetricsCards.tsx` + `.css` |
| Running timer bar | `components/logger/ActiveLogBar.tsx` + `.css` |
| Log list display | `components/logger/LogList.tsx` + `.css` |
| Create / edit / delete log form | `components/logger/LogFormModal.tsx` + `.css` |
| Mark important logs (meals/sleep) | `components/logger/ImportantLogsModal.tsx` + `.css` |
| Daily notes sidebar | `components/logger/NotesSheet.tsx` + `.css` |
| Log CRUD hooks | `hooks/useLogs.ts` |
| Log type hooks | `hooks/useLogTypes.ts` |
| Notes hooks | `hooks/useNotes.ts` |
| Day metadata hooks | `hooks/useDayMetadata.ts` |
| Log / log-type types | `types/log.ts`, `types/log-type.ts` |

**Shared dependencies**: `store/appStore.ts` (selectedDate, activeLog), `hooks/usePreferences.ts` (day settings for metrics), `lib/jiraApi.ts` (ticket search inside LogFormModal), `components/forms/UnifiedSheet.tsx` (SpeedDial log creation).

---

### Feature: Lifestyle (Sleep, Meals, Wellbeing, Sports, Learning)
**Route**: `/lifestyle`

| Role | File |
|------|------|
| Page | `pages/LifestylePage.tsx` + `.css` |
| Food log form (meals only) | `components/lifestyle/FoodLogSheet.tsx` + `.css` |
| Generic log form (non-food) | `components/logger/LogFormModal.tsx` (reused) |
| Date navigation card | `components/logger/HeroDateCard.tsx` (reused) |

**Categories** (`LIFESTYLE_CATS` in `LifestylePage.tsx`):

| ID | Label | Log categories | Pinned log types |
|----|-------|---------------|-----------------|
| `sleep` | Sleep & Rest | `sleep` | Sleep |
| `meals` | Meals | `food` | Breakfast, Lunch, Dinner, Food Intake |
| `sports` | Sports & Activity | `sport` | — |
| `wellbeing` | Wellbeing | `wellbeing` | — |
| `learning` | Learning | `learning` | — |

**Routing logic**: `logType.category === 'food'` → `FoodLogSheet`; all other categories → `LogFormModal`.

**FoodLogSheet — time input design**:
- Single point-in-time input (no Start/Finish range visible to user).
- Dual stacked progress-bar sliders: **hr** (0–23, 24 stops) and **min** (0–55, 12 stops at 5-min intervals).
- Fill div (`fls-track-fill`) uses `position: absolute; inset` — not `height: 100%` — to avoid baseline gaps.
- Fill width formula: `calc(5px + var(--frac, 0) * (100% - 10px))` where `--frac` is a 0–1 decimal; `5px` = half the 10px thumb width to keep the fill's right edge perfectly under the thumb centre.
- Rectangular notch thumb: 10 × 22 px, `border-radius: 3px`. Webkit centering: `margin-top: -3px` = `(track_height 16px − thumb_height 22px) / 2`.
- While dragging, a small floating label (`fls-thumb-label`) appears above the thumb showing the raw hour or minute number.
- Clicking the time display (`fls-time-display`) enters manual-edit mode: a bare `<input>` pre-filled in 12 h format, auto-selects on focus. Accepts `H:MM AM/PM` or `HH:MM` (24 h); minutes are snapped to nearest 5 on commit. Enter/blur = commit, Escape = cancel.
- On save: stored as `entryType: 'range'` with `startAtISO = selectedTime` and `endAtISO = selectedTime + 15 mins`. The 15-min duration is shown as `"till next 15mins"` beside the time display.

**Shared dependencies**: `hooks/useLogs.ts`, `hooks/useLogTypes.ts`, `lib/time.ts` (`localToISOString`, `isoToHHMM`).

---

### Feature: Journeys (Habit / Metric Tracking)
**Route**: `/journeys`

| Role | File |
|------|------|
| Page | `pages/JourneysPage.tsx` + `.css` |
| Journey + entry hooks | `hooks/useJourneys.ts` |
| Journey / entry types | `types/journey.ts` |

**Shared dependencies**: `hooks/useLogTypes.ts` (derived journey config), `lib/api.ts`, Chart.js (line chart visualisation).

---

### Feature: Configuration (Settings)
**Route**: `/configuration`

| Role | File |
|------|------|
| Page | `pages/ConfigurationPage.tsx` + `.css` |
| Theme / palette editor | `components/settings/ThemeEditor.tsx` + `.css` |
| Preferences hooks | `hooks/usePreferences.ts` |
| Log type hooks | `hooks/useLogTypes.ts` |
| Palette utilities | `lib/palette.ts` |
| Preference types | `types/preference.ts` |
| Notifications hook (mobile) | `hooks/useNotifications.ts` |

**Shared dependencies**: `hooks/useAuth.ts` (change-password), `store/appStore.ts`.

---

### Feature: Proactive Notifications (Mobile — Android only)
**Scope**: Background nudge notifications to remind the user to log their time. Only active on the native Capacitor build (`Capacitor.isNativePlatform()`); all hook functions are no-ops on web.

| Role | File |
|------|------|
| Hook — scheduling, permissions, enable/disable | `hooks/useNotifications.ts` |
| UI — toggle + frequency picker + preview button | `pages/ConfigurationPage.tsx` (NotificationsAccordion + NotificationsSection) |
| Resume top-up wiring | `layouts/AppLayout.tsx` (visibilitychange listener) |
| Android permissions | `android/app/src/main/AndroidManifest.xml` |

**Key behaviour**:
- Pre-schedules 100 individual `LocalNotifications` in one batch so notifications fire even when the app is killed or the phone reboots. The `@capacitor/local-notifications` plugin registers a `BOOT_COMPLETED` BroadcastReceiver that reschedules pending alarms automatically after a reboot.
- On every app foreground (`visibilitychange`), `topUpNotificationsOnResume()` checks pending count and refills to 100 if below threshold (20).
- 10 nudge phrases rotate round-robin; phrase index persists in `localStorage` under `renmito-notif-phrase-idx`.
- Frequency options: 15 sec (testing), 5 min, 10 min, 15 min, 30 min, 1 h, 2 h, 3 h, 6 h. Stored in `localStorage` under `renmito-notif-interval` (value in minutes; 15 sec = 0.25).
- "Preview Notification" fires a single notification 1.5 s after tap regardless of whether the toggle is on, for testing purposes.
- Required Android permissions: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`.

**localStorage keys**: `renmito-notif-enabled`, `renmito-notif-interval`, `renmito-notif-phrase-idx`, `renmito-notif-id-offset`.

---

### Feature: JIRA Integration
**Route**: `/external-configs/jira`

| Role | File |
|------|------|
| Page | `pages/JiraConfigPage.tsx` + `.css` |
| JIRA API client | `lib/jiraApi.ts` |

**Shared dependencies**: `lib/api.ts` (axios instance for API calls inside jiraApi.ts). Also consumed by `LogFormModal.tsx` for ticket search.

---

### Feature: Journeys Intelligence / AI (Food Insights)
**Route**: `/intelligence`

| Role | File |
|------|------|
| Page | `pages/IntelligencePage.tsx` + `.css` |
| Feature-flag toggle hook | `hooks/usePreferences.ts` → `useUpdateFeatures()` |
| Preference types | `types/preference.ts` |

**Shared dependencies**: `lib/api.ts` (Gemini config check at `/config`).

---

### Feature: Diary (Journaling)
**Route**: `/diary`

| Role | File |
|------|------|
| Page | `pages/DiaryPage.tsx` + `.css` |

**Shared dependencies**: `lib/api.ts` (direct API calls — no dedicated hook file yet). Season / Episode / Sentiment types are defined inline in DiaryPage.tsx.

---

### Feature: Reports
**Route**: `/report`

| Role | File |
|------|------|
| Page | `pages/ReportPage.tsx` + `.css` |

**Shared dependencies**: `lib/api.ts` (direct POST to `/reports`).

---

### Feature: Authentication
**Route**: `/login`

| Role | File |
|------|------|
| Login page | `pages/LoginPage.tsx` + `.css` |
| Auth context + provider | `contexts/AuthContext.tsx` |
| Auth hook | `hooks/useAuth.ts` |
| Auth types | `types/auth.ts` |

**Shared dependencies**: `lib/api.ts` (interceptor registers logout callback), `store/appStore.ts`.

---

### Feature: App Shell & Navigation
**Scope**: Global chrome present on all authenticated pages

| Role | File |
|------|------|
| Auth-guarded layout | `layouts/AppLayout.tsx` + `.css` |
| Top strip (menu + logo) | `components/shell/TopStrip.tsx` + `.css` |
| Left sidebar nav | `components/shell/LeftNav.tsx` + `.css` |
| Bottom tab bar (mobile) | `components/shell/BottomTabBar.tsx` + `.css` |
| Speed-dial FAB | `components/shell/SpeedDialFAB.tsx` + `.css` |
| Global toast | `components/shell/Toast.tsx` + `.css` |
| Route config | `router/index.tsx` |

**Shared dependencies**: `store/appStore.ts` (navOpen, toast), `hooks/useAuth.ts`, `components/forms/UnifiedSheet.tsx` (opened by SpeedDialFAB), `hooks/useNotifications.ts` (`topUpNotificationsOnResume` called on every foreground).

---

### Feature: Quick Log Creation (Unified Sheet)
**Scope**: Reusable sheet opened by SpeedDialFAB and other entry points

| Role | File |
|------|------|
| 3-tab quick-add sheet | `components/forms/UnifiedSheet.tsx` + `.css` |
| Log type selector dropdown | `components/forms/TypeSelector.tsx` + `.css` |
| Time picker input | `components/forms/TimeInput.tsx` + `.css` |

**Shared dependencies**: `hooks/useLogs.ts`, `hooks/useLogTypes.ts`, `hooks/usePreferences.ts` (active log), `store/appStore.ts`.

---

### Feature: AI Chat Log Parser (Renni)
**Scope**: Chat overlay for natural-language log creation

| Role | File |
|------|------|
| Chat component | `components/chat/RenniChat.tsx` + `.css` |

**Shared dependencies**: `hooks/useLogs.ts`, `store/appStore.ts`, `lib/api.ts`.

---

### Feature: Theme / Palette System
**Scope**: Cross-cutting — affects every page

| Role | File |
|------|------|
| Palette math + DOM application | `lib/palette.ts` |
| Palette hooks | `hooks/usePreferences.ts` → `useSavePalette`, `useAddPreset`, etc. |
| Palette editor UI | `components/settings/ThemeEditor.tsx` + `.css` |
| Preference types | `types/preference.ts` |

---

### Shared / Global Infrastructure

| Role | File |
|------|------|
| Zustand UI store | `store/appStore.ts` |
| Axios API client | `lib/api.ts` |
| Environment config | `config/env.ts` |
| App entry | `App.tsx`, `main.tsx` |
| Global styles | `index.css`, `App.css` |
| All type re-exports | `types/index.ts` |
| Loading spinner | `components/LoadingSpinner.tsx` + `.css` |

---

### Phase 4 Placeholders (not yet implemented)

| Feature | File |
|---------|------|
| Timeline view | `pages/TimelinePage.tsx` |
| Eagle View | `pages/EagleViewPage.tsx` |
| Expense Guide — config | `pages/ExpenseGuideConfigPage.tsx` |
| Expense Guide — expenses | `pages/ExpenseGuideExpensesPage.tsx` |
