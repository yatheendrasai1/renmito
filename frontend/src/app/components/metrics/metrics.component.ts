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

      <!-- ── Section header ───────────────────────────── -->
      <div class="metrics-header">
        <button class="metrics-toggle" (click)="toggleExpanded()" [attr.aria-expanded]="isExpanded">
          <svg class="metrics-chevron" width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 class="metrics-title">Metrics</h2>
        </button>
        <div class="metrics-header-right" *ngIf="isExpanded">
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
  `]
})
export class MetricsComponent implements OnChanges {
  @Input()  logs:         LogEntry[] = [];
  @Input()  selectedDate: Date = new Date();
  @Output() cardHighlight = new EventEmitter<string[] | null>();

  view: MetricView = 'professional';
  prevDayLogs: LogEntry[] = [];
  selectedCardIdx: number | null = null;
  isExpanded = false;

  constructor(private logService: LogService) {}

  /* ── Lifecycle ───────────────────────────────────── */

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate'] && this.selectedDate) {
      this.fetchPrevDayLogs();
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
    const work    = this.totalWorkHours;
    const code    = this.hoursWhere(l => this.isWork(l, 'codetime'));
    const meet    = this.hoursWhere(l => this.isWork(l, 'meeting'));
    const design  = this.hoursWhere(l => this.isWork(l, 'design'));
    const transit = this.hoursWhere(l => this.isWork(l, 'transit'));

    return [
      { label: 'Total Work Hours', main: this.fmtH(work),    side: null,
        logIds: this.logIdsWhere(l => l.logType?.domain === 'work') },
      { label: 'Coding Time',      main: this.fmtH(code),    side: this.pct(code, work),
        logIds: this.logIdsWhere(l => this.isWork(l, 'codetime')) },
      { label: 'Meetings',         main: this.fmtH(meet),    side: this.pct(meet, work),
        logIds: this.logIdsWhere(l => this.isWork(l, 'meeting')) },
      { label: 'Design',           main: this.fmtH(design),  side: this.pct(design, work),
        logIds: this.logIdsWhere(l => this.isWork(l, 'design')) },
      { label: 'Transit',          main: this.fmtH(transit), side: this.pct(transit, work),
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

  /* ── Metric computation ──────────────────────────── */

  private get totalWorkHours(): number {
    return this.hoursWhere(l => l.logType?.domain === 'work');
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
      const s = this.toMins(l.startAt);
      const e = this.toMins(l.endAt);
      mins += Math.max(0, Math.min(e, 24 * 60) - Math.max(s, PREV_START));
    }
    for (const l of this.logs) {
      if (l.logType?.domain !== 'personal' || l.logType?.category !== 'sleep') continue;
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
        return Math.min(this.toMins(l.endAt), DAY_END) - Math.max(this.toMins(l.startAt), 0) > 0;
      })
      .map(l => l.id);
  }

  private hoursWhere(pred: (l: LogEntry) => boolean): number {
    return this.logs
      .filter(pred)
      .reduce((sum, l) => sum + Math.max(0, this.toMins(l.endAt) - this.toMins(l.startAt)), 0) / 60;
  }

  private logIdsWhere(pred: (l: LogEntry) => boolean): string[] {
    return this.logs.filter(pred).map(l => l.id);
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
