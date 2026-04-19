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
CORS_ORIGIN=http://localhost:4200
PORT=5890
```

**Frontend** — controlled by `frontend/src/environments/environment*.ts`, no `.env` needed locally.
