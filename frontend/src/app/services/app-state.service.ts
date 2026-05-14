import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { LogService } from './log.service';
import { LogTypeService } from './log-type.service';
import { DayLevelService, DayMetadata, DayType } from './day-level.service';
import { NoteItem, NotesService } from './notes.service';
import { PreferenceService, ActiveLog, QuickShortcut } from './preference.service';
import { LogEntry, CreateLogEntry } from '../models/log.model';
import { LogType } from '../models/log-type.model';

export interface OpenLogFormParams {
  startTime:    string;
  endTime:      string;
  editEntry?:   LogEntry | null;
  logTypeId?:   string | null;
  mergeSourceIds?: [string, string] | null;
}

export interface OpenUnifiedSheetParams {
  tab: 1 | 2 | 3;
  prepDomain?:  'work' | 'personal';
  prepTypeId?:  string;
  prepTime?:    string;
  prepTitle?:   string;
}

export interface ConfirmDialogParams {
  title:     string;
  message:   string;
  detail?:   string;
  okLabel?:  string;
  onConfirm: () => void;
}

@Injectable({ providedIn: 'root' })
export class AppStateService {

  constructor(
    private logService:      LogService,
    private logTypeService:  LogTypeService,
    private dayLevelService: DayLevelService,
    private notesService:    NotesService,
    private prefService:     PreferenceService,
  ) {}

  // ── Reactive state ────────────────────────────────────────────────
  readonly selectedDate$    = new BehaviorSubject<Date>(AppStateService.logicalToday());
  readonly logs$            = new BehaviorSubject<LogEntry[]>([]);
  readonly inlineLogTypes$  = new BehaviorSubject<LogType[]>([]);
  readonly activeLog$       = new BehaviorSubject<ActiveLog | null>(null);
  readonly dayMetadata$     = new BehaviorSubject<DayMetadata | null>(null);
  readonly notesCount$      = new BehaviorSubject<number>(0);
  readonly notesList$       = new BehaviorSubject<NoteItem[]>([]);
  readonly highlightedLogId$= new BehaviorSubject<string | null>(null);
  readonly metricLogIds$    = new BehaviorSubject<Set<string> | null>(null);
  readonly isLoading$       = new BehaviorSubject<boolean>(false);
  readonly isAuthenticated$ = new BehaviorSubject<boolean>(false);
  readonly quickShortcuts$  = new BehaviorSubject<QuickShortcut[]>([]);
  readonly activeLogTick$   = new BehaviorSubject<number>(0);

  private activeLogTimerRef: ReturnType<typeof setInterval> | undefined;

  // ── UI action signals (routed views → AppComponent shell) ─────────
  readonly openNavRequested$           = new Subject<void>();
  readonly openCalendarRequested$      = new Subject<void>();
  readonly openImportantLogsRequested$ = new Subject<void>();
  readonly openNotesRequested$         = new Subject<string | undefined>();
  readonly openRenniWithTextRequested$ = new Subject<string>();
  readonly openLogFormRequested$       = new Subject<OpenLogFormParams>();
  readonly openUnifiedSheetRequested$  = new Subject<OpenUnifiedSheetParams>();
  readonly openTimerEditRequested$     = new Subject<void>();
  readonly stopRunningLogRequested$    = new Subject<void>();
  readonly startTimerRequested$        = new Subject<void>();
  readonly showToastRequested$         = new Subject<{ message: string; logId: string }>();
  readonly confirmDialogRequested$     = new Subject<ConfirmDialogParams>();
  readonly openWrapUpRequested$        = new Subject<void>();
  readonly createJourneyRequested$     = new Subject<void>();
  readonly coverageSheetOpen$          = new BehaviorSubject<boolean>(false);

  // ── Computed getters ──────────────────────────────────────────────
  get selectedDate(): Date { return this.selectedDate$.value; }

  get selectedDateStr(): string {
    const d = this.selectedDate$.value;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Before 05:00 AM the "logical day" is still yesterday.
  static logicalToday(): Date {
    const now = new Date();
    if (now.getHours() < 5) {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 1);
      return prev;
    }
    return now;
  }

  get isToday(): boolean {
    const t = AppStateService.logicalToday();
    const d = this.selectedDate$.value;
    return d.getFullYear() === t.getFullYear() &&
           d.getMonth()    === t.getMonth()    &&
           d.getDate()     === t.getDate();
  }

  get dateShortLabel(): string {
    return this.selectedDate$.value.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  get activeLogElapsedStr(): string {
    const s   = this.activeLogTick$.value;
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  get activeLogPlannedPct(): number {
    const al = this.activeLog$.value;
    if (!al?.plannedMins) return 0;
    return Math.min(100, (this.activeLogTick$.value / (al.plannedMins * 60)) * 100);
  }

  // ── Date navigation ───────────────────────────────────────────────
  prevDay(): void {
    const d = new Date(this.selectedDate$.value);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    this._changeDate(d);
  }

  nextDay(): void {
    if (this.isToday) return;
    const d = new Date(this.selectedDate$.value);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    this._changeDate(d);
  }

  goToToday(): void {
    const d = AppStateService.logicalToday();
    d.setHours(0, 0, 0, 0);
    this._changeDate(d);
  }

  selectDate(date: Date): void {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    this._changeDate(d);
  }

  private _changeDate(date: Date): void {
    this.selectedDate$.next(date);
    this.highlightedLogId$.next(null);
    this.metricLogIds$.next(null);
    this.reloadLogs();
  }

  // ── Data loading ──────────────────────────────────────────────────
  reloadLogs(): void {
    this.isLoading$.next(true);
    const dateStr = this.selectedDateStr;
    this.logService.getLogsForDate(this.selectedDate$.value).subscribe({
      next: logs => {
        this.logs$.next(logs.sort((a, b) => this._timeToMins(a.startAt) - this._timeToMins(b.startAt)));
        this.isLoading$.next(false);
      },
      error: () => { this.logs$.next([]); this.isLoading$.next(false); }
    });
    this._reloadDayMetadata(dateStr);
  }

  private _reloadDayMetadata(dateStr: string): void {
    this.dayLevelService.getMetadata(dateStr).subscribe({
      next:  meta => { if (this.selectedDateStr === dateStr) this.dayMetadata$.next(meta); },
      error: ()   => { if (this.selectedDateStr === dateStr) this.dayMetadata$.next(null); }
    });
    this._reloadNotesCount(dateStr);
  }

  private _reloadNotesCount(dateStr: string): void {
    this.notesCount$.next(0);
    this.notesList$.next([]);
    this.notesService.getNotes(dateStr).subscribe({
      next:  d  => {
        if (this.selectedDateStr === dateStr) {
          this.notesCount$.next(d.notes.length);
          this.notesList$.next(d.notes);
        }
      },
      error: () => {
        if (this.selectedDateStr === dateStr) {
          this.notesCount$.next(0);
          this.notesList$.next([]);
        }
      }
    });
  }

  reloadNotesCount(): void {
    const dateStr = this.selectedDateStr;
    this.notesService.invalidateCache(dateStr);
    this._reloadNotesCount(dateStr);
  }

  loadLogTypes(): void {
    if (this.inlineLogTypes$.value.length) return;
    this.logTypeService.getLogTypes().subscribe({
      next:  types => this.inlineLogTypes$.next(types),
      error: ()    => {}
    });
  }

  setDayType(dayType: DayType): void {
    const current = this.dayMetadata$.value;
    if (!current) return;
    this.dayMetadata$.next({ ...current, dayType });
    this.dayLevelService.setDayType(this.selectedDateStr, dayType).subscribe({
      next:  meta  => { if (meta) this.dayMetadata$.next(meta); },
      error: ()    => { this._reloadDayMetadata(this.selectedDateStr); }
    });
  }

  // ── Active log timer ──────────────────────────────────────────────
  setActiveLog(log: ActiveLog | null): void {
    this.activeLog$.next(log);
    if (log) {
      this._startTimer(log);
    } else {
      this._stopTimer();
    }
  }

  private _startTimer(log: ActiveLog): void {
    this._stopTimer();
    const update = () => {
      const elapsed = Date.now() - new Date(log.startedAt).getTime();
      this.activeLogTick$.next(Math.max(0, Math.floor(elapsed / 1000)));
    };
    update();
    this.activeLogTimerRef = setInterval(update, 1000);
  }

  stopTimer(): void { this._stopTimer(); }

  private _stopTimer(): void {
    if (this.activeLogTimerRef) {
      clearInterval(this.activeLogTimerRef);
      this.activeLogTimerRef = undefined;
    }
    this.activeLogTick$.next(0);
  }

  // ── Utility ───────────────────────────────────────────────────────
  private _timeToMins(t: string): number {
    const [h, m] = (t ?? '00:00').split(':').map(Number);
    return h * 60 + m;
  }
}
