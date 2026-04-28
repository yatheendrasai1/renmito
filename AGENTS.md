# AGENTS.md — Renmito Codebase Map

Quick reference for AI agents to locate the right file without traversing the whole tree.
Stack: Angular 19 (standalone) · Node/Express · MongoDB Atlas · Vercel.

---

## Bootstrap & Routing

| File | What's there |
|------|-------------|
| `frontend/src/main.ts` | App bootstrap, `provideRouter`, `authInterceptor` wiring |
| `frontend/src/app/app.routes.ts` | 5 lazy routes: `logger`, `timeline`, `journeys`, `report`, `configuration` |
| `frontend/src/app/app.component.ts` | Shell: top header, left nav (`[routerLink]`), `<router-outlet>`, **all global overlays** (log-form modal, calendar popup, timer-edit sheet, wrap-up sheet, unified sheet, confirm dialog, notes sheet, important-logs popup, profile popup, palette picker, undo toast, FAB) |

---

## Frontend — Routed View Components

Each is a lazy-loaded standalone `OnPush` component. They read state from `AppStateService` and emit on its signal Subjects rather than opening overlays themselves.

| File | What's there |
|------|-------------|
| `frontend/src/app/components/logger-view/logger-view.component.ts` | Full logger UI: date bar, day-type selector, metrics bar, active-log bar, quick-shortcuts bar, daily-essentials bar, wrap-up banner, log list with swipe-to-edit/delete and inline editing, quick-prefs popup |
| `frontend/src/app/components/timeline-view/timeline-view.component.ts` | Date bar, day-type selector, `<app-timeline>` canvas; handles drag-select → open log form and point-merge → confirm dialog via AppStateService signals |
| `frontend/src/app/components/journeys/journeys.component.ts` | Journey list, entry charts, create/edit/delete journeys, manual entry input |
| `frontend/src/app/components/report/report.component.ts` | Daily/weekly/monthly summary reports, CSV-ish data tables |
| `frontend/src/app/components/configuration/configuration.component.ts` | Log type CRUD, enhancements drawer, "My Ideal Day" config, account config |

---

## Frontend — Shared/Shell Components

Standalone components used inside `AppComponent` or injected into routed views.

| File | What's there |
|------|-------------|
| `frontend/src/app/components/unified-sheet/unified-sheet.component.ts` | 4-tab bottom sheet: Renni AI chat, Add Log (drum picker), Add Point (drum picker), Start Timer |
| `frontend/src/app/components/timeline/timeline.component.ts` | SVG timeline canvas, drag-select to create, merge two point-logs, scroll-to-log |
| `frontend/src/app/components/active-log-bar/active-log-bar.component.ts` | Ticking running-timer banner; emits `(editTimer)` and `(stop)` |
| `frontend/src/app/components/daily-essentials-bar/daily-essentials-bar.component.ts` | Wake / meal / sleep stamp bar; long-press = stamp now, tap = open add-point form |
| `frontend/src/app/components/palette-sheet/palette-sheet.component.ts` | Theme/palette quick-picker overlay (built-in presets + custom presets) |
| `frontend/src/app/components/log-form/log-form.component.ts` | Create / edit / delete a TimeLog; handles range and point entry types |
| `frontend/src/app/components/calendar/calendar.component.ts` | Month-view date picker |
| `frontend/src/app/components/important-logs/important-logs.component.ts` | Wake / meal / sleep snapshot popup; edits `DayLevelMetadata` |
| `frontend/src/app/components/notes-sheet/notes-sheet.component.ts` | Day-level free-text notes bottom sheet |
| `frontend/src/app/components/confirm-dialog/confirm-dialog.component.ts` | Generic confirm/cancel modal |
| `frontend/src/app/components/metrics/metrics.component.ts` | Day summary metrics bar (total logged, gap, top activity) |
| `frontend/src/app/components/theme-editor/theme-editor.component.ts` | Full palette CSS-var editor; exports `applyPaletteToDOM`, `loadSavedPalette`, `PALETTE_PRESETS` |
| `frontend/src/app/components/log-type-select/log-type-select.component.ts` | Reusable log-type dropdown/chip selector |
| `frontend/src/app/components/enhancements-drawer/enhancements-drawer.component.ts` | Enhancement list drawer used inside Configuration |
| `frontend/src/app/auth/login.component.ts` | Login form, emits `(loggedIn)` on success |

---

## Frontend — Services

| File | What's there |
|------|-------------|
| `frontend/src/app/services/app-state.service.ts` | **Central state facade.** BehaviorSubjects: `logs$`, `selectedDate$`, `dayMetadata$`, `notesCount$`, `activeLog$`, `activeLogTick$`, `inlineLogTypes$`, `quickShortcuts$`, `isAuthenticated$`, `isLoading$`, `highlightedLogId$`, `metricLogIds$`. Signal Subjects (message-bus): `openCalendarRequested$`, `openImportantLogsRequested$`, `openNotesRequested$`, `openLogFormRequested$`, `openUnifiedSheetRequested$`, `openTimerEditRequested$`, `stopRunningLogRequested$`, `startTimerRequested$`, `showToastRequested$`, `confirmDialogRequested$`, `openWrapUpRequested$`, `createJourneyRequested$`. Methods: `prevDay()`, `nextDay()`, `goToToday()`, `selectDate()`, `reloadLogs()`, `reloadNotesCount()`, `setDayType()`, `setActiveLog()`, `stopTimer()`. Computed getters: `selectedDate`, `selectedDateStr`, `isToday`, `dateShortLabel`, `activeLogElapsedStr`, `activeLogPlannedPct` |
| `frontend/src/app/services/log.service.ts` | `getLogsForDate()`, `createLog()`, `updateLog()`, `deleteLog()`, `clearAllCaches()` |
| `frontend/src/app/services/log-type.service.ts` | `getLogTypes()` (cached), `createLogType()`, `updateLogType()`, `deleteLogType()`, `clearCache()` |
| `frontend/src/app/services/preference.service.ts` | `getPreferences()`, `savePalette()`, `saveCustomPresets()`, `startActiveLog()`, `stopActiveLog()`, `updateQuickShortcuts()`, `clearPrefsCache()` |
| `frontend/src/app/services/auth.service.ts` | `login()`, `logout()`, `isLoggedIn()`, `getUser()`, `changePassword()`; stores JWT in `localStorage` under `renmito-token` / `renmito-user` |
| `frontend/src/app/services/day-level.service.ts` | `getMetadata()`, `setDayType()`, `clearAllCaches()` — manages `DayLevelMetadata` (dayType + important-log snapshots) |
| `frontend/src/app/services/journey.service.ts` | `getJourneys()`, `createJourney()`, `updateJourney()`, `deleteJourney()`, `getEntries()`, `addEntry()`, `resyncJourney()`, `clearAllCaches()` |
| `frontend/src/app/services/notes.service.ts` | `getNotes()`, `saveNotes()` — per-date free-text notes |
| `frontend/src/app/services/ai.service.ts` | `chat()` — sends message + dateStr to Renni AI, returns `ChatResponse` (text or parsed logs array) |
| `frontend/src/app/services/config.service.ts` | `getConfig()`, `saveConfig()` — account-level config (ideal day settings, etc.) |
| `frontend/src/app/interceptors/auth.interceptor.ts` | Functional `HttpInterceptorFn`; attaches `Authorization: Bearer <token>` to every request except `/api/auth/*` |

---

## Frontend — Models

| File | What's there |
|------|-------------|
| `frontend/src/app/models/log.model.ts` | `LogEntry`, `CreateLogEntry` interfaces; `entryType: 'range' \| 'point'` |
| `frontend/src/app/models/log-type.model.ts` | `LogType` interface; `domain: 'work' \| 'personal'`, `color`, `name`, `_id` |
| `frontend/src/app/models/journey.model.ts` | `Journey`, `JourneyEntry` interfaces; `trackerType: 'point-log' \| 'derived'` |

---

## Backend — Entry & Middleware

| File | What's there |
|------|-------------|
| `backend/src/app.js` | Express app; mounts all routes, CORS, lazy MongoDB connect, runs seed on cold start |
| `backend/src/middleware/authMiddleware.js` | JWT Bearer validation; all routes except `/api/auth/*` require it |
| `backend/src/utils/seedDefaults.js` | Upserts system `DefaultLogType` documents from `defaultLogTypes.json` |
| `backend/src/utils/seedEnhancements.js` | Upserts system `Enhancement` documents |

---

## Backend — Routes → Controllers → Services (parallel structure)

Each domain follows: `routes/*.route.js` → `controllers/*.controller.js` → `services/*.service.js`.

| Domain | Route prefix | Key behaviour |
|--------|-------------|---------------|
| **auth** | `/api/auth` | Register, login (bcrypt + JWT), change password |
| **logs** | `/api/logs` | CRUD for `TimeLog`; every write calls `journeys.service.syncLogEntry()` to keep derived journeys in sync |
| **logtypes** | `/api/logtypes` | User `LogType` CRUD; read also merges `DefaultLogType` list |
| **journeys** | `/api/journeys` | `Journey` + `JourneyEntry` CRUD; `POST /:id/resync` rebuilds all entries for a derived journey from matching `TimeLogs` |
| **preferences** | `/api/preferences` | Palette, `activeLog` (running timer state), `quickShortcuts` stored in `UserPreference` |
| **daylevelmetadata** | `/api/day-level` | Per-date `dayType` (`working`, `wfh`, `holiday`, `paid_leave`, `sick_leave`) and important-log snapshots |
| **notes** | `/api/notes` | Per-date free-text notes in `Note` model |
| **ai** | `/api/ai` | Renni chat; parses natural language → structured log suggestions |
| **config** | `/api/config` | Account-level config in `AccountConfig` (ideal day, etc.) |
| **enhancements** | `/api/enhancements` | Read-only `Enhancement` documents (seeded) |

---

## Backend — Mongoose Models

| File | Key fields |
|------|-----------|
| `backend/src/models/TimeLog.js` | `entryType: 'range'\|'point'`, `logTypeId`, `logTypeSource: 'DefaultLogType'\|'LogType'`, `status: 'running'\|'completed'\|'cancelled'`, `lastHeartbeatAt` |
| `backend/src/models/LogType.js` | User-created; `name`, `color`, `domain`, `userId` |
| `backend/src/models/DefaultLogType.js` | System-seeded; same shape as `LogType`, shared across all users |
| `backend/src/models/Journey.js` | `trackerType: 'point-log'\|'derived'`; derived has `derivedFrom.logTypeId` + `valueMetric: 'duration'\|'count'\|'start-time'\|'end-time'` |
| `backend/src/models/JourneyEntry.js` | One per (journey, date); `value`, `unit` |
| `backend/src/models/DayLevelMetadata.js` | `date`, `dayType`, `importantLogs: { wake, breakfast, lunch, dinner, sleep }` |
| `backend/src/models/UserPreference.js` | `palette`, `customPresets`, `activeLog` (running timer), `quickShortcuts` |
| `backend/src/models/Note.js` | `date`, `notes: string`, `userId` |
| `backend/src/models/User.js` | `userName`, `email`, `passwordHash` |
| `backend/src/models/AccountConfig.js` | Ideal-day config and other account-level settings |
| `backend/src/models/Enhancement.js` | System-seeded enhancement definitions |

---

## Cross-cutting patterns to know

- **New API resource**: model → service → controller → route → mount in `app.js`
- **Log write side-effect**: `logs.service.js` always calls `journeys.service.syncLogEntry()` after create/update/delete
- **Derived journey resync**: `POST /api/journeys/:id/resync` — rebuilds all `JourneyEntry` docs by querying `TimeLogs`
- **Cross-component signals**: routed views never open overlays directly — they call `appState.openLogFormRequested$.next(...)` etc.; `AppComponent` subscribes and opens the overlay
- **Running timer**: stored in `UserPreference.activeLog`; restored on app load via `preference.service → appState.setActiveLog()`; timer interval lives in `AppStateService`
- **Theme/palette**: applied to DOM via CSS vars in `theme-editor.component.ts`; cached in `localStorage` under `renmito-palette`; also saved to DB via `preferences.service`
