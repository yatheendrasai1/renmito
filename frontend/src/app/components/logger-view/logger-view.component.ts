import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { TimelineComponent, DragSelection } from '../timeline/timeline.component';

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
    TimelineComponent,
  ],
  styles: [`:host { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .date-title-row { display: flex; align-items: center; gap: 6px; }
    .date-swipe-zone { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; min-width: 0; user-select: none; touch-action: pan-y; }
    .date-above-bar { font-size: 13px; font-weight: 700; color: var(--text-primary); line-height: 1; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; will-change: transform; }
    .date-above-bar.date-animated { transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1); }
    .date-dropdown-icon { color: var(--text-muted); opacity: 0.75; flex-shrink: 0; }
    .action-btns-row { display: flex; gap: 8px; }
    .action-btns-row .add-point-wrap { flex: 1; }
    .action-btns-row .btn-add-entry { flex: 1; }
    .domain-filter-row { display: flex; gap: 6px; flex-wrap: nowrap; overflow-x: auto; margin-top: -6px; padding-bottom: 2px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
    .domain-filter-row::-webkit-scrollbar { display: none; }
    .domain-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 9px; border-radius: 6px; border: 1px solid var(--border-subtle, rgba(128,128,128,0.2)); border-left: 3px solid var(--chip-color, var(--border)); background: var(--bg-card); color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.14s, color 0.14s, border-color 0.14s; white-space: nowrap; flex-shrink: 0; }
    .domain-chip:hover { background: color-mix(in srgb, var(--chip-color, #9B9B9B) 8%, var(--bg-card)); color: var(--text-primary); }
    .domain-chip--active { background: color-mix(in srgb, var(--chip-color, #9B9B9B) 15%, var(--bg-card)); border-color: var(--chip-color, #9B9B9B); border-left-color: var(--chip-color, #9B9B9B); color: var(--chip-color, var(--text-primary)); font-weight: 600; }
    .domain-chip--all { --chip-color: var(--text-muted); }
    .domain-chip-badge { font-size: 10px; font-weight: 700; padding: 0 5px; min-width: 16px; height: 16px; background: color-mix(in srgb, var(--chip-color, #9B9B9B) 20%, var(--bg-surface)); color: var(--text-muted); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .domain-chip--active .domain-chip-badge { background: var(--chip-color, #9B9B9B); color: #fff; }
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
    .insight-body { padding-bottom: 4px; }
    .insight-text {
      margin: 0; padding: 0 14px 12px;
      font-family: inherit; font-size: 0.78rem;
      line-height: 1.65; color: var(--text-secondary, #8090A8);
      white-space: pre-wrap; word-break: break-word;
    }
  `],
  template: `
    <!-- ── Day-type pill · Prev · Date (swipeable) · Next · Today ── -->
    <div class="date-title-row">
      <div class="hdr-dt" *ngIf="dayMetadata">
        <button class="hdr-dt-trigger"
                (click)="dayTypeDropdownOpen = !dayTypeDropdownOpen; $event.stopPropagation()"
                [attr.aria-expanded]="dayTypeDropdownOpen"
                [style.background]="dayTypePastel">
          <span class="hdr-dt-dot" [style.background]="dayTypeColor"></span>
        </button>
        <div class="hdr-dt-panel" *ngIf="dayTypeDropdownOpen" (click)="$event.stopPropagation()">
          <button *ngFor="let opt of dayTypeOptions"
                  class="hdr-dt-option"
                  [class.hdr-dt-option--active]="dayMetadata?.dayType === opt.value"
                  (click)="setDayType(opt.value); dayTypeDropdownOpen = false">
            <span class="hdr-dt-dot" [style.background]="opt.color"></span>
            {{ opt.label }}
          </button>
        </div>
      </div>

      <button class="date-bar-btn" (click)="appState.prevDay()"
              title="Previous day" aria-label="Previous day">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      <div class="date-swipe-zone"
           (touchstart)="onDateSwipeStart($event)"
           (touchmove)="onDateSwipeMove($event)"
           (touchend)="onDateSwipeEnd()">
        <span class="date-above-bar"
              [class.date-animated]="!dateSwipeActive"
              [style.transform]="'translateX(' + dateSlideX + 'px)'"
              (click)="appState.openCalendarRequested$.next()">
          {{ appState.dateShortLabel }}
          <svg class="date-dropdown-icon" width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </div>

      <button class="date-bar-btn" (click)="appState.nextDay()"
              [disabled]="appState.isToday"
              title="Next day" aria-label="Next day">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      <button class="date-bar-btn date-bar-btn--today"
              [disabled]="appState.isToday"
              (click)="appState.goToToday()" title="Go to today" aria-label="Go to today">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7" cy="7" r="5.5" fill="currentColor"/>
        </svg>
      </button>

      <button class="date-bar-btn" (click)="appState.openImportantLogsRequested$.next()" title="Important logs" aria-label="Important logs">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
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
        <button class="notes-col-edit-btn" (click)="appState.openNotesRequested$.next()" title="Open notes">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="notes-preview" *ngIf="notesExpanded && notesList.length > 0">
        <div class="notes-preview-item" *ngFor="let note of notesList">{{ note.content }}</div>
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

    <!-- ── Embedded Timeline (vertical, compact) ──────── -->
    <app-timeline
      #embeddedTimelineRef
      [logs]="logs"
      [selectedDate]="selectedDate"
      [highlightedLogId]="highlightedLogId"
      [metricLogIds]="metricLogIds"
      [collapsible]="false"
      [scrollHeight]="'220px'"
      (createLogClicked)="onTimelineCreate($event)"
      (logClicked)="onTimelineLogClick($event)"
      (mergePointsSelected)="onTimelineMerge($event)"
    ></app-timeline>

    <!-- ── Action Buttons ────────────────────────────── -->
    <div class="action-btns-row" *ngIf="!isLoading">
      <button class="btn-add-entry" (click)="openLogNow()">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        Add log
      </button>
      <div class="add-point-wrap"
           (pointerdown)="onAddPointPointerDown($event)"
           (pointerup)="onAddPointPointerUp()"
           (pointerleave)="onAddPointPointerUp()"
           (click)="onAddPointClick($event)">
        <button class="btn-add-entry" style="pointer-events:none; width:100%">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.6"/>
            <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
          </svg>
          Add point
        </button>
        <div class="add-point-backdrop" *ngIf="addPointMenuOpen" (click)="closeAddPointMenu(); $event.stopPropagation()"></div>
        <div class="add-point-menu" *ngIf="addPointMenuOpen" (click)="$event.stopPropagation()">
          <button class="add-point-menu-item" (click)="addPointLogNow(); closeAddPointMenu(); $event.stopPropagation()">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/>
              <path d="M8 5v3l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <div class="add-point-menu-text">
              <span>Log now</span>
              <span class="add-point-menu-sub">Stamp at {{ currentTimeStr() }}</span>
            </div>
          </button>
          <button class="add-point-menu-item" (click)="openAddPoint(); closeAddPointMenu(); $event.stopPropagation()">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M5 3V1.5M11 3V1.5M2 7h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <div class="add-point-menu-text">
              <span>Log time</span>
              <span class="add-point-menu-sub">Pick a time</span>
            </div>
          </button>
        </div>
      </div>
      <button class="btn-add-entry btn-add-entry--activity" (click)="appState.startTimerRequested$.next()">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4.5 3.5l5 2.5-5 2.5V3.5z" fill="currentColor"/>
        </svg>
        Start activity
      </button>
    </div>

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
      <h2 class="section-title">Logs for the day</h2>
      <span class="log-count" *ngIf="logs.length > 0">
        <ng-container *ngIf="filterDomain; else noFilter">
          {{ filteredCount }}/{{ logs.length }}
        </ng-container>
        <ng-template #noFilter>{{ logs.length }} entr{{ logs.length === 1 ? 'y' : 'ies' }}</ng-template>
      </span>
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

    <!-- ── Domain filter chips ─────────────────────────────────────── -->
    <div class="domain-filter-row" *ngIf="!isLoading && availableDomains.length > 1">
      <button class="domain-chip domain-chip--all"
              [class.domain-chip--active]="filterDomain === ''"
              (click)="setDomainFilter('')">
        All
        <span class="domain-chip-badge">{{ logs.length }}</span>
      </button>
      <button *ngFor="let d of availableDomains"
              class="domain-chip"
              [class.domain-chip--active]="filterDomain === d"
              [style.--chip-color]="domainColor(d)"
              (click)="setDomainFilter(d)">
        {{ d }}
        <span class="domain-chip-badge">{{ domainCount(d) }}</span>
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
                    <div class="tl-card-header">
                      <div class="tl-card-body">
                        <div class="log-list-label">{{ log.title }}</div>
                        <div class="log-list-meta">
                          <span class="log-list-time">
                            <ng-container *ngIf="log.entryType === 'point'">⏱ {{ log.startAt }}</ng-container>
                            <ng-container *ngIf="log.entryType !== 'point'">
                              <span *ngIf="log.date !== selectedDateStr" class="log-prev-day-date">{{ shortDate(log.date) }}, </span>{{ log.startAt }} – <span *ngIf="log.endDate && log.endDate !== log.date && log.endDate !== selectedDateStr" class="log-prev-day-date">{{ shortDate(log.endDate) }}, </span>{{ log.endAt }}
                            </ng-container>
                          </span>
                          <span class="log-list-type-badge"
                                [style.background]="(log.logType?.color ?? '#9B9B9B') + '22'"
                                [style.color]="log.logType?.color ?? '#9B9B9B'">
                            {{ log.logType?.name ?? '—' }}
                          </span>
                          <span class="log-list-duration" *ngIf="getDuration(log)">{{ getDuration(log) }}</span>
                        </div>
                      </div>
                      <div class="tl-card-actions">
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
                  </div>
                  <pre class="insight-text">{{ insightText(log.id) }}</pre>
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
export class LoggerViewComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @ViewChild('embeddedTimelineRef') embeddedTimelineRef?: TimelineComponent;

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
  dayTypeDropdownOpen = false;
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

  setDayType(dayType: DayType): void { this.appState.setDayType(dayType); }

  // ── Log list ──────────────────────────────────────────────────────
  logSortOrder: 'asc' | 'desc' = 'desc';
  filterDomain = '';

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
      this.appState.openNotesRequested$.next();
    }
    this.cdr.markForCheck();
  }

  toggleLogSort(): void { this.logSortOrder = this.logSortOrder === 'asc' ? 'desc' : 'asc'; }
  setDomainFilter(domain: string): void { this.filterDomain = domain; }

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

  insightText(logId: string): string {
    const v = this.insightCache.get(logId);
    if (!v || v === 'loading' || v === 'error') return '';
    return (v as FoodInsightRecord).analysis || '';
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

  // ── Inline edit ───────────────────────────────────────────────────
  inlineEditId: string | null = null;
  inlineEdit = { title: '', startAt: '', endAt: '', logTypeId: '' };
  inlineSaving = false;

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

  // ── Add-point long-press ──────────────────────────────────────────
  addPointMenuOpen = false;
  private addPointLongPressTimer: ReturnType<typeof setTimeout> | undefined;
  private addPointLongPressTriggered = false;

  onAddPointPointerDown(_event: PointerEvent): void {
    this.addPointLongPressTriggered = false;
    this.addPointLongPressTimer = setTimeout(() => {
      this.addPointLongPressTriggered = true;
      this.addPointMenuOpen = true;
      this.cdr.markForCheck();
    }, 500);
  }
  onAddPointPointerUp(): void {
    clearTimeout(this.addPointLongPressTimer);
  }
  onAddPointClick(event: MouseEvent): void {
    if (this.addPointLongPressTriggered) { this.addPointLongPressTriggered = false; return; }
    if (this.addPointMenuOpen) { this.addPointMenuOpen = false; return; }
    this.openAddPoint();
  }
  closeAddPointMenu(): void { this.addPointMenuOpen = false; }

  addPointLogNow(): void {
    const pt      = this.currentTimeStr();
    const logTypes = this.logTypes;
    const typeId  = logTypes[0]?._id;
    if (!typeId) return;
    const lt      = logTypes.find(t => t._id === typeId);
    const title   = lt?.name ?? 'Point';
    this.logService.createLog(this.selectedDate, {
      title, logTypeId: typeId, entryType: 'point',
      pointTime: pt, startTime: pt, endTime: pt,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.appState.reloadLogs(),
      error: () => {}
    });
  }

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

  openLogNow(): void {
    this.appState.openUnifiedSheetRequested$.next({ tab: 1 });
  }

  openAddPoint(): void {
    this.appState.openUnifiedSheetRequested$.next({ tab: 2 });
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
      this.dateSlideX = 150;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.appState.prevDay();
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
      this.dateSlideX = -150;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.appState.nextDay();
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

  // ── Embedded timeline events ──────────────────────────────────────
  onTimelineCreate(selection: DragSelection): void {
    this.appState.openLogFormRequested$.next({
      startTime: selection.startTime,
      endTime:   selection.endTime,
      editEntry: null,
    });
  }

  onTimelineLogClick(log: LogEntry): void {
    this.appState.openLogFormRequested$.next({
      startTime: log.startAt,
      endTime:   log.endAt ?? '01:00',
      editEntry: log,
    });
  }

  onTimelineMerge(selection: DragSelection): void {
    const diff   = selection.endMinutes - selection.startMinutes;
    const h      = Math.floor(diff / 60), m = diff % 60;
    const durStr = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
    this.appState.confirmDialogRequested$.next({
      title:   'Merge into time range?',
      message: 'The two point logs will be deleted after the new entry is saved.',
      detail:  `${selection.startTime} – ${selection.endTime}  (${durStr})`,
      okLabel: 'Merge',
      onConfirm: () => {
        this.appState.openLogFormRequested$.next({
          startTime:      selection.startTime,
          endTime:        selection.endTime,
          editEntry:      null,
          logTypeId:      selection.mergeLogTypeId ?? null,
          mergeSourceIds: selection.mergeSourceIds ?? null,
        });
        this.embeddedTimelineRef?.cancelMerge();
      }
    });
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

  // ── Global click: close day-type dropdown ─────────────────────────
  @HostListener('document:click')
  onDocumentClick(): void {
    let changed = false;
    if (this.dayTypeDropdownOpen) { this.dayTypeDropdownOpen = false; changed = true; }
    if (this.openInsightId !== null) { this.openInsightId = null; changed = true; }
    if (changed) this.cdr.markForCheck();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  constructor(
    public  appState:          AppStateService,
    private logService:        LogService,
    private _dayLevelService:  DayLevelService,
    private foodInsightSvc:    FoodInsightService,
    private cdr:               ChangeDetectorRef,
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.addPointLongPressTimer);
  }
}
