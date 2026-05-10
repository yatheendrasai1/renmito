import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InsightService, AnalyzeResult, AnalyzeLogSummary } from '../../services/insight.service';
import { PromptService } from '../../services/prompt.service';
import { AppStateService } from '../../services/app-state.service';
import { CalendarComponent } from '../calendar/calendar.component';
import { InsightCard, InsightDetail } from '../../models/insight.model';

type SubView = 'list' | 'detail';
type GearTab = 'system' | 'custom';
type Period  = 'today' | 'yesterday' | 'last7days' | 'custom';

const PERIOD_LABELS: Record<string, string> = {
  today:     'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
};

// ── Markdown renderer ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,    '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,        '<em>$1</em>')
    .replace(/`(.+?)`/g,          '<code class="ev-md-code">$1</code>');
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  const lines  = text.split('\n');
  const out:   string[] = [];
  let inUl = false, inOl = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const line of lines) {
    if (!line.trim()) {
      closeList();
      out.push('<br>');
      continue;
    }

    const h4 = line.match(/^#{3,}\s+(.+)$/);
    if (h4) { closeList(); out.push(`<strong class="ev-md-h4">${inlineMd(h4[1])}</strong><br>`); continue; }

    const h3 = line.match(/^##\s+(.+)$/);
    if (h3) { closeList(); out.push(`<span class="ev-md-h3">${inlineMd(h3[1])}</span>`); continue; }

    const h2 = line.match(/^#\s+(.+)$/);
    if (h2) { closeList(); out.push(`<span class="ev-md-h2">${inlineMd(h2[1])}</span>`); continue; }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul class="ev-md-ul">'); inUl = true; }
      out.push(`<li>${inlineMd(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol class="ev-md-ol">'); inOl = true; }
      out.push(`<li>${inlineMd(ol[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p class="ev-md-p">${inlineMd(line)}</p>`);
  }
  closeList();
  return out.join('');
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-eagle-view',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<!-- ══════════════════════════════════════════
     CALENDAR RANGE OVERLAY  (reuses report pattern)
══════════════════════════════════════════ -->
<div class="ev-cal-overlay" *ngIf="showRangeCal" (click)="onCalOverlay($event)">
  <div class="ev-cal-popup">
    <div class="ev-cal-handle"></div>

    <div class="ev-cal-hint">
      <ng-container *ngIf="!pendingFromDate">Tap start date</ng-container>
      <ng-container *ngIf="pendingFromDate && !pendingToDate">Now tap the end date</ng-container>
      <ng-container *ngIf="pendingFromDate && pendingToDate">
        <strong>{{ fmtShort(pendingFromDate) }}</strong> →
        <strong>{{ fmtShort(pendingToDate) }}</strong>
      </ng-container>
    </div>

    <app-calendar
      [rangeFrom]="pendingFromDate"
      [rangeTo]="pendingToDate"
      (dateSelected)="onCalDateClick($event)">
    </app-calendar>

    <div class="ev-cal-actions">
      <button class="ev-cal-cancel" (click)="showRangeCal = false">Cancel</button>
      <button class="ev-cal-apply"  (click)="applyCustomRange()" [disabled]="!pendingToDate">Apply</button>
    </div>
  </div>
</div>


<div class="ev-root">

  <!-- ══════════════════════════════════════════
       LIST VIEW
  ══════════════════════════════════════════ -->
  <ng-container *ngIf="subView === 'list'">

    <div class="ev-page-header">
      <h2 class="ev-page-title">Eagle View</h2>
      <p class="ev-page-sub">AI-powered insights from your logs</p>
    </div>

    <div class="ev-loading-wrap" *ngIf="loading">
      <div class="ev-spinner"></div>
    </div>

    <div class="ev-insight-list" *ngIf="!loading">
      <div class="ev-insight-card" *ngFor="let card of insightCards; trackBy: trackByLabel">
        <div class="ev-card-body"
             [class.ev-card-body--enabled]="card.userInsight?.enabled"
             (click)="card.userInsight?.enabled ? openDetail(card) : null">

          <div class="ev-card-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
              <path d="M7 2v20"/>
              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
            </svg>
          </div>

          <div class="ev-card-info">
            <span class="ev-card-name">{{ card.name }}</span>
            <span class="ev-card-meta" *ngIf="card.userInsight?.enabled">
              {{ card.userInsight?.type === 'custom' ? 'Custom prompt' : 'System prompt' }}
              · {{ card.userInsight?.model || card.model }}
            </span>
            <span class="ev-card-meta ev-card-meta--dim" *ngIf="!card.userInsight?.enabled">
              Enable to start tracking
            </span>
          </div>

          <label class="ev-toggle-wrap" (click)="$event.stopPropagation()">
            <input type="checkbox" class="ev-toggle-input"
                   [checked]="card.userInsight?.enabled"
                   [disabled]="togglingLabel === card.label"
                   (change)="onToggle(card, $event)">
            <span class="ev-toggle-track" [class.ev-toggle-track--on]="card.userInsight?.enabled"></span>
          </label>
        </div>
      </div>
      <!-- TODO: Add "Create custom insight" entry point here -->
    </div>

    <div class="ev-empty" *ngIf="!loading && insightCards.length === 0">
      <p>No insights available</p>
    </div>

  </ng-container>

  <!-- ══════════════════════════════════════════
       DETAIL VIEW
  ══════════════════════════════════════════ -->
  <ng-container *ngIf="subView === 'detail' && selectedCard">

    <div class="ev-detail-header">
      <button class="ev-back-btn" (click)="backToList()" aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <span class="ev-detail-title">{{ selectedCard.name }}</span>
      <button class="ev-gear-btn" (click)="openGearSheet()" aria-label="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <!-- Period chips + calendar icon -->
    <div class="ev-period-row">
      <div class="ev-period-chips">
        <button class="ev-period-chip"
                [class.ev-period-chip--active]="selectedPeriod === 'today'"
                [disabled]="analyzing"
                (click)="selectPresetPeriod('today')">Today</button>
        <button class="ev-period-chip"
                [class.ev-period-chip--active]="selectedPeriod === 'yesterday'"
                [disabled]="analyzing"
                (click)="selectPresetPeriod('yesterday')">Yesterday</button>
        <button class="ev-period-chip"
                [class.ev-period-chip--active]="selectedPeriod === 'last7days'"
                [disabled]="analyzing"
                (click)="selectPresetPeriod('last7days')">Last 7 days</button>
        <button class="ev-period-chip"
                [class.ev-period-chip--active]="selectedPeriod === 'custom'"
                [disabled]="analyzing"
                (click)="openRangeCal()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round"
               style="margin-right:4px;vertical-align:middle">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
          {{ customRangeLabel || 'Custom' }}
        </button>
      </div>
    </div>

    <!-- Detail body -->
    <div class="ev-detail-body">

      <!-- Placeholder -->
      <div class="ev-detail-placeholder" *ngIf="!selectedPeriod && !analyzing">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.3"
             stroke-linecap="round" stroke-linejoin="round"
             style="opacity:0.28">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <p class="ev-detail-placeholder-text">
          Select a time period above to generate insights
        </p>
      </div>

      <!-- Analyzing -->
      <div class="ev-analyzing" *ngIf="analyzing">
        <div class="ev-spinner"></div>
        <p class="ev-analyzing-text">Analyzing your food logs…</p>
      </div>

      <!-- Error -->
      <div class="ev-error-card" *ngIf="analyzeError && !analyzing">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ analyzeError }}
      </div>

      <!-- Result -->
      <div class="ev-result" *ngIf="analyzeResult && !analyzing">

        <!-- Result header: period badge + log count (clickable) -->
        <div class="ev-result-header">
          <span class="ev-result-period-badge">{{ activePeriodLabel }}</span>
          <button class="ev-result-log-count"
                  (click)="toggleLogsList()"
                  [class.ev-result-log-count--active]="showLogsList"
                  title="Show / hide logs considered">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
              <line x1="8"  y1="6" x2="21" y2="6"/>
              <line x1="8"  y1="12" x2="21" y2="12"/>
              <line x1="8"  y1="18" x2="21" y2="18"/>
              <line x1="3"  y1="6" x2="3.01" y2="6"/>
              <line x1="3"  y1="12" x2="3.01" y2="12"/>
              <line x1="3"  y1="18" x2="3.01" y2="18"/>
            </svg>
            {{ analyzeResult.foodLogCount }}
            food log{{ analyzeResult.foodLogCount === 1 ? '' : 's' }}
          </button>
        </div>

        <!-- Expandable logs list -->
        <div class="ev-logs-list" *ngIf="showLogsList">
          <div class="ev-logs-empty" *ngIf="analyzeResult.logs.length === 0">
            No food-related logs found for this period.
          </div>
          <div class="ev-log-item" *ngFor="let log of analyzeResult.logs">
            <span class="ev-log-type">{{ log.logTypeName }}</span>
            <span class="ev-log-title">{{ log.title }}</span>
            <span class="ev-log-time">{{ fmtLogTime(log) }}</span>
          </div>
        </div>

        <!-- Markdown result body -->
        <div class="ev-result-body" [innerHTML]="renderedMarkdown"></div>
      </div>

    </div>
  </ng-container>

</div>


<!-- ══════════════════════════════════════════
     GEAR SHEET
══════════════════════════════════════════ -->
<ng-container *ngIf="showGearSheet">
  <div class="ev-sheet-backdrop" (click)="closeGearSheet()"></div>
  <div class="ev-sheet" (click)="$event.stopPropagation()">
    <div class="ev-sheet-handle"></div>
    <div class="ev-sheet-header">
      <span class="ev-sheet-title">Insight Settings</span>
      <button class="ev-sheet-close" (click)="closeGearSheet()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="ev-sheet-body">

      <div class="ev-selector-section">
        <span class="ev-selector-heading">Prompt Selected</span>
        <div class="ev-seg-ctrl">
          <button class="ev-seg-btn" [class.ev-seg-btn--active]="gearTab === 'system'"
                  (click)="selectGearTab('system')">
            <span class="ev-seg-radio" [class.ev-seg-radio--on]="gearTab === 'system'"></span>
            system
          </button>
          <button class="ev-seg-btn" [class.ev-seg-btn--active]="gearTab === 'custom'"
                  (click)="selectGearTab('custom')">
            <span class="ev-seg-radio" [class.ev-seg-radio--on]="gearTab === 'custom'"></span>
            custom
          </button>
        </div>
      </div>

      <!-- System pane -->
      <div class="ev-pane" *ngIf="gearTab === 'system'">
        <div class="ev-readonly-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Read only
        </div>
        <div class="ev-sys-loading" *ngIf="loadingSystemPrompt">
          <div class="ev-spinner ev-spinner--sm"></div>
          <span>Loading prompt…</span>
        </div>
        <textarea *ngIf="!loadingSystemPrompt"
                  class="ev-prompt-ta ev-prompt-ta--readonly"
                  [value]="systemPromptContent"
                  readonly rows="10"></textarea>
      </div>

      <!-- Custom pane -->
      <div class="ev-pane" *ngIf="gearTab === 'custom'">
        <div class="ev-custom-loading" *ngIf="loadingCustomPrompt">
          <div class="ev-spinner ev-spinner--sm"></div>
          <span>Loading prompt…</span>
        </div>
        <ng-container *ngIf="!loadingCustomPrompt">
          <div class="ev-field-row">
            <span class="ev-field-label">Model</span>
            <select class="ev-model-select" [(ngModel)]="customModel">
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <div class="ev-field-row ev-field-row--between">
            <span class="ev-field-label">Prompt</span>
            <button class="ev-save-btn"
                    (click)="saveCustomPrompt()"
                    [disabled]="!customPromptContent?.trim() || savingPrompt">
              {{ savingPrompt ? 'Saving…' : 'Save' }}
            </button>
          </div>
          <textarea class="ev-prompt-ta"
                    [(ngModel)]="customPromptContent"
                    placeholder="Enter your custom prompt…"
                    rows="10"></textarea>
        </ng-container>
      </div>

    </div>
  </div>
</ng-container>


<!-- ══════════════════════════════════════════
     SWITCH-TO-CUSTOM CONFIRM
══════════════════════════════════════════ -->
<div class="ev-confirm-overlay" *ngIf="showSwitchConfirm" (click)="cancelSwitchConfirm()">
  <div class="ev-confirm-panel" (click)="$event.stopPropagation()">
    <h3 class="ev-confirm-title">Switch to custom prompt?</h3>
    <p class="ev-confirm-body">Are you sure? You can always switch back to system.</p>
    <div class="ev-confirm-actions">
      <button class="ev-confirm-btn ev-confirm-cancel" (click)="cancelSwitchConfirm()">Cancel</button>
      <button class="ev-confirm-btn ev-confirm-ok"
              (click)="confirmSwitchToCustom()"
              [disabled]="switchingToCustom">
        {{ switchingToCustom ? 'Switching…' : 'Yes, switch' }}
      </button>
    </div>
  </div>
</div>
`,
  styles: [`
    :host { display: block; }

    .ev-root {
      padding-bottom: calc(58px + env(safe-area-inset-bottom, 0px) + 16px);
      min-height: 100%;
    }

    /* ── Calendar overlay (same pattern as reports) ── */
    .ev-cal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(2px);
      z-index: 1200;
      display: flex; align-items: center; justify-content: center;
      animation: ev-fadein 0.15s ease;
    }
    .ev-cal-popup {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      max-width: 360px; width: 100%;
      animation: ev-popup-in 0.18s ease;
    }
    @keyframes ev-popup-in {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .ev-cal-handle { display: none; }
    .ev-cal-hint {
      padding: 12px 16px 6px;
      font-size: 13px; color: var(--text-muted);
      text-align: center; min-height: 36px;
    }
    .ev-cal-hint strong { color: var(--text-primary); }
    .ev-cal-actions {
      display: flex; gap: 8px;
      justify-content: flex-end;
      padding: 10px 16px 14px;
      border-top: 1px solid var(--border);
    }
    .ev-cal-cancel {
      flex: 1; padding: 10px 14px;
      background: transparent; border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-muted);
      font-size: 14px; cursor: pointer;
      transition: background 0.12s;
    }
    .ev-cal-cancel:hover { background: var(--bg-surface); }
    .ev-cal-apply {
      flex: 2; padding: 10px 16px;
      background: var(--accent); border: none;
      border-radius: 8px; color: #fff;
      font-size: 14px; font-weight: 600;
      cursor: pointer;
    }
    .ev-cal-apply:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Mobile: bottom sheet */
    @media (max-width: 480px) {
      .ev-cal-overlay { align-items: flex-end; }
      .ev-cal-popup { border-radius: 14px 14px 0 0; max-width: 100%; }
      .ev-cal-handle {
        display: block;
        width: 36px; height: 4px; border-radius: 2px;
        background: var(--border);
        margin: 10px auto 0;
      }
    }

    /* ── Page header ── */
    .ev-page-header { padding: 18px 18px 10px; }
    .ev-page-title {
      font-size: 20px; font-weight: 700;
      color: var(--text-primary); margin: 0 0 2px;
    }
    .ev-page-sub { font-size: 12px; color: var(--text-muted); margin: 0; }

    /* ── Spinner ── */
    .ev-loading-wrap { display: flex; justify-content: center; padding: 40px 0; }
    .ev-spinner {
      width: 22px; height: 22px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: ev-spin 0.7s linear infinite;
    }
    .ev-spinner--sm { width: 15px; height: 15px; }
    @keyframes ev-spin { to { transform: rotate(360deg); } }

    /* ── Insight list ── */
    .ev-insight-list { padding: 4px 14px 8px; display: flex; flex-direction: column; gap: 10px; }
    .ev-insight-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .ev-card-body { display: flex; align-items: center; gap: 12px; padding: 14px 16px; transition: background 0.13s; }
    .ev-card-body--enabled { cursor: pointer; }
    .ev-card-body--enabled:active { background: var(--bg-surface); }
    .ev-card-icon-wrap {
      flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px;
      background: var(--bg-surface); display: flex; align-items: center; justify-content: center;
      color: var(--accent);
    }
    .ev-card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .ev-card-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
    .ev-card-meta { font-size: 11px; color: var(--text-muted); }
    .ev-card-meta--dim { opacity: 0.6; }

    /* ── Toggle ── */
    .ev-toggle-wrap { flex-shrink: 0; position: relative; cursor: pointer; display: inline-block; }
    .ev-toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
    .ev-toggle-track {
      display: block; width: 42px; height: 24px; border-radius: 12px;
      background: var(--border); position: relative; transition: background 0.2s;
    }
    .ev-toggle-track::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.2s;
    }
    .ev-toggle-track--on { background: var(--accent); }
    .ev-toggle-track--on::after { transform: translateX(18px); }

    .ev-empty { text-align: center; padding: 48px 24px; color: var(--text-muted); font-size: 13px; }

    /* ── Detail header ── */
    .ev-detail-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 16px 10px; border-bottom: 1px solid var(--border);
    }
    .ev-back-btn, .ev-gear-btn {
      background: none; border: none; padding: 6px; cursor: pointer;
      color: var(--text-muted); display: flex; align-items: center;
      border-radius: 8px; transition: background 0.13s, color 0.13s;
    }
    .ev-back-btn:hover, .ev-gear-btn:hover { background: var(--bg-surface); color: var(--text-primary); }
    .ev-detail-title { flex: 1; font-size: 16px; font-weight: 600; color: var(--text-primary); }

    /* ── Period chips row ── */
    .ev-period-row { padding: 10px 14px 4px; }
    .ev-period-chips { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 2px; }
    .ev-period-chip {
      flex-shrink: 0; padding: 6px 13px;
      border-radius: 20px; border: 1px solid var(--border);
      background: var(--bg-surface); color: var(--text-muted);
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
      display: inline-flex; align-items: center;
    }
    .ev-period-chip:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }
    .ev-period-chip--active { background: var(--accent) !important; border-color: var(--accent) !important; color: #fff !important; }
    .ev-period-chip:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Detail body ── */
    .ev-detail-body { padding: 14px 16px 24px; }
    .ev-detail-placeholder { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 40px 16px; }
    .ev-detail-placeholder-text { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0; }
    .ev-analyzing { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0; }
    .ev-analyzing-text { font-size: 13px; color: var(--text-muted); margin: 0; }
    .ev-error-card {
      display: flex; align-items: flex-start; gap: 8px;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px 14px;
      font-size: 13px; color: var(--text-muted); line-height: 1.5;
    }

    /* ── Result ── */
    .ev-result { display: flex; flex-direction: column; gap: 10px; }
    .ev-result-header { display: flex; align-items: center; gap: 8px; }
    .ev-result-period-badge {
      padding: 3px 10px; border-radius: 12px;
      background: var(--accent); color: #fff;
      font-size: 11px; font-weight: 600;
    }
    .ev-result-log-count {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; color: var(--text-muted);
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 3px 9px;
      cursor: pointer; transition: all 0.13s;
    }
    .ev-result-log-count:hover, .ev-result-log-count--active {
      border-color: var(--accent); color: var(--accent);
    }

    /* ── Logs list ── */
    .ev-logs-list {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      animation: ev-fadein 0.15s ease;
    }
    .ev-logs-empty { padding: 12px 14px; font-size: 12px; color: var(--text-muted); }
    .ev-log-item {
      display: flex; align-items: baseline; gap: 8px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .ev-log-item:last-child { border-bottom: none; }
    .ev-log-type { color: var(--accent); font-weight: 600; flex-shrink: 0; }
    .ev-log-title { color: var(--text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ev-log-time { color: var(--text-muted); flex-shrink: 0; }

    /* ── Markdown result body ── */
    .ev-result-body {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      font-size: 13px; color: var(--text-primary);
      line-height: 1.7;
      word-break: break-word;
    }

    /* Markdown styles (scoped inside result body via :host) */
    .ev-result-body ::ng-deep .ev-md-h2 {
      display: block; font-size: 15px; font-weight: 700;
      color: var(--text-primary); margin: 12px 0 4px;
    }
    .ev-result-body ::ng-deep .ev-md-h3 {
      display: block; font-size: 13px; font-weight: 700;
      color: var(--accent); margin: 10px 0 3px;
    }
    .ev-result-body ::ng-deep .ev-md-h4 {
      font-weight: 700; color: var(--text-primary);
    }
    .ev-result-body ::ng-deep .ev-md-p {
      margin: 0 0 6px;
    }
    .ev-result-body ::ng-deep .ev-md-ul,
    .ev-result-body ::ng-deep .ev-md-ol {
      margin: 4px 0 8px; padding-left: 20px;
    }
    .ev-result-body ::ng-deep .ev-md-ul li,
    .ev-result-body ::ng-deep .ev-md-ol li {
      margin-bottom: 3px;
    }
    .ev-result-body ::ng-deep .ev-md-code {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 4px; padding: 1px 5px;
      font-family: monospace; font-size: 12px;
    }

    /* ── Gear sheet ── */
    .ev-sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(2px); z-index: 900; }
    .ev-sheet {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--bg-card); border-radius: 14px 14px 0 0;
      z-index: 901; display: flex; flex-direction: column;
      max-height: 88vh; animation: ev-slide-up 0.25s ease;
    }
    @keyframes ev-slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }
    .ev-sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 10px auto 0; flex-shrink: 0; }
    .ev-sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 8px; flex-shrink: 0; }
    .ev-sheet-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .ev-sheet-close { background: none; border: none; padding: 4px; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; border-radius: 6px; transition: background 0.13s; }
    .ev-sheet-close:hover { background: var(--bg-surface); }
    .ev-sheet-body { flex: 1; overflow-y: auto; padding: 4px 18px calc(env(safe-area-inset-bottom, 0px) + 28px); }

    /* ── Segmented prompt selector ── */
    .ev-selector-section { margin-bottom: 16px; }
    .ev-selector-heading { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
    .ev-seg-ctrl { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--bg-surface); }
    .ev-seg-btn { display: flex; align-items: center; gap: 6px; padding: 7px 18px; background: transparent; border: none; font-size: 13px; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
    .ev-seg-btn + .ev-seg-btn { border-left: 1px solid var(--border); }
    .ev-seg-btn--active { background: var(--accent); color: #fff; }
    .ev-seg-radio { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--text-muted); flex-shrink: 0; transition: all 0.15s; }
    .ev-seg-radio--on { border-color: var(--accent); background: var(--accent); }
    .ev-seg-btn--active .ev-seg-radio--on { border-color: #fff; background: #fff; }

    /* ── Pane content ── */
    .ev-pane { display: flex; flex-direction: column; gap: 10px; }
    .ev-readonly-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text-muted); align-self: flex-start; }
    .ev-sys-loading, .ev-custom-loading { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); padding: 12px 0; }
    .ev-field-row { display: flex; align-items: center; gap: 10px; }
    .ev-field-row--between { justify-content: space-between; }
    .ev-field-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
    .ev-model-select { padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-primary); font-size: 13px; cursor: pointer; }
    .ev-save-btn { padding: 5px 18px; border-radius: 8px; border: none; background: var(--accent); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
    .ev-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ev-prompt-ta { width: 100%; min-height: 180px; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.6; color: var(--text-primary); background: var(--bg-surface); resize: vertical; box-sizing: border-box; font-family: inherit; }
    .ev-prompt-ta:focus { outline: none; border-color: var(--accent); }
    .ev-prompt-ta--readonly { background: var(--bg-card); color: var(--text-muted); cursor: default; resize: none; }

    /* ── Confirm ── */
    .ev-confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px); z-index: 3100; display: flex; align-items: center; justify-content: center; }
    .ev-confirm-panel { background: var(--bg-card); border-radius: 14px; padding: 24px 22px 20px; width: 320px; max-width: 92vw; animation: ev-fadein 0.15s ease; }
    @keyframes ev-fadein { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .ev-confirm-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; }
    .ev-confirm-body { font-size: 13px; color: var(--text-muted); margin: 0 0 20px; line-height: 1.5; }
    .ev-confirm-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .ev-confirm-btn { padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; border: none; }
    .ev-confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ev-confirm-cancel { background: var(--bg-surface); border: 1px solid var(--border) !important; color: var(--text-muted); }
    .ev-confirm-ok { background: var(--accent); color: #fff; }
  `]
})
export class EagleViewComponent implements OnInit, OnDestroy {

  subView: SubView = 'list';

  // List
  insightCards: InsightCard[] = [];
  loading       = false;
  togglingLabel = '';

  // Detail
  selectedCard:  InsightCard | null = null;
  detailInsight: InsightDetail | null = null;

  // Period & analysis
  selectedPeriod:  Period | null = null;
  analyzing        = false;
  analyzeResult:   AnalyzeResult | null = null;
  analyzeError:    string | null = null;
  showLogsList     = false;
  renderedMarkdown = '';

  // Calendar (custom range)
  showRangeCal:    boolean   = false;
  pendingFromDate: Date | null = null;
  pendingToDate:   Date | null = null;
  customRangeLabel = '';

  // Gear sheet
  showGearSheet    = false;
  gearTab: GearTab = 'system';
  loadingSystemPrompt = false;
  systemPromptContent = '';
  loadingCustomPrompt = false;
  savingPrompt        = false;
  customPromptContent = '';
  customModel         = 'gemini';
  customPromptId: string | null = null;

  // Switch confirm
  showSwitchConfirm = false;
  switchingToCustom = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private insightSvc: InsightService,
    private promptSvc:  PromptService,
    private appState:   AppStateService,
    private cdr:        ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.loadInsights(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── List ────────────────────────────────────────────────────────

  private loadInsights(): void {
    this.loading = true;
    this.insightSvc.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: cards => { this.insightCards = cards; this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  onToggle(card: InsightCard, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.togglingLabel = card.label;
    checked ? this._enableInsight(card) : this._disableInsight(card);
  }

  private _enableInsight(card: InsightCard): void {
    if (card.userInsight) {
      this.insightSvc.update(card.userInsight._id, { enabled: true }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => { card.userInsight!.enabled = true; this.togglingLabel = ''; this.cdr.markForCheck(); },
        error: () => { this.togglingLabel = ''; this.cdr.markForCheck(); }
      });
      return;
    }
    this.insightSvc.createUserInsight({ label: card.label, name: card.name, model: card.model, type: 'system', promptId: card.label })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: d => {
          card.userInsight = { _id: d._id, type: d.type, model: d.model, promptId: d.promptId, enabled: true };
          this.togglingLabel = ''; this.cdr.markForCheck();
        },
        error: () => { this.togglingLabel = ''; this.cdr.markForCheck(); }
      });
  }

  private _disableInsight(card: InsightCard): void {
    if (!card.userInsight) { this.togglingLabel = ''; return; }
    this.insightSvc.update(card.userInsight._id, { enabled: false }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { card.userInsight!.enabled = false; this.togglingLabel = ''; this.cdr.markForCheck(); },
      error: () => { this.togglingLabel = ''; this.cdr.markForCheck(); }
    });
  }

  openDetail(card: InsightCard): void {
    this.selectedCard    = card;
    this.subView         = 'detail';
    this.detailInsight   = null;
    this.selectedPeriod  = null;
    this.analyzeResult   = null;
    this.analyzeError    = null;
    this.showLogsList    = false;
    this.renderedMarkdown = '';
    this.cdr.markForCheck();

    this.insightSvc.getById(card.userInsight!._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: detail => {
        this.detailInsight = detail;
        this.cdr.markForCheck();
        if (detail.type === 'system') this.openGearSheet();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  backToList(): void {
    this.subView = 'list'; this.selectedCard = null; this.showGearSheet = false;
    this.cdr.markForCheck();
  }

  trackByLabel(_i: number, card: InsightCard): string { return card.label; }

  // ── Period chips ────────────────────────────────────────────────

  get activePeriodLabel(): string {
    if (this.selectedPeriod === 'custom') return this.customRangeLabel || 'Custom';
    return PERIOD_LABELS[this.selectedPeriod ?? ''] ?? '';
  }

  selectPresetPeriod(period: 'today' | 'yesterday' | 'last7days'): void {
    this.selectedPeriod = period;
    this._runAnalysis(period);
  }

  private _runAnalysis(period: Period, startDate?: string, endDate?: string): void {
    this.analyzeResult = null;
    this.analyzeError  = null;
    this.showLogsList  = false;
    this.renderedMarkdown = '';
    this.analyzing     = true;
    this.cdr.markForCheck();

    this.insightSvc.analyze(this.selectedCard!.userInsight!._id, period, startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          this.analyzeResult    = result;
          this.renderedMarkdown = renderMarkdown(result.text);
          this.analyzing        = false;
          this.cdr.markForCheck();
        },
        error: err => {
          this.analyzeError = err?.error?.error || 'Analysis failed. Please try again.';
          this.analyzing    = false;
          this.cdr.markForCheck();
        }
      });
  }

  toggleLogsList(): void {
    this.showLogsList = !this.showLogsList;
    this.cdr.markForCheck();
  }

  fmtLogTime(log: AnalyzeLogSummary): string {
    const start = new Date(log.startAt);
    const hh = String(start.getUTCHours()).padStart(2, '0');
    const mm = String(start.getUTCMinutes()).padStart(2, '0');
    if (log.entryType === 'point' || !log.endAt) return `${hh}:${mm}`;
    const end = new Date(log.endAt);
    const eh  = String(end.getUTCHours()).padStart(2, '0');
    const em  = String(end.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}–${eh}:${em}`;
  }

  // ── Calendar (custom range) ─────────────────────────────────────

  fmtShort(d: Date): string { return fmtShort(d); }

  openRangeCal(): void {
    this.pendingFromDate = null;
    this.pendingToDate   = null;
    this.showRangeCal    = true;
    this.cdr.markForCheck();
  }

  onCalOverlay(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('ev-cal-overlay')) {
      this.showRangeCal = false;
      this.cdr.markForCheck();
    }
  }

  onCalDateClick(date: Date): void {
    if (this.pendingToDate) {
      this.pendingFromDate = date; this.pendingToDate = null;
    } else if (!this.pendingFromDate) {
      this.pendingFromDate = date;
    } else if (date >= this.pendingFromDate) {
      this.pendingToDate = date;
    } else {
      this.pendingFromDate = date;
    }
    this.cdr.markForCheck();
  }

  applyCustomRange(): void {
    if (!this.pendingFromDate || !this.pendingToDate) return;
    const from = dateToStr(this.pendingFromDate);
    const to   = dateToStr(this.pendingToDate);
    this.customRangeLabel = `${fmtShort(this.pendingFromDate)} – ${fmtShort(this.pendingToDate)}`;
    this.selectedPeriod   = 'custom';
    this.showRangeCal     = false;
    this.cdr.markForCheck();
    this._runAnalysis('custom', from, to);
  }

  // ── Gear sheet ──────────────────────────────────────────────────

  openGearSheet(): void {
    const detail = this.detailInsight;
    this.gearTab = detail?.type === 'custom' ? 'custom' : 'system';
    if (this.gearTab === 'system') {
      this._loadSystemPromptContent();
    } else if (detail?.promptId) {
      this.customPromptId      = detail.promptId;
      this.customPromptContent = detail.promptContent ?? '';
      this.customModel         = detail.model;
    }
    this.showGearSheet = true;
    this.cdr.markForCheck();
  }

  private _loadSystemPromptContent(): void {
    const promptId = this.detailInsight?.label || this.selectedCard?.label;
    if (!promptId) return;
    this.loadingSystemPrompt = true;
    this.systemPromptContent = '';
    this.cdr.markForCheck();
    this.promptSvc.getSystemPrompt(promptId).pipe(takeUntil(this.destroy$)).subscribe({
      next: sp  => { this.systemPromptContent = sp.content; this.loadingSystemPrompt = false; this.cdr.markForCheck(); },
      error: () => { this.systemPromptContent = 'Could not load system prompt.'; this.loadingSystemPrompt = false; this.cdr.markForCheck(); }
    });
  }

  closeGearSheet(): void {
    this.showGearSheet = false; this.showSwitchConfirm = false; this.cdr.markForCheck();
  }

  selectGearTab(tab: GearTab): void {
    if (tab === this.gearTab) return;
    if (tab === 'custom' && this.detailInsight?.type === 'system') {
      this.showSwitchConfirm = true; this.cdr.markForCheck(); return;
    }
    this.gearTab = tab;
    if (tab === 'system' && !this.systemPromptContent) this._loadSystemPromptContent();
    this.cdr.markForCheck();
  }

  cancelSwitchConfirm(): void { this.showSwitchConfirm = false; this.cdr.markForCheck(); }

  confirmSwitchToCustom(): void {
    this.switchingToCustom = true;
    this.cdr.markForCheck();
    const insightId = this.detailInsight?._id;
    const promptId  = this.detailInsight?.label ?? '';

    this.promptSvc.getSystemPrompt(promptId).pipe(takeUntil(this.destroy$)).subscribe({
      next: sp => {
        this.promptSvc.createCustomPrompt({ content: sp.content, insightId }).pipe(takeUntil(this.destroy$)).subscribe({
          next: np => {
            this.insightSvc.update(insightId!, { type: 'custom', promptId: np._id }).pipe(takeUntil(this.destroy$)).subscribe({
              next: updated => {
                this.detailInsight = updated;
                this.customPromptId = np._id; this.customPromptContent = np.content; this.customModel = updated.model;
                if (this.selectedCard?.userInsight) { this.selectedCard.userInsight.type = 'custom'; this.selectedCard.userInsight.promptId = np._id; }
                this.switchingToCustom = false; this.showSwitchConfirm = false; this.gearTab = 'custom';
                this.cdr.markForCheck();
              },
              error: () => { this.switchingToCustom = false; this.cdr.markForCheck(); }
            });
          },
          error: () => { this.switchingToCustom = false; this.cdr.markForCheck(); }
        });
      },
      error: () => { this.switchingToCustom = false; this.cdr.markForCheck(); }
    });
  }

  saveCustomPrompt(): void {
    if (!this.customPromptContent?.trim() || !this.customPromptId) return;
    this.savingPrompt = true;
    this.cdr.markForCheck();
    this.promptSvc.updateCustomPrompt(this.customPromptId, this.customPromptContent).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.savingPrompt = false; this.cdr.markForCheck(); this.appState.showToastRequested$.next({ message: 'Prompt saved', logId: '' }); },
      error: () => { this.savingPrompt = false; this.cdr.markForCheck(); }
    });
  }
}
