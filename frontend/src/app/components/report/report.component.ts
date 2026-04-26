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

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarComponent],
  template: `
<div class="rpt-wrap">

  <!-- ── Calendar overlays ─────────────────────────── -->
  <div class="rpt-cal-overlay" *ngIf="showFromCal" (click)="onFromOverlay($event)">
    <div class="rpt-cal-popup">
      <app-calendar [selectedDate]="pendingFromDate" (dateSelected)="pendingFromDate = $event"></app-calendar>
      <div class="rpt-cal-actions">
        <button class="rpt-cal-cancel" (click)="showFromCal = false">Cancel</button>
        <button class="rpt-cal-apply"  (click)="applyFromDate()">Apply</button>
      </div>
    </div>
  </div>
  <div class="rpt-cal-overlay" *ngIf="showToCal" (click)="onToOverlay($event)">
    <div class="rpt-cal-popup">
      <app-calendar [selectedDate]="pendingToDate" (dateSelected)="pendingToDate = $event"></app-calendar>
      <div class="rpt-cal-actions">
        <button class="rpt-cal-cancel" (click)="showToCal = false">Cancel</button>
        <button class="rpt-cal-apply"  (click)="applyToDate()">Apply</button>
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

  <!-- ── Date/time range bar ────────────────────────── -->
  <div class="rpt-range-bar">

    <div class="rpt-dt-group">
      <span class="rpt-range-text">From</span>
      <div class="rpt-dt-row">
        <button class="rpt-dt-btn" (click)="openFromCal()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
          {{ fromDateLabel }}
        </button>
        <input type="time" class="rpt-time-input" [(ngModel)]="startTimeStr" title="Start time (UTC)">
      </div>
    </div>

    <div class="rpt-dt-group">
      <span class="rpt-range-text">To</span>
      <div class="rpt-dt-row">
        <button class="rpt-dt-btn" (click)="openToCal()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
          {{ toDateLabel }}
        </button>
        <input type="time" class="rpt-time-input" [(ngModel)]="endTimeStr" title="End time (UTC)">
      </div>
    </div>

    <button class="rpt-fetch-btn" (click)="fetchLogs()" [disabled]="isFetching">
      {{ isFetching ? 'Loading…' : 'Fetch Logs' }}
    </button>
  </div>

  <!-- ── Error ──────────────────────────────────────── -->
  <div class="rpt-fetch-error" *ngIf="fetchError">{{ fetchError }}</div>

  <!-- ── Summary bar ────────────────────────────────── -->
  <div class="rpt-summary" *ngIf="hasFetched && !isFetching">
    <span>{{ logs.length }} log{{ logs.length !== 1 ? 's' : '' }}</span>
    <span class="rpt-summary-sep" *ngIf="totalMins > 0"> · </span>
    <span class="rpt-summary-total" *ngIf="totalMins > 0">{{ totalJira }} total</span>
  </div>

  <!-- ── Bulk-apply ticket to all logs ────────────── -->
  <div class="rpt-week-apply" *ngIf="logs.length > 0">
    <input class="rpt-week-ticket-inp" type="text"
           placeholder="Ticket No"
           [(ngModel)]="weekTicketInput">
    <button class="rpt-week-apply-btn"
            (click)="applyTicketToWeek()"
            [disabled]="applyingWeek || !weekTicketInput.trim()">
      {{ applyingWeek ? 'Applying…' : 'Apply to week' }}
    </button>
  </div>

  <!-- ── Accordion list grouped by day ─────────────── -->
  <div class="rpt-list" *ngIf="logs.length > 0">
    <div class="rpt-day-group" *ngFor="let group of groupedLogs">

      <!-- Day header -->
      <div class="rpt-day-hdr">
        <span class="rpt-day-label">{{ group.dateLabel }}</span>
        <div class="rpt-day-hdr-right">
          <span class="rpt-day-total" *ngIf="group.totalMins > 0">{{ fmt(group.totalMins) }}</span>
          <div class="rpt-day-apply">
            <input class="rpt-day-ticket-inp" type="text"
                   placeholder="Ticket No"
                   [(ngModel)]="dayTicketInputs[group.dateStr]">
            <button class="rpt-day-apply-btn"
                    (click)="applyTicketToDay(group)"
                    [disabled]="applyingDay === group.dateStr || !dayTicketInputs[group.dateStr]?.trim()">
              {{ applyingDay === group.dateStr ? 'Applying…' : 'Apply to day' }}
            </button>
          </div>
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
                <span class="rpt-start">{{ formatDisplay(log.startAtISO) }}</span>
                <span class="rpt-dur" *ngIf="log.durationMins">{{ fmt(log.durationMins) }}</span>
              </div>
              <span class="rpt-comment">{{ log.title }}</span>
            </div>

            <span class="rpt-type-badge" *ngIf="log.logType"
                  [style.background]="(log.logType.color ?? '#9B9B9B') + '22'"
                  [style.color]="log.logType.color ?? '#9B9B9B'">
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
                       [(ngModel)]="editForm.ticketId">
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
      padding: 16px 12px 48px;
    }

    /* ── Calendar overlay ──────────────────────────── */
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
    }
    @keyframes rpt-popup-in {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .rpt-cal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 10px 16px;
      border-top: 1px solid var(--border);
    }
    .rpt-cal-cancel {
      padding: 6px 14px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.12s;
    }
    .rpt-cal-cancel:hover { background: var(--bg-hover); }
    .rpt-cal-apply {
      padding: 6px 16px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .rpt-cal-apply:hover { opacity: 0.88; }

    /* ── Header ────────────────────────────────────── */
    .rpt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
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
      padding: 7px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .rpt-export-btn:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--highlight-selected);
    }
    .rpt-export-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Date/time range bar ───────────────────────── */
    .rpt-range-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 14px;
    }
    .rpt-dt-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rpt-dt-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .rpt-range-text {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .rpt-dt-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s, border-color 0.12s;
      height: 34px;
    }
    .rpt-dt-btn:hover {
      background: var(--bg-hover);
      border-color: var(--highlight-selected);
    }
    .rpt-time-input {
      padding: 7px 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      width: 110px;
      height: 34px;
    }
    .rpt-time-input:focus {
      outline: none;
      border-color: var(--highlight-selected);
    }
    .rpt-fetch-btn {
      padding: 8px 18px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
      height: 34px;
    }
    .rpt-fetch-btn:hover:not(:disabled) { opacity: 0.88; }
    .rpt-fetch-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Error ─────────────────────────────────────── */
    .rpt-fetch-error {
      padding: 8px 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-sm);
      color: #ef4444;
      font-size: 13px;
      margin-bottom: 12px;
    }

    /* ── Summary ───────────────────────────────────── */
    .rpt-summary {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .rpt-summary-total { color: var(--text-secondary); font-weight: 500; }

    /* ── Day-grouped list ──────────────────────────── */
    .rpt-list { display: flex; flex-direction: column; }

    .rpt-day-group { margin-bottom: 20px; }
    .rpt-day-group:last-child { margin-bottom: 0; }

    .rpt-day-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 2px 7px;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--border);
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

    .rpt-day-hdr-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rpt-day-apply {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .rpt-day-ticket-inp {
      width: 120px;
      padding: 4px 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 12px;
      font-family: monospace;
      transition: border-color 0.12s;
    }
    .rpt-day-ticket-inp:focus {
      outline: none;
      border-color: var(--highlight-selected);
    }
    .rpt-day-ticket-inp::placeholder { color: var(--text-muted); font-family: inherit; }

    .rpt-day-apply-btn {
      padding: 4px 10px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .rpt-day-apply-btn:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--highlight-selected);
      color: var(--highlight-selected);
    }
    .rpt-day-apply-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Week-level bulk apply ─────────────────────── */
    .rpt-week-apply {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
      padding: 8px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }

    .rpt-week-ticket-inp {
      flex: 1;
      max-width: 200px;
      padding: 6px 10px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      font-family: monospace;
      transition: border-color 0.12s;
    }
    .rpt-week-ticket-inp:focus {
      outline: none;
      border-color: var(--highlight-selected);
    }
    .rpt-week-ticket-inp::placeholder { color: var(--text-muted); font-family: inherit; }

    .rpt-week-apply-btn {
      padding: 6px 14px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.15s;
    }
    .rpt-week-apply-btn:hover:not(:disabled) { opacity: 0.88; }
    .rpt-week-apply-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    .rpt-day-items { display: flex; flex-direction: column; gap: 6px; }

    /* ── Accordion item ────────────────────────────── */
    .rpt-item {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .rpt-item--expanded {
      border-color: var(--highlight-selected);
    }

    .rpt-item-hdr {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      color: var(--text-primary);
      transition: background 0.12s;
    }
    .rpt-item-hdr:hover { background: var(--bg-hover); }

    .rpt-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
      transition: transform 0.15s;
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
      gap: 8px;
    }

    .rpt-ticket {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      font-family: monospace;
      min-width: 48px;
    }
    .rpt-ticket--na { color: var(--text-muted); font-weight: 400; }

    .rpt-start {
      font-size: 12px;
      color: var(--text-secondary);
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
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* ── Expanded body ─────────────────────────────── */
    .rpt-item-body {
      padding: 12px 14px 14px;
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
      margin-bottom: 12px;
    }
    @media (max-width: 520px) {
      .rpt-edit-grid { grid-template-columns: 1fr; }
    }

    .rpt-field { display: flex; flex-direction: column; gap: 4px; }
    .rpt-field--full { grid-column: 1 / -1; }

    .rpt-field-lbl {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .rpt-field-inp {
      padding: 7px 10px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.12s;
    }
    .rpt-field-inp:focus {
      outline: none;
      border-color: var(--highlight-selected);
    }
    .rpt-field-inp--err { border-color: #ef4444 !important; }

    .rpt-field-ta {
      resize: vertical;
      min-height: 52px;
    }

    .rpt-field-hint {
      font-size: 11px;
      color: var(--text-muted);
    }
    .rpt-field-err {
      font-size: 11px;
      color: #ef4444;
    }

    /* ── Actions ───────────────────────────────────── */
    .rpt-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .rpt-save-btn {
      padding: 7px 20px;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .rpt-save-btn:hover:not(:disabled) { opacity: 0.88; }
    .rpt-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .rpt-cancel-btn {
      padding: 7px 14px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.12s;
    }
    .rpt-cancel-btn:hover:not(:disabled) { background: var(--bg-hover); }
    .rpt-cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .rpt-save-err {
      font-size: 12px;
      color: #ef4444;
    }

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

    /* ── Mobile tweaks ─────────────────────────────── */
    @media (max-width: 480px) {
      .rpt-start  { display: none; }
      .rpt-dt-row { flex-wrap: wrap; }
    }
  `]
})
export class ReportComponent {

  // ── Date/time range ────────────────────────────────────────────────────────
  fromDate: Date;
  toDate: Date;
  startTimeStr = '00:00';
  endTimeStr   = '23:59';

  // ── Calendar popups ────────────────────────────────────────────────────────
  showFromCal    = false;
  showToCal      = false;
  pendingFromDate!: Date;
  pendingToDate!: Date;

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
    this.toDate   = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    this.fromDate = weekAgo;
    this.pendingFromDate = new Date(this.fromDate);
    this.pendingToDate   = new Date(this.toDate);
  }

  // ── Computed date strings ──────────────────────────────────────────────────

  get startDateStr(): string { return dateToStr(this.fromDate); }
  get endDateStr():   string { return dateToStr(this.toDate); }

  get fromDateLabel(): string { return this.fmtDateBtn(this.fromDate); }
  get toDateLabel():   string { return this.fmtDateBtn(this.toDate); }

  private fmtDateBtn(date: Date): string {
    const dd  = String(date.getDate()).padStart(2, '0');
    const mmm = MONTHS[date.getMonth()];
    return `${dd}-${mmm}-${date.getFullYear()}`;
  }

  // ── Computed totals ────────────────────────────────────────────────────────

  get totalMins(): number {
    return this.logs.reduce((s, l) => s + (l.durationMins ?? 0), 0);
  }
  get totalJira(): string { return minsToJira(this.totalMins); }

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
        map.set(dateStr, {
          dateStr,
          dateLabel: formatDayLabel(dateStr),
          totalMins: 0,
          logs: []
        });
      }
      const g = map.get(dateStr)!;
      g.logs.push(log);
      g.totalMins += log.durationMins ?? 0;
    }
    this.groupedLogs = Array.from(map.values());
  }

  // ── Calendar popup handlers ────────────────────────────────────────────────

  openFromCal(): void {
    this.pendingFromDate = new Date(this.fromDate);
    this.showFromCal = true;
  }

  openToCal(): void {
    this.pendingToDate = new Date(this.toDate);
    this.showToCal = true;
  }

  applyFromDate(): void {
    this.fromDate    = new Date(this.pendingFromDate);
    this.showFromCal = false;
  }

  applyToDate(): void {
    this.toDate    = new Date(this.pendingToDate);
    this.showToCal = false;
  }

  onFromOverlay(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('rpt-cal-overlay')) {
      this.showFromCal = false;
    }
  }

  onToOverlay(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('rpt-cal-overlay')) {
      this.showToCal = false;
    }
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

    // Build ISO boundary strings for client-side time filtering (UTC)
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
    if (this.expandedId === log.id) {
      this.cancelEdit();
      return;
    }
    this.expandedId  = log.id;
    this.editErrors  = {};
    this.saveError   = '';
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

    this.isSaving = true;
    this.saveError = '';

    this.logService.updateLogReport(log.id, {
      title:      this.editForm.comment,
      ticketId:   this.editForm.ticketId || null,
      startAtISO,
      durationMins,
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

  // ── Bulk-apply ticket to all logs in the report ──────────────────────────

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
