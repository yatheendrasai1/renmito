import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogEntry } from '../../models/log.model';
import { LogService } from '../../services/log.service';

type MetricView = 'professional' | 'personal';

interface MetricCard {
  label:   string;
  main:    string;        // e.g. "4h 50min"
  side:    string | null; // e.g. "43%"  or null
  logIds:  string[];      // IDs of contributing logs on the selected day
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="metrics-section">

      <!-- ── 1.65: Coverage ring — always visible ─────── -->
      <div class="coverage-row">
        <div class="coverage-ring-wrap">
          <svg viewBox="0 0 56 56" class="coverage-svg" aria-hidden="true">
            <!-- Track -->
            <circle cx="28" cy="28" r="20" fill="none"
              stroke="var(--border-light)" stroke-width="5"/>
            <!-- Filled arc — green at 100%, accent otherwise -->
            <circle cx="28" cy="28" r="20" fill="none"
              [attr.stroke]="coveragePct >= 100 ? '#5BAD6F' : 'var(--accent)'"
              stroke-width="5" stroke-linecap="round"
              [attr.stroke-dasharray]="coverageDash"
              transform="rotate(-90 28 28)"/>
          </svg>
          <span class="coverage-center-text">{{ coveragePct }}%</span>
        </div>
        <div class="coverage-stats">
          <span class="coverage-big">{{ coveredHoursLabel }}</span>
          <span class="coverage-of">of 8h today</span>
        </div>
        <div class="streak-block">
          <span class="streak-fire">🔥</span>
          <div class="streak-text-col">
            <span class="streak-count">{{ streak }}</span>
            <span class="streak-label">{{ streak === 1 ? 'day' : 'days' }} streak</span>
          </div>
        </div>
      </div>

      <!-- ── Section header ───────────────────────────── -->
      <div class="metrics-header" (click)="toggleExpanded()">
        <button class="metrics-toggle" [attr.aria-expanded]="isExpanded" tabindex="-1">
          <svg class="metrics-chevron" width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 class="metrics-title">Metrics</h2>
        </button>
        <div class="metrics-header-right" *ngIf="isExpanded" (click)="$event.stopPropagation()">
          <button class="metrics-clear-btn"
                  *ngIf="selectedCardIdx !== null"
                  (click)="clearSelection()"
                  aria-label="Clear metric filter">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round"/>
            </svg>
            Clear
          </button>
          <select class="metrics-view-select"
                  [ngModel]="view"
                  (ngModelChange)="onViewChange($event)">
            <option value="professional">Professional</option>
            <option value="personal">Personal</option>
          </select>
        </div>
      </div>

      <!-- ── Cards ────────────────────────────────────── -->
      <div class="metrics-cards" *ngIf="isExpanded">
        <div class="metric-card"
             *ngFor="let card of activeCards; let i = index"
             [class.metric-card--selected]="selectedCardIdx === i"
             (click)="selectCard(i)">
          <span class="metric-label">{{ card.label }}</span>
          <div class="metric-body">
            <span class="metric-main">{{ card.main }}</span>
            <span class="metric-side" *ngIf="card.side">{{ card.side }}</span>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ── Section wrapper ─────────────────────────────── */
    .metrics-section {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ──────────────────────────────────────── */
    .metrics-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 14px;
      cursor: pointer;
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
      transition: transform 0.2s ease;
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

    .metrics-clear-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--highlight-selected);
      background: rgba(74,144,226,0.1);
      border: 1px solid rgba(74,144,226,0.35);
      border-radius: var(--radius-sm);
      padding: 4px 9px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .metrics-clear-btn:hover {
      background: rgba(74,144,226,0.18);
      border-color: var(--highlight-selected);
    }

    .metrics-view-select {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 5px 10px;
      cursor: pointer;
      outline: none;
      transition: border-color 0.15s;
    }
    .metrics-view-select:focus { border-color: var(--highlight-selected); }

    /* ── Cards row ───────────────────────────────────── */
    .metrics-cards {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 0 14px 14px;
    }
    .metrics-cards::-webkit-scrollbar { height: 4px; }
    .metrics-cards::-webkit-scrollbar-track { background: transparent; }
    .metrics-cards::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    /* ── Individual card ─────────────────────────────── */
    .metric-card {
      flex: 1;
      min-width: 120px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .metric-card:hover {
      background: var(--accent-hover);
      border-color: var(--border-light);
    }
    .metric-card--selected {
      border-color: var(--highlight-selected);
      background: rgba(74,144,226,0.1);
      box-shadow: 0 0 0 1px var(--highlight-selected);
    }

    .metric-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }

    .metric-body {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .metric-main {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .metric-side {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--bg-surface);
      padding: 2px 7px;
      border-radius: 10px;
    }

    @media (max-width: 700px) {
      .metrics-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        overflow-x: unset;
        gap: 8px;
      }
      .metric-card {
        min-width: unset;
        white-space: normal;
      }
    }

    /* ── 1.65: Coverage ring ─────────────────────────── */
    .coverage-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }

    .coverage-ring-wrap {
      position: relative;
      flex-shrink: 0;
      width: 56px;
      height: 56px;
    }

    .coverage-svg { width: 56px; height: 56px; }

    .coverage-center-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .coverage-stats {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .coverage-big {
      font-size: 20px;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1;
    }

    .coverage-of {
      font-size: 11px;
      color: var(--text-muted);
    }

    .streak-block {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .streak-fire { font-size: 22px; }

    .streak-text-col {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .streak-count {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1;
    }

    .streak-label {
      font-size: 10px;
      color: var(--text-muted);
    }
  `]
})
export class MetricsComponent implements OnChanges {
  @Input()  logs:         LogEntry[] = [];
  @Input()  selectedDate: Date = new Date();
  @Output() cardHighlight = new EventEmitter<string[] | null>();

  view: MetricView = 'professional';
  prevDayLogs:          LogEntry[] = [];
  selectedCardIdx:      number | null = null;
  isExpanded            = false;
  monthWorkSummary:     Record<string, number> = {};
  prevMonthWorkSummary: Record<string, number> = {};

  constructor(private logService: LogService) {}

  /* ── Lifecycle ───────────────────────────────────── */

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate'] && this.selectedDate) {
      this.fetchPrevDayLogs();
      this.fetchMonthSummary();
      this.clearSelection();
    }
  }

  private fetchPrevDayLogs(): void {
    const prev = new Date(this.selectedDate);
    prev.setDate(prev.getDate() - 1);
    this.logService.getLogsForDate(prev).subscribe({
      next:  logs => this.prevDayLogs = logs,
      error: ()   => this.prevDayLogs = []
    });
  }

  private fetchMonthSummary(): void {
    const y = this.selectedDate.getFullYear();
    const m = this.selectedDate.getMonth() + 1;
    this.logService.getMonthWorkSummary(y, m).subscribe({
      next:  data => this.monthWorkSummary = data,
      error: ()   => {}
    });
    // Fetch previous month for streak calculation across month boundaries
    const prev = new Date(this.selectedDate);
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    this.logService.getMonthWorkSummary(prev.getFullYear(), prev.getMonth() + 1).subscribe({
      next:  data => this.prevMonthWorkSummary = data,
      error: ()   => {}
    });
  }

  /* ── View / card selection ───────────────────────── */

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    if (!this.isExpanded) this.clearSelection();
  }

  onViewChange(v: MetricView): void {
    this.view = v;
    this.clearSelection();
  }

  selectCard(idx: number): void {
    if (this.selectedCardIdx === idx) {
      this.clearSelection();
    } else {
      this.selectedCardIdx = idx;
      this.cardHighlight.emit(this.activeCards[idx].logIds);
    }
  }

  clearSelection(): void {
    this.selectedCardIdx = null;
    this.cardHighlight.emit(null);
  }

  /* ── Active cards ────────────────────────────────── */

  get activeCards(): MetricCard[] {
    return this.view === 'professional'
      ? this.professionalCards
      : this.personalCards;
  }

  /* ── Professional cards ──────────────────────────── */

  private get professionalCards(): MetricCard[] {
    const work    = this.totalWorkHours;          // excludes transit
    const code    = this.hoursWhere(l => this.isWork(l, 'codetime'));
    const meet    = this.hoursWhere(l => this.isWork(l, 'meeting'));
    const design  = this.hoursWhere(l => this.isWork(l, 'design'));
    const transit = this.hoursWhere(l => this.isWork(l, 'transit'));
    const dayTotal = 24; // transit % shown as fraction of full day
    const workDayPct = Math.round((work / 8) * 100); // % of 8h standard workday
    const workLogIds = this.logIdsWhere(l => l.logType?.domain === 'work' && l.logType?.category !== 'transit' && l.logType?.category !== 'break');

    return [
      { label: 'Total Work Hours', main: this.fmtH(work),           side: null,
        logIds: workLogIds },
      { label: 'Work Log %',       main: workDayPct + '%',           side: this.fmtH(work),
        logIds: workLogIds },
      { label: 'Coding Time',      main: this.fmtH(code),    side: this.pct(code, work),
        logIds: this.logIdsWhere(l => this.isWork(l, 'codetime')) },
      { label: 'Meetings',         main: this.fmtH(meet),    side: this.pct(meet, work),
        logIds: this.logIdsWhere(l => this.isWork(l, 'meeting')) },
      { label: 'Design',           main: this.fmtH(design),  side: this.pct(design, work),
        logIds: this.logIdsWhere(l => this.isWork(l, 'design')) },
      { label: 'Transit',          main: this.fmtH(transit), side: this.pct(transit, dayTotal),
        logIds: this.logIdsWhere(l => this.isWork(l, 'transit')) }
    ];
  }

  /* ── Personal cards ──────────────────────────────── */

  private get personalCards(): MetricCard[] {
    const sleep    = this.sleepHours;
    const learning = this.hoursWhere(
      l => l.logType?.domain === 'personal' && l.logType?.category === 'learning'
    );

    return [
      { label: 'Main Sleep Time', main: this.fmtH(sleep),    side: null,
        logIds: this.sleepLogIds },
      { label: 'Learning Time',   main: this.fmtH(learning), side: null,
        logIds: this.logIdsWhere(
          l => l.logType?.domain === 'personal' && l.logType?.category === 'learning'
        ) }
    ];
  }

  /* ── 1.65: Coverage ring + streak ───────────────── */

  /** % of 8h standard workday covered by today's work logs (0–100). */
  get coveragePct(): number {
    return Math.min(100, Math.round((this.totalWorkHours / 8) * 100));
  }

  /** SVG stroke-dasharray value for the coverage ring (r = 20, circ ≈ 125.66). */
  get coverageDash(): string {
    const circ    = 2 * Math.PI * 20;
    const covered = Math.min(this.coveragePct / 100, 1) * circ;
    return `${covered.toFixed(1)} ${circ.toFixed(1)}`;
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
   * Consecutive-day logging streak ending on selectedDate.
   * A day counts if it has ≥30 min work logged (1 min threshold for today,
   * since the day may still be in progress).
   */
  get streak(): number {
    const combined  = { ...this.prevMonthWorkSummary, ...this.monthWorkSummary };
    const todayKey  = this.localDateKey(this.selectedDate);
    // Override today's slot with live data so partial days count
    combined[todayKey] = Math.round(this.totalWorkHours * 60);

    let count = 0;
    const d   = new Date(this.selectedDate);
    for (let i = 0; i < 62; i++) {
      const key       = this.localDateKey(d);
      const threshold = i === 0 ? 1 : 30; // today: any work; past: ≥30 min
      if ((combined[key] ?? 0) >= threshold) {
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

  /** Transit and break are excluded — travel time and breaks are not productive work. */
  private get totalWorkHours(): number {
    return this.hoursWhere(l => l.logType?.domain === 'work' && l.logType?.category !== 'transit' && l.logType?.category !== 'break');
  }

  /**
   * Sleep window: previous day 19:00 → selected day 12:00.
   * Clips each matching log to the relevant half of the window.
   */
  private get sleepHours(): number {
    const PREV_START = 19 * 60;
    const DAY_END    = 12 * 60;
    let mins = 0;

    for (const l of this.prevDayLogs) {
      if (l.logType?.domain !== 'personal' || l.logType?.category !== 'sleep') continue;
      if (!l.endAt) continue;
      const s = this.toMins(l.startAt);
      const e = this.toMins(l.endAt);
      mins += Math.max(0, Math.min(e, 24 * 60) - Math.max(s, PREV_START));
    }
    for (const l of this.logs) {
      if (l.logType?.domain !== 'personal' || l.logType?.category !== 'sleep') continue;
      if (!l.endAt) continue;
      const s = this.toMins(l.startAt);
      const e = this.toMins(l.endAt);
      mins += Math.max(0, Math.min(e, DAY_END) - Math.max(s, 0));
    }
    return mins / 60;
  }

  /** IDs of selected-day sleep logs that fall within [00:00, 12:00]. */
  private get sleepLogIds(): string[] {
    const DAY_END = 12 * 60;
    return this.logs
      .filter(l => {
        if (l.logType?.domain !== 'personal' || l.logType?.category !== 'sleep') return false;
        if (!l.endAt) return false;
        return Math.min(this.toMins(l.endAt), DAY_END) - Math.max(this.toMins(l.startAt), 0) > 0;
      })
      .map(l => l.id);
  }

  private hoursWhere(pred: (l: LogEntry) => boolean): number {
    return this.logs
      .filter(l => l.entryType !== 'point')
      .filter(pred)
      .reduce((sum, l) => sum + Math.max(0, this.toMins(l.endAt ?? '00:00') - this.toMins(l.startAt)), 0) / 60;
  }

  private logIdsWhere(pred: (l: LogEntry) => boolean): string[] {
    return this.logs.filter(l => l.entryType !== 'point').filter(pred).map(l => l.id);
  }

  private isWork(l: LogEntry, category: string): boolean {
    return l.logType?.domain === 'work' && l.logType?.category === category;
  }

  private toMins(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /** Format fractional hours as "Xh Ymin", "Xh", or "Ymin". */
  private fmtH(hours: number): string {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  private pct(part: number, total: number): string | null {
    if (!total) return null;
    return (part / total * 100).toFixed(0) + '%';
  }
}
