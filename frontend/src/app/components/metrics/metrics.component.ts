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
import { DayLevelService } from '../../services/day-level.service';

type MetricView    = 'professional' | 'personal';
type AnalyticsMode = 'digital' | 'visual';

interface PieSlice {
  name:  string;
  color: string;
  hours: number;
  pct:   number;
  path:  string;   // SVG path for the slice
}

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
            <!-- Track — 1.85: text-primary at low opacity always contrasts any bg -->
            <circle cx="28" cy="28" r="20" fill="none"
              class="ring-track" stroke-width="5"/>
            <!-- Filled arc — green at 100%, accent-bright otherwise (1.85) -->
            <circle cx="28" cy="28" r="20" fill="none"
              [attr.stroke]="coveragePct >= 100 ? '#5BAD6F' : 'var(--accent-bright)'"
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
                  *ngIf="selectedCardIdx !== null && analyticsMode === 'digital'"
                  (click)="clearSelection()"
                  aria-label="Clear metric filter">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round"/>
            </svg>
            Clear
          </button>
          <select class="metrics-view-select"
                  *ngIf="analyticsMode === 'digital'"
                  [ngModel]="view"
                  (ngModelChange)="onViewChange($event)">
            <option value="professional">Professional</option>
            <option value="personal">Personal</option>
          </select>
          <!-- 1.91: Mode selector -->
          <div class="mode-wrap">
            <button class="mode-btn" (click)="toggleModeMenu(); $event.stopPropagation()">
              Mode
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="mode-menu" *ngIf="modeMenuOpen">
              <button class="mode-menu-item"
                      [class.mode-menu-item--active]="analyticsMode === 'digital'"
                      (click)="setMode('digital')">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M4 7h6M4 9.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                Digital
              </button>
              <button class="mode-menu-item"
                      [class.mode-menu-item--active]="analyticsMode === 'visual'"
                      (click)="setMode('visual')">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M7 7L7 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  <path d="M7 7L11.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                Visual
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Digital: metric cards ────────────────────── -->
      <div class="metrics-cards" *ngIf="isExpanded && analyticsMode === 'digital'">
        <div class="metric-card"
             *ngFor="let card of activeCards; let i = index; trackBy: trackByLabel"
             [class.metric-card--selected]="selectedCardIdx === i"
             (click)="selectCard(i)">
          <span class="metric-label">{{ card.label }}</span>
          <div class="metric-body">
            <span class="metric-main">{{ card.main }}</span>
            <span class="metric-side" *ngIf="card.side">{{ card.side }}</span>
          </div>
        </div>
      </div>

      <!-- ── Visual: pie chart ─────────────────────────── -->
      <div class="metrics-visual" *ngIf="isExpanded && analyticsMode === 'visual'">
        <ng-container *ngIf="workPieSlices.length > 0; else noPieData">
          <div class="pie-wrap">
            <!-- Donut pie chart -->
            <svg viewBox="0 0 200 200" class="pie-svg" aria-label="Work domain breakdown">
              <ng-container *ngIf="workPieSlices.length === 1">
                <!-- Full circle for single type -->
                <circle cx="100" cy="100" r="80" [attr.fill]="workPieSlices[0].color"/>
              </ng-container>
              <ng-container *ngIf="workPieSlices.length > 1">
                <path *ngFor="let s of workPieSlices; trackBy: trackByName"
                      [attr.d]="s.path"
                      [attr.fill]="s.color"
                      class="pie-slice"/>
              </ng-container>
              <!-- Donut hole -->
              <circle cx="100" cy="100" r="52" fill="var(--bg-surface)"/>
              <!-- Center label -->
              <text x="100" y="94" text-anchor="middle" class="pie-center-top">Work</text>
              <text x="100" y="112" text-anchor="middle" class="pie-center-bot">{{ workTotalLabel }}</text>
            </svg>
            <!-- Legend -->
            <div class="pie-legend">
              <div class="pie-legend-row" *ngFor="let s of workPieSlices; trackBy: trackByName">
                <span class="pie-legend-dot" [style.background]="s.color"></span>
                <span class="pie-legend-name">{{ s.name }}</span>
                <span class="pie-legend-val">{{ fmtHPublic(s.hours) }}</span>
                <span class="pie-legend-pct">{{ s.pct }}%</span>
              </div>
            </div>
          </div>
        </ng-container>
        <ng-template #noPieData>
          <div class="pie-empty">No work logs for today.</div>
        </ng-template>
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

    /* ── 1.91: Mode toggle ──────────────────────────── */
    .mode-wrap { position: relative; }

    .mode-btn {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600;
      color: var(--text-muted);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 5px 9px; cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .mode-btn:hover { border-color: var(--accent); color: var(--text-primary); }

    .mode-menu {
      position: absolute; top: calc(100% + 5px); right: 0;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 6px 20px rgba(0,0,0,0.28);
      min-width: 130px; z-index: 50;
      overflow: hidden;
      animation: slideDown 0.14s ease;
    }
    .mode-menu-item {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 9px 13px;
      background: none; border: none;
      color: var(--text-secondary); font-size: 12px; font-weight: 500;
      cursor: pointer; text-align: left;
      transition: background 0.12s, color 0.12s;
    }
    .mode-menu-item:not(:last-child) { border-bottom: 1px solid var(--border); }
    .mode-menu-item:hover { background: var(--accent-hover); color: var(--text-primary); }
    .mode-menu-item--active { color: var(--highlight-selected); font-weight: 700; }
    .mode-menu-item svg { flex-shrink: 0; }

    /* ── 1.91: Visual / pie chart ────────────────── */
    .metrics-visual {
      padding: 8px 14px 16px;
    }
    .pie-wrap {
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    }
    .pie-svg {
      width: 160px; height: 160px; flex-shrink: 0;
    }
    .pie-slice { transition: opacity 0.15s; }
    .pie-slice:hover { opacity: 0.82; }
    .pie-center-top {
      font-size: 12px; font-weight: 700;
      fill: var(--text-muted);
    }
    .pie-center-bot {
      font-size: 18px; font-weight: 800;
      fill: var(--text-primary);
    }
    .pie-legend {
      flex: 1; min-width: 140px;
      display: flex; flex-direction: column; gap: 7px;
    }
    .pie-legend-row {
      display: flex; align-items: center; gap: 7px;
    }
    .pie-legend-dot {
      width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
    }
    .pie-legend-name {
      flex: 1; font-size: 12px; color: var(--text-secondary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pie-legend-val {
      font-size: 11px; font-weight: 600; color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
    .pie-legend-pct {
      font-size: 10px; color: var(--text-muted);
      background: var(--bg-card);
      padding: 1px 5px; border-radius: 6px;
      font-variant-numeric: tabular-nums;
    }
    .pie-empty {
      padding: 20px 0; text-align: center;
      font-size: 12px; color: var(--text-muted);
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-5px); }
      to   { opacity: 1; transform: translateY(0); }
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

    /* 1.85: track always visible — text-primary at 18% opacity contrasts any bg */
    .ring-track {
      stroke: var(--text-primary);
      stroke-opacity: 0.18;
    }

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

  view: MetricView      = 'professional';
  analyticsMode: AnalyticsMode = 'digital';
  modeMenuOpen          = false;
  prevDayLogs:          LogEntry[] = [];
  selectedCardIdx:      number | null = null;
  isExpanded            = false;
  monthWorkSummary:     Record<string, number> = {};
  prevMonthWorkSummary: Record<string, number> = {};
  /** 1.83 — day type map for current and previous month (for leave-day streak skipping). */
  monthDayTypes:     Record<string, string> = {};
  prevMonthDayTypes: Record<string, string> = {};

  constructor(
    private logService:      LogService,
    private dayLevelService: DayLevelService,
  ) {}

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
    this.dayLevelService.getMonthDayTypes(y, m).subscribe({
      next:  data => this.monthDayTypes = data,
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
    this.dayLevelService.getMonthDayTypes(prev.getFullYear(), prev.getMonth() + 1).subscribe({
      next:  data => this.prevMonthDayTypes = data,
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

  // ── 1.91: Analytics mode ──────────────────────────────────
  toggleModeMenu(): void { this.modeMenuOpen = !this.modeMenuOpen; }

  setMode(m: AnalyticsMode): void {
    this.analyticsMode = m;
    this.modeMenuOpen  = false;
    if (m === 'digital') return;
    this.clearSelection();
  }

  // ── 1.91: Pie chart ───────────────────────────────────────

  get workTotalLabel(): string { return this.fmtH(this.workDomainTotalHours); }

  fmtHPublic(h: number): string { return this.fmtH(h); }

  private get workDomainTotalHours(): number {
    return this.logs
      .filter(l => l.logType?.domain === 'work' && l.entryType !== 'point' && l.endAt)
      .reduce((s, l) => s + Math.max(0, this.toMins(l.endAt!) - this.toMins(l.startAt)), 0) / 60;
  }

  get workPieSlices(): PieSlice[] {
    const map = new Map<string, { name: string; color: string; hours: number }>();

    for (const l of this.logs) {
      if (l.logType?.domain !== 'work' || l.entryType === 'point' || !l.endAt) continue;
      const key   = l.logType.id;
      const hours = Math.max(0, this.toMins(l.endAt) - this.toMins(l.startAt)) / 60;
      if (!map.has(key)) map.set(key, { name: l.logType.name, color: l.logType.color, hours: 0 });
      map.get(key)!.hours += hours;
    }

    const entries = Array.from(map.values()).filter(s => s.hours > 0);
    const total   = entries.reduce((s, e) => s + e.hours, 0);
    if (!total) return [];

    // Sort largest first for cleaner chart
    entries.sort((a, b) => b.hours - a.hours);

    let cumPct = 0;
    return entries.map(e => {
      const pct  = (e.hours / total) * 100;
      const path = this.pieArcPath(cumPct, cumPct + pct, 80, 100, 100);
      cumPct += pct;
      return { name: e.name, color: e.color, hours: e.hours, pct: Math.round(pct), path };
    });
  }

  private pieArcPath(startPct: number, endPct: number, r: number, cx: number, cy: number): string {
    const rad  = (p: number) => (p / 100) * 2 * Math.PI - Math.PI / 2;
    const s    = rad(startPct);
    const e    = rad(endPct);
    const x1   = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2   = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = (endPct - startPct) > 50 ? 1 : 0;
    return `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
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

  trackByLabel(_i: number, card: MetricCard): string { return card.label; }
  trackByName(_i: number, s: PieSlice): string { return s.name; }
}
