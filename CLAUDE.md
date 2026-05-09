# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (port 5890)
```bash
cd backend && npm run dev      # nodemon auto-reload
cd backend && npm start        # plain node
```

### Frontend (port 4200)
```bash
cd frontend && npm start       # ng serve
cd frontend && npm run build   # build only
```

### Production build (from repo root)
```bash
npm run build    # builds Angular, outputs to frontend/dist/renmito-frontend/browser
```

Vercel runs `npm run build` automatically on deploy. No test suite exists — testing is manual.

## Architecture

Full-stack app: Angular 19 frontend + Node/Express backend + MongoDB Atlas. In production both are served under the same Vercel domain; the backend rewrites `/api/*` to `backend/src/app.js`.

**Frontend** (`frontend/src/app/`)
- Angular 19 standalone components throughout — no NgModules.
- Service-based state, no NgRx/Redux. Services use RxJS Observables; components `.subscribe()` or use `async` pipe.
- `authInterceptor` (functional `HttpInterceptorFn`) auto-attaches `Authorization: Bearer <token>` to every request except `/api/auth/*`.
- Token and user stored in `localStorage` under keys `renmito-token` / `renmito-user`.
- `AppComponent` owns the root layout, current-date state, login-gate, and date-change events.

**Backend** (`backend/src/`)
- Standard controller → service → model layering. Routes in `routes/`, handlers in `controllers/`, business logic in `services/`, Mongoose schemas in `models/`.
- MongoDB connection is lazy (opened on first request) — required for Vercel's serverless model.
- On cold start, `seedDefaults.js` and `seedEnhancements.js` upsert system-wide `DefaultLogType` and `Enhancement` documents.
- All routes except `/api/auth/*` require a valid JWT Bearer token (7-day expiry, validated in `middleware/authMiddleware.js`).

**API base URLs**
- Dev: `http://localhost:5890/api` (set in `frontend/src/environments/environment.ts`)
- Prod: `/api` (set in `environment.prod.ts`, same domain)

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

**Performance profiler**: `AppComponent` wraps startup HTTP calls in `performance.mark()` / `performance.measure()`. Output appears in DevTools User Timings or the `[Renmito Perf]` console group.

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

**Frontend** — controlled by `frontend/src/environments/environment*.ts`, no `.env` needed locally.

**CORS_ORIGIN default** (when unset) covers web + mobile: `http://localhost:4200,https://localhost,capacitor://localhost`. Vercel production uses `*`.

## Mobile App (Android — Capacitor)

A native Android app is maintained alongside the web app using **Capacitor 8**. The Android project lives at `frontend/android/`. The web app and mobile app share the same Angular codebase — no separate React Native project.

**Key files:**
- `frontend/capacitor.config.ts` — app ID `com.renmito.app`, `webDir: dist/renmito-frontend/browser`
- `frontend/src/environments/environment.mobile.ts` — uses absolute API URL `https://renmito.vercel.app/api` (not relative `/api`)
- `frontend/angular.json` — `mobile` build configuration (uses `environment.mobile.ts`, larger budgets)

**Mobile build workflow:**
```bash
cd frontend
npm run android:build   # ng build --configuration mobile + cap sync android
npm run android:open    # above + opens Android Studio (then Build → Build APK)
```

**Implicit rules — apply these whenever touching the frontend:**

1. **Layout / spacing changes**: Any padding, margin, or top-bar height change must preserve `env(safe-area-inset-top)` on `.top-strip` so content stays below the Android status bar. Pattern: `padding-top: calc(Xpx + env(safe-area-inset-top))`.

2. **New top-level UI chrome** (headers, banners, sticky bars added above the main content): Add `padding-top: env(safe-area-inset-top)` to the outermost element. Bottom chrome (tab bars, FABs): use `padding-bottom: env(safe-area-inset-bottom)`.

3. **New environment variable usage in Angular**: If a service or component reads from `environment.*`, add the same key to `environment.mobile.ts` with the correct production value.

4. **New API base URL references**: Never hardcode `/api` — always use `environment.apiBase`. The mobile build uses the absolute Vercel URL; relative paths break in a Capacitor WebView.

5. **After any frontend change**: remind to run `npm run android:build` from `frontend/` and rebuild the APK in Android Studio to get the change on device.

6. **CORS changes** (new origins, new methods): Update `backend/src/config.js` CORS default and `backend/.env.example` to keep mobile origins (`https://localhost`, `capacitor://localhost`) in the allowed list.
