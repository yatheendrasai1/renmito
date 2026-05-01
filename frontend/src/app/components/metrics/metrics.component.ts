import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LogEntry } from '../../models/log.model';
import { LogService } from '../../services/log.service';
import { DayLevelService } from '../../services/day-level.service';

interface LogTypeBreakdown {
  id:        string;
  name:      string;
  color:     string;
  totalMins: number;
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="metrics-wrapper">

      <!-- ── Summary cards: free-floating, no shared border ── -->
      <div class="summary-cards">

        <div class="summary-card">
          <span class="summary-label">Coverage <span class="summary-baseline">(8h)</span></span>
          <span class="summary-val">{{ coveragePct }}%</span>
          <div class="coverage-bar-track">
            <div class="coverage-bar-fill"
              [style.width.%]="coverageBarPct"
              [style.background]="coveragePct >= 100 ? '#a3d4ac' : '#93b8de'">
            </div>
          </div>
        </div>

        <div class="summary-card">
          <span class="summary-label">Logged</span>
          <span class="summary-val">{{ coveredHoursLabel }}</span>
        </div>

      </div>

      <!-- ── Metrics accordion — separate card ────────── -->
      <div class="metrics-section">

        <div class="metrics-header" (click)="toggleExpanded()">
          <button class="metrics-toggle" [attr.aria-expanded]="isExpanded" tabindex="-1">
            <svg class="metrics-chevron" width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h2 class="metrics-title">Metrics</h2>
          </button>
        </div>

        <!-- Animated body -->
        <div class="metrics-body-grid" [class.metrics-body-grid--open]="isExpanded">
        <div class="metrics-body">

          <ng-container *ngIf="logTypeBreakdown.length > 0; else noBreakdown">
            <div class="breakdown-list">
              <div class="breakdown-item"
                   *ngFor="let bt of visibleBreakdown; trackBy: trackByBreakdownId">
                <div class="breakdown-row">
                  <span class="breakdown-dot" [style.background]="bt.color || '#9B9B9B'"></span>
                  <span class="breakdown-name">{{ bt.name }}</span>
                  <span class="breakdown-time">{{ fmtMins(bt.totalMins) }}</span>
                  <span class="breakdown-pct">{{ breakdownPct(bt.totalMins) }}%</span>
                </div>
                <div class="breakdown-track">
                  <div class="breakdown-fill"
                       [style.width]="breakdownPct(bt.totalMins) + '%'"
                       [style.background]="bt.color || '#9B9B9B'"></div>
                </div>
              </div>
            </div>
            <button class="breakdown-expand-btn"
                    *ngIf="logTypeBreakdown.length > 4"
                    (click)="breakdownExpanded = !breakdownExpanded; $event.stopPropagation()">
              <ng-container *ngIf="!breakdownExpanded">
                Show {{ logTypeBreakdown.length - 4 }} more
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </ng-container>
              <ng-container *ngIf="breakdownExpanded">
                Show less
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </ng-container>
            </button>
          </ng-container>
          <ng-template #noBreakdown>
            <div class="breakdown-empty">No logs for this day.</div>
          </ng-template>

        </div>
        </div>

      </div>

    </div>
  `,
  styles: [`
    /* ── Outer wrapper: stacks summary cards + metrics accordion ── */
    .metrics-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* ── Summary cards: free-floating row ───────────── */
    .summary-cards {
      display: flex;
      gap: 8px;
    }

    .summary-card {
      flex: 1;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 7px 9px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .summary-label {
      font-size: 9px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .summary-baseline {
      font-size: 8px;
      font-weight: 400;
      color: color-mix(in srgb, var(--text-muted) 65%, transparent);
      text-transform: none;
      letter-spacing: 0;
    }

    .summary-val {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    /* ── Coverage progress bar ───────────────────────── */
    .coverage-bar-track {
      height: 4px;
      background: color-mix(in srgb, var(--text-primary) 15%, transparent);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 4px;
    }

    .coverage-bar-fill {
      height: 100%;
      border-radius: 2px;
      max-width: 100%;
      transition: width 0.35s ease;
    }

    /* ── Metrics accordion card ──────────────────────── */
    .metrics-section {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .metrics-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 14px;
      cursor: pointer;
      user-select: none;
    }

    .metrics-toggle {
      display: flex;
      align-items: center;
      gap: 7px;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0;
    }
    .metrics-toggle:hover .metrics-title { color: var(--text-primary); }

    .metrics-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
      transform: rotate(-90deg);
      transition: transform 0.25s ease;
    }
    .metrics-toggle[aria-expanded="true"] .metrics-chevron {
      transform: rotate(0deg);
    }

    .metrics-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: color 0.15s;
    }

    .metrics-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* ── Animated body ───────────────────────────────── */
    .metrics-body-grid {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.28s ease;
    }
    .metrics-body-grid--open {
      grid-template-rows: 1fr;
    }
    .metrics-body {
      overflow: hidden;
    }

    /* ── Breakdown list ──────────────────────────────── */
    .breakdown-list { display: flex; flex-direction: column; gap: 10px; padding: 4px 14px 14px; }
    .breakdown-item { display: flex; flex-direction: column; gap: 5px; }
    .breakdown-row { display: flex; align-items: center; gap: 8px; }
    .breakdown-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .breakdown-name { flex: 1; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .breakdown-time { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .breakdown-pct { font-size: 12px; color: var(--text-muted); white-space: nowrap; min-width: 36px; text-align: right; }
    .breakdown-track { height: 4px; background: var(--bg-hover); border-radius: 2px; overflow: hidden; }
    .breakdown-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; opacity: 0.75; }
    .breakdown-empty { padding: 16px 14px; font-size: 12px; color: var(--text-muted); }
    .breakdown-expand-btn {
      display: flex; align-items: center; gap: 4px; justify-content: center;
      width: 100%; padding: 7px 14px;
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      background: none; border: none; border-top: 1px solid var(--border);
      cursor: pointer; transition: color 0.15s, background 0.15s;
    }
    .breakdown-expand-btn:hover { color: var(--text-primary); background: var(--accent-hover); }
  `]
})
export class MetricsComponent implements OnChanges, OnDestroy {
  @Input()  logs:         LogEntry[] = [];
  @Input()  selectedDate: Date = new Date();
  @Output() cardHighlight = new EventEmitter<string[] | null>();

  private readonly destroy$ = new Subject<void>();
  prevDayLogs:          LogEntry[] = [];
  isExpanded            = false;
  breakdownExpanded     = false;
  monthWorkSummary:     Record<string, number> = {};
  prevMonthWorkSummary: Record<string, number> = {};
  /** 1.83 — day type map for current and previous month (for leave-day streak skipping). */
  monthDayTypes:     Record<string, string> = {};
  prevMonthDayTypes: Record<string, string> = {};

  constructor(
    private logService:      LogService,
    private dayLevelService: DayLevelService,
    private cdr:             ChangeDetectorRef,
  ) {}

  /* ── Lifecycle ───────────────────────────────────── */

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate'] && this.selectedDate) {
      this.fetchPrevDayLogs();
      this.fetchMonthSummary();
      this.breakdownExpanded = false;
    }
  }

  private fetchPrevDayLogs(): void {
    const prev = new Date(this.selectedDate);
    prev.setDate(prev.getDate() - 1);
    this.logService.getLogsForDate(prev).pipe(takeUntil(this.destroy$)).subscribe({
      next:  logs => { this.prevDayLogs = logs; this.cdr.markForCheck(); },
      error: ()   => { this.prevDayLogs = []; this.cdr.markForCheck(); }
    });
  }

  private fetchMonthSummary(): void {
    const y = this.selectedDate.getFullYear();
    const m = this.selectedDate.getMonth() + 1;
    this.logService.getMonthWorkSummary(y, m).pipe(takeUntil(this.destroy$)).subscribe({
      next:  data => { this.monthWorkSummary = data; this.cdr.markForCheck(); },
      error: ()   => {}
    });
    this.dayLevelService.getMonthDayTypes(y, m).pipe(takeUntil(this.destroy$)).subscribe({
      next:  data => { this.monthDayTypes = data; this.cdr.markForCheck(); },
      error: ()   => {}
    });
    // Fetch previous month for streak calculation across month boundaries
    const prev = new Date(this.selectedDate);
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    this.logService.getMonthWorkSummary(prev.getFullYear(), prev.getMonth() + 1).pipe(takeUntil(this.destroy$)).subscribe({
      next:  data => { this.prevMonthWorkSummary = data; this.cdr.markForCheck(); },
      error: ()   => {}
    });
    this.dayLevelService.getMonthDayTypes(prev.getFullYear(), prev.getMonth() + 1).pipe(takeUntil(this.destroy$)).subscribe({
      next:  data => { this.prevMonthDayTypes = data; this.cdr.markForCheck(); },
      error: ()   => {}
    });
  }

  /* ── View / expand ──────────────────────────────── */

  toggleExpanded(): void { this.isExpanded = !this.isExpanded; }

  /* ── Breakdown ───────────────────────────────────── */

  get visibleBreakdown(): LogTypeBreakdown[] {
    return this.breakdownExpanded ? this.logTypeBreakdown : this.logTypeBreakdown.slice(0, 4);
  }

  get logTypeBreakdown(): LogTypeBreakdown[] {
    const map = new Map<string, LogTypeBreakdown>();
    for (const log of this.logs) {
      if (!log.logType || log.entryType === 'point' || !log.endAt) continue;
      const mins = Math.max(0, this.toMins(log.endAt) - this.toMins(log.startAt));
      if (!mins) continue;
      const key = log.logType.id;
      if (!map.has(key)) map.set(key, { id: key, name: log.logType.name, color: log.logType.color, totalMins: 0 });
      map.get(key)!.totalMins += mins;
    }
    return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
  }

  private get breakdownTotalMins(): number {
    return this.logTypeBreakdown.reduce((s, bt) => s + bt.totalMins, 0);
  }

  breakdownPct(mins: number): number {
    return this.breakdownTotalMins > 0 ? Math.round(mins / this.breakdownTotalMins * 100) : 0;
  }

  fmtMins(totalMins: number): string {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  /* ── 1.65: Coverage ring + streak ───────────────── */

  /** % of 8h standard workday covered by today's work logs. Exceeds 100 when over 8h. */
  get coveragePct(): number {
    return Math.round((this.totalWorkHours / 8) * 100);
  }

  /** Progress bar fill percentage — always 0–100. When >8h logged, bar fills to 100%. */
  get coverageBarPct(): number {
    if (this.totalWorkHours <= 8) return Math.round((this.totalWorkHours / 8) * 100);
    return 100;
  }

  /** Human-readable label of logged work hours (e.g. "4h 20m", "45m"). */
  get coveredHoursLabel(): string {
    const h    = this.totalWorkHours;
    const hInt = Math.floor(h);
    const mInt = Math.round((h - hInt) * 60);
    if (hInt === 0) return `${mInt}m`;
    if (mInt === 0) return `${hInt}h`;
    return `${hInt}h ${mInt}m`;
  }

  /**
   * Consecutive working-day logging streak ending on selectedDate.
   * Weekends (Sat/Sun) are holidays and are skipped — they neither
   * add to nor break the streak.
   * A weekday counts if it has ≥30 min work logged (1 min threshold
   * for today, since the day may still be in progress).
   */
  get streak(): number {
    const combined  = { ...this.prevMonthWorkSummary, ...this.monthWorkSummary };
    const dayTypes  = { ...this.prevMonthDayTypes, ...this.monthDayTypes };
    const todayKey  = this.localDateKey(this.selectedDate);
    combined[todayKey] = Math.round(this.totalWorkHours * 60);

    let count        = 0;
    let workdaysSeen = 0;
    const d          = new Date(this.selectedDate);

    for (let i = 0; i < 90; i++) { // look back up to 90 calendar days
      const dow     = d.getDay(); // 0=Sun, 6=Sat
      const key     = this.localDateKey(d);
      const dayType = dayTypes[key] ?? null;
      const workMins = combined[key] ?? 0;

      // Weekends always skip
      if (dow === 0 || dow === 6) {
        d.setDate(d.getDate() - 1);
        continue;
      }

      // Paid / sick leave with no work: skip (don't break streak)
      if ((dayType === 'paid_leave' || dayType === 'sick_leave') && workMins === 0) {
        d.setDate(d.getDate() - 1);
        continue;
      }

      // First non-skipped day: use lenient threshold (today may still be in progress)
      const threshold = workdaysSeen === 0 ? 1 : 30;
      workdaysSeen++;

      if (workMins >= threshold) {
        count++;
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  private localDateKey(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /* ── Metric computation ──────────────────────────── */

  private get totalWorkHours(): number {
    return this.logs
      .filter(l => l.entryType !== 'point' && l.logType?.domain === 'work'
                && l.logType?.category !== 'transit' && l.logType?.category !== 'break')
      .reduce((s, l) => s + Math.max(0, this.toMins(l.endAt ?? '00:00') - this.toMins(l.startAt)), 0) / 60;
  }

  private toMins(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  trackByBreakdownId(_i: number, bt: LogTypeBreakdown): string { return bt.id; }
}
