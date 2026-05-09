import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LogEntry } from '../../models/log.model';
import { LogService } from '../../services/log.service';
import { DayLevelService, DayMetadata } from '../../services/day-level.service';
import { AppStateService } from '../../services/app-state.service';

interface LogTypeBreakdown {
  id:        string;
  name:      string;
  color:     string;
  domain:    string;
  totalMins: number;
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="metrics-wrapper">

      <!-- ── Summary cards ────────────────────────── -->
      <div class="summary-cards">

        <ng-container *ngIf="dayMetadata?.dayType === 'holiday' || dayMetadata?.dayType === 'paid_leave' || dayMetadata?.dayType === 'sick_leave'; else normalCards">
          <ng-container *ngIf="totalWorkMins > 0; else breakMsg">
            <div class="summary-card summary-card--break-logged">
              <span class="summary-label">Logged</span>
              <span class="summary-val">{{ coveredHoursLabel }}</span>
            </div>
          </ng-container>
          <ng-template #breakMsg>
            <div class="summary-card summary-card--break-msg">
              <span class="break-msg-text">
                <ng-container *ngIf="dayMetadata?.dayType === 'sick_leave'">
                  Really sick? I mean sick sick? JK! take care! :-)
                </ng-container>
                <ng-container *ngIf="dayMetadata?.dayType === 'holiday' || dayMetadata?.dayType === 'paid_leave'">
                  Take a break. you deserve this! focus on your 'ME' Time
                </ng-container>
              </span>
            </div>
          </ng-template>
        </ng-container>

        <ng-template #normalCards>
          <!-- Coverage card — clicking opens metrics popup -->
          <div class="summary-card summary-card--clickable"
               (click)="toggleMetricsPopup($event)">
            <div class="summary-card-header-row">
              <span class="summary-label">Coverage <span class="summary-baseline">(8h)</span></span>
              <svg class="summary-chevron" [class.summary-chevron--open]="metricsPopupOpen"
                   width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
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

          <div class="summary-card">
            <span class="summary-label">Remaining</span>
            <span class="summary-val summary-val--goal-met" *ngIf="remainingHours <= 0">Goal met ✓</span>
            <span class="summary-val" *ngIf="remainingHours > 0">{{ remainingHoursLabel }}</span>
          </div>
        </ng-template>

      </div>

      <!-- ── Metrics popup overlay + sheet ────────── -->
      <div class="metrics-popup-overlay" *ngIf="metricsPopupOpen"
           (click)="metricsPopupOpen = false"></div>

      <div class="metrics-popup" *ngIf="metricsPopupOpen"
           (click)="$event.stopPropagation()">

        <div class="metrics-popup-header">
          <div class="metrics-popup-meta">
            <span class="metrics-popup-date">{{ formattedDate }}</span>
            <div class="metrics-popup-daytype">
              <span class="mp-daytype-dot" [style.background]="dayTypeColor"></span>
              {{ dayTypeLabel }}
            </div>
          </div>
          <button class="metrics-popup-close"
                  (click)="metricsPopupOpen = false"
                  aria-label="Close metrics">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Summary header -->
        <div class="breakdown-summary-hdr" *ngIf="logTypeBreakdown.length > 0">
          <div class="bsh-row">
            <span class="bsh-label">Total Logged</span>
            <span class="bsh-logged">{{ fmtMins(totalWorkMins) }}</span>
            <span class="bsh-sep">/</span>
            <span class="bsh-target">8h target</span>
            <span class="bsh-overflow-lbl" *ngIf="totalWorkMins > 480">
              ↑ {{ overflowMultiplierLabel }}
            </span>
          </div>
          <div class="bsh-track">
            <div class="bsh-fill"
                 [style.width.%]="summaryTargetWidth"
                 [style.background]="totalWorkMins >= 480 ? '#a3d4ac' : '#93b8de'"></div>
            <div class="bsh-fill bsh-fill--overflow"
                 *ngIf="totalWorkMins > 480"
                 [style.width.%]="summaryOverflowWidth"></div>
          </div>
        </div>

        <ng-container *ngIf="logTypeBreakdown.length > 0; else noBreakdown">

          <!-- Professional section -->
          <ng-container *ngIf="professionalBreakdown.length > 0">
            <div class="breakdown-section-header">
              <span class="breakdown-section-label">Professional</span>
              <span class="breakdown-section-total">{{ fmtMins(sectionTotalMins(professionalBreakdown)) }}</span>
            </div>
            <div class="breakdown-list">
              <div class="breakdown-item"
                   *ngFor="let bt of visibleProfessional; trackBy: trackByBreakdownId">
                <div class="breakdown-row">
                  <span class="breakdown-dot" [style.background]="bt.color || '#9B9B9B'"></span>
                  <span class="breakdown-name">{{ bt.name }}</span>
                  <span class="breakdown-time">{{ fmtMins(bt.totalMins) }}</span>
                  <span class="breakdown-pct" [style.color]="bt.color || '#9B9B9B'">{{ breakdownPct(bt.totalMins) }}%</span>
                </div>
                <div class="breakdown-track">
                  <div class="breakdown-fill"
                       [style.width]="breakdownBarWidth(bt.totalMins) + '%'"
                       [style.background]="bt.color || '#9B9B9B'"></div>
                </div>
              </div>
            </div>
            <button class="breakdown-expand-btn"
                    *ngIf="professionalBreakdown.length > 4"
                    (click)="professionalExpanded = !professionalExpanded; $event.stopPropagation()">
              <ng-container *ngIf="!professionalExpanded">
                Show {{ professionalBreakdown.length - 4 }} more
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </ng-container>
              <ng-container *ngIf="professionalExpanded">
                Show less
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </ng-container>
            </button>
            <div class="breakdown-footnote">% of 24h day</div>
          </ng-container>

          <!-- Personal section -->
          <ng-container *ngIf="personalBreakdown.length > 0">
            <div class="breakdown-section-header"
                 [class.breakdown-section-header--bordered]="professionalBreakdown.length > 0">
              <span class="breakdown-section-label">Personal</span>
              <span class="breakdown-section-total">{{ fmtMins(sectionTotalMins(personalBreakdown)) }}</span>
            </div>
            <div class="breakdown-list">
              <div class="breakdown-item"
                   *ngFor="let bt of visiblePersonal; trackBy: trackByBreakdownId">
                <div class="breakdown-row">
                  <span class="breakdown-dot" [style.background]="bt.color || '#9B9B9B'"></span>
                  <span class="breakdown-name">{{ bt.name }}</span>
                  <span class="breakdown-time">{{ fmtMins(bt.totalMins) }}</span>
                  <span class="breakdown-pct" [style.color]="bt.color || '#9B9B9B'">{{ breakdownPct(bt.totalMins) }}%</span>
                </div>
                <div class="breakdown-track">
                  <div class="breakdown-fill"
                       [style.width]="breakdownBarWidth(bt.totalMins) + '%'"
                       [style.background]="bt.color || '#9B9B9B'"></div>
                </div>
              </div>
            </div>
            <button class="breakdown-expand-btn"
                    *ngIf="personalBreakdown.length > 4"
                    (click)="personalExpanded = !personalExpanded; $event.stopPropagation()">
              <ng-container *ngIf="!personalExpanded">
                Show {{ personalBreakdown.length - 4 }} more
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </ng-container>
              <ng-container *ngIf="personalExpanded">
                Show less
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </ng-container>
            </button>
            <div class="breakdown-footnote">% of 24h day</div>
          </ng-container>

        </ng-container>
        <ng-template #noBreakdown>
          <div class="breakdown-empty">No logs recorded for this day.</div>
        </ng-template>

        <div class="metrics-popup-fade"></div>

      </div>

    </div>
  `,
  styles: [`
    /* ── Outer wrapper ──────────────────────────────── */
    .metrics-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }

    /* ── Summary cards row ──────────────────────────── */
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

    .summary-card--clickable {
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .summary-card--clickable:hover {
      background: var(--accent-hover);
      border-color: var(--border-light);
    }

    .summary-card--break-logged {
      flex: 3;
    }

    .summary-card--break-msg {
      flex: 3;
      justify-content: center;
      align-items: center;
    }
    .break-msg-text {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
      line-height: 1.4;
    }

    .summary-card-header-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .summary-chevron {
      margin-left: auto;
      color: var(--text-muted);
      flex-shrink: 0;
      transform: rotate(-90deg);
      transition: transform 0.2s ease;
    }
    .summary-chevron--open {
      transform: rotate(0deg);
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

    .summary-val--goal-met {
      color: #a3d4ac;
      font-size: 13px;
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

    /* ── Metrics popup overlay ──────────────────────── */
    .metrics-popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0, 0, 0, 0.35);
    }

    /* ── Metrics popup card ─────────────────────────── */
    .metrics-popup {
      position: fixed;
      bottom: 76px;
      left: 12px;
      right: 12px;
      max-width: 480px;
      margin: 0 auto;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      z-index: 201;
      max-height: 68vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.28);
      animation: metricsPopIn 0.2s ease;
    }

    @keyframes metricsPopIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .metrics-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px 10px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--bg-card);
    }

    .metrics-popup-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .metrics-popup-date {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .metrics-popup-daytype {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .mp-daytype-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .metrics-popup-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      border-radius: var(--radius-sm);
      transition: background 0.15s, color 0.15s;
    }
    .metrics-popup-close:hover {
      background: var(--accent-hover);
      color: var(--text-primary);
    }

    /* ── Breakdown list ──────────────────────────────── */
    .breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px 14px;
    }
    .breakdown-item   { display: flex; flex-direction: column; gap: 5px; }
    .breakdown-row    { display: flex; align-items: center; gap: 8px; }
    .breakdown-dot    { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .breakdown-name   { flex: 1; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .breakdown-time   { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .breakdown-pct    { font-size: 12px; color: var(--text-muted); white-space: nowrap; min-width: 36px; text-align: right; }
    .breakdown-track  { height: 4px; background: var(--bg-hover); border-radius: 2px; overflow: hidden; }
    .breakdown-fill   { height: 100%; border-radius: 2px; transition: width 0.4s ease; opacity: 0.75; }
    .breakdown-empty  { padding: 16px 14px; font-size: 12px; color: var(--text-muted); }

    .breakdown-section-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 4px;
    }
    .breakdown-section-header--bordered {
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }
    .breakdown-section-label {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: var(--text-muted);
    }
    .breakdown-section-total {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .breakdown-expand-btn {
      display: flex; align-items: center; gap: 4px; justify-content: center;
      width: 100%; padding: 7px 14px;
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      background: none; border: none; border-top: 1px solid var(--border);
      cursor: pointer; transition: color 0.15s, background 0.15s;
    }
    .breakdown-expand-btn:hover { color: var(--text-primary); background: var(--accent-hover); }

    /* ── Summary header card ─────────────────────────── */
    .breakdown-summary-hdr {
      margin: 10px 12px 4px;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--bg-card) 60%, var(--bg-surface));
      border: 1px solid var(--border);
      border-radius: var(--radius-sm, 6px);
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .bsh-row {
      display: flex;
      align-items: baseline;
      gap: 5px;
    }
    .bsh-label {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.7px; color: var(--text-muted); flex: 1;
    }
    .bsh-logged {
      font-size: 13px; font-weight: 700; color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
    .bsh-sep { font-size: 11px; color: var(--text-muted); }
    .bsh-target { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .bsh-overflow-lbl {
      font-size: 10px; font-weight: 700; color: #f59e0b;
      margin-left: 2px;
    }
    .bsh-track {
      display: flex;
      height: 5px;
      background: color-mix(in srgb, var(--text-primary) 12%, transparent);
      border-radius: 3px;
      overflow: hidden;
    }
    .bsh-fill {
      height: 100%; transition: width 0.35s ease;
    }
    .bsh-fill--overflow {
      background: #f59e0b;
      opacity: 0.85;
    }

    /* ── Footnote ────────────────────────────────────── */
    .breakdown-footnote {
      font-size: 10px; color: var(--text-muted);
      padding: 4px 14px 10px;
      opacity: 0.65;
    }

    /* ── Bottom fade ─────────────────────────────────── */
    .metrics-popup-fade {
      position: sticky;
      bottom: 0;
      height: 40px;
      margin-top: -40px;
      background: linear-gradient(to bottom, transparent, var(--bg-card));
      pointer-events: none;
      display: block;
    }
  `]
})
export class MetricsComponent implements OnChanges, OnDestroy {
  @Input()  logs:         LogEntry[]       = [];
  @Input()  selectedDate: Date             = new Date();
  @Input()  dayMetadata:  DayMetadata|null = null;
  @Output() cardHighlight = new EventEmitter<string[] | null>();

  private readonly destroy$ = new Subject<void>();

  private _metricsPopupOpen = false;
  get metricsPopupOpen(): boolean { return this._metricsPopupOpen; }
  set metricsPopupOpen(v: boolean) {
    this._metricsPopupOpen = v;
    this.appState.coverageSheetOpen$.next(v);
  }

  breakdownExpanded     = false;
  professionalExpanded  = false;
  personalExpanded      = false;
  monthWorkSummary:     Record<string, number> = {};
  prevMonthWorkSummary: Record<string, number> = {};
  monthDayTypes:        Record<string, string> = {};
  prevMonthDayTypes:    Record<string, string> = {};

  private readonly dayTypeOptions = [
    { value: 'working',    label: 'Working Day', color: '#4ade80' },
    { value: 'wfh',        label: 'WFH',         color: '#facc15' },
    { value: 'holiday',    label: 'Holiday',      color: '#60a5fa' },
    { value: 'paid_leave', label: 'Paid Leave',   color: '#fb923c' },
    { value: 'sick_leave', label: 'Sick Leave',   color: '#f87171' },
  ] as const;

  constructor(
    private logService:      LogService,
    private dayLevelService: DayLevelService,
    private cdr:             ChangeDetectorRef,
    readonly appState:       AppStateService,
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
      this.breakdownExpanded     = false;
      this.professionalExpanded  = false;
      this.personalExpanded      = false;
      this.metricsPopupOpen      = false;
    }
  }

  /* ── Popup toggle ───────────────────────────────── */

  toggleMetricsPopup(event: MouseEvent): void {
    event.stopPropagation();
    this.metricsPopupOpen = !this.metricsPopupOpen;
    this.cdr.markForCheck();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.metricsPopupOpen) {
      this.metricsPopupOpen = false;
      this.cdr.markForCheck();
    }
  }

  /* ── Date & day type display ─────────────────────── */

  get formattedDate(): string {
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  }

  get dayTypeLabel(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.label ?? 'Working Day';
  }

  get dayTypeColor(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.color ?? '#4ade80';
  }

  /* ── Data fetching ───────────────────────────────── */

  private fetchPrevDayLogs(): void {
    const prev = new Date(this.selectedDate);
    prev.setDate(prev.getDate() - 1);
    this.logService.getLogsForDate(prev).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => this.cdr.markForCheck(),
      error: () => {}
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

  /* ── Breakdown ───────────────────────────────────── */

  get logTypeBreakdown(): LogTypeBreakdown[] {
    const map = new Map<string, LogTypeBreakdown>();
    for (const log of this.logs) {
      if (!log.logType || log.entryType === 'point' || !log.endAt) continue;
      const mins = Math.max(0, this.toMins(log.endAt) - this.toMins(log.startAt));
      if (!mins) continue;
      const key = log.logType.id;
      if (!map.has(key)) map.set(key, { id: key, name: log.logType.name, color: log.logType.color, domain: log.logType.domain ?? '', totalMins: 0 });
      map.get(key)!.totalMins += mins;
    }
    return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
  }

  get professionalBreakdown(): LogTypeBreakdown[] {
    return this.logTypeBreakdown.filter(bt => bt.domain === 'work');
  }

  get personalBreakdown(): LogTypeBreakdown[] {
    return this.logTypeBreakdown.filter(bt => bt.domain !== 'work');
  }

  get visibleProfessional(): LogTypeBreakdown[] {
    return this.professionalExpanded ? this.professionalBreakdown : this.professionalBreakdown.slice(0, 4);
  }

  get visiblePersonal(): LogTypeBreakdown[] {
    return this.personalExpanded ? this.personalBreakdown : this.personalBreakdown.slice(0, 4);
  }

  sectionTotalMins(section: LogTypeBreakdown[]): number {
    return section.reduce((s, bt) => s + bt.totalMins, 0);
  }

  get breakdownTotalMins(): number {
    return this.logTypeBreakdown.reduce((s, bt) => s + bt.totalMins, 0);
  }

  breakdownPct(mins: number): number {
    return Math.round(mins / 1440 * 100);
  }

  breakdownBarWidth(mins: number): number {
    return Math.min(100, mins / 1440 * 100);
  }

  get totalWorkMins(): number {
    return Math.round(this.totalWorkHours * 60);
  }

  get summaryTargetWidth(): number {
    if (this.totalWorkMins <= 480) return this.totalWorkMins / 480 * 100;
    return 480 / this.totalWorkMins * 100;
  }

  get summaryOverflowWidth(): number {
    if (this.totalWorkMins <= 480) return 0;
    return (this.totalWorkMins - 480) / this.totalWorkMins * 100;
  }

  get overflowMultiplierLabel(): string {
    const x = Math.round(this.totalWorkMins / 480 * 10) / 10;
    return x.toFixed(1) + 'x target';
  }

  fmtMins(totalMins: number): string {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  /* ── Coverage ───────────────────────────────────── */

  get coveragePct(): number {
    return Math.round((this.totalWorkHours / 8) * 100);
  }

  get coverageBarPct(): number {
    if (this.totalWorkHours <= 8) return Math.round((this.totalWorkHours / 8) * 100);
    return 100;
  }

  get remainingHours(): number {
    return 8 - this.totalWorkHours;
  }

  get remainingHoursLabel(): string {
    const r = this.remainingHours;
    if (r <= 0) return 'Goal met ✓';
    const h = Math.floor(r);
    const m = Math.round((r - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  get coveredHoursLabel(): string {
    const h    = this.totalWorkHours;
    const hInt = Math.floor(h);
    const mInt = Math.round((h - hInt) * 60);
    if (hInt === 0) return `${mInt}m`;
    if (mInt === 0) return `${hInt}h`;
    return `${hInt}h ${mInt}m`;
  }

  get streak(): number {
    const combined  = { ...this.prevMonthWorkSummary, ...this.monthWorkSummary };
    const dayTypes  = { ...this.prevMonthDayTypes, ...this.monthDayTypes };
    const todayKey  = this.localDateKey(this.selectedDate);
    combined[todayKey] = Math.round(this.totalWorkHours * 60);

    let count        = 0;
    let workdaysSeen = 0;
    const d          = new Date(this.selectedDate);

    for (let i = 0; i < 90; i++) {
      const dow      = d.getDay();
      const key      = this.localDateKey(d);
      const dayType  = dayTypes[key] ?? null;
      const workMins = combined[key] ?? 0;

      if (dow === 0 || dow === 6) { d.setDate(d.getDate() - 1); continue; }

      if ((dayType === 'paid_leave' || dayType === 'sick_leave') && workMins === 0) {
        d.setDate(d.getDate() - 1); continue;
      }

      const threshold = workdaysSeen === 0 ? 1 : 30;
      workdaysSeen++;
      if (workMins >= threshold) { count++; } else { break; }
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  private localDateKey(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  get totalWorkHours(): number {
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
