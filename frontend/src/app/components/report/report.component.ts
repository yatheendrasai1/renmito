import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogService } from '../../services/log.service';
import { CalendarComponent } from '../calendar/calendar.component';

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToDisplay(iso: string): string {
  const d = new Date(iso);
  const dd  = String(d.getUTCDate()).padStart(2, '0');
  const mmm = MONTHS[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  const hh  = String(d.getUTCHours()).padStart(2, '0');
  const mi  = String(d.getUTCMinutes()).padStart(2, '0');
  const ss  = String(d.getUTCSeconds()).padStart(2, '0');
  return `${dd}-${mmm}-${yyyy} ${hh}:${mi}:${ss}`;
}

function displayToISO(display: string): string | null {
  const m = display.trim().match(
    /^(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!m) return null;
  const [, dd, mon, yyyy, hh, mi, ss] = m;
  const idx = MONTHS.findIndex(x => x.toLowerCase() === mon.toLowerCase());
  if (idx === -1) return null;
  const mm = String(idx + 1).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.000Z`;
}

// 1w = 5d = 40h = 2400m, 1d = 8h = 480m
function parseTimeSpentToMins(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  if (/[wdhm]/i.test(s)) {
    let mins = 0;
    const wm = s.match(/(\d+)\s*w/i); if (wm) mins += parseInt(wm[1]) * 2400;
    const dm = s.match(/(\d+)\s*d/i); if (dm) mins += parseInt(dm[1]) * 480;
    const hm = s.match(/(\d+)\s*h/i); if (hm) mins += parseInt(hm[1]) * 60;
    const mm = s.match(/(\d+)\s*m(?!o)/i); if (mm) mins += parseInt(mm[1]);
    return mins > 0 ? mins : null;
  }

  if (/^\d{1,3}:\d{1,2}$/.test(s)) {
    const [h, mi] = s.split(':').map(Number);
    if (isNaN(h) || isNaN(mi) || mi > 59) return null;
    return h * 60 + mi;
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    const val = parseFloat(s);
    return val > 0 ? Math.round(val * 60) : null;
  }

  return null;
}

function minsToJira(totalMins: number): string {
  if (totalMins <= 0) return '0m';
  let rem = totalMins;
  const w = Math.floor(rem / 2400); rem %= 2400;
  const d = Math.floor(rem / 480);  rem %= 480;
  const h = Math.floor(rem / 60);   rem %= 60;
  const parts: string[] = [];
  if (w) parts.push(`${w}w`);
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (rem) parts.push(`${rem}m`);
  return parts.join(' ');
}

function formatDayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAYS[d.getUTCDay()];
  const dd  = String(day).padStart(2, '0');
  const mmm = MONTHS[month - 1];
  return `${weekday}, ${dd} ${mmm} ${year}`;
}

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface ReportEntry {
  id: string;
  date: string;
  startAtISO: string;
  durationMins: number | null;
  title: string;
  ticketId: string;
  logType: { id: string; name: string; color: string; category: string | null } | null;
}

interface DayGroup {
  dateStr: string;
  dateLabel: string;
  totalMins: number;
  logs: ReportEntry[];
}

interface LogTypeBreakdown {
  id: string;
  name: string;
  color: string;
  totalMins: number;
}

type Preset = 'last10' | 'thisWeek' | 'currentMonth' | 'lastMonth';

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarComponent],
  template: `
<div class="rpt-wrap">

  <!-- ── Range picker overlay (bottom sheet on mobile) ── -->
  <div class="rpt-cal-overlay" *ngIf="showRangeCal" (click)="onRangeOverlay($event)">
    <div class="rpt-cal-popup">

      <div class="rpt-popup-drag-handle"></div>

      <div class="rpt-range-hint">
        <ng-container *ngIf="!pendingFromDate">Tap start date</ng-container>
        <ng-container *ngIf="pendingFromDate && !pendingToDate">Now tap the end date</ng-container>
        <ng-container *ngIf="pendingFromDate && pendingToDate">
          <strong>{{ fmtDateBtn(pendingFromDate) }}</strong> → <strong>{{ fmtDateBtn(pendingToDate) }}</strong>
        </ng-container>
      </div>

      <app-calendar
        [rangeFrom]="pendingFromDate"
        [rangeTo]="pendingToDate"
        (dateSelected)="onRangeDateClick($event)">
      </app-calendar>

      <div class="rpt-time-row">
        <div class="rpt-time-group">
          <label class="rpt-time-lbl">From time (UTC)</label>
          <input type="time" class="rpt-time-input" [(ngModel)]="pendingStartTime">
        </div>
        <div class="rpt-time-group">
          <label class="rpt-time-lbl">To time (UTC)</label>
          <input type="time" class="rpt-time-input" [(ngModel)]="pendingEndTime">
        </div>
      </div>

      <div class="rpt-cal-actions">
        <button class="rpt-cal-cancel" (click)="showRangeCal = false">Cancel</button>
        <button class="rpt-cal-apply"  (click)="applyRange()" [disabled]="!pendingToDate">Apply</button>
      </div>
    </div>
  </div>

  <!-- ── Header ─────────────────────────────────────── -->
  <div class="rpt-header">
    <span class="rpt-title">Work Log Report</span>
    <button class="rpt-export-btn"
            [disabled]="logs.length === 0"
            (click)="exportCSV()"
            title="Export filtered logs as CSV">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export CSV
    </button>
  </div>

  <!-- ── Range bar ──────────────────────────────────── -->
  <div class="rpt-range-bar">
    <button class="rpt-dt-btn" (click)="openRangeCal()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
      {{ rangeLabel }}
    </button>
    <button class="rpt-fetch-btn" (click)="fetchLogs()" [disabled]="isFetching">
      {{ isFetching ? 'Loading…' : 'Fetch Logs' }}
    </button>
  </div>

  <!-- ── Quick presets ──────────────────────────────── -->
  <div class="rpt-presets">
    <button class="rpt-preset-btn" [class.rpt-preset-btn--active]="activePreset === 'last10'"       (click)="applyPreset('last10')">Last 10 days</button>
    <button class="rpt-preset-btn" [class.rpt-preset-btn--active]="activePreset === 'thisWeek'"     (click)="applyPreset('thisWeek')">This week</button>
    <button class="rpt-preset-btn" [class.rpt-preset-btn--active]="activePreset === 'currentMonth'" (click)="applyPreset('currentMonth')">Current month</button>
    <button class="rpt-preset-btn" [class.rpt-preset-btn--active]="activePreset === 'lastMonth'"    (click)="applyPreset('lastMonth')">Last month</button>
  </div>

  <!-- ── Error ──────────────────────────────────────── -->
  <div class="rpt-fetch-error" *ngIf="fetchError">{{ fetchError }}</div>

  <!-- ── Metrics panel ──────────────────────────────── -->
  <div class="rpt-metrics" *ngIf="hasFetched && logs.length > 0 && !isFetching">

    <div class="rpt-metric-cards">
      <div class="rpt-metric-card">
        <span class="rpt-metric-val">{{ logs.length }}</span>
        <span class="rpt-metric-lbl">Total work logs</span>
      </div>
      <div class="rpt-metric-card">
        <span class="rpt-metric-val">{{ totalJira }}</span>
        <span class="rpt-metric-lbl">Total time logged</span>
      </div>
      <div class="rpt-metric-card">
        <span class="rpt-metric-val">{{ avgJira }}</span>
        <span class="rpt-metric-lbl">Avg. per working day</span>
      </div>
    </div>

    <div class="rpt-breakdown" *ngIf="logTypeBreakdown.length > 0">
      <div class="rpt-breakdown-title">Time by log type</div>
      <div class="rpt-breakdown-list">
        <div class="rpt-breakdown-item" *ngFor="let bt of logTypeBreakdown">
          <div class="rpt-breakdown-row">
            <span class="rpt-breakdown-dot" [style.background]="bt.color || '#9B9B9B'"></span>
            <span class="rpt-breakdown-name">{{ bt.name }}</span>
            <span class="rpt-breakdown-time">{{ fmt(bt.totalMins) }}</span>
            <span class="rpt-breakdown-pct">{{ pct(bt.totalMins) }}%</span>
          </div>
          <div class="rpt-breakdown-track">
            <div class="rpt-breakdown-fill"
                 [style.width]="pct(bt.totalMins) + '%'"
                 [style.background]="bt.color || '#9B9B9B'"></div>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- ── Bulk-apply ticket to all logs ────────────── -->
  <div class="rpt-week-apply" *ngIf="logs.length > 0">
    <input class="rpt-week-ticket-inp" type="text"
           placeholder="Ticket No (e.g. JA-1001)"
           [(ngModel)]="weekTicketInput"
           autocomplete="off" autocorrect="off" spellcheck="false">
    <button class="rpt-week-apply-btn"
            (click)="applyTicketToWeek()"
            [disabled]="applyingWeek || !weekTicketInput.trim()">
      {{ applyingWeek ? 'Applying…' : 'Apply for the selected date range' }}
    </button>
  </div>

  <!-- ── Accordion list grouped by day ─────────────── -->
  <div class="rpt-list" *ngIf="logs.length > 0">
    <div class="rpt-day-group" *ngFor="let group of groupedLogs">

      <!-- Day header -->
      <div class="rpt-day-hdr">
        <div class="rpt-day-hdr-top">
          <span class="rpt-day-label">{{ group.dateLabel }}</span>
          <span class="rpt-day-total" *ngIf="group.totalMins > 0">{{ fmt(group.totalMins) }}</span>
        </div>
        <div class="rpt-day-apply">
          <input class="rpt-day-ticket-inp" type="text"
                 placeholder="Ticket No"
                 [(ngModel)]="dayTicketInputs[group.dateStr]"
                 autocomplete="off" autocorrect="off" spellcheck="false">
          <button class="rpt-day-apply-btn"
                  (click)="applyTicketToDay(group)"
                  [disabled]="applyingDay === group.dateStr || !dayTicketInputs[group.dateStr]?.trim()">
            {{ applyingDay === group.dateStr ? 'Applying…' : 'Apply to day' }}
          </button>
        </div>
      </div>

      <!-- Logs in this day -->
      <div class="rpt-day-items">
        <div class="rpt-item"
             *ngFor="let log of group.logs"
             [class.rpt-item--expanded]="expandedId === log.id">

          <!-- Collapsed header -->
          <button class="rpt-item-hdr"
                  (click)="toggleExpand(log)"
                  [attr.aria-expanded]="expandedId === log.id">

            <svg class="rpt-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path [attr.d]="expandedId === log.id ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'"
                    stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>

            <div class="rpt-item-meta">
              <div class="rpt-item-meta-row">
                <span class="rpt-ticket" [class.rpt-ticket--na]="!log.ticketId">
                  {{ log.ticketId || 'NA' }}
                </span>
                <span class="rpt-dur" *ngIf="log.durationMins">{{ fmt(log.durationMins) }}</span>
                <span class="rpt-start">{{ formatDisplay(log.startAtISO) }}</span>
              </div>
              <span class="rpt-comment">{{ log.title }}</span>
            </div>

            <span class="rpt-type-badge" *ngIf="log.logType"
                  [style.background]="(log.logType.color || '#9B9B9B') + '22'"
                  [style.color]="log.logType.color || '#9B9B9B'">
              {{ log.logType.name }}
            </span>
          </button>

          <!-- Expanded edit body -->
          <div class="rpt-item-body" *ngIf="expandedId === log.id">
            <div class="rpt-edit-grid">

              <!-- Ticket No -->
              <div class="rpt-field">
                <label class="rpt-field-lbl">Ticket No</label>
                <input class="rpt-field-inp" type="text"
                       placeholder="e.g. JA-1001 (optional)"
                       [(ngModel)]="editForm.ticketId"
                       autocomplete="off" autocorrect="off" spellcheck="false">
              </div>

              <!-- Start Date -->
              <div class="rpt-field">
                <label class="rpt-field-lbl">Start Date</label>
                <input class="rpt-field-inp"
                       [class.rpt-field-inp--err]="editErrors['startDate']"
                       type="text"
                       placeholder="DD-MMM-YYYY HH:mm:ss"
                       [(ngModel)]="editForm.startDate"
                       (blur)="validateStartDate()">
                <span class="rpt-field-err" *ngIf="editErrors['startDate']">
                  {{ editErrors['startDate'] }}
                </span>
              </div>

              <!-- Time Spent -->
              <div class="rpt-field">
                <label class="rpt-field-lbl">Time Spent</label>
                <input class="rpt-field-inp"
                       [class.rpt-field-inp--err]="editErrors['timeSpent']"
                       type="text"
                       placeholder="1h 30m · 1.5 · 1:30 · 8"
                       [(ngModel)]="editForm.timeSpent"
                       (blur)="validateTimeSpent()">
                <span class="rpt-field-hint" *ngIf="!editErrors['timeSpent'] && normalizedTimeSpent">
                  → {{ normalizedTimeSpent }}
                </span>
                <span class="rpt-field-err" *ngIf="editErrors['timeSpent']">
                  {{ editErrors['timeSpent'] }}
                </span>
              </div>

              <!-- Comment (full width) -->
              <div class="rpt-field rpt-field--full">
                <label class="rpt-field-lbl">Comment</label>
                <textarea class="rpt-field-inp rpt-field-ta"
                          placeholder="Activity description"
                          [(ngModel)]="editForm.comment"
                          rows="2"></textarea>
              </div>

            </div><!-- /grid -->

            <!-- Actions -->
            <div class="rpt-actions">
              <button class="rpt-save-btn"
                      (click)="saveEdit(log)"
                      [disabled]="isSaving || hasErrors">
                {{ isSaving ? 'Saving…' : 'Save' }}
              </button>
              <button class="rpt-cancel-btn"
                      (click)="cancelEdit()"
                      [disabled]="isSaving">
                Cancel
              </button>
              <span class="rpt-save-err" *ngIf="saveError">{{ saveError }}</span>
            </div>

          </div><!-- /body -->
        </div><!-- /rpt-item -->
      </div><!-- /rpt-day-items -->

    </div><!-- /rpt-day-group -->
  </div><!-- /rpt-list -->

  <!-- ── Empty state ────────────────────────────────── -->
  <div class="rpt-empty" *ngIf="hasFetched && logs.length === 0 && !isFetching">
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="15" stroke="var(--text-muted)"
              stroke-width="1.5" stroke-dasharray="4 3"/>
      <path d="M18 11v7l4 3" stroke="var(--text-muted)"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p>No work logs found for this date range.</p>
    <span>Break and transit logs are excluded.</span>
  </div>

</div>
  `,
  styles: [`
    .rpt-wrap {
      max-width: 780px;
      margin: 0 auto;
      padding: 16px 12px 64px;
    }

    /* ── Calendar overlay / bottom-sheet ───────────── */
    .rpt-cal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
      animation: rpt-fade-in 0.15s ease;
    }
    .rpt-cal-popup {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      animation: rpt-popup-in 0.18s ease;
      max-width: 360px;
      width: 100%;
    }
    @keyframes rpt-popup-in {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .rpt-popup-drag-handle { display: none; }

    .rpt-range-hint {
      padding: 12px 16px 6px;
      font-size: 13px;
      color: var(--text-muted);
      text-align: center;
      min-height: 36px;
    }
    .rpt-range-hint strong { color: var(--text-primary); }

    .rpt-time-row {
      display: flex;
      gap: 12px;
      padding: 10px 16px 6px;
      border-top: 1px solid var(--border);
    }
    .rpt-time-group { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .rpt-time-lbl {
      font-size: 10px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .rpt-time-input {
      padding: 8px 10px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 14px;
      width: 100%;
      min-height: 44px;
      box-sizing: border-box;
    }
    .rpt-time-input:focus { outline: none; border-color: var(--highlight-selected); }

    .rpt-cal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 10px 16px 14px;
      border-top: 1px solid var(--border);
    }
    .rpt-cal-cancel {
      flex: 1;
      padding: 10px 14px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
      min-height: 44px;
      transition: background 0.12s;
    }
    .rpt-cal-cancel:hover { background: var(--bg-hover); }
    .rpt-cal-apply {
      flex: 2;
      padding: 10px 16px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      transition: opacity 0.15s;
    }
    .rpt-cal-apply:hover:not(:disabled) { opacity: 0.88; }
    .rpt-cal-apply:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Header ────────────────────────────────────── */
    .rpt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .rpt-title {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .rpt-export-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      cursor: pointer;
      min-height: 40px;
      transition: background 0.15s, border-color 0.15s;
    }
    .rpt-export-btn:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--highlight-selected);
    }
    .rpt-export-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Range bar ─────────────────────────────────── */
    .rpt-range-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    .rpt-dt-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 14px;
      cursor: pointer;
      min-height: 44px;
      transition: background 0.12s, border-color 0.12s;
    }
    .rpt-dt-btn:hover { background: var(--bg-hover); border-color: var(--highlight-selected); }
    .rpt-fetch-btn {
      padding: 10px 20px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      white-space: nowrap;
      transition: opacity 0.15s;
    }
    .rpt-fetch-btn:hover:not(:disabled) { opacity: 0.88; }
    .rpt-fetch-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Quick presets ──────────────────────────────── */
    .rpt-presets {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      margin-bottom: 14px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .rpt-presets::-webkit-scrollbar { display: none; }
    .rpt-preset-btn {
      flex-shrink: 0;
      padding: 7px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      min-height: 36px;
      transition: background 0.12s, border-color 0.15s, color 0.15s;
    }
    .rpt-preset-btn:hover {
      background: var(--bg-hover);
      border-color: var(--highlight-selected);
      color: var(--highlight-selected);
    }
    .rpt-preset-btn--active {
      background: color-mix(in srgb, var(--highlight-selected) 12%, transparent);
      border-color: var(--highlight-selected);
      color: var(--highlight-selected);
      font-weight: 600;
    }

    /* ── Error ─────────────────────────────────────── */
    .rpt-fetch-error {
      padding: 10px 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-sm);
      color: #ef4444;
      font-size: 13px;
      margin-bottom: 12px;
    }

    /* ── Metrics panel ─────────────────────────────── */
    .rpt-metrics {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      margin-bottom: 14px;
    }
    .rpt-metric-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-bottom: 1px solid var(--border);
    }
    .rpt-metric-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 14px 10px;
      gap: 4px;
      border-right: 1px solid var(--border);
    }
    .rpt-metric-card:last-child { border-right: none; }
    .rpt-metric-val {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .rpt-metric-lbl {
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
      line-height: 1.3;
    }

    .rpt-breakdown { padding: 12px 14px 14px; }
    .rpt-breakdown-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 10px;
    }
    .rpt-breakdown-list { display: flex; flex-direction: column; gap: 10px; }
    .rpt-breakdown-item { display: flex; flex-direction: column; gap: 5px; }
    .rpt-breakdown-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .rpt-breakdown-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .rpt-breakdown-name {
      flex: 1;
      font-size: 13px;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rpt-breakdown-time {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .rpt-breakdown-pct {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
      min-width: 36px;
      text-align: right;
    }
    .rpt-breakdown-track {
      height: 4px;
      background: var(--bg-hover);
      border-radius: 2px;
      overflow: hidden;
    }
    .rpt-breakdown-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.4s ease;
      opacity: 0.8;
    }

    /* ── Bulk-apply ticket (date range) ────────────── */
    .rpt-week-apply {
      display: flex;
      align-items: stretch;
      gap: 8px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .rpt-week-ticket-inp {
      flex: 1;
      min-width: 140px;
      padding: 10px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 14px;
      font-family: monospace;
      min-height: 44px;
      transition: border-color 0.12s;
    }
    .rpt-week-ticket-inp:focus { outline: none; border-color: var(--highlight-selected); }
    .rpt-week-ticket-inp::placeholder { color: var(--text-muted); font-family: inherit; }
    .rpt-week-apply-btn {
      flex: 2;
      min-width: 200px;
      padding: 10px 16px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      white-space: nowrap;
      transition: opacity 0.15s;
    }
    .rpt-week-apply-btn:hover:not(:disabled) { opacity: 0.88; }
    .rpt-week-apply-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Day-grouped list ──────────────────────────── */
    .rpt-list { display: flex; flex-direction: column; }
    .rpt-day-group { margin-bottom: 20px; }
    .rpt-day-group:last-child { margin-bottom: 0; }

    .rpt-day-hdr {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 6px 2px 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }
    .rpt-day-hdr-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .rpt-day-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .rpt-day-total {
      font-size: 11px;
      font-weight: 600;
      color: #5BAD6F;
    }

    .rpt-day-apply {
      display: flex;
      gap: 8px;
      align-items: stretch;
    }
    .rpt-day-ticket-inp {
      flex: 1;
      min-width: 0;
      padding: 8px 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      font-family: monospace;
      min-height: 40px;
      transition: border-color 0.12s;
    }
    .rpt-day-ticket-inp:focus { outline: none; border-color: var(--highlight-selected); }
    .rpt-day-ticket-inp::placeholder { color: var(--text-muted); font-family: inherit; }
    .rpt-day-apply-btn {
      padding: 8px 14px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      min-height: 40px;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .rpt-day-apply-btn:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--highlight-selected);
      color: var(--highlight-selected);
    }
    .rpt-day-apply-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .rpt-day-items { display: flex; flex-direction: column; gap: 6px; }

    /* ── Accordion item ────────────────────────────── */
    .rpt-item {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .rpt-item--expanded { border-color: var(--highlight-selected); }

    .rpt-item-hdr {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      color: var(--text-primary);
      min-height: 56px;
      transition: background 0.12s;
    }
    .rpt-item-hdr:hover { background: var(--bg-hover); }

    .rpt-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
    }

    .rpt-item-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .rpt-item-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .rpt-ticket {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      font-family: monospace;
    }
    .rpt-ticket--na { color: var(--text-muted); font-weight: 400; }

    .rpt-start {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .rpt-dur {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      background: var(--bg-hover);
      padding: 2px 7px;
      border-radius: 10px;
      white-space: nowrap;
    }

    .rpt-comment {
      font-size: 13px;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rpt-type-badge {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 10px;
    }

    /* ── Expanded body ─────────────────────────────── */
    .rpt-item-body {
      padding: 14px;
      border-top: 1px solid var(--border);
      animation: rpt-fade-in 0.15s ease;
    }
    @keyframes rpt-fade-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .rpt-edit-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }

    .rpt-field { display: flex; flex-direction: column; gap: 5px; }
    .rpt-field--full { grid-column: 1 / -1; }

    .rpt-field-lbl {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .rpt-field-inp {
      padding: 10px 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 15px;
      font-family: inherit;
      min-height: 44px;
      transition: border-color 0.12s;
    }
    .rpt-field-inp:focus { outline: none; border-color: var(--highlight-selected); }
    .rpt-field-inp--err { border-color: #ef4444 !important; }

    .rpt-field-ta { resize: vertical; min-height: 64px; }

    .rpt-field-hint { font-size: 11px; color: var(--text-muted); }
    .rpt-field-err  { font-size: 11px; color: #ef4444; }

    /* ── Edit actions ──────────────────────────────── */
    .rpt-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .rpt-save-btn {
      flex: 1;
      padding: 11px 20px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      transition: opacity 0.15s;
    }
    .rpt-save-btn:hover:not(:disabled) { opacity: 0.88; }
    .rpt-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .rpt-cancel-btn {
      padding: 11px 16px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
      min-height: 44px;
      transition: background 0.12s;
    }
    .rpt-cancel-btn:hover:not(:disabled) { background: var(--bg-hover); }
    .rpt-cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .rpt-save-err { font-size: 12px; color: #ef4444; width: 100%; }

    /* ── Empty state ───────────────────────────────── */
    .rpt-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 48px 16px;
      color: var(--text-muted);
      text-align: center;
    }
    .rpt-empty p { margin: 0; font-size: 14px; }
    .rpt-empty span { font-size: 12px; }

    /* ── Mobile overrides (≤ 600px) ─────────────────── */
    @media (max-width: 600px) {
      .rpt-wrap { padding: 12px 8px 64px; }

      /* Bottom sheet */
      .rpt-cal-overlay { align-items: flex-end; }
      .rpt-cal-popup {
        border-radius: 16px 16px 0 0;
        max-width: 100%;
        max-height: 92dvh;
        overflow-y: auto;
        animation: rpt-sheet-in 0.22s ease;
      }
      .rpt-popup-drag-handle {
        display: block;
        width: 36px;
        height: 4px;
        background: var(--border);
        border-radius: 2px;
        margin: 10px auto 2px;
      }
      @keyframes rpt-sheet-in {
        from { transform: translateY(60px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      /* Make the calendar fill the sheet width */
      .rpt-cal-popup ::ng-deep .calendar-wrapper {
        width: 100% !important;
        box-sizing: border-box;
      }

      .rpt-header { margin-bottom: 12px; }
      .rpt-title  { font-size: 16px; }
      .rpt-export-btn span { display: none; }

      /* Metrics: 1 row of 3 small cards, scrollable */
      .rpt-metric-cards { grid-template-columns: repeat(3, 1fr); }
      .rpt-metric-val   { font-size: 16px; }
      .rpt-metric-lbl   { font-size: 10px; }

      /* Bulk apply stacks */
      .rpt-week-apply { flex-direction: column; }
      .rpt-week-ticket-inp,
      .rpt-week-apply-btn { width: 100%; min-width: 0; flex: none; }

      /* Edit form: single column */
      .rpt-edit-grid { grid-template-columns: 1fr; }
      .rpt-field--full { grid-column: 1; }

      /* Bigger action buttons */
      .rpt-save-btn,
      .rpt-cancel-btn { flex: 1; }

      /* Hide timestamp on log rows */
      .rpt-start { display: none; }
    }

    @media (max-width: 380px) {
      .rpt-metric-val { font-size: 14px; }
      .rpt-metric-card { padding: 10px 6px; }
    }
  `]
})
export class ReportComponent {

  // ── Date/time range ────────────────────────────────────────────────────────
  fromDate: Date;
  toDate: Date;
  startTimeStr = '00:00';
  endTimeStr   = '23:59';

  // ── Range picker popup ─────────────────────────────────────────────────────
  showRangeCal    = false;
  pendingFromDate: Date | null = null;
  pendingToDate:   Date | null = null;
  pendingStartTime = '00:00';
  pendingEndTime   = '23:59';

  // ── Preset tracking ────────────────────────────────────────────────────────
  activePreset: Preset | null = null;

  // ── List state ─────────────────────────────────────────────────────────────
  logs: ReportEntry[] = [];
  groupedLogs: DayGroup[] = [];
  hasFetched = false;
  isFetching = false;
  fetchError = '';

  // ── Accordion state ────────────────────────────────────────────────────────
  expandedId: string | null = null;
  editForm = { ticketId: '', startDate: '', timeSpent: '', comment: '' };
  editErrors: Record<string, string> = {};
  isSaving  = false;
  saveError = '';

  // ── Bulk-apply ticket state ────────────────────────────────────────────────
  dayTicketInputs: Record<string, string> = {};
  applyingDay: string | null = null;
  weekTicketInput = '';
  applyingWeek = false;

  formatDisplay = isoToDisplay;
  fmt = minsToJira;

  constructor(private logService: LogService) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.toDate = new Date(today);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    this.fromDate = weekAgo;
  }

  // ── Computed date strings ──────────────────────────────────────────────────

  get startDateStr(): string { return dateToStr(this.fromDate); }
  get endDateStr():   string { return dateToStr(this.toDate); }

  fmtDateBtn(date: Date): string {
    const dd  = String(date.getDate()).padStart(2, '0');
    const mmm = MONTHS[date.getMonth()];
    return `${dd}-${mmm}-${date.getFullYear()}`;
  }

  get rangeLabel(): string {
    return `${this.fmtDateBtn(this.fromDate)} → ${this.fmtDateBtn(this.toDate)}`;
  }

  // ── Computed totals & metrics ──────────────────────────────────────────────

  get totalMins(): number {
    return this.logs.reduce((s, l) => s + (l.durationMins ?? 0), 0);
  }
  get totalJira(): string { return minsToJira(this.totalMins); }

  get activeDaysCount(): number {
    return this.groupedLogs.filter(g => g.totalMins > 0).length;
  }

  get avgJira(): string {
    const days = this.activeDaysCount;
    return days > 0 ? minsToJira(Math.round(this.totalMins / days)) : '—';
  }

  get logTypeBreakdown(): LogTypeBreakdown[] {
    const map = new Map<string, LogTypeBreakdown>();
    for (const log of this.logs) {
      if (!log.logType || !log.durationMins) continue;
      const key = log.logType.id;
      if (!map.has(key)) {
        map.set(key, { id: key, name: log.logType.name, color: log.logType.color, totalMins: 0 });
      }
      map.get(key)!.totalMins += log.durationMins;
    }
    return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
  }

  pct(mins: number): number {
    return this.totalMins > 0 ? Math.round(mins / this.totalMins * 100) : 0;
  }

  get normalizedTimeSpent(): string {
    const mins = parseTimeSpentToMins(this.editForm.timeSpent);
    return mins !== null ? minsToJira(mins) : '';
  }

  get hasErrors(): boolean {
    return Object.values(this.editErrors).some(Boolean);
  }

  // ── Day grouping ───────────────────────────────────────────────────────────

  private rebuildGroups(): void {
    const map = new Map<string, DayGroup>();
    for (const log of this.logs) {
      const dateStr = log.startAtISO.slice(0, 10);
      if (!map.has(dateStr)) {
        map.set(dateStr, { dateStr, dateLabel: formatDayLabel(dateStr), totalMins: 0, logs: [] });
      }
      const g = map.get(dateStr)!;
      g.logs.push(log);
      g.totalMins += log.durationMins ?? 0;
    }
    this.groupedLogs = Array.from(map.values());
  }

  // ── Range picker handlers ──────────────────────────────────────────────────

  openRangeCal(): void {
    this.pendingFromDate  = new Date(this.fromDate);
    this.pendingToDate    = new Date(this.toDate);
    this.pendingStartTime = this.startTimeStr;
    this.pendingEndTime   = this.endTimeStr;
    this.showRangeCal = true;
  }

  onRangeDateClick(date: Date): void {
    if (this.pendingToDate) {
      this.pendingFromDate = date;
      this.pendingToDate   = null;
    } else if (!this.pendingFromDate) {
      this.pendingFromDate = date;
    } else if (date >= this.pendingFromDate) {
      this.pendingToDate = date;
    } else {
      this.pendingFromDate = date;
    }
  }

  applyRange(): void {
    if (!this.pendingFromDate || !this.pendingToDate) return;
    this.fromDate     = new Date(this.pendingFromDate);
    this.toDate       = new Date(this.pendingToDate);
    this.startTimeStr = this.pendingStartTime;
    this.endTimeStr   = this.pendingEndTime;
    this.activePreset = null;
    this.showRangeCal = false;
  }

  onRangeOverlay(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('rpt-cal-overlay')) {
      this.showRangeCal = false;
    }
  }

  // ── Quick presets (on main page — directly fetches) ───────────────────────

  applyPreset(preset: Preset): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from: Date, to: Date = new Date(today);

    switch (preset) {
      case 'last10':
        from = new Date(today);
        from.setDate(today.getDate() - 9);
        break;
      case 'thisWeek': {
        const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
        from = new Date(today);
        from.setDate(today.getDate() - dow);
        break;
      }
      case 'currentMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to   = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }

    this.fromDate     = from!;
    this.toDate       = to;
    this.startTimeStr = '00:00';
    this.endTimeStr   = '23:59';
    this.activePreset = preset;
    this.fetchLogs();
  }

  // ── Fetch logs ─────────────────────────────────────────────────────────────

  fetchLogs(): void {
    if (this.startDateStr > this.endDateStr) {
      this.fetchError = '"From" date must be on or before "To" date.';
      return;
    }

    this.isFetching = true;
    this.fetchError = '';
    this.expandedId = null;

    const startFilter = `${this.startDateStr}T${this.startTimeStr}:00.000Z`;
    const endFilter   = `${this.endDateStr}T${this.endTimeStr}:59.999Z`;

    this.logService.getLogsForDateRange(this.startDateStr, this.endDateStr).subscribe({
      next: (data) => {
        this.logs = (data as ReportEntry[]).filter(log =>
          log.startAtISO >= startFilter && log.startAtISO <= endFilter
        );
        this.rebuildGroups();
        this.hasFetched = true;
        this.isFetching = false;
      },
      error: (err) => {
        this.fetchError = err?.error?.error ?? 'Failed to fetch logs.';
        this.isFetching = false;
      }
    });
  }

  // ── Accordion ──────────────────────────────────────────────────────────────

  toggleExpand(log: ReportEntry): void {
    if (this.expandedId === log.id) { this.cancelEdit(); return; }
    this.expandedId = log.id;
    this.editErrors = {};
    this.saveError  = '';
    this.editForm = {
      ticketId:  log.ticketId ?? '',
      startDate: isoToDisplay(log.startAtISO),
      timeSpent: log.durationMins ? minsToJira(log.durationMins) : '',
      comment:   log.title ?? '',
    };
  }

  cancelEdit(): void {
    this.expandedId = null;
    this.editErrors = {};
    this.saveError  = '';
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  validateStartDate(): void {
    if (!displayToISO(this.editForm.startDate)) {
      this.editErrors['startDate'] = 'Format must be DD-MMM-YYYY HH:mm:ss';
    } else {
      delete this.editErrors['startDate'];
    }
  }

  validateTimeSpent(): void {
    const mins = parseTimeSpentToMins(this.editForm.timeSpent);
    if (mins === null || mins <= 0) {
      this.editErrors['timeSpent'] = 'Enter valid time (e.g. 1h 30m, 1.5, 1:30, 8)';
    } else {
      delete this.editErrors['timeSpent'];
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  saveEdit(log: ReportEntry): void {
    this.validateStartDate();
    this.validateTimeSpent();
    if (this.hasErrors) return;

    const startAtISO   = displayToISO(this.editForm.startDate)!;
    const durationMins = parseTimeSpentToMins(this.editForm.timeSpent)!;
    const oldDateStr   = log.startAtISO.slice(0, 10);

    this.isSaving  = true;
    this.saveError = '';

    this.logService.updateLogReport(log.id, {
      title: this.editForm.comment, ticketId: this.editForm.ticketId || null,
      startAtISO, durationMins,
    }, oldDateStr).subscribe({
      next: (updated: any) => {
        const idx = this.logs.findIndex(l => l.id === log.id);
        if (idx !== -1) {
          this.logs[idx] = {
            ...this.logs[idx],
            title:        updated.title,
            ticketId:     updated.ticketId ?? '',
            startAtISO:   updated.startAtISO,
            durationMins: updated.durationMins,
          };
          this.rebuildGroups();
        }
        this.isSaving   = false;
        this.expandedId = null;
        this.editErrors = {};
      },
      error: (err: any) => {
        this.saveError = err?.error?.error ?? 'Failed to save. Please try again.';
        this.isSaving  = false;
      }
    });
  }

  // ── Bulk-apply ticket to all logs in the report ───────────────────────────

  applyTicketToWeek(): void {
    const ticketId = this.weekTicketInput.trim();
    if (!ticketId || this.applyingWeek) return;

    this.applyingWeek = true;
    let pending = this.logs.length;

    for (const log of this.logs) {
      this.logService.updateLogReport(log.id, { ticketId }, log.startAtISO.slice(0, 10)).subscribe({
        next: (updated: any) => {
          const idx = this.logs.findIndex(l => l.id === log.id);
          if (idx !== -1) this.logs[idx] = { ...this.logs[idx], ticketId: updated.ticketId ?? ticketId };
          if (--pending === 0) { this.rebuildGroups(); this.applyingWeek = false; }
        },
        error: () => {
          if (--pending === 0) { this.rebuildGroups(); this.applyingWeek = false; }
        }
      });
    }
  }

  // ── Bulk-apply ticket to all logs in a day ────────────────────────────────

  applyTicketToDay(group: DayGroup): void {
    const ticketId = (this.dayTicketInputs[group.dateStr] ?? '').trim();
    if (!ticketId || this.applyingDay) return;

    this.applyingDay = group.dateStr;
    let pending = group.logs.length;

    for (const log of group.logs) {
      this.logService.updateLogReport(log.id, { ticketId }, log.startAtISO.slice(0, 10)).subscribe({
        next: (updated: any) => {
          const idx = this.logs.findIndex(l => l.id === log.id);
          if (idx !== -1) this.logs[idx] = { ...this.logs[idx], ticketId: updated.ticketId ?? ticketId };
          if (--pending === 0) { this.rebuildGroups(); this.applyingDay = null; }
        },
        error: () => {
          if (--pending === 0) { this.rebuildGroups(); this.applyingDay = null; }
        }
      });
    }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────

  exportCSV(): void {
    const header = 'Ticket No,Start Date,Timespent,Comment';
    const rows = this.logs.map(log => {
      const ticket    = log.ticketId || 'NA';
      const startDate = isoToDisplay(log.startAtISO);
      const timespent = log.durationMins ? minsToJira(log.durationMins) : '';
      const comment   = (log.title || '').replace(/"/g, '""');
      return `"${ticket}","${startDate}","${timespent}","${comment}"`;
    });

    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `work-logs-${this.startDateStr}-to-${this.endDateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
