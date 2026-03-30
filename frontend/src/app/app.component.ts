import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarComponent } from './components/calendar/calendar.component';
import { TimelineComponent, DragSelection } from './components/timeline/timeline.component';
import { LogFormComponent } from './components/log-form/log-form.component';
import { EnhancementsDrawerComponent } from './components/enhancements-drawer/enhancements-drawer.component';
import { LogService } from './services/log.service';
import { LogEntry, CreateLogEntry } from './models/log.model';
import { getActivityLabel } from './constants/activity-types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CalendarComponent, TimelineComponent, LogFormComponent, EnhancementsDrawerComponent],
  template: `
    <div class="app-shell">

      <!-- ── Top Header ─────────────────────────────────── -->
      <header class="app-header">
        <div class="header-logo">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="12" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
            <path d="M14 8v6l4 3" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.7)"/>
          </svg>
          <span class="app-title">Renmito</span>
        </div>

        <div class="header-actions">
          <span class="header-date">{{ todayLabel }}</span>

          <!-- Enhancement log -->
          <button class="header-icon-btn" (click)="showEnhancementsDrawer = true"
                  title="Enhancement log" aria-label="Open enhancement log">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="16" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </button>

          <!-- Theme toggle -->
          <button class="theme-toggle-btn" (click)="toggleTheme()"
                  [title]="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
                  [attr.aria-label]="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
            <!-- Sun — shown in dark mode (click to go light) -->
            <svg *ngIf="theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1"  x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1"  y1="12" x2="3"  y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <!-- Moon — shown in light mode (click to go dark) -->
            <svg *ngIf="theme === 'light'" width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- ── Body: left nav + view area ────────────────── -->
      <div class="app-body">

        <!-- Left Navigation -->
        <nav class="left-nav">
          <div class="nav-group">
            <span class="nav-group-label">Main</span>
            <button
              class="left-nav-item"
              [class.left-nav-item--active]="activeView === 'logger'"
              (click)="activeView = 'logger'"
            >
              <!-- Clock icon -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Logger</span>
            </button>
          </div>
        </nav>

        <!-- ── View area ────────────────────────────────── -->
        <div class="view-area">

          <!-- Logger view -->
          <div class="logger-layout" *ngIf="activeView === 'logger'">

            <!-- Calendar panel -->
            <aside class="calendar-panel">
              <h2 class="section-title">Calendar</h2>
              <app-calendar
                [selectedDate]="selectedDate"
                (dateSelected)="onDateSelected($event)"
              ></app-calendar>

              <!-- Download Report -->
              <div class="report-card">
                <div class="report-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <polyline points="9 15 12 18 15 15"/>
                  </svg>
                  Download report of the Day
                </div>
                <p class="report-card-date">{{ dateShortLabel }}</p>
                <button class="btn-download-csv"
                        (click)="downloadCSV()"
                        [disabled]="logs.length === 0"
                        [title]="logs.length === 0 ? 'No logs for this day' : 'Download CSV for ' + dateShortLabel">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {{ logs.length === 0 ? 'No logs to download' : 'Download CSV' }}
                </button>
              </div>
            </aside>

            <!-- Timeline + Logs panel -->
            <section class="content-area">

              <!-- Timeline header -->
              <div class="content-header">
                <h2 class="section-title">Timeline — {{ dateShortLabel }}</h2>
                <div class="loading-indicator" *ngIf="isLoading">
                  <span class="spinner"></span> Loading…
                </div>
              </div>

              <!-- Timeline -->
              <div class="timeline-container">
                <app-timeline
                  #timelineRef
                  [logs]="logs"
                  [selectedDate]="selectedDate"
                  [highlightedLogId]="highlightedLogId"
                  (selectionMade)="onSelectionChanged($event)"
                  (createLogClicked)="onCreateLogClicked($event)"
                  (logClicked)="editLog($event)"
                ></app-timeline>
              </div>

              <div class="timeline-hint" *ngIf="!isLoading">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:4px;">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M8 5v4M8 11v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                Drag on the timeline to create a log entry. Click an existing bar to edit it.
              </div>

              <!-- Log List -->
              <div class="log-list-section">
                <div class="log-list-header">
                  <h2 class="section-title">Logs for this day</h2>
                  <span class="log-count" *ngIf="logs.length > 0">
                    {{ logs.length }} entr{{ logs.length === 1 ? 'y' : 'ies' }}
                  </span>
                </div>

                <!-- Skeleton -->
                <div class="log-list-skeleton" *ngIf="isLoading">
                  <div class="skeleton-row" *ngFor="let i of [1,2,3]"></div>
                </div>

                <!-- List -->
                <div class="log-list" *ngIf="!isLoading && logs.length > 0">
                  <div
                    class="log-list-item"
                    *ngFor="let log of logs; let i = index"
                    [class.log-list-item--active]="log.id === highlightedLogId"
                    (click)="focusLog(log)"
                  >
                    <div class="log-list-index">{{ i + 1 }}</div>
                    <div class="log-list-color-bar" [style.background]="log.color"></div>
                    <div class="log-list-body">
                      <div class="log-list-label">{{ log.label }}</div>
                      <div class="log-list-meta">
                        <span class="log-list-type-badge"
                              [style.background]="log.color + '22'"
                              [style.color]="log.color">
                          {{ getActivityLabel(log.type) }}
                        </span>
                        <span class="log-list-time">{{ log.startTime }} – {{ log.endTime }}</span>
                        <span class="log-list-duration">{{ getDuration(log) }}</span>
                      </div>
                    </div>
                    <button class="log-list-edit-btn"
                            (click)="editLog(log); $event.stopPropagation()"
                            aria-label="Edit">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Empty -->
                <div class="log-list-empty" *ngIf="!isLoading && logs.length === 0">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="18" r="15" stroke="var(--text-muted)" stroke-width="1.5" stroke-dasharray="4 3"/>
                    <path d="M18 11v7l4 3" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <p>No logs recorded for this day.</p>
                  <span>Drag on the timeline above to get started.</span>
                </div>
              </div>

            </section>
          </div><!-- /logger-layout -->

        </div><!-- /view-area -->
      </div><!-- /app-body -->
    </div><!-- /app-shell -->

    <!-- Enhancement log drawer -->
    <app-enhancements-drawer
      [isOpen]="showEnhancementsDrawer"
      (close)="showEnhancementsDrawer = false"
    ></app-enhancements-drawer>

    <!-- Log Form Modal -->
    <app-log-form
      *ngIf="showForm"
      [startTime]="formStartTime"
      [endTime]="formEndTime"
      [editEntry]="editingEntry"
      (saved)="onLogSaved($event)"
      (updated)="onLogUpdated($event)"
      (deleted)="onLogDeleted($event)"
      (cancelled)="closeForm()"
    ></app-log-form>
  `,
  styles: [`

    /* ── Shell ─────────────────────────────────────────── */
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-primary);
    }

    /* ── Header ─────────────────────────────────────────── */
    .app-header {
      height: 60px;
      flex-shrink: 0;
      background: var(--header-bg);
      border-bottom: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px 0 24px;
      z-index: 200;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }

    .header-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .app-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--header-text);
      letter-spacing: -0.3px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-date {
      font-size: 12px;
      color: rgba(255,255,255,0.78);
    }

    .header-icon-btn,
    .theme-toggle-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--header-icon-bg);
      color: rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
      flex-shrink: 0;
    }
    .header-icon-btn:hover,
    .theme-toggle-btn:hover {
      background: var(--header-icon-hover);
      color: #ffffff;
    }

    /* ── Body ────────────────────────────────────────────── */
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ── Left Nav ────────────────────────────────────────── */
    .left-nav {
      width: 210px;
      flex-shrink: 0;
      background: var(--nav-bg);
      border-right: 1px solid var(--border);
      padding: 20px 10px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .nav-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-group-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--nav-text-muted);
      text-transform: uppercase;
      letter-spacing: 1.2px;
      padding: 0 10px 6px;
    }

    .left-nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius);
      background: transparent;
      color: var(--nav-text);
      font-size: 13px;
      font-weight: 500;
      text-align: left;
      border-left: 3px solid transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .left-nav-item:hover {
      background: var(--nav-item-hover);
      color: var(--nav-text);
    }

    .left-nav-item--active {
      background: var(--nav-item-active) !important;
      color: var(--nav-item-active-border) !important;
      border-left-color: var(--nav-item-active-border) !important;
      font-weight: 600;
    }

    .left-nav-item svg {
      flex-shrink: 0;
    }

    /* ── View Area ───────────────────────────────────────── */
    .view-area {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      min-width: 0;
    }

    /* ── Logger Layout ───────────────────────────────────── */
    .logger-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 24px;
      align-items: start;
    }

    /* Calendar panel — sticky */
    .calendar-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: sticky;
      top: 0;
    }

    /* ── Content Area ────────────────────────────────────── */
    .content-area {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      overflow: hidden;
    }

    .content-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .spinner {
      width: 13px;
      height: 13px;
      border: 2px solid var(--border);
      border-top-color: var(--highlight-selected);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Timeline Container ──────────────────────────────── */
    .timeline-container {
      background: var(--bg-surface);
      border-radius: var(--radius);
      padding: 16px;
      min-width: 0;
      overflow: hidden;
      /* Enhancement 1.4 — occupy at least half the viewport */
      min-height: calc(50vh - 80px);
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }

    .timeline-hint {
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
      padding: 4px;
    }

    /* ── Log List Section ────────────────────────────────── */
    .log-list-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
    }

    .log-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .log-count {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-card);
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* Skeleton */
    .log-list-skeleton { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row {
      height: 52px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--bg-card) 25%, var(--accent-hover) 50%, var(--bg-card) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Log rows */
    .log-list { display: flex; flex-direction: column; gap: 6px; }

    .log-list-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      background: var(--bg-card);
    }
    .log-list-item:hover { background: var(--accent-hover); border-color: var(--border); }
    .log-list-item--active {
      border-color: rgba(74,144,226,0.5) !important;
      background: rgba(74,144,226,0.08) !important;
    }

    .log-list-index {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      width: 18px; text-align: center; flex-shrink: 0;
    }
    .log-list-color-bar { width: 4px; height: 36px; border-radius: 2px; flex-shrink: 0; }
    .log-list-body {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 4px;
    }
    .log-list-label {
      font-size: 13px; font-weight: 600; color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .log-list-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .log-list-type-badge {
      font-size: 10px; font-weight: 600;
      padding: 1px 7px; border-radius: 8px;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .log-list-time {
      font-size: 11px; color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .log-list-duration {
      font-size: 11px; color: var(--text-muted);
      background: var(--bg-surface); padding: 1px 6px; border-radius: 6px;
    }

    .log-list-edit-btn {
      background: none; color: var(--text-muted);
      padding: 5px; border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s; flex-shrink: 0;
    }
    .log-list-item:hover .log-list-edit-btn { opacity: 1; }
    .log-list-edit-btn:hover { background: var(--accent-hover); color: var(--text-primary); }

    .log-list-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 28px 16px; text-align: center; opacity: 0.5;
    }
    .log-list-empty p { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin: 0; }
    .log-list-empty span { font-size: 11px; color: var(--text-muted); }

    /* ── Download Report Card ────────────────────────────── */
    .report-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .report-card-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.9px;
    }

    .report-card-date {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .btn-download-csv {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      width: 100%;
      padding: 8px 12px;
      background: var(--highlight-selected);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      border-radius: var(--radius-sm);
      transition: background 0.2s, opacity 0.2s;
    }
    .btn-download-csv:hover:not(:disabled) { background: #3a7fcf; }
    .btn-download-csv:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      background: var(--bg-card);
      color: var(--text-muted);
    }

    /* ── Responsive ──────────────────────────────────────── */
    @media (max-width: 960px) {
      .left-nav { width: 52px; padding: 20px 6px; }
      .nav-group-label { display: none; }
      .left-nav-item span { display: none; }
      .left-nav-item { justify-content: center; padding: 10px; }
      .logger-layout { grid-template-columns: 1fr; }
      .calendar-panel { position: static; }
    }
  `]
})
export class AppComponent implements OnInit {
  @ViewChild('timelineRef') timelineRef!: TimelineComponent;

  activeView: 'logger' = 'logger';
  theme: 'dark' | 'light' = 'dark';
  showEnhancementsDrawer = false;

  selectedDate: Date = new Date();
  logs: LogEntry[] = [];
  isLoading = false;
  highlightedLogId: string | null = null;

  showForm = false;
  formStartTime = '09:00';
  formEndTime = '10:00';
  editingEntry: LogEntry | null = null;

  readonly getActivityLabel = getActivityLabel;

  constructor(private logService: LogService) {}

  get todayLabel(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  get dateShortLabel(): string {
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  }

  ngOnInit(): void {
    // Restore saved theme
    const saved = localStorage.getItem('renmito-theme') as 'dark' | 'light' | null;
    this.theme = saved ?? 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.selectedDate = today;
    this.loadLogs();
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('renmito-theme', this.theme);
  }

  onDateSelected(date: Date): void {
    this.selectedDate = date;
    this.highlightedLogId = null;
    this.loadLogs();
  }

  focusLog(log: LogEntry): void {
    this.highlightedLogId = log.id;
    this.timelineRef?.scrollToLog(log);
  }

  getDuration(log: LogEntry): string {
    const diff = this.timeToMinutes(log.endTime) - this.timeToMinutes(log.startTime);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  loadLogs(): void {
    this.isLoading = true;
    this.logService.getLogsForDate(this.selectedDate).subscribe({
      next: (logs) => {
        this.logs = logs.sort((a, b) =>
          this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
        );
        this.isLoading = false;
      },
      error: () => {
        this.logs = [];
        this.isLoading = false;
      }
    });
  }

  /** Fired when drag ends — just tracks state, does NOT open the form (Enhancement 1.5). */
  onSelectionChanged(_selection: DragSelection): void {
    // intentionally a no-op here; form opens only via the "Create Log" button
  }

  /** Fired when the "Create Log" button inside the timeline is clicked. */
  onCreateLogClicked(selection: DragSelection): void {
    this.formStartTime = selection.startTime;
    this.formEndTime = selection.endTime;
    this.editingEntry = null;
    this.showForm = true;
  }

  editLog(log: LogEntry): void {
    this.formStartTime = log.startTime;
    this.formEndTime = log.endTime;
    this.editingEntry = log;
    this.showForm = true;
  }

  onLogSaved(entry: CreateLogEntry): void {
    this.logService.createLog(this.selectedDate, entry).subscribe({
      next: () => { this.closeForm(); this.loadLogs(); },
      error: () => alert('Failed to save log. Make sure the backend is running on port 3000.')
    });
  }

  onLogUpdated(event: { id: string; entry: Partial<CreateLogEntry> }): void {
    this.logService.updateLog(this.selectedDate, event.id, event.entry).subscribe({
      next: () => { this.closeForm(); this.loadLogs(); },
      error: () => alert('Failed to update log. Make sure the backend is running on port 3000.')
    });
  }

  onLogDeleted(id: string): void {
    this.logService.deleteLog(this.selectedDate, id).subscribe({
      next: () => { this.closeForm(); this.loadLogs(); },
      error: () => alert('Failed to delete log. Make sure the backend is running on port 3000.')
    });
  }

  downloadCSV(): void {
    if (this.logs.length === 0) return;

    const dateStr = this.selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const header = ['Date', 'Start Time', 'End Time', 'Duration', 'Activity Type', 'Label'];

    const rows = this.logs.map(log => [
      dateStr,
      log.startTime,
      log.endTime,
      this.getDuration(log),
      this.getActivityLabel(log.type),
      `"${log.label.replace(/"/g, '""')}"` // quote-escape label
    ]);

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `renmito-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  closeForm(): void {
    this.showForm = false;
    this.editingEntry = null;
    this.highlightedLogId = null;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
