import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, OnDestroy, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LogEntry } from '../../models/log.model';
import { DayLevelService, DayMetadata, ImportantLogEntry } from '../../services/day-level.service';
import { LogService } from '../../services/log.service';
import { LogTypeService } from '../../services/log-type.service';
import { LogFormComponent } from '../log-form/log-form.component';

interface LiveSlot {
  key:       'wokeUp' | 'breakfast' | 'lunch' | 'dinner' | 'sleep';
  label:     string;
  /** HH:MM (24h) — internal for comparisons */
  time:      string | null;
  /** Formatted for display in AM/PM */
  timeDisplay: string | null;
  logId:     string | null;
  logDate:   string | null;
  logEntry:  LogEntry | null;
  /** Log type category to auto-select when creating */
  category:  string;
  /** If captured snapshot time differs from live time → stale. */
  stale:     boolean;
  /** Day-relative badge: 'prev' | 'next' | null */
  dayBadge:  'prev' | 'next' | null;
}

/** Maps slot key → personal log-type category name used in default log types. */
const SLOT_CATEGORY: Record<string, string> = {
  wokeUp:    'sleep',
  breakfast: 'breakfast',
  lunch:     'lunch',
  dinner:    'dinner',
  sleep:     'sleep',
};

@Component({
  selector: 'app-important-logs',
  standalone: true,
  imports: [CommonModule, LogFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="il-overlay" (click)="onOverlayClick($event)">
      <div class="il-panel" role="dialog" aria-modal="true" aria-label="Important Logs">

        <!-- Header -->
        <div class="il-header">
          <span class="il-title">Important Logs</span>
          <button class="il-close" (click)="close.emit()" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Loading -->
        <div class="il-loading" *ngIf="loading">
          <div class="il-spinner"></div>
          <span>Loading…</span>
        </div>

        <!-- Slots -->
        <div class="il-slots" *ngIf="!loading">
          <div class="il-slot" *ngFor="let slot of slots; trackBy: trackByKey">
            <div class="il-slot-left">
              <div class="il-slot-info">
                <span class="il-slot-label">{{ slot.label }}</span>
                <div class="il-slot-time-row" *ngIf="slot.time">
                  <span class="il-slot-time">{{ slot.timeDisplay }}</span>
                  <span class="il-day-badge il-day-badge--prev" *ngIf="slot.dayBadge === 'prev'">prev</span>
                  <span class="il-day-badge il-day-badge--next" *ngIf="slot.dayBadge === 'next'">next</span>
                  <span class="il-stale-warn" *ngIf="slot.stale"
                        title="Time has changed since last Capture — please Capture again">
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2L2 17h16L10 2z" stroke="#F5A623" stroke-width="1.6"
                            stroke-linejoin="round" fill="rgba(245,166,35,0.12)"/>
                      <line x1="10" y1="8" x2="10" y2="12" stroke="#F5A623" stroke-width="1.5" stroke-linecap="round"/>
                      <circle cx="10" cy="14.5" r="0.8" fill="#F5A623"/>
                    </svg>
                  </span>
                </div>
                <span class="il-slot-empty" *ngIf="!slot.time">Not logged</span>
              </div>
            </div>
            <div class="il-slot-actions">
              <!-- Edit (open log form for the referenced log) -->
              <button class="il-btn il-btn--edit"
                      *ngIf="slot.logEntry"
                      (click)="openEdit(slot)"
                      title="Edit this log">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor"
                        stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
              </button>
              <!-- Create (open log form to create a new log for this slot) -->
              <button class="il-btn il-btn--add"
                      *ngIf="!slot.logEntry"
                      (click)="openCreate(slot)"
                      title="Log this now">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Captured info -->
        <div class="il-captured-row" *ngIf="!loading && metadata?.capturedAt">
          <span class="il-captured-label">Last captured: {{ formatCapturedAt(metadata!.capturedAt!) }}</span>
        </div>
        <div class="il-captured-row il-captured-row--stale" *ngIf="!loading && anyStale">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style="flex-shrink:0">
            <path d="M10 2L2 17h16L10 2z" stroke="#F5A623" stroke-width="1.6"
                  stroke-linejoin="round" fill="rgba(245,166,35,0.12)"/>
            <line x1="10" y1="8" x2="10" y2="12" stroke="#F5A623" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="10" cy="14.5" r="0.8" fill="#F5A623"/>
          </svg>
          <span>Some times have changed — click Capture to update the snapshot.</span>
        </div>

        <!-- Footer with Capture button -->
        <div class="il-footer">
          <button class="il-capture-btn"
                  [disabled]="capturing"
                  (click)="doCapture()">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
                 style="flex-shrink:0">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6"/>
              <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
            </svg>
            {{ capturing ? 'Capturing…' : 'Capture' }}
          </button>
        </div>

      </div>
    </div>

    <!-- Log Form for edit / create -->
    <app-log-form
      *ngIf="showForm"
      [startTime]="formStartTime"
      [endTime]="formEndTime"
      [editEntry]="formEditEntry"
      [currentDate]="formDate"
      [preselectedLogTypeId]="formLogTypeId"
      (logChanged)="onFormChanged()"
      (cancelled)="showForm = false"
    ></app-log-form>
  `,
  styles: [`
    .il-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 900; backdrop-filter: blur(2px);
    }
    .il-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      width: 420px; max-width: 96vw;
      max-height: 88vh; overflow-y: auto;
      box-shadow: var(--shadow);
      animation: slideIn 0.2s ease;
      display: flex; flex-direction: column;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-12px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    .il-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    }
    .il-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .il-close {
      width: 28px; height: 28px; border-radius: 50%;
      background: none; color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .il-close:hover { background: var(--bg-card); color: var(--text-primary); }

    /* Loading */
    .il-loading {
      display: flex; align-items: center; gap: 10px;
      padding: 28px 16px;
      color: var(--text-muted); font-size: 13px;
    }
    .il-spinner {
      width: 16px; height: 16px;
      border: 2px solid var(--border-light);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Slots */
    .il-slots { padding: 8px 0; flex: 1; }
    .il-slot {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-light);
      gap: 10px;
    }
    .il-slot:last-child { border-bottom: none; }

    .il-slot-left { display: flex; align-items: center; flex: 1; min-width: 0; }
    .il-slot-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .il-slot-label {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .il-slot-time-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .il-slot-time { font-size: 18px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .il-slot-empty { font-size: 13px; color: var(--text-muted); font-style: italic; }

    .il-day-badge {
      font-size: 9px; font-weight: 700; padding: 1px 5px;
      border-radius: 8px; text-transform: uppercase; letter-spacing: 0.4px;
    }
    .il-day-badge--prev { background: rgba(100,120,200,0.15); color: #7090d0; }
    .il-day-badge--next { background: rgba(100,180,120,0.15); color: #50a06a; }

    .il-stale-warn { display: flex; align-items: center; cursor: default; }

    .il-slot-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .il-btn {
      width: 30px; height: 30px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .il-btn--edit { background: none; color: var(--text-muted); }
    .il-btn--edit:hover { background: var(--accent-hover); color: var(--text-primary); }
    .il-btn--add { background: rgba(74,144,226,0.1); color: var(--highlight-selected); }
    .il-btn--add:hover { background: rgba(74,144,226,0.2); }

    /* Captured row */
    .il-captured-row {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 16px;
      font-size: 11px; color: var(--text-muted);
      border-top: 1px solid var(--border-light);
      flex-shrink: 0;
    }
    .il-captured-row--stale { color: #c98800; gap: 6px; }
    .il-captured-label { font-style: italic; }

    /* Footer */
    .il-footer {
      padding: 12px 16px 14px;
      display: flex; justify-content: flex-end;
      border-top: 1px solid var(--border-light);
      flex-shrink: 0;
    }
    .il-capture-btn {
      display: flex; align-items: center; gap: 7px;
      padding: 9px 18px;
      background: var(--highlight-selected);
      color: #fff; font-size: 13px; font-weight: 600;
      border-radius: 8px;
      transition: opacity 0.15s;
    }
    .il-capture-btn:hover:not(:disabled) { opacity: 0.88; }
    .il-capture-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class ImportantLogsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedDate!: Date;
  @Input() logs:          LogEntry[] = [];  // current day
  @Input() metadata:      DayMetadata | null = null;

  @Output() close        = new EventEmitter<void>();
  @Output() metadataChanged = new EventEmitter<DayMetadata>();
  /** Emitted after a log is saved/updated/deleted so parent can reload logs. */
  @Output() logsChanged  = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();
  loading    = false;
  capturing  = false;
  prevDayLogs: LogEntry[] = [];
  nextDayLogs: LogEntry[] = [];
  allLogTypes: any[]      = [];

  slots: LiveSlot[] = [];

  // Log form
  showForm       = false;
  formStartTime  = '00:00';
  formEndTime    = '01:00';
  formDate       = '';
  formEditEntry: LogEntry | null = null;
  formLogTypeId: string | null = null;

  constructor(
    private dayLevelService: DayLevelService,
    private logService:      LogService,
    private logTypeService:  LogTypeService,
    private cdr:             ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.loadSurroundingLogs();
    this.logTypeService.getLogTypes().pipe(takeUntil(this.destroy$)).subscribe({
      next:  types => { this.allLogTypes = types; this.buildSlots(); this.cdr.markForCheck(); },
      error: ()    => {}
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['logs'] || changes['metadata'] || changes['selectedDate']) {
      this.buildSlots();
    }
  }

  private get selectedDateStr(): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = this.selectedDate;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private prevDateStr(): string {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private nextDateStr(): string {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private loadSurroundingLogs(): void {
    this.loading = true;
    let pending = 2;
    const done = () => {
      if (--pending === 0) {
        this.loading = false;
        this.buildSlots();
        this.cdr.markForCheck();
      }
    };
    this.logService.getLogsForDate(this.prevDate()).pipe(takeUntil(this.destroy$)).subscribe({
      next: logs => { this.prevDayLogs = logs; done(); },
      error: () => { this.prevDayLogs = []; done(); }
    });
    this.logService.getLogsForDate(this.nextDate()).pipe(takeUntil(this.destroy$)).subscribe({
      next: logs => { this.nextDayLogs = logs; done(); },
      error: () => { this.nextDayLogs = []; done(); }
    });
  }

  private prevDate(): Date {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    return d;
  }

  private nextDate(): Date {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    return d;
  }

  private isSleep(log: LogEntry): boolean {
    return log.logType?.domain === 'personal' && log.logType?.category === 'sleep';
  }

  private isMeal(log: LogEntry, mealKey: string): boolean {
    const cat  = (log.logType?.category ?? '').toLowerCase();
    const name = (log.logType?.name     ?? '').toLowerCase();
    return log.logType?.domain === 'personal' && (cat === mealKey || name.includes(mealKey));
  }

  private toMins(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Convert HH:MM to 12-hour AM/PM display string (e.g. "1:30 PM"). */
  toAmPm(hhmm: string | null): string | null {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const h12    = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  /** Find a personal log type matching a category keyword. */
  private findLogTypeByCategory(category: string): any | null {
    return this.allLogTypes.find(lt =>
      lt.domain === 'personal' &&
      ((lt.category ?? '').toLowerCase() === category ||
       (lt.name ?? '').toLowerCase().includes(category))
    ) ?? null;
  }

  buildSlots(): void {
    const selDateStr = this.selectedDateStr;
    const prevStr    = this.prevDateStr();
    const nextStr    = this.nextDateStr();

    const wokeUpCandidates = [
      ...this.prevDayLogs.filter(l => this.isSleep(l) && l.endAt && this.toMins(l.startAt) >= 23 * 60),
      ...this.logs.filter(l => this.isSleep(l) && l.endAt && this.toMins(l.startAt) < 12 * 60),
    ];
    wokeUpCandidates.sort((a, b) => this.toMins(b.endAt!) - this.toMins(a.endAt!));
    const wokeUpLog = wokeUpCandidates[0] ?? null;

    const bfLog     = this.logs.filter(l => this.isMeal(l, 'breakfast')).sort((a, b) => this.toMins(a.startAt) - this.toMins(b.startAt))[0] ?? null;
    const lunchLog  = this.logs.filter(l => this.isMeal(l, 'lunch')).sort((a, b) => this.toMins(a.startAt) - this.toMins(b.startAt))[0] ?? null;
    const dinnerLog = this.logs.filter(l => this.isMeal(l, 'dinner')).sort((a, b) => this.toMins(a.startAt) - this.toMins(b.startAt))[0] ?? null;

    const sleepCandidates = [
      ...this.logs.filter(l => this.isSleep(l) && this.toMins(l.startAt) >= 19 * 60),
      ...this.nextDayLogs.filter(l => this.isSleep(l) && this.toMins(l.startAt) <= 5 * 60),
    ];
    sleepCandidates.sort((a, b) => this.toMins(a.startAt) - this.toMins(b.startAt));
    const sleepLog = sleepCandidates[0] ?? null;

    const cap = this.metadata?.importantLogs;

    this.slots = [
      this.buildSlot('wokeUp',    'Woke Up',   wokeUpLog,  wokeUpLog?.endAt   ?? null, wokeUpLog?.date  ?? null, selDateStr, prevStr, nextStr, cap?.wokeUp    ?? null),
      this.buildSlot('breakfast', 'Breakfast', bfLog,      bfLog?.startAt     ?? null, bfLog?.date      ?? null, selDateStr, prevStr, nextStr, cap?.breakfast ?? null),
      this.buildSlot('lunch',     'Lunch',     lunchLog,   lunchLog?.startAt  ?? null, lunchLog?.date   ?? null, selDateStr, prevStr, nextStr, cap?.lunch     ?? null),
      this.buildSlot('dinner',    'Dinner',    dinnerLog,  dinnerLog?.startAt ?? null, dinnerLog?.date  ?? null, selDateStr, prevStr, nextStr, cap?.dinner    ?? null),
      this.buildSlot('sleep',     'Sleep',     sleepLog,   sleepLog?.startAt  ?? null, sleepLog?.date   ?? null, selDateStr, prevStr, nextStr, cap?.sleep     ?? null),
    ];
  }

  private buildSlot(
    key: LiveSlot['key'],
    label: string,
    logEntry: LogEntry | null,
    liveTime: string | null,
    logDate: string | null,
    selDateStr: string,
    prevStr: string,
    nextStr: string,
    captured: ImportantLogEntry | null,
  ): LiveSlot {
    const hasCaptured = !!(captured?.time && this.metadata?.capturedAt);
    const stale       = hasCaptured && captured!.time !== liveTime;

    let dayBadge: 'prev' | 'next' | null = null;
    if (logDate && logDate !== selDateStr) {
      dayBadge = logDate === prevStr ? 'prev' : logDate === nextStr ? 'next' : null;
    }
    if (key === 'wokeUp' && logEntry?.date === prevStr) dayBadge = 'prev';

    return {
      key, label,
      time:        liveTime,
      timeDisplay: this.toAmPm(liveTime),
      logId:       logEntry?.id ?? null,
      logDate,
      logEntry,
      category:    SLOT_CATEGORY[key],
      stale,
      dayBadge,
    };
  }

  get anyStale(): boolean {
    return this.slots.some(s => s.stale);
  }

  formatCapturedAt(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.toLocaleDateString()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('il-overlay')) this.close.emit();
  }

  // ── Edit / Create ──────────────────────────────────────────────────────────

  openEdit(slot: LiveSlot): void {
    if (!slot.logEntry) return;
    this.formEditEntry = slot.logEntry;
    this.formDate      = slot.logEntry.date;
    this.formStartTime = slot.logEntry.startAt;
    this.formEndTime   = slot.logEntry.endAt ?? slot.logEntry.startAt;
    this.formLogTypeId = null;
    this.showForm      = true;
  }

  openCreate(slot: LiveSlot): void {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowHH = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // Auto-select log type matching this slot's category
    const matchedType = this.findLogTypeByCategory(slot.category);

    this.formEditEntry = null;
    this.formDate      = this.selectedDateStr;
    this.formStartTime = nowHH;
    this.formEndTime   = nowHH;
    this.formLogTypeId = matchedType?._id ?? null;
    this.showForm      = true;
  }

  onFormChanged(): void {
    this.showForm = false;
    this.logsChanged.emit();
    this.reloadSurroundingAndRebuild();
  }

  private reloadSurroundingAndRebuild(): void {
    this.loading = true;
    let pending = 2;
    const done = () => {
      if (--pending === 0) {
        this.loading = false;
        this.buildSlots();
        this.cdr.markForCheck();
      }
    };
    this.logService.getLogsForDate(this.prevDate()).pipe(takeUntil(this.destroy$)).subscribe({
      next: logs => { this.prevDayLogs = logs; done(); },
      error: () => { this.prevDayLogs = []; done(); }
    });
    this.logService.getLogsForDate(this.nextDate()).pipe(takeUntil(this.destroy$)).subscribe({
      next: logs => { this.nextDayLogs = logs; done(); },
      error: () => { this.nextDayLogs = []; done(); }
    });
  }

  // ── Capture ────────────────────────────────────────────────────────────────

  doCapture(): void {
    this.capturing = true;
    this.dayLevelService.capture(this.selectedDateStr).pipe(takeUntil(this.destroy$)).subscribe({
      next: meta => {
        this.capturing = false;
        if (meta) {
          this.metadata = meta;
          this.metadataChanged.emit(meta);
          this.buildSlots();
        }
        this.cdr.markForCheck();
      },
      error: () => { this.capturing = false; this.cdr.markForCheck(); }
    });
  }

  trackByKey(_i: number, slot: LiveSlot): string { return slot.key; }
}
