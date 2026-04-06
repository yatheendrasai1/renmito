import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogEntry } from '../../models/log.model';

// ── Kept for backward-compat with app.component.ts imports ──────────────────
export interface DragSelection {
  startTime:    string;
  endTime:      string;
  startMinutes: number;
  endMinutes:   number;
  mergeSourceIds?: [string, string];
  mergeLogTypeId?: string;
}

interface SpineEntry {
  log:      LogEntry;
  gapMins:  number;   // free minutes before this log
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="spine-wrapper">

      <!-- ── Header ──────────────────────────────────────────── -->
      <div class="spine-hdr" (click)="isCollapsed = !isCollapsed">
        <div class="spine-hdr-left">
          <svg class="chevron" [class.chevron--open]="!isCollapsed"
               width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="spine-hdr-title">Timeline</span>
          <span class="spine-count" *ngIf="entries.length">{{ entries.length }}</span>
        </div>
        <button class="btn-add"
                (click)="onAddLog(); $event.stopPropagation()"
                [disabled]="isCollapsed">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="8" y1="2" x2="8" y2="14"/>
            <line x1="2" y1="8" x2="14" y2="8"/>
          </svg>
          Add log
        </button>
      </div>

      <!-- ── Body ────────────────────────────────────────────── -->
      <div class="spine-body" *ngIf="!isCollapsed">

        <!-- Loading skeleton -->
        <div class="spine-skel" *ngIf="isLoading">
          <div class="skel-row shimmer" *ngFor="let x of [1,2,3]"></div>
        </div>

        <!-- Empty state -->
        <div class="spine-empty" *ngIf="!isLoading && !entries.length">
          <svg width="38" height="38" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="15" stroke="var(--text-muted)"
                    stroke-width="1.4" stroke-dasharray="4 3"/>
            <path d="M18 11v7l4 3" stroke="var(--text-muted)"
                  stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p class="spine-empty-text">No logs for this day</p>
          <button class="btn-empty-add" (click)="onAddLog()">+ Add first log</button>
        </div>

        <!-- Spine track -->
        <div class="spine-track" *ngIf="!isLoading && entries.length">

          <ng-container *ngFor="let entry of entries; let last = last">

            <!-- Gap indicator (≥ 60 min free) -->
            <div class="gap-row" *ngIf="entry.gapMins >= 60">
              <div class="gap-axis"></div>
              <div class="gap-pill">
                <span class="gap-label">{{ formatMins(entry.gapMins) }} free</span>
              </div>
            </div>

            <!-- Log entry -->
            <div class="spine-entry"
                 [class.spine-entry--hi]="isHighlighted(entry.log)"
                 [class.spine-entry--dim]="isDimmed(entry.log)"
                 [class.spine-entry--last]="last"
                 [attr.data-log-id]="entry.log.id">

              <!-- Axis: dot + connecting line -->
              <div class="spine-axis" [class.spine-axis--last]="last">
                <div class="spine-dot"
                     [style.background]="entry.log.logType?.color || '#8C8C8C'">
                </div>
                <div class="spine-line" *ngIf="!last"></div>
              </div>

              <!-- Pill card -->
              <div class="spine-pill"
                   [class.spine-pill--last]="last"
                   [style.border-left-color]="entry.log.logType?.color || '#8C8C8C'"
                   [style.background]="pillBg(entry.log)"
                   (click)="onPillClick(entry.log)">

                <div class="pill-top">
                  <span class="pill-type"
                        [style.color]="entry.log.logType?.color || '#8C8C8C'">
                    {{ entry.log.logType?.name || '—' }}
                  </span>
                  <span class="pill-dur" *ngIf="getDuration(entry.log)">
                    {{ getDuration(entry.log) }}
                  </span>
                </div>

                <div class="pill-title" *ngIf="entry.log.title">
                  {{ entry.log.title }}
                </div>

                <div class="pill-time">
                  <ng-container *ngIf="entry.log.entryType === 'point'">
                    ⏱ {{ entry.log.startAt }}
                  </ng-container>
                  <ng-container *ngIf="entry.log.entryType !== 'point'">
                    {{ entry.log.startAt }}{{ entry.log.endAt ? ' – ' + entry.log.endAt : '' }}
                  </ng-container>
                </div>

              </div>
            </div>

          </ng-container>

          <!-- Bottom: add another -->
          <div class="spine-add-row" (click)="onAddLog()">
            <div class="spine-axis spine-axis--last">
              <button class="spine-add-dot" tabindex="-1">+</button>
            </div>
            <span class="spine-add-hint">Add another log</span>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Wrapper ───────────────────────────────────────────── */
    .spine-wrapper {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    /* ── Header ───────────────────────────────────────────── */
    .spine-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .spine-hdr:hover { background: var(--accent-hover); }

    .spine-hdr-left { display: flex; align-items: center; gap: 8px; }
    .chevron { color: var(--text-muted); transition: transform 0.22s ease; flex-shrink: 0; }
    .chevron--open { transform: rotate(180deg); }
    .spine-hdr-title {
      font-size: 11px; font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 1px;
    }
    .spine-count {
      font-size: 11px; color: var(--text-muted);
      background: var(--bg-card);
      padding: 1px 8px; border-radius: 10px;
    }

    .btn-add {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; font-weight: 600;
      color: var(--highlight-selected);
      background: transparent;
      border: 1px solid var(--highlight-selected);
      border-radius: var(--radius-sm);
      padding: 5px 11px;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .btn-add:hover { background: rgba(74,144,226,0.12); }
    .btn-add:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── Body ─────────────────────────────────────────────── */
    .spine-body { padding: 18px 18px 10px; }

    /* ── Skeleton ─────────────────────────────────────────── */
    .spine-skel { display: flex; flex-direction: column; gap: 14px; }
    .skel-row { height: 60px; border-radius: var(--radius-sm); }
    .shimmer {
      background: linear-gradient(90deg,
        var(--bg-card) 25%, var(--accent-hover) 50%, var(--bg-card) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Empty ────────────────────────────────────────────── */
    .spine-empty {
      display: flex; flex-direction: column;
      align-items: center; gap: 12px;
      padding: 36px 16px; text-align: center;
    }
    .spine-empty-text { font-size: 13px; color: var(--text-muted); margin: 0; }
    .btn-empty-add {
      font-size: 13px; font-weight: 600;
      color: var(--highlight-selected);
      background: rgba(74,144,226,0.08);
      border: 1px solid rgba(74,144,226,0.28);
      border-radius: var(--radius-sm);
      padding: 8px 18px;
      transition: background 0.15s;
    }
    .btn-empty-add:hover { background: rgba(74,144,226,0.15); }

    /* ── Spine track ──────────────────────────────────────── */
    .spine-track { display: flex; flex-direction: column; }

    /* ── Gap row ──────────────────────────────────────────── */
    .gap-row { display: flex; gap: 14px; align-items: center; }
    .gap-axis {
      width: 12px; flex-shrink: 0;
      /* Visual space for the axis column, no dot shown */
    }
    .gap-pill {
      flex: 1; padding: 6px 0;
      display: flex; align-items: center;
      margin-bottom: 0;
    }
    .gap-label {
      font-size: 11px; color: var(--text-muted); font-style: italic;
      background: var(--bg-card);
      padding: 2px 10px; border-radius: 10px;
      border: 1px dashed var(--border);
    }

    /* ── Spine entry ──────────────────────────────────────── */
    .spine-entry {
      display: flex;
      gap: 14px;
      align-items: stretch; /* axis stretches to pill height */
    }

    /* ── Axis: dot + line ─────────────────────────────────── */
    .spine-axis {
      width: 12px;
      flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center;
      padding-bottom: 14px; /* bridges the gap to next entry's dot */
    }
    .spine-axis--last { padding-bottom: 0; }

    .spine-dot {
      width: 12px; height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 10px;      /* aligns with pill type label */
      position: relative; z-index: 1;
      box-shadow: 0 0 0 3px var(--bg-surface);
    }

    .spine-line {
      width: 2px; flex: 1;
      min-height: 14px;
      background: var(--border);
      margin-top: 4px;
    }

    /* ── Pill ─────────────────────────────────────────────── */
    .spine-pill {
      flex: 1; min-width: 0;
      border-left: 3px solid;
      border-radius: 0 8px 8px 0;
      padding: 10px 14px;
      margin-bottom: 14px;
      cursor: pointer;
      display: flex; flex-direction: column; gap: 5px;
      min-height: 52px;
      transition: filter 0.12s, transform 0.1s, box-shadow 0.12s;
    }
    .spine-pill--last { margin-bottom: 0; }
    .spine-pill:hover { filter: brightness(1.07); transform: translateX(2px); }
    .spine-pill:active { transform: translateX(1px) scale(0.99); }

    /* Highlighted: metric or focussed */
    .spine-entry--hi .spine-pill {
      box-shadow: 0 0 0 2px var(--highlight-selected);
      filter: brightness(1.05);
    }
    .spine-entry--hi .spine-dot {
      box-shadow: 0 0 0 3px var(--highlight-selected);
    }

    /* Dimmed: metric de-emphasis */
    .spine-entry--dim .spine-pill {
      opacity: 0.22; filter: grayscale(0.6);
    }
    .spine-entry--dim .spine-dot { opacity: 0.22; }

    /* Pill content */
    .pill-top {
      display: flex; align-items: center;
      justify-content: space-between; gap: 8px;
    }
    .pill-type {
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pill-dur {
      font-size: 11px; color: var(--text-muted);
      background: var(--bg-surface);
      padding: 1px 7px; border-radius: 6px;
      flex-shrink: 0; white-space: nowrap;
    }
    .pill-title {
      font-size: 13px; font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pill-time {
      font-size: 11px; color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    /* ── Bottom add row ───────────────────────────────────── */
    .spine-add-row {
      display: flex; align-items: center; gap: 14px;
      padding: 6px 0;
      cursor: pointer; opacity: 0.5;
      transition: opacity 0.15s;
    }
    .spine-add-row:hover { opacity: 1; }

    .spine-add-dot {
      width: 20px; height: 20px;
      border-radius: 50%;
      border: 2px dashed var(--border);
      background: var(--bg-card);
      color: var(--text-muted);
      font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
      transition: border-color 0.15s, color 0.15s;
    }
    .spine-add-row:hover .spine-add-dot {
      border-color: var(--highlight-selected);
      color: var(--highlight-selected);
    }

    .spine-add-hint {
      font-size: 12px; color: var(--text-muted); font-style: italic;
    }
  `]
})
export class TimelineComponent implements OnChanges {

  @Input() logs:             LogEntry[] = [];
  @Input() selectedDate:     Date       = new Date();
  @Input() highlightedLogId: string | null = null;
  @Input() metricLogIds:     Set<string> | null = null;
  @Input() isLoading:        boolean    = false;

  @Output() selectionMade       = new EventEmitter<DragSelection>(); // compat
  @Output() createLogClicked    = new EventEmitter<DragSelection>();
  @Output() logClicked          = new EventEmitter<LogEntry>();
  @Output() mergePointsSelected = new EventEmitter<DragSelection>(); // compat

  isCollapsed = false;
  entries: SpineEntry[] = [];

  ngOnChanges(): void {
    const sorted = [...this.logs].sort((a, b) => a.startAt.localeCompare(b.startAt));
    this.entries = sorted.map((log, i) => ({
      log,
      gapMins: this.calcGap(sorted, i)
    }));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private calcGap(sorted: LogEntry[], i: number): number {
    const currStart = this.toMins(sorted[i].startAt);
    if (i === 0) return currStart; // gap from midnight
    const prev    = sorted[i - 1];
    const prevEnd = prev.endAt ? this.toMins(prev.endAt) : this.toMins(prev.startAt);
    return Math.max(0, currStart - prevEnd);
  }

  toMins(t: string): number {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private minsToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  formatMins(mins: number): string {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    return h ? `${h}h` : `${m}m`;
  }

  getDuration(log: LogEntry): string {
    if (log.durationMins) return this.formatMins(log.durationMins);
    if (!log.endAt)       return '';
    const diff = this.toMins(log.endAt) - this.toMins(log.startAt);
    return diff > 0 ? this.formatMins(diff) : '';
  }

  pillBg(log: LogEntry): string {
    return (log.logType?.color || '#8C8C8C') + '22';
  }

  isHighlighted(log: LogEntry): boolean {
    if (this.metricLogIds) return this.metricLogIds.has(log.id);
    return log.id === this.highlightedLogId;
  }

  isDimmed(log: LogEntry): boolean {
    return !!this.metricLogIds && !this.metricLogIds.has(log.id);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  onPillClick(log: LogEntry): void {
    this.logClicked.emit(log);
  }

  onAddLog(): void {
    const lastLog  = this.entries.length
      ? this.entries[this.entries.length - 1].log
      : null;
    const startStr = lastLog?.endAt || lastLog?.startAt || '09:00';
    const startM   = this.toMins(startStr);
    const endM     = Math.min(startM + 60, 23 * 60 + 50);
    this.createLogClicked.emit({
      startTime:    startStr,
      endTime:      this.minsToTime(endM),
      startMinutes: startM,
      endMinutes:   endM
    });
  }

  // ── Public API (called by app.component.ts via ViewChild) ─────────────────

  scrollToLog(log: LogEntry): void {
    setTimeout(() => {
      document.querySelector(`[data-log-id="${log.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  cancelMerge(): void { /* no-op — merge mode not used in spine view */ }
}
