import {
  Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppStateService } from '../../services/app-state.service';
import { LogService } from '../../services/log.service';
import { DayLevelService, DayType } from '../../services/day-level.service';
import { NoteItem } from '../../services/notes.service';
import { FoodInsightService, FoodInsightRecord } from '../../services/food-insight.service';

import { LogEntry } from '../../models/log.model';
import { LogType } from '../../models/log-type.model';

import { MetricsComponent } from '../metrics/metrics.component';
import { ActiveLogBarComponent } from '../active-log-bar/active-log-bar.component';
import { LogTypeSelectComponent } from '../log-type-select/log-type-select.component';

@Component({
  selector: 'app-logger-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MetricsComponent,
    ActiveLogBarComponent,
    LogTypeSelectComponent,
  ],
  styles: [`:host { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

    /* ── Hero card — structural only, no color overrides ────────────── */
    .hero-card {
      border-radius: 0 0 32px 32px;
      overflow: hidden;
      box-shadow: 0 20px 20px -4px rgba(0,0,0,0.22);
      /* Matches view-area's default 24px horizontal padding */
      margin: 0 -24px 0;
    }
    @media (max-width: 390px) {
      .hero-card { margin: 0 -10px 0; }
    }
    @media (min-width: 412px) {
      .hero-card { margin: 0 -20px 0; }
    }
    .hero-content {
      position: relative;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 40px 16px;
      touch-action: pan-y;
      overflow: hidden;
    }
    /* Left: date */
    .hero-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
      will-change: transform;
    }
.hero-date-line {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    .hero-day-num {
      font-size: 42px;
      font-weight: 900;
      color: var(--text-primary);
      line-height: 1;
      letter-spacing: -1px;
      font-variant-numeric: tabular-nums;
    }
    .hero-day-suffix {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0;
      vertical-align: super;
      opacity: 0.65;
    }
    .hero-month-year-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: 5px;
    }
    .hero-month-year-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: none;
      border: none;
      padding: 0;
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      cursor: pointer;
      font-family: inherit;
      line-height: 1;
    }
    .hero-month-year-btn:hover { color: var(--text-secondary); }
    .hero-cal-icon { color: var(--text-muted); flex-shrink: 0; }
    .hero-weekday {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      line-height: 1;
    }
    .hero-chips-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hero-today-chip {
      font-size: 10px;
      font-weight: 600;
      color: var(--highlight-selected, #5A9CB5);
      border: 1px solid var(--highlight-selected, #5A9CB5);
      padding: 2px 8px;
      border-radius: 20px;
      line-height: 1.4;
      white-space: nowrap;
    }

    /* Right: day type + important times */
    .hero-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }
    .hero-daytype-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px 3px 6px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.07);
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      transition: border-color 0.14s;
      white-space: nowrap;
    }
    .hero-daytype-wrap:hover { border-color: var(--border); }
    .hero-daytype-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .hero-daytype-lbl { font-size: 10.5px; }
    .hdr-dt-panel {
      position: fixed;
      z-index: 1000;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius, 10px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.32);
      padding: 4px 0;
      min-width: 140px;
    }
    .hdr-dt-option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 14px;
      background: none;
      border: none;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s;
    }
    .hdr-dt-option:hover { background: var(--accent-hover); }
    .hdr-dt-option--active { color: var(--highlight-selected, #5A9CB5); font-weight: 600; }
    .hdr-dt-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .hero-imp-times {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .hero-imp-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .hero-imp-key {
      font-size: 9.5px;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .hero-imp-val {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
    .hero-imp-open-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle, rgba(128,128,128,0.18));
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.13s, color 0.13s;
      margin-top: 2px;
    }
    .hero-imp-open-btn:hover { background: var(--accent-hover); color: var(--text-primary); }
    .hero-right-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hero-today-chip--sm {
      font-size: 10px;
      padding: 2px 8px;
    }
    .hero-goto-today-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 20px;
      border: 1px solid var(--highlight-selected, #5A9CB5);
      background: color-mix(in srgb, var(--highlight-selected, #5A9CB5) 12%, transparent);
      color: var(--highlight-selected, #5A9CB5);
      font-size: 10px;
      font-weight: 600;
      font-family: inherit;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.13s, border-color 0.13s;
    }
    .hero-goto-today-btn:hover {
      background: color-mix(in srgb, var(--highlight-selected, #5A9CB5) 22%, transparent);
    }


    /* ── Day scroll strip ──────────────────────────────────────────── */
    .day-strip {
      position: relative;
      display: flex;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      border-top: 1px solid rgba(255,255,255,0.08);
      padding: 6px 28px 22px;
      gap: 2px;
    }
    .day-strip::-webkit-scrollbar { display: none; }
    /* Floating indicator — sits behind items, moves continuously with swipe */
    .day-strip-selector {
      position: absolute;
      top: 6px;
      bottom: 22px;
      width: 32px;
      background: var(--highlight-selected, #5A9CB5);
      border-radius: 7px;
      pointer-events: none;
      z-index: 0;
    }
    .day-strip-item {
      flex: 0 0 auto;
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 32px;
      padding: 4px 0;
      border-radius: 7px;
      border: none;
      background: none;
      cursor: pointer;
      transition: background 0.13s;
    }
    .day-strip-item:hover:not(:disabled):not(.day-strip-item--selected) {
      background: var(--accent-hover);
    }
    .day-strip-item--selected {
      background: none;
    }
    .day-strip-item--selected .day-strip-dow,
    .day-strip-item--selected .day-strip-num { color: #fff; }
    .day-strip-item--today .day-strip-num {
      color: var(--highlight-selected, #5A9CB5);
      font-weight: 800;
    }
    .day-strip-item--future { opacity: 0.3; cursor: not-allowed; }
    .day-strip-dow {
      font-size: 8px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .day-strip-num {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    /* domain dropdown */
    .domain-dd-wrap { position: relative; margin-left: 4px; }
    .domain-dd-trigger { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 5px; border: 1px solid var(--border-subtle, rgba(128,128,128,0.2)); background: var(--bg-card); color: var(--text-secondary); font-size: 11px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: border-color 0.14s, color 0.14s; }
    .domain-dd-trigger:hover { border-color: var(--border); color: var(--text-primary); }
    .domain-dd-trigger--active { border-color: var(--chip-color, var(--border)); color: var(--chip-color, var(--text-primary)); }
    .domain-dd-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .domain-dd-chevron { color: var(--text-muted); transition: transform 0.15s; flex-shrink: 0; }
    .domain-dd-chevron--open { transform: rotate(180deg); }
    .domain-dd-panel { position: absolute; top: calc(100% + 3px); left: 0; z-index: 200; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 6px 20px rgba(0,0,0,0.28); min-width: 100px; padding: 4px 0; }
    .domain-dd-option { display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 10px; background: none; border: none; color: var(--text-primary); font-size: 12px; font-family: inherit; cursor: pointer; text-align: left; transition: background 0.1s; white-space: nowrap; }
    .domain-dd-option:hover { background: var(--nav-item-hover); }
    .domain-dd-option--active { background: color-mix(in srgb, var(--chip-color, #9B9B9B) 10%, var(--bg-card)); color: var(--chip-color, var(--text-primary)); font-weight: 600; }
    .domain-dd-count { margin-left: auto; font-size: 10px; color: var(--text-muted); background: var(--bg-surface); padding: 0 5px; border-radius: 6px; }
    .tl-card--ai { border-left: 3px solid #9B6DBF; }
    .log-group-header {
      position: sticky; top: 0; z-index: 5;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 2px 4px;
      cursor: pointer;
      user-select: none;
    }
    .log-group-header:hover .log-group-label { color: var(--text-secondary); }
    .log-group-collapse-btn {
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; padding: 0; cursor: pointer;
      color: var(--text-muted); flex-shrink: 0;
    }
    .log-group-chevron { transition: transform 0.2s ease; }
    .log-group-chevron--collapsed { transform: rotate(-90deg); }
    .log-group-label { font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.4px; }
    .log-group-count { font-size: 10px; color: var(--text-muted); background: var(--bg-card); padding: 1px 6px; border-radius: 8px; }
    .log-group-line { flex: 1; height: 1px; background: var(--border-subtle, rgba(128,128,128,0.15)); }

    /* ── Food insight button ─────────────────────────────────────────── */
    .log-list-insight-btn {
      display: flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 6px;
      border: 1px solid rgba(251,191,36,0.25);
      background: rgba(251,191,36,0.08);
      color: #fbbf24; cursor: pointer;
      transition: background 0.14s, border-color 0.14s;
      flex-shrink: 0;
    }
    .log-list-insight-btn:hover,
    .log-list-insight-btn--open { background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.45); }

    /* ── Duration chip in action row ────────────────────────────────── */
    .log-list-dur-chip {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-surface);
      padding: 1px 6px;
      border-radius: 6px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Insight panel ───────────────────────────────────────────────── */
    .insight-panel {
      margin-top: 4px;
      border-radius: 10px;
      border: 1px solid rgba(251,191,36,0.18);
      background: rgba(251,191,36,0.04);
      overflow: hidden;
      animation: insightIn 0.18s ease;
    }
    @keyframes insightIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .insight-loading, .insight-pending, .insight-error {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; font-size: 0.78rem;
      color: var(--text-secondary, #8090A8);
    }
    .insight-error { color: #f87171; }
    .insight-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(251,191,36,0.2);
      border-top-color: #fbbf24;
      animation: spin 0.7s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .insight-generate-row {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
    }
    .insight-generate-row--error { color: #f87171; }
    .insight-generate-hint {
      flex: 1; font-size: 0.77rem; color: var(--text-muted, #6A7290);
    }
    .insight-generate-row--error .insight-generate-hint { color: #f87171; }
    .insight-generate-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 12px; border-radius: 7px; font-size: 0.76rem; font-weight: 600;
      background: rgba(251,191,36,0.12);
      border: 1px solid rgba(251,191,36,0.3);
      color: #fbbf24; cursor: pointer; flex-shrink: 0;
      transition: background 0.14s;
    }
    .insight-generate-btn:hover:not(:disabled) { background: rgba(251,191,36,0.22); }
    .insight-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .insight-header {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 14px 6px;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: #fbbf24;
    }
    .insight-regen-btn {
      margin-left: auto; display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(251,191,36,0.25);
      background: transparent; color: #fbbf24; cursor: pointer; opacity: 0.7;
      transition: opacity 0.14s, background 0.14s; flex-shrink: 0;
    }
    .insight-regen-btn:hover:not(:disabled) { opacity: 1; background: rgba(251,191,36,0.12); }
    .insight-regen-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .insight-body { padding-bottom: 4px; }
    .insight-text {
      margin: 0; padding: 0 14px 12px;
      font-size: 0.78rem; line-height: 1.65;
      color: var(--text-secondary, #8090A8); word-break: break-word;
    }
    .insight-markdown p { margin: 0 0 6px; }
    .insight-markdown p:last-child { margin-bottom: 0; }
    .insight-markdown ul, .insight-markdown ol {
      margin: 4px 0 6px; padding-left: 18px;
    }
    .insight-markdown li { margin-bottom: 2px; }
    .insight-markdown strong { color: var(--text-primary, #CDD6E8); font-weight: 600; }
    .insight-markdown h1, .insight-markdown h2, .insight-markdown h3 {
      font-size: 0.8rem; font-weight: 700; margin: 8px 0 4px;
      color: var(--text-primary, #CDD6E8);
    }
  `],
  template: `
    <!-- ── Hero Card ─────────────────────────────────────────────── -->
    <div class="hero-card">

      <!-- Swipeable main area -->
      <div class="hero-content"
           (touchstart)="onDateSwipeStart($event)"
           (touchmove)="onDateSwipeMove($event)"
           (touchend)="onDateSwipeEnd()">

        <!-- Left: date + weekday + nav -->
        <div class="hero-left"
             [style.opacity]="heroDateOpacity"
             [style.transform]="'translateX(' + dateSlideX + 'px)'"
             [style.transition]="dateSwipeActive ? 'none' : 'opacity 0.2s ease, transform 0.22s cubic-bezier(0.4,0,0.2,1)'">
          <div class="hero-date-line">
            <span class="hero-day-num">{{ heroDateDayNum }}<span class="hero-day-suffix">{{ heroDateDaySuffix }}</span></span>
            <div class="hero-month-year-col">
              <button class="hero-month-year-btn"
                      (click)="appState.openCalendarRequested$.next(); $event.stopPropagation()">
                {{ heroDateMonthYear }}
                <svg class="hero-cal-icon" width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span class="hero-weekday">{{ heroDateWeekday }}</span>
            </div>
          </div>
          <div class="hero-chips-row"></div>
        </div>

        <!-- Right: day type + important times -->
        <div class="hero-right">
          <div class="hero-daytype-wrap" #daytypeWrap *ngIf="dayMetadata"
               (click)="toggleDayTypeDropdown($event)">
            <span class="hero-daytype-dot" [style.background]="dayTypeColor"></span>
            <span class="hero-daytype-lbl">{{ dayTypeLabel }}</span>
          </div>
          <div class="hero-right-actions">
            <span class="hero-today-chip hero-today-chip--sm" *ngIf="isToday">current day</span>
            <button class="hero-goto-today-btn" *ngIf="!isToday"
                    (click)="appState.goToToday(); $event.stopPropagation()"
                    title="Go to today" aria-label="Go to today">
              go to today
            </button>
            <button class="hero-imp-open-btn"
                    (click)="appState.openImportantLogsRequested$.next(); $event.stopPropagation()"
                    title="Capture important times" aria-label="Important logs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        </div>

      </div><!-- /hero-content -->

      <!-- Day scroll strip -->
      <div class="day-strip" #dayStripRef>
        <!-- Floating selection indicator — moves continuously with swipe -->
        <div class="day-strip-selector"
             [style.left.px]="indicatorLeft"
             [style.transition]="dateSwipeActive ? 'none' : 'left 0.22s cubic-bezier(0.4,0,0.2,1)'">
        </div>
        <button *ngFor="let d of scrollDays; trackBy: trackByDayDate"
                class="day-strip-item"
                [class.day-strip-item--selected]="d.isSelected"
                [class.day-strip-item--today]="d.isToday && !d.isSelected"
                [class.day-strip-item--future]="d.isFuture"
                [disabled]="d.isFuture"
                (click)="onScrollDayClick(d)">
          <span class="day-strip-dow">{{ d.dowLabel }}</span>
          <span class="day-strip-num">{{ d.dayNum }}</span>
        </button>
      </div>

    </div><!-- /hero-card -->

    <!-- Day type dropdown portal — outside hero-card to escape overflow:hidden -->
    <div class="hdr-dt-panel" *ngIf="dayTypeDropdownOpen"
         [style.top.px]="dayTypePanelTop"
         [style.right.px]="dayTypePanelRight"
         (click)="$event.stopPropagation()">
      <button *ngFor="let opt of dayTypeOptions"
              class="hdr-dt-option"
              [class.hdr-dt-option--active]="dayMetadata?.dayType === opt.value"
              (click)="setDayType(opt.value); dayTypeDropdownOpen = false">
        <span class="hdr-dt-dot" [style.background]="opt.color"></span>
        {{ opt.label }}
      </button>
    </div>

    <!-- ── Metrics ────────────────────────────────────── -->
    <app-metrics
      [logs]="logs"
      [selectedDate]="selectedDate"
      [dayMetadata]="dayMetadata"
      (cardHighlight)="onCardHighlight($event)"
    ></app-metrics>

    <!-- ── Notes + Important Logs ────────────────────── -->
    <div class="notes-important-row">
      <div class="notes-col" [class.notes-col--expanded]="notesExpanded && notesList.length > 0">
        <button class="notes-col-main" (click)="toggleNotesExpand()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <div class="notes-col-text">
            <span class="notes-col-label">Notes</span>
            <span class="notes-col-subtitle" *ngIf="notesList.length > 0">{{ notesList[0].content }}</span>
          </div>
          <span class="notes-row-count" *ngIf="notesCount > 0">{{ notesCount }}</span>
        </button>
        <button class="notes-col-edit-btn" (click)="appState.openNotesRequested$.next(undefined)" title="Open notes">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="notes-preview" *ngIf="notesExpanded && notesList.length > 0">
        <button class="notes-preview-item" *ngFor="let note of notesList"
                (click)="openNotesAtNote(note._id); $event.stopPropagation()">
          {{ note.content }}
        </button>
      </div>
    </div>

    <!-- ── Running Log Banner ────────────────────────── -->
    <app-active-log-bar
      [activeLog]="activeLog"
      [logTypes]="logTypes"
      [elapsedStr]="activeLogElapsedStr"
      [plannedPct]="activeLogPlannedPct"
      (editTimer)="appState.openTimerEditRequested$.next()"
      (stop)="appState.stopRunningLogRequested$.next()">
    </app-active-log-bar>



    <!-- ── Wrap-Up Banner ───────────────────────────── -->
    <div class="wrapup-banner" *ngIf="showWrapUpBanner">
      <svg class="wrapup-banner-icon" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <span class="wrapup-banner-text">
        <strong>{{ todayGaps.length }} gap{{ todayGaps.length > 1 ? 's' : '' }}</strong>
        &nbsp;· {{ totalGapLabel }} unlogged today
      </span>
      <button class="wrapup-start-btn" (click)="appState.openWrapUpRequested$.next()">Wrap Up</button>
      <button class="wrapup-dismiss-btn" (click)="dismissWrapUp()" aria-label="Dismiss">✕</button>
    </div>

    <!-- ── Log List ─────────────────────────────────── -->
    <div class="content-header">
      <h2 class="section-title">Activities</h2>
      <!-- Domain filter dropdown -->
      <div class="domain-dd-wrap" *ngIf="!isLoading && availableDomains.length > 1"
           (click)="$event.stopPropagation()">
        <button class="domain-dd-trigger"
                [class.domain-dd-trigger--active]="!!filterDomain"
                (click)="domainDropdownOpen = !domainDropdownOpen"
                [style.--chip-color]="filterDomain ? domainColor(filterDomain) : 'var(--text-muted)'">
          <span class="domain-dd-dot" *ngIf="filterDomain"
                [style.background]="domainColor(filterDomain)"></span>
          {{ filterDomain || 'All' }}
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" class="domain-dd-chevron"
               [class.domain-dd-chevron--open]="domainDropdownOpen">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="domain-dd-panel" *ngIf="domainDropdownOpen">
          <button class="domain-dd-option"
                  [class.domain-dd-option--active]="filterDomain === ''"
                  (click)="setDomainFilter(''); domainDropdownOpen = false">
            All
            <span class="domain-dd-count">{{ logs.length }}</span>
          </button>
          <button *ngFor="let d of availableDomains"
                  class="domain-dd-option"
                  [class.domain-dd-option--active]="filterDomain === d"
                  [style.--chip-color]="domainColor(d)"
                  (click)="setDomainFilter(d); domainDropdownOpen = false">
            <span class="domain-dd-dot" [style.background]="domainColor(d)"></span>
            {{ d }}
            <span class="domain-dd-count">{{ domainCount(d) }}</span>
          </button>
        </div>
      </div>
      <button type="button" class="btn-sort"
              *ngIf="!isLoading && logs.length > 1"
              (click)="toggleLogSort()"
              [title]="logSortOrder === 'asc' ? 'Earliest first — click for latest first' : 'Latest first — click for earliest first'">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 2v12M4 14l-2.5-3M4 14l2.5-3" stroke="currentColor"
                stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
                [attr.opacity]="logSortOrder === 'desc' ? '1' : '0.35'"/>
          <path d="M12 14V2M12 2l-2.5 3M12 2l2.5 3" stroke="currentColor"
                stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
                [attr.opacity]="logSortOrder === 'asc' ? '1' : '0.35'"/>
        </svg>
        <span>{{ logSortOrder === 'asc' ? 'Earliest' : 'Latest' }}</span>
      </button>
    </div>

    <div class="log-list-section">

          <!-- Skeleton -->
          <div class="log-list-skeleton" *ngIf="isLoading">
            <div class="tl-skeleton-row" *ngFor="let i of [1,2,3]; trackBy: trackByIndex">
              <div class="tl-sk-time"></div>
              <div class="tl-sk-spine">
                <div class="tl-sk-line"></div>
                <div class="tl-sk-dot"></div>
                <div class="tl-sk-line"></div>
              </div>
              <div class="tl-sk-card"></div>
            </div>
          </div>

          <!-- Log cards grouped by time period -->
          <div class="log-list" *ngIf="!isLoading && logs.length > 0">
            <ng-container *ngFor="let group of logGroups; trackBy: trackByGroupPeriod">
              <div class="log-group-header" (click)="toggleGroupCollapse(group.period)">
                <button class="log-group-collapse-btn" tabindex="-1">
                  <svg class="log-group-chevron"
                       [class.log-group-chevron--collapsed]="isGroupCollapsed(group.period)"
                       width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <span class="log-group-label">{{ group.period }}</span>
                <span class="log-group-count">{{ group.logs.length }}</span>
                <div class="log-group-line"></div>
              </div>
            <ng-container *ngIf="!isGroupCollapsed(group.period)">
            <div
              class="tl-item"
              *ngFor="let log of group.logs; trackBy: trackByLogId"
              [class.tl-item--active]="log.id === highlightedLogId && !metricLogIds && inlineEditId !== log.id"
              [class.tl-item--metric-active]="metricLogIds?.has(log.id) && inlineEditId !== log.id"
              [class.tl-item--dimmed]="metricLogIds && !metricLogIds.has(log.id) && inlineEditId !== log.id"
              [class.tl-item--editing]="inlineEditId === log.id"
              (click)="onLogItemClick(log, $event)"
            >
              <div class="swipe-wrap"
                   (touchstart)="onSwipeStart(log, $event)"
                   (touchmove)="onSwipeMove(log, $event)"
                   (touchend)="onSwipeEnd(log, $event)">

                <div class="swipe-reveal swipe-reveal--edit"
                     [class.swipe-reveal--active]="swipeLogId === log.id && swipeTranslateX > 20"
                     [class.swipe-reveal--ready]="swipeLogId === log.id && swipeTranslateX > 72">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                  </svg>
                  Edit
                </div>

                <div class="swipe-reveal swipe-reveal--delete"
                     [class.swipe-reveal--active]="swipeLogId === log.id && swipeTranslateX < -20"
                     [class.swipe-reveal--ready]="swipeLogId === log.id && swipeTranslateX < -72">
                  Delete
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                          stroke="currentColor" stroke-width="1.4"
                          stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>

                <div class="tl-card"
                     [style.transform]="swipeLogId === log.id ? 'translateX(' + swipeTranslateX + 'px)' : ''"
                     [class.tl-card--snapping]="swipeLogId === log.id && swipeSnapping"
                     [class.tl-card--ai]="log.source === 'ai'">

                  <!-- View mode -->
                  <ng-container *ngIf="inlineEditId !== log.id">
                    <div class="tl-card-body">
                      <div class="tl-card-top-row">
                        <div class="tl-card-chip-time">
                          <span class="log-list-type-chip"
                                [style.background]="(log.logType?.color ?? '#9B9B9B') + '22'"
                                [style.color]="'#000000'"
                                (click)="toggleTitleExpand(log.id, $event)"
                                title="{{ log.logType?.name ?? '—' }}">
                            {{ log.logType?.name ?? '—' }}
                          </span>
                          <span class="log-list-time"
                                (click)="toggleTitleExpand(log.id, $event)">
                            <ng-container *ngIf="log.entryType === 'point'">⏱ {{ log.startAt }}</ng-container>
                            <ng-container *ngIf="log.entryType !== 'point'">
                              <span *ngIf="log.date !== selectedDateStr" class="log-prev-day-date">{{ shortDate(log.date) }}, </span>{{ log.startAt }} – <span *ngIf="log.endDate && log.endDate !== log.date && log.endDate !== selectedDateStr" class="log-prev-day-date">{{ shortDate(log.endDate) }}, </span>{{ log.endAt }}
                            </ng-container>
                          </span>
                        </div>
                        <div class="tl-card-actions">
                          <span class="log-list-dur-chip" *ngIf="getDuration(log)">{{ getDuration(log) }}</span>
                          <button *ngIf="isFoodLog(log)" type="button"
                                  class="log-list-insight-btn"
                                  [class.log-list-insight-btn--open]="openInsightId === log.id"
                                  (click)="toggleInsight(log, $event)"
                                  aria-label="Food insight">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                              <path d="M7 2v20"/>
                              <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                            </svg>
                          </button>
                          <button type="button" class="log-list-edit-btn"
                                  (click)="editLog(log); $event.stopPropagation()"
                                  aria-label="Edit">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor"
                                    stroke-width="1.5" stroke-linejoin="round"/>
                            </svg>
                          </button>
                          <button type="button" class="log-list-delete-btn"
                                  (click)="confirmDeleteLog(log); $event.stopPropagation()"
                                  aria-label="Delete">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                                    stroke="currentColor" stroke-width="1.4"
                                    stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="log-list-title-reveal" *ngIf="isTitleExpanded(log.id) && log.title">
                        {{ log.title }}
                      </div>
                    </div>
                  </ng-container>

                  <!-- Inline edit mode -->
                  <div class="log-list-inline" *ngIf="inlineEditId === log.id"
                       (click)="$event.stopPropagation()">
                    <textarea class="inline-title-input"
                              [(ngModel)]="inlineEdit.title"
                              maxlength="300"
                              rows="2"
                              placeholder="Activity description"
                              (keydown)="onInlineKeydown($event, log)"></textarea>
                    <app-log-type-select
                      [logTypes]="logTypes"
                      [selectedId]="inlineEdit.logTypeId"
                      (selectedIdChange)="inlineEdit.logTypeId = $event">
                    </app-log-type-select>
                    <div class="inline-time-row">
                      <span class="inline-time-label">Start</span>
                      <button type="button" class="btn-time-step"
                              (click)="adjustTime('startAt', -10); $event.stopPropagation()">−10m</button>
                      <input class="inline-time-input" type="time" [(ngModel)]="inlineEdit.startAt">
                      <button type="button" class="btn-time-step"
                              (click)="adjustTime('startAt', 10); $event.stopPropagation()">+10m</button>
                    </div>
                    <div class="inline-time-row" *ngIf="log.entryType !== 'point'">
                      <span class="inline-time-label">End</span>
                      <button type="button" class="btn-time-step"
                              (click)="adjustTime('endAt', -10); $event.stopPropagation()">−10m</button>
                      <input class="inline-time-input" type="time" [(ngModel)]="inlineEdit.endAt">
                      <button type="button" class="btn-time-step"
                              (click)="adjustTime('endAt', 10); $event.stopPropagation()">+10m</button>
                    </div>
                    <div class="inline-action-row">
                      <button type="button" class="btn-inline-save"
                              (click)="saveInlineEdit(log); $event.stopPropagation()"
                              [disabled]="inlineSaving">
                        {{ inlineSaving ? '…' : '✓ Save' }}
                      </button>
                      <button type="button" class="btn-inline-cancel"
                              (click)="cancelInlineEdit(); $event.stopPropagation()">✕ Cancel</button>
                      <button type="button" class="btn-inline-fullform"
                              (click)="editLog(log); cancelInlineEdit(); $event.stopPropagation()"
                              title="Open full edit form">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor"
                                stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                </div><!-- /tl-card -->
              </div><!-- /swipe-wrap -->

              <!-- Food insight panel (outside swipe-wrap, inside tl-item) -->
              <div class="insight-panel" *ngIf="openInsightId === log.id && isFoodLog(log)"
                   (click)="$event.stopPropagation()">
                <!-- Loading -->
                <div class="insight-loading" *ngIf="insightState(log.id) === 'loading'">
                  <div class="insight-spinner"></div>
                  <span>Fetching analysis…</span>
                </div>
                <!-- Pending (computed but not yet stored) -->
                <div class="insight-pending" *ngIf="insightState(log.id) === 'pending'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                  Analysis is still running — check back in a moment.
                </div>
                <!-- No insight found -->
                <div class="insight-generate-row" *ngIf="insightState(log.id) === 'none'">
                  <span class="insight-generate-hint">No analysis yet.</span>
                  <button class="insight-generate-btn"
                          (click)="generateInsight(log, $event)"
                          [disabled]="generatingLogIds.has(log.id)"
                          type="button">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Generate
                  </button>
                </div>
                <!-- Error -->
                <div class="insight-generate-row insight-generate-row--error" *ngIf="insightState(log.id) === 'error'">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span class="insight-generate-hint">Analysis failed.</span>
                  <button class="insight-generate-btn"
                          (click)="generateInsight(log, $event)"
                          [disabled]="generatingLogIds.has(log.id)"
                          type="button">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Retry
                  </button>
                </div>
                <!-- Analysis text -->
                <div class="insight-body" *ngIf="insightState(log.id) === 'done'">
                  <div class="insight-header">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                      <path d="M7 2v20"/>
                      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                    </svg>
                    Food Analysis
                    <button class="insight-regen-btn"
                            (click)="generateInsight(log, $event)"
                            [disabled]="generatingLogIds.has(log.id)"
                            title="Re-generate analysis"
                            type="button">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    </button>
                  </div>
                  <div class="insight-text insight-markdown" [innerHTML]="insightHtml(log.id)"></div>
                </div>
              </div><!-- /insight-panel -->

            </div><!-- /tl-item -->
            </ng-container><!-- /collapse -->
            </ng-container><!-- /group -->
          </div><!-- /log-list -->

          <div class="log-list-empty" *ngIf="!isLoading && logs.length === 0">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="15" stroke="var(--text-muted)"
                      stroke-width="1.5" stroke-dasharray="4 3"/>
              <path d="M18 11v7l4 3" stroke="var(--text-muted)"
                    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p>No logs recorded for this day.</p>
            <span>Use the Time Line view or Log Now to get started.</span>
          </div>

    </div><!-- /log-list-section -->
  `,
})
export class LoggerViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @ViewChild('dayStripRef') dayStripRef!: ElementRef<HTMLDivElement>;

  // ── Derived from AppStateService ──────────────────────────────────
  logs:           LogEntry[]         = [];
  logTypes:       LogType[]          = [];
  selectedDate:   Date               = new Date();
  selectedDateStr = '';
  isToday         = false;
  isLoading       = false;
  isAuthenticated = false;
  activeLog       = this.appState.activeLog$.value;
  dayMetadata     = this.appState.dayMetadata$.value;
  notesCount      = 0;
  notesList:      NoteItem[] = [];
  notesExpanded   = false;
  highlightedLogId: string | null    = null;
  metricLogIds:     Set<string>|null = null;
  activeLogElapsedStr = '00:00';
  activeLogPlannedPct = 0;

  // ── Day type ──────────────────────────────────────────────────────
  @ViewChild('daytypeWrap') daytypeWrapRef?: ElementRef;
  dayTypeDropdownOpen = false;
  dayTypePanelTop = 0;
  dayTypePanelRight = 0;
  readonly dayTypeOptions: { value: DayType; label: string; color: string }[] = [
    { value: 'working',    label: 'Working Day', color: '#4ade80' },
    { value: 'wfh',        label: 'WFH',         color: '#facc15' },
    { value: 'holiday',    label: 'Holiday',      color: '#60a5fa' },
    { value: 'paid_leave', label: 'Paid Leave',   color: '#fb923c' },
    { value: 'sick_leave', label: 'Sick Leave',   color: '#f87171' },
  ];

  get dayTypeColor(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.color ?? '#4ade80';
  }

  get dayTypePastel(): string {
    const c = this.dayTypeColor;
    return `color-mix(in srgb, ${c} 28%, var(--bg-card))`;
  }

  get dayTypeLabel(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.label ?? 'Working Day';
  }

  setDayType(dayType: DayType): void { this.appState.setDayType(dayType); }

  toggleDayTypeDropdown(event: Event): void {
    event.stopPropagation();
    if (!this.dayTypeDropdownOpen && this.daytypeWrapRef) {
      const rect: DOMRect = this.daytypeWrapRef.nativeElement.getBoundingClientRect();
      this.dayTypePanelTop = rect.bottom + 6;
      this.dayTypePanelRight = window.innerWidth - rect.right;
    }
    this.dayTypeDropdownOpen = !this.dayTypeDropdownOpen;
  }

  // ── Hero date getters ─────────────────────────────────────────────
  get heroDateDayNum(): string {
    return String(this.selectedDate.getDate());
  }

  get heroDateDaySuffix(): string {
    const d = this.selectedDate.getDate();
    const m = d % 100;
    return (m >= 11 && m <= 13) ? 'th'
         : d % 10 === 1 ? 'st' : d % 10 === 2 ? 'nd' : d % 10 === 3 ? 'rd' : 'th';
  }

  get heroDateOpacity(): number {
    return Math.max(0, 1 - Math.abs(this.dateSlideX) / 60);
  }

  get heroDateMonthYear(): string {
    return this.selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get heroDateWeekday(): string {
    return this.selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  }

  get prevDayLabel(): string {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  get nextDayLabel(): string {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ── Day scroll strip ──────────────────────────────────────────────
  // Anchor stays stable; only shifts ±1 day when selected date goes outside ±5 of anchor.
  private _stripAnchorDate: Date = new Date(this.selectedDate);

  // Index (0–30) of the committed selected date within the 31-day strip window.
  // Uses local-midnight dates to avoid time-component / DST off-by-one errors.
  get selectedStripIndex(): number {
    const a = this._stripAnchorDate;
    const s = this.selectedDate;
    const anchorMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const selMid    = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const diffDays  = Math.round((selMid.getTime() - anchorMid.getTime()) / 86400000);
    return Math.max(0, Math.min(30, diffDays + 15));
  }

  // Holds the target strip index during the commit handoff window so the indicator
  // does not bounce back to the old slot before selectedDate catches up.
  private _pendingStripIndex: number | null = null;

  // Pixel left-offset of the floating indicator inside the scrollable strip content.
  get indicatorLeft(): number {
    const ITEM_W = 34; // 32px item + 2px gap
    const PAD_L  = 28; // strip padding-left
    // During an active user gesture apply the live proportional offset.
    if (this.dateSwipeActive && Math.abs(this.dateSlideX) <= 100) {
      const idx      = this._pendingStripIndex ?? this.selectedStripIndex;
      const basePx   = PAD_L + idx * ITEM_W;
      const maxRight = this.isToday ? 0 : ITEM_W;
      const rawOff   = -(this.dateSlideX / 45) * ITEM_W;
      const swipePx  = Math.max(-ITEM_W, Math.min(maxRight, rawOff));
      return basePx + swipePx;
    }
    // At rest (or during hero-text exit animation): use pending or committed index.
    const idx = this._pendingStripIndex ?? this.selectedStripIndex;
    return PAD_L + idx * ITEM_W;
  }

  get scrollDays(): Array<{ date: Date; dayNum: number; dowLabel: string; isSelected: boolean; isToday: boolean; isFuture: boolean }> {
    const today    = AppStateService.logicalToday();
    const todayStr = this._localDateKey(today);
    const selStr   = this._localDateKey(this.selectedDate);
    const result   = [];
    for (let i = -15; i <= 15; i++) {
      const d = new Date(this._stripAnchorDate);
      d.setDate(d.getDate() + i);
      const dStr = this._localDateKey(d);
      result.push({
        date:       d,
        dayNum:     d.getDate(),
        dowLabel:   d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        isSelected: dStr === selStr,
        isToday:    dStr === todayStr,
        isFuture:   dStr > todayStr,
      });
    }
    return result;
  }

  // Shift anchor one day at a time until newDate is within ±14 of anchor.
  private _updateStripAnchor(newDate: Date): void {
    const newStr = this._localDateKey(newDate);
    let shifted  = false;
    for (let i = 0; i < 30; i++) {
      const lo    = new Date(this._stripAnchorDate);
      lo.setDate(lo.getDate() - 14);
      const hi    = new Date(this._stripAnchorDate);
      hi.setDate(hi.getDate() + 14);
      if (newStr < this._localDateKey(lo)) {
        const a = new Date(this._stripAnchorDate);
        a.setDate(a.getDate() - 1);
        this._stripAnchorDate = a;
        shifted = true;
      } else if (newStr > this._localDateKey(hi)) {
        const a = new Date(this._stripAnchorDate);
        a.setDate(a.getDate() + 1);
        this._stripAnchorDate = a;
        shifted = true;
      } else {
        break;
      }
    }
    if (shifted) {
      setTimeout(() => this.scrollDayStripToCenter(), 0);
    }
  }

  onScrollDayClick(day: { date: Date; isFuture: boolean }): void {
    if (day.isFuture) return;
    this.appState.selectDate(day.date);
  }

  scrollDayStripToCenter(): void {
    const strip = this.dayStripRef?.nativeElement;
    if (!strip) return;
    const items = strip.querySelectorAll<HTMLElement>('.day-strip-item');
    const center = items[15];
    if (!center) return;
    strip.scrollLeft = center.offsetLeft - strip.clientWidth / 2 + center.offsetWidth / 2;
  }

  trackByDayDate(_i: number, d: { date: Date }): number { return d.date.getTime(); }

  // ── Log list ──────────────────────────────────────────────────────
  logSortOrder: 'asc' | 'desc' = 'desc';
  filterDomain     = '';
  domainDropdownOpen = false;

  get availableDomains(): string[] {
    const seen = new Set<string>();
    for (const log of this.logs) {
      const d = log.logType?.domain;
      if (d) seen.add(d);
    }
    return [...seen].sort();
  }

  get sortedLogs(): LogEntry[] {
    const ordered = this.logSortOrder === 'asc' ? this.logs : [...this.logs].reverse();
    if (!this.filterDomain) return ordered;
    return ordered.filter(l => l.logType?.domain === this.filterDomain);
  }

  get filteredCount(): number { return this.sortedLogs.length; }

  private periodOf(startAt: string): string {
    const h = parseInt(startAt.split(':')[0], 10);
    if (h < 6)             return 'Late Night';
    if (h >= 6  && h < 12) return 'Morning';
    if (h >= 12 && h < 17) return 'Afternoon';
    if (h >= 17 && h < 21) return 'Evening';
    return 'Night';
  }

  get logGroups(): { period: string; logs: LogEntry[] }[] {
    const ascOrder = ['Late Night', 'Morning', 'Afternoon', 'Evening', 'Night'];
    const order = this.logSortOrder === 'asc' ? ascOrder : [...ascOrder].reverse();
    const map = new Map<string, LogEntry[]>();
    for (const log of this.sortedLogs) {
      const p = this.periodOf(log.startAt);
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(log);
    }
    return order.filter(p => map.has(p)).map(p => ({ period: p, logs: map.get(p)! }));
  }

  trackByGroupPeriod(_i: number, g: { period: string }): string { return g.period; }

  private collapsedGroups = new Set<string>();
  isGroupCollapsed(period: string): boolean { return this.collapsedGroups.has(period); }
  toggleGroupCollapse(period: string): void {
    if (this.collapsedGroups.has(period)) {
      this.collapsedGroups.delete(period);
    } else {
      this.collapsedGroups.add(period);
    }
    this.cdr.markForCheck();
  }

  toggleNotesExpand(): void {
    if (this.notesList.length > 0) {
      this.notesExpanded = !this.notesExpanded;
    } else {
      this.appState.openNotesRequested$.next(undefined);
    }
    this.cdr.markForCheck();
  }

  toggleLogSort(): void { this.logSortOrder = this.logSortOrder === 'asc' ? 'desc' : 'asc'; }
  setDomainFilter(domain: string): void { this.filterDomain = domain; }

  openNotesAtNote(noteId: string): void {
    this.appState.openNotesRequested$.next(noteId);
  }

  // ── Food insights ─────────────────────────────────────────────────
  private readonly FOOD_LOG_NAMES = ['breakfast', 'lunch', 'dinner', 'food intake'];
  openInsightId:    string | null = null;
  insightCache      = new Map<string, FoodInsightRecord | 'loading' | 'error'>();
  generatingLogIds  = new Set<string>();

  isFoodLog(log: LogEntry): boolean {
    if (log.logType?.domain !== 'personal') return false;
    return this.FOOD_LOG_NAMES.includes((log.logType?.name ?? '').toLowerCase().trim());
  }

  toggleInsight(log: LogEntry, event: Event): void {
    event.stopPropagation();
    if (this.openInsightId === log.id) {
      this.openInsightId = null;
      this.cdr.detectChanges();
      return;
    }
    this.openInsightId = log.id;
    if (!this.insightCache.has(log.id)) {
      this.insightCache.set(log.id, 'loading');
      this.cdr.detectChanges();
      this.foodInsightSvc.getByLogId(log.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: rec => {
          this.insightCache.set(log.id, rec ?? 'error');
          this.cdr.detectChanges();
        },
        error: () => {
          this.insightCache.set(log.id, 'error');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.cdr.detectChanges();
    }
  }

  insightState(logId: string): 'loading' | 'done' | 'pending' | 'error' | 'none' {
    const v = this.insightCache.get(logId);
    if (!v)                            return 'none';
    if (v === 'loading')               return 'loading';
    if (v === 'error')                 return 'error';
    return (v as FoodInsightRecord).status === 'done'    ? 'done'
         : (v as FoodInsightRecord).status === 'pending' ? 'pending'
         : 'error';
  }

  insightHtml(logId: string): SafeHtml {
    const v = this.insightCache.get(logId);
    if (!v || v === 'loading' || v === 'error') return '';
    const raw = (v as FoodInsightRecord).analysis || '';
    const html = marked.parse(raw) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  generateInsight(log: LogEntry, event: Event): void {
    event.stopPropagation();
    if (this.generatingLogIds.has(log.id)) return;
    this.generatingLogIds.add(log.id);
    this.insightCache.set(log.id, 'loading');
    this.cdr.detectChanges();
    this.foodInsightSvc.generate(log.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: rec => {
        this.generatingLogIds.delete(log.id);
        this.insightCache.set(log.id, rec ?? 'error');
        this.cdr.detectChanges();
      },
      error: () => {
        this.generatingLogIds.delete(log.id);
        this.insightCache.set(log.id, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ── Title expand (chip click) ─────────────────────────────────────
  private expandedTitleLogIds = new Set<string>();

  isTitleExpanded(logId: string): boolean {
    return this.expandedTitleLogIds.has(logId);
  }

  toggleTitleExpand(logId: string, event: Event): void {
    event.stopPropagation();
    if (this.expandedTitleLogIds.has(logId)) {
      this.expandedTitleLogIds.delete(logId);
    } else {
      this.expandedTitleLogIds.add(logId);
    }
    this.cdr.markForCheck();
  }

  // ── Inline edit ───────────────────────────────────────────────────
  inlineEditId: string | null = null;
  inlineEdit = { title: '', startAt: '', endAt: '', logTypeId: '' };
  private inlineEditOriginal = { title: '', startAt: '', endAt: '', logTypeId: '' };
  inlineSaving = false;

  private get hasInlineEditChanges(): boolean {
    return this.inlineEdit.title     !== this.inlineEditOriginal.title
        || this.inlineEdit.startAt   !== this.inlineEditOriginal.startAt
        || this.inlineEdit.endAt     !== this.inlineEditOriginal.endAt
        || this.inlineEdit.logTypeId !== this.inlineEditOriginal.logTypeId;
  }


  // ── Date swipe ────────────────────────────────────────────────────
  dateSlideX     = 0;
  dateSwipeActive = false;
  private _dateSwipeStartX = 0;

  // ── Swipe ─────────────────────────────────────────────────────────
  swipeLogId:      string | null = null;
  swipeTranslateX  = 0;
  swipeSnapping    = false;
  private swipeStartX        = 0;
  private swipeStartY        = 0;
  private swipeIsHorizontal: boolean | null = null;


  // ── Wrap-up ───────────────────────────────────────────────────────
  private wrapUpDismissedDate = '';

  get todayGaps(): Array<{ start: string; end: string; mins: number }> {
    const sorted = this.logs
      .filter(l => l.entryType === 'range' && l.startAt && l.endAt)
      .sort((a, b) => this._timeToMins(a.startAt) - this._timeToMins(b.startAt));
    const gaps: Array<{ start: string; end: string; mins: number }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapMins = this._timeToMins(sorted[i + 1].startAt) - this._timeToMins(sorted[i].endAt!);
      if (gapMins >= 15) gaps.push({ start: sorted[i].endAt!, end: sorted[i + 1].startAt, mins: gapMins });
    }
    return gaps;
  }

  get showWrapUpBanner(): boolean {
    return this.isToday
      && new Date().getHours() >= 17
      && this.todayGaps.length > 0
      && !this.wrapUpDismissedDate.startsWith(this._localDateKey(new Date()));
  }

  get totalGapLabel(): string {
    const total = this.todayGaps.reduce((s, g) => s + g.mins, 0);
    const h = Math.floor(total / 60), m = total % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }

  dismissWrapUp(): void { this.wrapUpDismissedDate = this._localDateKey(new Date()); }

  private _localDateKey(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ── Log operations ────────────────────────────────────────────────
  editLog(log: LogEntry): void {
    this.appState.openLogFormRequested$.next({
      startTime: log.startAt, endTime: log.endAt ?? '01:00', editEntry: log
    });
  }

  confirmDeleteLog(log: LogEntry): void {
    this.cancelInlineEdit();
    const label = log.title || log.logType?.name || 'this log';
    this.appState.confirmDialogRequested$.next({
      title:   'Delete log',
      message: `Delete "${label}"?`,
      detail:  'This action cannot be undone.',
      okLabel: 'Delete',
      onConfirm: () => {
        this.logService.deleteLog(this.selectedDate, log.id).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => this.appState.reloadLogs(), error: () => {}
        });
      }
    });
  }

  // ── Inline edit ───────────────────────────────────────────────────
  private closeInsight(): void {
    if (this.openInsightId !== null) {
      this.openInsightId = null;
    }
  }

  onLogItemClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.closeInsight();
    if (this.inlineEditId === log.id) return;
    this.inlineEditId = log.id;
    this.inlineEdit   = {
      title:     log.title,
      startAt:   log.startAt,
      endAt:     log.endAt ?? '',
      logTypeId: log.logType?.id ?? ''
    };
    this.inlineEditOriginal = { ...this.inlineEdit };
    this.appState.highlightedLogId$.next(log.id);
  }

  cancelInlineEdit(): void { this.inlineEditId = null; }

  saveInlineEdit(log: LogEntry): void {
    if (this.inlineSaving) return;
    this.inlineSaving = true;
    const payload = log.entryType === 'point'
      ? { title: this.inlineEdit.title, logTypeId: this.inlineEdit.logTypeId, entryType: 'point' as const, pointTime: this.inlineEdit.startAt }
      : { title: this.inlineEdit.title, logTypeId: this.inlineEdit.logTypeId, startTime: this.inlineEdit.startAt, endTime: this.inlineEdit.endAt };
    this.logService.updateLog(this.selectedDate, log.id, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => { this.inlineSaving = false; this.inlineEditId = null; this.appState.reloadLogs(); this.cdr.markForCheck(); },
      error: () => { this.inlineSaving = false; alert('Failed to save changes.'); this.cdr.markForCheck(); }
    });
  }

  onInlineKeydown(event: KeyboardEvent, log: LogEntry): void {
    if (event.key === 'Enter')  { event.preventDefault(); this.saveInlineEdit(log); }
    if (event.key === 'Escape') { this.cancelInlineEdit(); }
  }

  adjustTime(field: 'startAt' | 'endAt', deltaMins: number): void {
    const val = this.inlineEdit[field];
    if (!val) return;
    const [h, m] = val.split(':').map(Number);
    const clamped = Math.max(0, Math.min(1439, h * 60 + m + deltaMins));
    this.inlineEdit[field] = `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
  }

  // ── Swipe ─────────────────────────────────────────────────────────
  onSwipeStart(log: LogEntry, e: TouchEvent): void {
    if (this.inlineEditId) return;
    this.swipeLogId        = log.id;
    this.swipeStartX       = e.touches[0].clientX;
    this.swipeStartY       = e.touches[0].clientY;
    this.swipeTranslateX   = 0;
    this.swipeSnapping     = false;
    this.swipeIsHorizontal = null;
  }

  onSwipeMove(log: LogEntry, e: TouchEvent): void {
    if (this.swipeLogId !== log.id) return;
    const dx = e.touches[0].clientX - this.swipeStartX;
    const dy = e.touches[0].clientY - this.swipeStartY;
    if (this.swipeIsHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      this.swipeIsHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!this.swipeIsHorizontal) return;
    e.preventDefault();
    this.swipeTranslateX = Math.max(-120, Math.min(120, dx));
  }

  onSwipeEnd(log: LogEntry, _e: TouchEvent): void {
    if (this.swipeLogId !== log.id || !this.swipeIsHorizontal) { this.swipeLogId = null; return; }
    const action = this.swipeTranslateX > 72 ? 'edit' : this.swipeTranslateX < -72 ? 'delete' : null;
    this.swipeSnapping   = true;
    this.swipeTranslateX = 0;
    if (action) this.closeInsight();
    setTimeout(() => {
      this.swipeLogId    = null;
      this.swipeSnapping = false;
      if (action === 'edit')   this.onLogItemClick(log, new MouseEvent('click'));
      if (action === 'delete') this.confirmDeleteLog(log);
      this.cdr.markForCheck();
    }, 240);
  }

  // ── Date swipe handlers ───────────────────────────────────────────
  onDateSwipeStart(e: TouchEvent): void {
    this._dateSwipeStartX = e.touches[0].clientX;
    this.dateSwipeActive  = true;
    this.dateSlideX       = 0;
    this.cdr.markForCheck();
  }

  onDateSwipeMove(e: TouchEvent): void {
    if (!this.dateSwipeActive) return;
    const dx = e.touches[0].clientX - this._dateSwipeStartX;
    if (Math.abs(dx) > 8) e.preventDefault();
    this.dateSlideX = Math.max(-100, Math.min(100, dx));
    this.cdr.markForCheck();
  }

  onDateSwipeEnd(): void {
    if (!this.dateSwipeActive) return;
    const dx = this.dateSlideX;
    this.dateSwipeActive = false;

    if (dx > 45) {
      // Pin indicator to prev-day slot immediately — prevents bounce-back animation.
      this._pendingStripIndex = Math.max(0, this.selectedStripIndex - 1);
      this.dateSlideX = 150;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.appState.prevDay();   // selectedDate updates; selectedStripIndex now equals _pendingStripIndex
        this._pendingStripIndex = null;
        this.dateSwipeActive = true;
        this.dateSlideX = -150;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.dateSwipeActive = false;
          this.dateSlideX = 0;
          this.cdr.markForCheck();
        }, 16);
      }, 200);
    } else if (dx < -45 && !this.appState.isToday) {
      // Pin indicator to next-day slot immediately.
      this._pendingStripIndex = Math.min(12, this.selectedStripIndex + 1);
      this.dateSlideX = -150;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.appState.nextDay();   // selectedDate updates; selectedStripIndex now equals _pendingStripIndex
        this._pendingStripIndex = null;
        this.dateSwipeActive = true;
        this.dateSlideX = 150;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.dateSwipeActive = false;
          this.dateSlideX = 0;
          this.cdr.markForCheck();
        }, 16);
      }, 200);
    } else {
      this.dateSlideX = 0;
      this.cdr.markForCheck();
    }
  }

  onCardHighlight(ids: string[] | null): void {
    this.appState.metricLogIds$.next(ids ? new Set(ids) : null);
    this.cdr.markForCheck();
  }

  // ── Utilities ─────────────────────────────────────────────────────
  getDuration(log: LogEntry): string {
    if (!log.startAt || !log.endAt || log.entryType === 'point') return '';
    const diff = this._timeToMins(log.endAt) - this._timeToMins(log.startAt);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60), m = diff % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }

  shortDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  currentTimeStr(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }

  private _timeToMins(t: string): number {
    const [h, m] = (t ?? '00:00').split(':').map(Number);
    return h * 60 + m;
  }

  domainCount(domain: string): number {
    return this.logs.filter(l => l.logType?.domain === domain).length;
  }

  domainColor(domain: string): string {
    const map: Record<string, string> = {
      work: '#5A9CB5',
      personal: '#F2A65A',
      family: '#9B6DBF',
    };
    return map[domain] ?? '#9B9B9B';
  }

  // ── TrackBy helpers ───────────────────────────────────────────────
  trackByIndex(index: number): number { return index; }
  trackByLogId(_i: number, log: LogEntry): string { return log.id; }

  // ── Global click: close dropdowns, insight panel, and inline edit ──
  @HostListener('document:click')
  onDocumentClick(): void {
    let changed = false;
    if (this.dayTypeDropdownOpen)    { this.dayTypeDropdownOpen  = false; changed = true; }
    if (this.domainDropdownOpen)     { this.domainDropdownOpen   = false; changed = true; }
    if (this.openInsightId !== null) { this.openInsightId = null; changed = true; }
    if (this.inlineEditId !== null)  { this.cancelInlineEdit();           changed = true; }
    if (changed) this.cdr.markForCheck();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  constructor(
    public  appState:          AppStateService,
    private logService:        LogService,
    private _dayLevelService:  DayLevelService,
    private foodInsightSvc:    FoodInsightService,
    private cdr:               ChangeDetectorRef,
    private sanitizer:         DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.appState.logs$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.logs = v; this.cdr.markForCheck();
    });
    this.appState.inlineLogTypes$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.logTypes = v; this.cdr.markForCheck();
    });
    this.appState.selectedDate$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.selectedDate    = v;
      this.selectedDateStr = this.appState.selectedDateStr;
      this.isToday         = this.appState.isToday;
      this.filterDomain    = '';
      this.openInsightId   = null;
      this.insightCache.clear();
      this.expandedTitleLogIds.clear();
      this._updateStripAnchor(v);
      this.cdr.markForCheck();
    });
    this.appState.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.isLoading = v; this.cdr.markForCheck();
    });
    this.appState.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.isAuthenticated = v; this.cdr.markForCheck();
    });
    this.appState.activeLog$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.activeLog = v; this.cdr.markForCheck();
    });
    this.appState.dayMetadata$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.dayMetadata = v; this.cdr.markForCheck();
    });
    this.appState.notesCount$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.notesCount = v; this.cdr.markForCheck();
    });
    this.appState.notesList$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.notesList = v; this.notesExpanded = false; this.cdr.markForCheck();
    });
    this.appState.highlightedLogId$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.highlightedLogId = v; this.cdr.markForCheck();
    });
    this.appState.metricLogIds$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.metricLogIds = v; this.cdr.markForCheck();
    });
    this.appState.activeLogTick$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.activeLogElapsedStr = this.appState.activeLogElapsedStr;
      this.activeLogPlannedPct = this.appState.activeLogPlannedPct;
      this.cdr.markForCheck();
    });

    if (!this.appState.inlineLogTypes$.value.length) {
      this.appState.loadLogTypes();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scrollDayStripToCenter(), 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
