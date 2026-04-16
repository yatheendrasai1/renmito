import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarComponent } from './components/calendar/calendar.component';
import { TimelineComponent, DragSelection } from './components/timeline/timeline.component';
import { LogFormComponent } from './components/log-form/log-form.component';
import { LoginComponent } from './auth/login.component';
import { MetricsComponent } from './components/metrics/metrics.component';
import { ThemeEditorComponent, applyPaletteToDOM, loadSavedPalette, clearPaletteFromDOM } from './components/theme-editor/theme-editor.component';
import { LogService } from './services/log.service';
import { AuthService } from './services/auth.service';
import { LogTypeService } from './services/log-type.service';
import { PreferenceService, ActiveLog } from './services/preference.service';
import { DayLevelService, DayMetadata, DayType } from './services/day-level.service';
import { LogEntry, CreateLogEntry } from './models/log.model';
import { forkJoin } from 'rxjs';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { LogTypeSelectComponent } from './components/log-type-select/log-type-select.component';
import { ImportantLogsComponent } from './components/important-logs/important-logs.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarComponent, TimelineComponent, LogFormComponent, LoginComponent, MetricsComponent, ThemeEditorComponent, ConfirmDialogComponent, LogTypeSelectComponent, ImportantLogsComponent],
  template: `
    <!-- ── Login gate ──────────────────────────────────── -->
    <app-login *ngIf="!isAuthenticated" (loggedIn)="onLoggedIn()"></app-login>

    <!-- ── Main app ────────────────────────────────────── -->
    <ng-container *ngIf="isAuthenticated">
    <div class="app-shell">

      <!-- ── Top Header ─────────────────────────────────── -->
      <header class="app-header">
        <div class="header-left">
          <!-- Hamburger — 1.22 -->
          <button class="hamburger-btn" (click)="toggleNav()"
                  title="Toggle navigation" aria-label="Toggle navigation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="header-logo">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <circle cx="14" cy="14" r="12" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
              <path d="M14 8v6l4 3" stroke="rgba(255,255,255,0.9)" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.7)"/>
            </svg>
            <span class="app-title">Renmito</span>
          </div>
        </div>

        <div class="header-actions">
          <span class="header-date">{{ todayLabel }}</span>
          <button class="header-user" *ngIf="currentUser" (click)="openProfile()" title="My profile">{{ currentUser.userName }}</button>

          <!-- Palette editor toggle -->
          <button class="header-icon-btn"
                  (click)="showThemeEditor = !showThemeEditor"
                  [class.header-icon-btn--active]="showThemeEditor"
                  title="Color palette editor"
                  aria-label="Open color palette editor">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="13.5" cy="6.5" r="2.5"/>
              <circle cx="19"   cy="13"  r="2.5"/>
              <circle cx="6"    cy="13"  r="2.5"/>
              <circle cx="10"   cy="19"  r="2.5"/>
            </svg>
          </button>

          <!-- Logout — far right -->
          <button class="header-icon-btn" (click)="logout()" title="Log out" aria-label="Log out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- ── Body ───────────────────────────────────────── -->
      <div class="app-body">

        <!-- Left Navigation — 1.22: collapsible -->
        <nav class="left-nav" [class.left-nav--collapsed]="navCollapsed">
          <div class="nav-group">
            <span class="nav-group-label">Main</span>
            <button
              class="left-nav-item"
              [class.left-nav-item--active]="activeView === 'logger'"
              [title]="navCollapsed ? 'Logger' : ''"
              (click)="activeView = 'logger'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Logger</span>
            </button>
            <button
              class="left-nav-item"
              [class.left-nav-item--active]="activeView === 'timeline'"
              [title]="navCollapsed ? 'Time Line' : ''"
              (click)="activeView = 'timeline'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
                <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/>
                <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>
                <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>
              </svg>
              <span>Time Line</span>
            </button>
          </div>
        </nav>

        <!-- ── View area ───────────────────────────────── -->
        <div class="view-area" (scroll)="onViewAreaScroll($event)">

          <!-- Logger view -->
          <div class="content-area" *ngIf="activeView === 'logger'">

            <!-- ── Date bar — 1.23 ─────────────────────── -->
            <div class="date-bar">
              <span class="date-bar-text">{{ dateShortLabel }}</span>
              <div class="date-bar-actions">

                <!-- Previous day — 1.31 -->
                <button class="date-bar-btn" (click)="prevDay()"
                        title="Previous day" aria-label="Previous day">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>

                <!-- Next day — 1.31 -->
                <button class="date-bar-btn" (click)="nextDay()"
                        [disabled]="isToday"
                        title="Next day" aria-label="Next day">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>

                <!-- Today — 1.31 -->
                <button class="date-bar-btn" (click)="goToToday()"
                        [disabled]="isToday"
                        title="Go to today" aria-label="Go to today">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                  </svg>
                </button>

                <!-- Calendar icon -->
                <button class="date-bar-btn" (click)="openCalendarPopup()"
                        title="Pick a date" aria-label="Open calendar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8"  y1="2" x2="8"  y2="6"/>
                    <line x1="3"  y1="10" x2="21" y2="10"/>
                  </svg>
                </button>
                <!-- Download icon -->
                <button class="date-bar-btn" (click)="downloadCSV()"
                        [disabled]="logs.length === 0"
                        [title]="logs.length === 0 ? 'No logs to download' : 'Download CSV for ' + dateShortLabel"
                        aria-label="Download CSV">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>

                <!-- 1.83: Important Logs button -->
                <button class="date-bar-btn"
                        (click)="openImportantLogs()"
                        title="Important Logs"
                        aria-label="Important Logs">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="1"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- 1.83: Day type selector dropdown -->
            <div class="day-type-bar" *ngIf="dayMetadata">
              <div class="dt-select" [class.dt-select--open]="dayTypeDropdownOpen">
                <button class="dt-trigger"
                        (click)="dayTypeDropdownOpen = !dayTypeDropdownOpen; $event.stopPropagation()">
                  <span class="dt-trigger-label">{{ selectedDayTypeLabel }}</span>
                  <svg class="dt-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="dt-panel" *ngIf="dayTypeDropdownOpen" (click)="$event.stopPropagation()">
                  <button *ngFor="let opt of dayTypeOptions"
                          class="dt-option"
                          [class.dt-option--active]="dayMetadata!.dayType === opt.value"
                          (click)="setDayType(opt.value); dayTypeDropdownOpen = false">
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="dt-backdrop" *ngIf="dayTypeDropdownOpen" (click)="dayTypeDropdownOpen = false"></div>

            <!-- ── Metrics — 1.30 ─────────────────────────── -->
            <app-metrics
              [logs]="logs"
              [selectedDate]="selectedDate"
              (cardHighlight)="onCardHighlight($event)"
            ></app-metrics>

            <!-- ── 1.71: Running Log Banner ───────────────────────── -->
            <div class="running-log-banner" *ngIf="activeLog">
              <div class="running-log-left">
                <span class="running-log-dot"
                      [style.background]="activeLogTypeColor"
                      [class.running-log-dot--pulse]="true"></span>
                <div class="running-log-info">
                  <span class="running-log-name">{{ activeLog.title || activeLogTypeName }}</span>
                  <span class="running-log-sub">{{ activeLogTypeName }}</span>
                </div>
              </div>
              <div class="running-log-center">
                <span class="running-log-clock">{{ activeLogElapsedStr }}</span>
                <!-- 1.72: Planned duration progress bar -->
                <div class="running-log-progress" *ngIf="activeLog.plannedMins">
                  <div class="running-log-progress-fill"
                       [style.width.%]="activeLogPlannedPct"
                       [class.running-log-progress-fill--done]="activeLogPlannedPct >= 100"></div>
                </div>
                <span class="running-log-planned" *ngIf="activeLog.plannedMins">
                  {{ activeLogPlannedPct >= 100 ? '✓ Done' : 'of ' + activeLog.plannedMins + 'm planned' }}
                </span>
              </div>
              <button class="running-log-stop-btn" (click)="stopRunningLog()" title="Stop and save log">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="2" y="2" width="10" height="10" rx="2"/>
                </svg>
                Stop
              </button>
            </div>

            <!-- ── Quick Shortcuts — 1.62 / 1.82 ──────────────── -->
            <div class="shortcuts-bar" *ngIf="isAuthenticated && shortcutDisplayTypes.length > 0"
                 (click)="$event.stopPropagation()">
              <span class="shortcuts-label">
                Quick
                <button class="shortcuts-edit-btn"
                        (click)="openQuickPrefs($event)"
                        title="Configure quick shortcuts"
                        aria-label="Configure quick bar">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor"
                          stroke-width="1.5" stroke-linejoin="round"/>
                  </svg>
                </button>
              </span>
              <button class="shortcut-chip"
                      *ngFor="let lt of shortcutDisplayTypes"
                      [class.shortcut-chip--active]="quickActionChip?._id === lt._id"
                      [disabled]="shortcutSaving"
                      (click)="onShortcutTap(lt)"
                      [title]="'Log ' + lt.name">
                <span class="shortcut-dot" [style.background]="lt.color"></span>
                {{ lt.name }}
              </button>

              <!-- ── 1.85: Quick action panel ─────────────────── -->
              <div class="quick-action-panel" *ngIf="quickActionChip">
                <div class="quick-action-row">
                  <button class="quick-anchor-btn"
                          [class.quick-anchor-btn--active]="quickActionAnchor === 'start'"
                          (click)="quickActionAnchor = 'start'">start</button>
                  <button class="quick-anchor-btn"
                          [class.quick-anchor-btn--active]="quickActionAnchor === 'conclude'"
                          (click)="quickActionAnchor = 'conclude'">conclude</button>
                </div>
                <div class="quick-action-row">
                  <button class="quick-dur-chip"
                          *ngFor="let d of quickDurations"
                          [class.quick-dur-chip--active]="quickActionDuration === d.mins"
                          (click)="quickActionDuration = d.mins">{{ d.label }}</button>
                </div>
                <div class="quick-action-row quick-action-row--log">
                  <button class="quick-log-btn"
                          (click)="commitQuickLog()"
                          [disabled]="shortcutSaving">Log</button>
                </div>
              </div>
            </div>

            <!-- ── 1.68: End-of-Day Wrap-Up Banner ───────────── -->
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
              <button class="wrapup-start-btn" (click)="openWrapUp()">Wrap Up</button>
              <button class="wrapup-dismiss-btn" (click)="dismissWrapUp()" aria-label="Dismiss">✕</button>
            </div>

            <!-- ── Log List (full width in logger view) ── -->
            <div class="logger-split">

              <!-- Log List -->
              <div class="split-logs split-logs--full">
                <div class="content-header">
                  <h2 class="section-title">Logs for the day</h2>
                  <span class="log-count" *ngIf="logs.length > 0">
                    {{ logs.length }} entr{{ logs.length === 1 ? 'y' : 'ies' }}
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

            <div class="log-list-section">

              <!-- ── Add log row — 1.80: three action buttons ──────── -->
              <div class="log-list-add-row" *ngIf="!isLoading">
                <div class="add-log-btn-group">
                  <button class="btn-add-entry" (click)="openLogNow()">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                    Add log
                  </button>
                  <button class="btn-add-entry" (click)="openAddPoint()">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.6"/>
                      <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
                    </svg>
                    Add point
                  </button>
                  <button class="btn-add-entry btn-add-entry--activity" (click)="openStartLog()">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M4.5 3.5l5 2.5-5 2.5V3.5z" fill="currentColor"/>
                    </svg>
                    Start activity
                  </button>
                </div>
              </div>

              <!-- ── 1.80: Continue Last Log ── -->
              <div class="continue-log-row"
                   *ngIf="isToday && lastRangeLog && !inlineEditId">
                <button class="continue-log-btn"
                        [disabled]="shortcutSaving"
                        (click)="continueLastLog()">
                  <span class="continue-dot"
                        [style.background]="lastRangeLog.logType?.color ?? '#9B9B9B'"></span>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M2 1.5l6 3.5-6 3.5V1.5z"/>
                  </svg>
                  Continue
                  <strong>{{ lastRangeLog.logType?.name ?? 'last log' }}</strong>
                  <span class="continue-since">since {{ lastRangeLog.endAt }}</span>
                </button>
              </div>

              <div class="log-list-skeleton" *ngIf="isLoading">
                <div class="skeleton-row" *ngFor="let i of [1,2,3]"></div>
              </div>

              <div class="log-list" *ngIf="!isLoading && logs.length > 0">
                <div
                  class="log-list-item"
                  *ngFor="let log of sortedLogs; let i = index"
                  [class.log-list-item--active]="log.id === highlightedLogId && !metricLogIds && inlineEditId !== log.id"
                  [class.log-list-item--metric-active]="metricLogIds?.has(log.id) && inlineEditId !== log.id"
                  [class.log-list-item--dimmed]="metricLogIds && !metricLogIds.has(log.id) && inlineEditId !== log.id"
                  [class.log-list-item--editing]="inlineEditId === log.id"
                  (click)="onLogItemClick(log, $event)"
                >
                  <div class="log-list-index">{{ i + 1 }}</div>
                  <div class="log-list-color-bar"
                       [style.background]="inlineEditId === log.id ? (inlineCurrentColor ?? log.logType?.color ?? '#9B9B9B') : (log.logType?.color ?? '#9B9B9B')"></div>

                  <!-- ── View mode ── -->
                  <ng-container *ngIf="inlineEditId !== log.id">
                    <div class="log-list-body">
                      <div class="log-list-label">{{ log.title }}</div>
                      <div class="log-list-meta">
                        <span class="log-list-type-badge"
                              [style.background]="(log.logType?.color ?? '#9B9B9B') + '22'"
                              [style.color]="log.logType?.color ?? '#9B9B9B'">
                          {{ log.logType?.name ?? '—' }}
                        </span>
                        <span class="log-list-time">
                          <ng-container *ngIf="log.entryType === 'point'">⏱ {{ log.startAt }}</ng-container>
                          <ng-container *ngIf="log.entryType !== 'point'">{{ log.startAt }} – {{ log.endAt }}</ng-container>
                        </span>
                        <span class="log-list-duration">{{ getDuration(log) }}</span>
                      </div>
                    </div>
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
                  </ng-container>

                  <!-- ── Inline edit mode — 1.54 / 1.57 mobile-friendly ── -->
                  <div class="log-list-inline" *ngIf="inlineEditId === log.id"
                       (click)="$event.stopPropagation()">
                    <input class="inline-title-input" type="text"
                           [(ngModel)]="inlineEdit.title"
                           maxlength="300"
                           placeholder="Activity description"
                           (keydown)="onInlineKeydown($event, log)">
                    <app-log-type-select
                      [logTypes]="inlineLogTypes"
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
                </div>
              </div>

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
            </div><!-- /split-logs -->

            </div><!-- /logger-split -->

          </div><!-- /content-area (logger) -->

          <!-- ── Time Line view — 1.76 ─────────────────────── -->
          <div class="content-area timeline-view" *ngIf="activeView === 'timeline'">

            <!-- Date bar (same as logger) -->
            <div class="date-bar">
              <span class="date-bar-text">{{ dateShortLabel }}</span>
              <div class="date-bar-actions">
                <button class="date-bar-btn" (click)="prevDay()"
                        title="Previous day" aria-label="Previous day">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <button class="date-bar-btn" (click)="nextDay()"
                        [disabled]="isToday"
                        title="Next day" aria-label="Next day">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <button class="date-bar-btn" (click)="goToToday()"
                        [disabled]="isToday"
                        title="Go to today" aria-label="Go to today">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                  </svg>
                </button>
                <button class="date-bar-btn" (click)="openCalendarPopup()"
                        title="Pick a date" aria-label="Open calendar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8"  y1="2" x2="8"  y2="6"/>
                    <line x1="3"  y1="10" x2="21" y2="10"/>
                  </svg>
                </button>
                <!-- 1.83: Important Logs button -->
                <button class="date-bar-btn"
                        (click)="openImportantLogs()"
                        title="Important Logs"
                        aria-label="Important Logs">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="1"/>
                  </svg>
                </button>
              </div>
            </div>
            <!-- 1.83: Day type selector dropdown -->
            <div class="day-type-bar" *ngIf="dayMetadata">
              <div class="dt-select" [class.dt-select--open]="dayTypeDropdownOpen">
                <button class="dt-trigger"
                        (click)="dayTypeDropdownOpen = !dayTypeDropdownOpen; $event.stopPropagation()">
                  <span class="dt-trigger-label">{{ selectedDayTypeLabel }}</span>
                  <svg class="dt-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="dt-panel" *ngIf="dayTypeDropdownOpen" (click)="$event.stopPropagation()">
                  <button *ngFor="let opt of dayTypeOptions"
                          class="dt-option"
                          [class.dt-option--active]="dayMetadata!.dayType === opt.value"
                          (click)="setDayType(opt.value); dayTypeDropdownOpen = false">
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="dt-backdrop" *ngIf="dayTypeDropdownOpen" (click)="dayTypeDropdownOpen = false"></div>

            <!-- Full-width timeline (no accordion) -->
            <div class="timeline-view-container">
              <app-timeline
                #timelineRef
                [logs]="logs"
                [selectedDate]="selectedDate"
                [highlightedLogId]="highlightedLogId"
                [metricLogIds]="metricLogIds"
                [collapsible]="false"
                (selectionMade)="onSelectionChanged($event)"
                (createLogClicked)="onCreateLogClicked($event)"
                (logClicked)="editLog($event)"
                (mergePointsSelected)="onMergePointsSelected($event)"
              ></app-timeline>
            </div>

          </div><!-- /content-area (timeline) -->

        </div><!-- /view-area -->
      </div><!-- /app-body -->

      <!-- ── 1.62: Undo toast ──────────────────────────────── -->
      <div class="shortcut-toast" *ngIf="shortcutToast">
        <span class="shortcut-toast-msg">✓ {{ shortcutToast.message }}</span>
        <button class="shortcut-toast-undo" (click)="undoShortcut()">Undo</button>
      </div>

      <!-- ── 1.61: Log Now FAB (always shows + icon) ── -->
      <button class="log-now-fab"
              *ngIf="isAuthenticated"
              (click)="openLogNow()"
              title="Log Now — tap to record what you just did">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <!-- ── 1.83: Unified log-creation sheet (Add log / Add point / Start timer) ── -->
      <div class="log-now-backdrop" *ngIf="unifiedSheetOpen" (click)="closeUnifiedSheet()"></div>
      <div class="log-now-sheet uni-sheet" *ngIf="unifiedSheetOpen"
           (touchstart)="onUnifiedSwipeStart($event)"
           (touchend)="onUnifiedSwipeEnd($event)">

        <!-- Tab pill header -->
        <div class="uni-tabs">
          <button class="uni-tab" [class.uni-tab--active]="unifiedSheetTab === 0"
                  (click)="switchTab(0)">Add log</button>
          <button class="uni-tab" [class.uni-tab--active]="unifiedSheetTab === 1"
                  (click)="switchTab(1)">Add point</button>
          <button class="uni-tab" [class.uni-tab--active]="unifiedSheetTab === 2"
                  (click)="switchTab(2)">Start timer</button>
        </div>

        <!-- ── Tab 0: Add log ── -->
        <ng-container *ngIf="unifiedSheetTab === 0">
          <div class="log-now-fields">
            <!-- 1.81: Work / Personal domain tabs -->
            <div class="ln-domain-tabs">
              <button class="ln-domain-tab"
                      [class.ln-domain-tab--active]="logNowDomain === 'work'"
                      (click)="setLogNowDomain('work')">Work</button>
              <button class="ln-domain-tab"
                      [class.ln-domain-tab--active]="logNowDomain === 'personal'"
                      (click)="setLogNowDomain('personal')">Personal</button>
            </div>
            <!-- 1.81: Log type drum picker -->
            <div class="ln-type-drum-wrap">
              <div class="ln-drum-center-band"></div>
              <div class="ln-drum ln-drum-ln-types" (scroll)="onLogNowTypeScroll($event)">
                <div class="ln-drum-spacer"></div>
                <div class="ln-type-drum-item"
                     *ngFor="let lt of logNowFilteredTypes; let i = index"
                     [class.ln-type-drum-item--sel]="i === logNowTypeIndex">
                  <span class="ln-type-dot-sm" [style.background]="lt.color"></span>
                  {{ lt.name }}
                </div>
                <div class="ln-drum-spacer"></div>
              </div>
            </div>
            <textarea class="log-now-input"
                      placeholder="Title (optional — defaults to type name)"
                      [(ngModel)]="logNowTitle"></textarea>
            <!-- 1.78: Drum time pickers for Start and End -->
            <div class="ln-time-pickers">
              <div class="ln-time-block">
                <span class="ln-time-block-label">Start</span>
                <div class="ln-drum-group">
                  <div class="ln-drum-col">
                    <div class="ln-drum-wrapper">
                      <div class="ln-drum-center-band"></div>
                      <div class="ln-drum ln-drum-start-h" (scroll)="onLogNowStartHourScroll($event)">
                        <div class="ln-drum-spacer"></div>
                        <div class="ln-drum-item"
                             *ngFor="let h of logNowHours"
                             [class.ln-drum-item--sel]="h === logNowStartHour">
                          {{ h | number:'2.0-0' }}
                        </div>
                        <div class="ln-drum-spacer"></div>
                      </div>
                    </div>
                    <span class="ln-drum-unit">h</span>
                  </div>
                  <div class="ln-drum-colon">:</div>
                  <div class="ln-drum-col">
                    <div class="ln-drum-wrapper">
                      <div class="ln-drum-center-band"></div>
                      <div class="ln-drum ln-drum-start-m" (scroll)="onLogNowStartMinuteScroll($event)">
                        <div class="ln-drum-spacer"></div>
                        <div class="ln-drum-item"
                             *ngFor="let m of logNowMinutes"
                             [class.ln-drum-item--sel]="m === logNowStartMinute">
                          {{ m | number:'2.0-0' }}
                        </div>
                        <div class="ln-drum-spacer"></div>
                      </div>
                    </div>
                    <span class="ln-drum-unit">m</span>
                  </div>
                </div>
              </div>

              <div class="ln-time-arrow">→</div>

              <div class="ln-time-block">
                <span class="ln-time-block-label">End</span>
                <div class="ln-drum-group">
                  <div class="ln-drum-col">
                    <div class="ln-drum-wrapper">
                      <div class="ln-drum-center-band"></div>
                      <div class="ln-drum ln-drum-end-h" (scroll)="onLogNowEndHourScroll($event)">
                        <div class="ln-drum-spacer"></div>
                        <div class="ln-drum-item"
                             *ngFor="let h of logNowHours"
                             [class.ln-drum-item--sel]="h === logNowEndHour">
                          {{ h | number:'2.0-0' }}
                        </div>
                        <div class="ln-drum-spacer"></div>
                      </div>
                    </div>
                    <span class="ln-drum-unit">h</span>
                  </div>
                  <div class="ln-drum-colon">:</div>
                  <div class="ln-drum-col">
                    <div class="ln-drum-wrapper">
                      <div class="ln-drum-center-band"></div>
                      <div class="ln-drum ln-drum-end-m" (scroll)="onLogNowEndMinuteScroll($event)">
                        <div class="ln-drum-spacer"></div>
                        <div class="ln-drum-item"
                             *ngFor="let m of logNowMinutes"
                             [class.ln-drum-item--sel]="m === logNowEndMinute">
                          {{ m | number:'2.0-0' }}
                        </div>
                        <div class="ln-drum-spacer"></div>
                      </div>
                    </div>
                    <span class="ln-drum-unit">m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="log-now-actions">
            <button class="log-now-cancel" (click)="closeUnifiedSheet()">Cancel</button>
            <button class="log-now-save"
                    (click)="saveLogNow()"
                    [disabled]="logNowSaving || !logNowTypeId">
              {{ logNowSaving ? 'Saving…' : 'Save Log' }}
            </button>
          </div>
        </ng-container>

        <!-- ── Tab 1: Add point ── -->
        <ng-container *ngIf="unifiedSheetTab === 1">
          <div class="log-now-fields">
            <!-- Domain tabs -->
            <div class="ln-domain-tabs">
              <button class="ln-domain-tab"
                      [class.ln-domain-tab--active]="addPointDomain === 'work'"
                      (click)="setAddPointDomain('work')">Work</button>
              <button class="ln-domain-tab"
                      [class.ln-domain-tab--active]="addPointDomain === 'personal'"
                      (click)="setAddPointDomain('personal')">Personal</button>
            </div>
            <!-- Log type drum -->
            <div class="ln-type-drum-wrap">
              <div class="ln-drum-center-band"></div>
              <div class="ln-drum ln-drum-ap-types" (scroll)="onAddPointTypeScroll($event)">
                <div class="ln-drum-spacer"></div>
                <div class="ln-type-drum-item"
                     *ngFor="let lt of addPointFilteredTypes; let i = index"
                     [class.ln-type-drum-item--sel]="i === addPointTypeIndex">
                  <span class="ln-type-dot-sm" [style.background]="lt.color"></span>
                  {{ lt.name }}
                </div>
                <div class="ln-drum-spacer"></div>
              </div>
            </div>
            <textarea class="log-now-input"
                      placeholder="Title (optional)"
                      [(ngModel)]="addPointTitle"></textarea>
            <!-- Point time: drum picker (H + M, quarters only) -->
            <div class="ln-time-pickers ln-time-pickers--single">
              <div class="ln-time-block">
                <span class="ln-time-block-label">Time</span>
                <div class="ln-drum-group">
                  <div class="ln-drum-col">
                    <div class="ln-drum-wrapper">
                      <div class="ln-drum-center-band"></div>
                      <div class="ln-drum ln-drum-ap-h" (scroll)="onAddPointHourScroll($event)">
                        <div class="ln-drum-spacer"></div>
                        <div class="ln-drum-item"
                             *ngFor="let h of logNowHours"
                             [class.ln-drum-item--sel]="h === addPointHour">
                          {{ h | number:'2.0-0' }}
                        </div>
                        <div class="ln-drum-spacer"></div>
                      </div>
                    </div>
                    <span class="ln-drum-unit">h</span>
                  </div>
                  <div class="ln-drum-colon">:</div>
                  <div class="ln-drum-col">
                    <div class="ln-drum-wrapper">
                      <div class="ln-drum-center-band"></div>
                      <div class="ln-drum ln-drum-ap-m" (scroll)="onAddPointMinuteScroll($event)">
                        <div class="ln-drum-spacer"></div>
                        <div class="ln-drum-item"
                             *ngFor="let m of addPointMinutes"
                             [class.ln-drum-item--sel]="m === addPointMinute">
                          {{ m | number:'2.0-0' }}
                        </div>
                        <div class="ln-drum-spacer"></div>
                      </div>
                    </div>
                    <span class="ln-drum-unit">m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="log-now-actions">
            <button class="log-now-cancel" (click)="closeUnifiedSheet()">Cancel</button>
            <button class="log-now-save"
                    (click)="saveAddPoint()"
                    [disabled]="addPointSaving || !addPointTypeId">
              {{ addPointSaving ? 'Saving…' : 'Add Point' }}
            </button>
          </div>
        </ng-container>

        <!-- ── Tab 2: Start timer ── -->
        <ng-container *ngIf="unifiedSheetTab === 2">
          <div class="log-now-fields">
            <!-- Domain tabs -->
            <div class="ln-domain-tabs">
              <button class="ln-domain-tab"
                      [class.ln-domain-tab--active]="startLogDomain === 'work'"
                      (click)="setStartLogDomain('work')">Work</button>
              <button class="ln-domain-tab"
                      [class.ln-domain-tab--active]="startLogDomain === 'personal'"
                      (click)="setStartLogDomain('personal')">Personal</button>
            </div>
            <!-- Log type drum -->
            <div class="ln-type-drum-wrap">
              <div class="ln-drum-center-band"></div>
              <div class="ln-drum ln-drum-sl-types" (scroll)="onStartLogTypeScroll($event)">
                <div class="ln-drum-spacer"></div>
                <div class="ln-type-drum-item"
                     *ngFor="let lt of startLogFilteredTypes; let i = index"
                     [class.ln-type-drum-item--sel]="i === startLogTypeIndex">
                  <span class="ln-type-dot-sm" [style.background]="lt.color"></span>
                  {{ lt.name }}
                </div>
                <div class="ln-drum-spacer"></div>
              </div>
            </div>
            <textarea class="log-now-input"
                      placeholder="Title (optional — defaults to type name)"
                      [(ngModel)]="startLogTitle"></textarea>
            <!-- 1.72: Planned duration chips -->
            <div class="start-log-planned-row">
              <span class="start-log-planned-label">Plan for:</span>
              <div class="start-log-planned-chips">
                <button *ngFor="let opt of [{v:'',l:'no time bound'},{v:'15',l:'15m'},{v:'30',l:'30m'},{v:'60',l:'1h'},{v:'90',l:'1.5h'},{v:'120',l:'2h'}]"
                        class="start-log-chip"
                        [class.start-log-chip--active]="startLogPlanned === opt.v"
                        (click)="startLogPlanned = opt.v">
                  {{ opt.l }}
                </button>
              </div>
            </div>
          </div>
          <div class="log-now-actions">
            <button class="log-now-cancel" (click)="closeUnifiedSheet()">Cancel</button>
            <button class="log-now-save log-now-save--start"
                    (click)="saveStartLog()"
                    [disabled]="startLogSaving || !startLogTypeId">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {{ startLogSaving ? 'Starting…' : 'Start Timer' }}
            </button>
          </div>
        </ng-container>

      </div>

      <!-- ── Footer — 1.35 / fixed full-width 1.52 / 1.84 mobile scroll ─── -->
      <footer class="app-footer" [class.footer-visible]="footerVisible">
        <div class="footer-brand">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="12" stroke="rgba(241,233,233,0.85)" stroke-width="1.8"/>
            <path d="M14 8v6l4 3" stroke="rgba(241,233,233,0.85)" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="14" cy="14" r="2" fill="rgba(241,233,233,0.6)"/>
          </svg>
          <span class="footer-logo-text">Renmito</span>
        </div>
        <p class="footer-tagline">
          log.reflect.patterns.observe
        </p>
        <span class="footer-copy">© {{ currentYear }} Renmito</span>
      </footer>
    </div><!-- /app-shell -->

    <!-- ── 1.68: End-of-Day Wrap-Up Sheet ───────────────── -->
    <div class="log-now-backdrop" *ngIf="wrapUpOpen" (click)="closeWrapUp()"></div>
    <div class="log-now-sheet wrapup-sheet" *ngIf="wrapUpOpen">
      <div class="log-now-header">
        <div class="wrapup-header-left">
          <span class="log-now-title">Fill Gap {{ wrapUpIdx + 1 }} / {{ wrapUpGaps.length }}</span>
          <div class="wrapup-step-dots">
            <span *ngFor="let g of wrapUpGaps; let i = index"
                  class="wrapup-step-dot"
                  [class.wrapup-step-dot--done]="i < wrapUpIdx"
                  [class.wrapup-step-dot--active]="i === wrapUpIdx"></span>
          </div>
        </div>
        <button class="log-now-close" (click)="closeWrapUp()" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="wrapup-gap-time" *ngIf="wrapUpCurrentGap">
        <span class="wrapup-time">{{ wrapUpCurrentGap.start }}</span>
        <span class="wrapup-time-arrow">→</span>
        <span class="wrapup-time">{{ wrapUpCurrentGap.end }}</span>
        <span class="wrapup-duration-badge">{{ formatGapMins(wrapUpCurrentGap.mins) }}</span>
      </div>

      <div class="log-now-fields">
        <select class="log-now-select" [(ngModel)]="wrapUpTypeId">
          <option value="" disabled>Select type…</option>
          <option *ngFor="let lt of inlineLogTypes" [value]="lt._id">{{ lt.name }}</option>
        </select>
        <input class="log-now-input" type="text"
               placeholder="Title (optional — defaults to type name)"
               [(ngModel)]="wrapUpTitle"/>
      </div>

      <div class="log-now-actions">
        <button class="log-now-cancel" (click)="wrapUpSkip()">Skip</button>
        <button class="log-now-save"
                (click)="wrapUpSave()"
                [disabled]="wrapUpSaving || !wrapUpTypeId">
          {{ wrapUpSaving ? 'Saving…' : (wrapUpIdx === wrapUpGaps.length - 1 ? 'Save & Finish' : 'Save & Next →') }}
        </button>
      </div>
    </div>

    <!-- ── Log Form Modal ─────────────────────────────── -->
    <app-log-form
      *ngIf="showForm"
      [startTime]="formStartTime"
      [endTime]="formEndTime"
      [editEntry]="editingEntry"
      [currentDate]="selectedDateStr"
      [preselectedLogTypeId]="formLogTypeId"
      (saved)="onLogSaved($event)"
      (updated)="onLogUpdated($event)"
      (deleted)="onLogDeleted($event)"
      (cancelled)="closeForm()"
    ></app-log-form>

    <!-- ── Theme / Palette Editor — 1.42 ───────────── -->
    <app-theme-editor
      *ngIf="showThemeEditor"
      (close)="showThemeEditor = false"
    ></app-theme-editor>

    <!-- ── Profile popup — 1.50 ─────────────────────── -->
    <div class="profile-overlay" *ngIf="showProfile" (click)="onProfileOverlayClick($event)">
      <div class="profile-popup">
        <div class="profile-header">
          <span class="profile-title">My Profile</span>
          <button class="profile-close-btn" (click)="closeProfile()" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="profile-info">
          <div class="profile-info-row">
            <span class="profile-label">Username</span>
            <span class="profile-value">{{ currentUser?.userName }}</span>
          </div>
          <div class="profile-info-row">
            <span class="profile-label">Email</span>
            <span class="profile-value">{{ currentUser?.email }}</span>
          </div>
        </div>

        <div class="profile-section-title">Change Password</div>

        <div class="profile-field">
          <label class="profile-field-label">Current password</label>
          <input class="profile-input" type="password" [(ngModel)]="profilePass.current" placeholder="Current password" [disabled]="profileChanging"/>
        </div>
        <div class="profile-field">
          <label class="profile-field-label">New password</label>
          <input class="profile-input" type="password" [(ngModel)]="profilePass.next" placeholder="Min 8 characters" [disabled]="profileChanging"/>
        </div>
        <div class="profile-field">
          <label class="profile-field-label">Confirm new password</label>
          <input class="profile-input" type="password" [(ngModel)]="profilePass.confirm" placeholder="Repeat new password" [disabled]="profileChanging"/>
        </div>

        <div class="profile-error" *ngIf="profileError">{{ profileError }}</div>
        <div class="profile-success" *ngIf="profileSuccess">{{ profileSuccess }}</div>

        <div class="profile-actions">
          <button class="btn-profile-save" (click)="submitChangePassword()"
                  [disabled]="profileChanging || !profilePass.current || !profilePass.next || !profilePass.confirm">
            <span class="btn-spinner" *ngIf="profileChanging"></span>
            <span>{{ profileChanging ? 'Saving…' : 'Update password' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── Calendar popup — 1.23 ─────────────────────── -->
    <div class="cal-overlay" *ngIf="showCalendarPopup"
         (click)="onCalOverlayClick($event)">
      <div class="cal-popup">
        <app-calendar
          [selectedDate]="pendingDate"
          (dateSelected)="onPendingDateSelected($event)"
        ></app-calendar>
        <div class="cal-popup-actions">
          <button class="btn-cal-cancel" (click)="closeCalendarPopup()">Cancel</button>
          <button class="btn-cal-apply"  (click)="applyPendingDate()">Apply</button>
        </div>
      </div>
    </div>

    <!-- ── 1.82: Quick Prefs popup ──────────────────────────── -->
    <div class="quick-prefs-overlay" *ngIf="quickPrefsOpen"
         (click)="closeQuickPrefs()"></div>
    <div class="quick-prefs-popup" *ngIf="quickPrefsOpen"
         (click)="$event.stopPropagation()">
      <div class="quick-prefs-header">
        <div class="quick-prefs-title-row">
          <span class="quick-prefs-title">Quick Bar</span>
          <span class="quick-prefs-sub">Select log types to pin in the quick bar</span>
        </div>
        <button class="quick-prefs-close" (click)="closeQuickPrefs()" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="quick-prefs-body">
        <!-- Work types -->
        <div class="quick-prefs-domain-label">Work</div>
        <ng-container *ngFor="let lt of quickPrefsWorkTypes">
          <div class="quick-pref-item"
               [class.quick-pref-item--on]="isInQuickPrefs(lt._id)"
               (click)="toggleQuickPref(lt._id)">
            <span class="quick-pref-dot" [style.background]="lt.color"></span>
            <span class="quick-pref-name">{{ lt.name }}</span>
            <span class="quick-pref-badge" *ngIf="isInQuickPrefs(lt._id)">30m</span>
            <span class="quick-pref-toggle-icon">
              <svg *ngIf="isInQuickPrefs(lt._id)" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l4 4 6-6" stroke="#4A90E2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg *ngIf="!isInQuickPrefs(lt._id)" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
        </ng-container>
        <!-- Personal types -->
        <div class="quick-prefs-domain-label" style="margin-top:10px">Personal</div>
        <ng-container *ngFor="let lt of quickPrefsPersonalTypes">
          <div class="quick-pref-item"
               [class.quick-pref-item--on]="isInQuickPrefs(lt._id)"
               (click)="toggleQuickPref(lt._id)">
            <span class="quick-pref-dot" [style.background]="lt.color"></span>
            <span class="quick-pref-name">{{ lt.name }}</span>
            <span class="quick-pref-badge" *ngIf="isInQuickPrefs(lt._id)">30m</span>
            <span class="quick-pref-toggle-icon">
              <svg *ngIf="isInQuickPrefs(lt._id)" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l4 4 6-6" stroke="#4A90E2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg *ngIf="!isInQuickPrefs(lt._id)" width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
        </ng-container>
      </div>
      <div class="quick-prefs-footer">
        <button class="quick-prefs-reset" (click)="resetQuickPrefs()"
                title="Reset to smart defaults">Reset</button>
        <button class="quick-prefs-save" (click)="saveQuickPrefs()"
                [disabled]="quickPrefsSaving">
          {{ quickPrefsSaving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <!-- ── 1.83: Important Logs popup ─────────────────────── -->
    <app-important-logs
      *ngIf="showImportantLogs"
      [selectedDate]="selectedDate"
      [logs]="logs"
      [metadata]="dayMetadata"
      (close)="showImportantLogs = false"
      (metadataChanged)="dayMetadata = $event"
      (logsChanged)="loadLogs()"
    ></app-important-logs>

    <!-- Global confirmation dialog (logout + merge) -->
    <app-confirm-dialog
      [visible]="confirmDialog !== null"
      [title]="confirmDialog?.title ?? ''"
      [message]="confirmDialog?.message ?? ''"
      [detail]="confirmDialog?.detail ?? ''"
      [okLabel]="confirmDialog?.okLabel ?? 'Confirm'"
      (confirmed)="onGlobalConfirm()"
      (cancelled)="onGlobalCancel()"
    ></app-confirm-dialog>

    </ng-container>
  `,
  styles: [`

    /* ── Shell ──────────────────────────────────────────── */
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      background: var(--bg-primary);
    }

    /* ── Header ─────────────────────────────────────────── */
    .app-header {
      height: 60px;
      flex-shrink: 0;
      background: var(--header-bg);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px 0 16px;
      z-index: 200;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Hamburger — 1.22 */
    .hamburger-btn {
      width: 34px; height: 34px;
      border-radius: var(--radius-sm);
      background: var(--header-icon-bg);
      color: rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .hamburger-btn:hover { background: var(--header-icon-hover); color: #fff; }

    .header-logo { display: flex; align-items: center; gap: 10px; }
    .app-title { font-size: 20px; font-weight: 700; color: var(--header-text); letter-spacing: -0.3px; font-family: 'Google Sans Flex', sans-serif; }

    .header-actions { display: flex; align-items: center; gap: 14px; }
    .header-date { font-size: 12px; color: rgba(255,255,255,0.78); }

    .header-icon-btn,
    .theme-toggle-btn {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: var(--header-icon-bg);
      color: rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, color 0.2s;
      flex-shrink: 0;
    }
    .header-icon-btn:hover, .theme-toggle-btn:hover {
      background: var(--header-icon-hover); color: #fff;
    }
    .header-icon-btn--active {
      background: var(--header-icon-hover) !important;
      color: #fff !important;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
    }

    .header-user {
      font-size: 11px; font-weight: 600;
      color: rgba(255,255,255,0.75);
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 3px 10px;
      letter-spacing: 0.3px;
      max-width: 120px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .header-user:hover { background: rgba(255,255,255,0.2); color: #fff; }

    /* ── Body ────────────────────────────────────────────── */
    .app-body { display: flex; flex: 1; overflow: hidden; }

    /* ── Left Nav — 1.22 collapsible ────────────────────── */
    .left-nav {
      width: 210px;
      flex-shrink: 0;
      background: var(--nav-bg);
      border-right: 1px solid var(--border);
      padding: 20px 10px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 24px;
      transition: width 0.22s ease;
    }

    /* Collapsed state — fully hidden, takes no space */
    .left-nav--collapsed {
      width: 0;
      padding: 0;
      border-right-width: 0;
      overflow: hidden;
    }

    .nav-group { display: flex; flex-direction: column; gap: 4px; }
    .nav-group-label {
      font-size: 10px; font-weight: 700; color: var(--nav-text-muted);
      text-transform: uppercase; letter-spacing: 1.2px;
      padding: 0 10px 6px;
      white-space: nowrap; overflow: hidden;
    }

    .left-nav-item {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 9px 12px;
      border-radius: var(--radius);
      background: transparent; color: var(--nav-text);
      font-size: 13px; font-weight: 500;
      text-align: left;
      border-left: 3px solid transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      white-space: nowrap; overflow: hidden;
    }
    .left-nav-item svg { flex-shrink: 0; }
    .left-nav-item:hover { background: var(--nav-item-hover); color: var(--nav-text); }
    .left-nav-item--active {
      background: var(--nav-item-active) !important;
      color: var(--nav-item-active-border) !important;
      border-left-color: var(--nav-item-active-border) !important;
      font-weight: 600;
    }

    /* ── View area ──────────────────────────────────────── */
    /* 1.53: scrollbar-gutter:stable reserves scrollbar lane so it never
             causes a layout shift when it appears / disappears            */
    .view-area { flex: 1; overflow-y: auto; scrollbar-gutter: stable; padding: 20px 24px; min-width: 0; }

    /* ── Content area (full width now — no calendar panel) ─ */
    .content-area {
      display: flex; flex-direction: column;
      gap: 14px; min-width: 0; overflow: hidden;
    }

    /* ── Date bar — 1.23 ─────────────────────────────────── */
    .date-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 16px;
    }
    .date-bar-text {
      font-size: 15px; font-weight: 700;
      color: var(--text-primary);
    }
    .date-bar-actions { display: flex; align-items: center; gap: 6px; }
    .date-bar-btn {
      width: 34px; height: 34px;
      background: var(--bg-card);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .date-bar-btn:hover:not(:disabled) { background: var(--accent-hover); color: var(--text-primary); }
    .date-bar-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── 1.83: Day type dropdown ────────────────────────────── */
    .day-type-bar { padding: 8px 4px 2px; position: relative; }
    .dt-backdrop {
      position: fixed; inset: 0; z-index: 49; background: transparent;
    }
    .dt-select { position: relative; display: inline-block; }
    .dt-trigger {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .dt-select--open .dt-trigger,
    .dt-trigger:hover { border-color: var(--highlight-selected); color: var(--text-primary); }
    .dt-chevron {
      color: var(--text-muted);
      transition: transform 0.15s;
      flex-shrink: 0;
    }
    .dt-select--open .dt-chevron { transform: rotate(180deg); }
    .dt-panel {
      position: absolute;
      top: calc(100% + 4px); left: 0;
      z-index: 50;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 4px 0;
      min-width: 140px;
    }
    .dt-option {
      display: block; width: 100%;
      padding: 8px 14px;
      background: none; color: var(--text-primary);
      font-size: 12px; font-weight: 500;
      text-align: left; cursor: pointer;
      transition: background 0.12s;
    }
    .dt-option:hover { background: var(--accent-hover); }
    .dt-option--active {
      color: var(--highlight-selected);
      background: color-mix(in srgb, var(--highlight-selected) 8%, var(--bg-card));
      font-weight: 700;
    }

    /* ── Logger layout — 1.76: full-width log list ─────── */
    .logger-split {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Log list — full width */
    .split-logs {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    .split-logs--full .log-list-section {
      max-height: none;
      overflow-y: visible;
    }

    /* ── Time Line view — 1.76 ─────────────────────────── */
    .timeline-view { }
    .timeline-view-container {
      background: var(--bg-surface);
      border-radius: var(--radius);
      padding: 16px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }

    /* ── Content header ─────────────────────────────────── */
    .content-header { display: flex; align-items: center; justify-content: space-between; }
    .section-title {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 1px;
    }
    .loading-indicator { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); }
    .spinner {
      width: 13px; height: 13px;
      border: 2px solid var(--border);
      border-top-color: var(--highlight-selected);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Timeline container ─────────────────────────────── */
    .timeline-container { background: var(--bg-surface); border-radius: var(--radius); padding: 16px; min-width: 0; }
    .timeline-hint { font-size: 11px; color: var(--text-muted); text-align: center; padding: 4px; }

    /* ── Log List section ───────────────────────────────── */
    .log-list-section {
      display: flex; flex-direction: column; gap: 12px;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px;
    }
    .log-count {
      font-size: 11px; color: var(--text-muted);
      background: var(--bg-card); padding: 2px 8px; border-radius: 10px;
    }
    .btn-sort {
      display: flex; align-items: center; gap: 4px;
      background: transparent; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-muted);
      font-size: 11px; padding: 3px 8px; cursor: pointer;
      margin-left: auto;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .btn-sort:hover { background: var(--accent-hover); color: var(--text-primary); border-color: var(--accent); }

    .log-list-skeleton { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row {
      height: 52px; border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--bg-card) 25%, var(--accent-hover) 50%, var(--bg-card) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .log-list { display: flex; flex-direction: column; gap: 6px; }
    .log-list-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: var(--radius-sm);
      border: 1px solid transparent; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      background: var(--bg-card);
    }
    .log-list-item:hover { background: var(--accent-hover); border-color: var(--border); }
    .log-list-item--active {
      border-color: rgba(74,144,226,0.5) !important;
      background: rgba(74,144,226,0.08) !important;
    }
    .log-list-item--metric-active {
      border-color: rgba(74,144,226,0.6) !important;
      background: rgba(74,144,226,0.12) !important;
    }
    .log-list-item--dimmed {
      opacity: 0.38;
      /* Visually de-emphasised but still tappable — do NOT add pointer-events:none */
    }

    .log-list-index { font-size: 11px; font-weight: 600; color: var(--text-muted); width: 18px; text-align: center; flex-shrink: 0; }
    .log-list-color-bar { width: 4px; height: 36px; border-radius: 2px; flex-shrink: 0; }
    .log-list-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .log-list-label { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .log-list-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .log-list-type-badge { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.4px; }
    .log-list-time { font-size: 11px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .log-list-duration { font-size: 11px; color: var(--text-muted); background: var(--bg-surface); padding: 1px 6px; border-radius: 6px; }

    /* Always visible at low opacity (accessible on touch/mobile);
       brighten to full on desktop hover */
    .log-list-edit-btn {
      background: none; color: var(--text-muted); border: none;
      padding: 5px; border-radius: var(--radius-sm); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0.45; transition: opacity 0.15s, background 0.15s, color 0.15s; flex-shrink: 0;
    }
    .log-list-item:hover .log-list-edit-btn { opacity: 1; }
    .log-list-edit-btn:hover { background: var(--accent-hover); color: var(--text-primary); }
    .log-list-delete-btn {
      background: none; color: var(--text-muted); border: none;
      padding: 5px; border-radius: var(--radius-sm); cursor: pointer;
      opacity: 0.45; transition: opacity 0.15s, background 0.15s, color 0.15s; flex-shrink: 0;
    }
    .log-list-item:hover .log-list-delete-btn { opacity: 1; }
    .log-list-delete-btn:hover { background: rgba(158,59,59,0.14); color: #9E3B3B; }

    /* ── Inline edit mode — 1.54 / 1.57 mobile-friendly ──── */
    .log-list-item--editing {
      align-items: flex-start;
      border-color: var(--border-light) !important;
      background: var(--bg-card) !important;
      cursor: default;
    }
    .log-list-item--editing .log-list-color-bar {
      align-self: stretch; height: auto;
    }
    .log-list-inline {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 8px;
      padding: 2px 0;
    }
    .inline-title-input {
      width: 100%; box-sizing: border-box;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-primary);
      font-size: 13px; font-weight: 600; padding: 7px 8px;
      font-family: inherit; outline: none;
    }
    .inline-title-input:focus { border-color: var(--border-light); }
    .inline-type-select {
      width: 100%; box-sizing: border-box;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-primary);
      font-size: 12px; padding: 7px 6px; outline: none; cursor: pointer;
    }
    .inline-type-select:focus { border-color: var(--border-light); }
    /* ── Time stepper row — 1.57 ── */
    .inline-time-row {
      display: flex; align-items: center; gap: 6px;
    }
    .inline-time-label {
      font-size: 10px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.6px;
      width: 30px; flex-shrink: 0;
    }
    .btn-time-step {
      flex-shrink: 0;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-secondary);
      font-size: 11px; font-weight: 600;
      padding: 0 10px; height: 34px;
      cursor: pointer; transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .btn-time-step:hover { background: var(--accent-hover); color: var(--text-primary); }
    .inline-time-input {
      flex: 1; min-width: 0;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-primary);
      font-size: 13px; padding: 6px 8px; font-variant-numeric: tabular-nums;
      outline: none; text-align: center;
    }
    .inline-time-input:focus { border-color: var(--border-light); }
    .inline-action-row { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
    .btn-inline-save {
      flex: 1;
      background: var(--highlight-selected); color: #fff; border: none;
      border-radius: var(--radius-sm); padding: 8px 12px;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
    }
    .btn-inline-save:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-inline-save:hover:not(:disabled) { opacity: 0.85; }
    .btn-inline-cancel {
      flex: 1;
      background: transparent; color: var(--text-muted);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      padding: 8px 10px; font-size: 12px; cursor: pointer; transition: background 0.15s;
    }
    .btn-inline-cancel:hover { background: var(--accent-hover); }
    .btn-inline-fullform {
      background: transparent; color: var(--text-muted);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      padding: 0 10px; height: 36px; cursor: pointer; display: flex; align-items: center;
      transition: background 0.15s, color 0.15s; flex-shrink: 0;
    }
    .btn-inline-fullform:hover { background: var(--accent-hover); color: var(--text-primary); }

    /* ── Add log row — 1.54 / 1.80 ────────────────────────────────── */
    .log-list-add-row { position: relative; padding-top: 4px; }

    .log-list-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 28px 16px; text-align: center; opacity: 0.5;
    }
    .log-list-empty p { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin: 0; }
    .log-list-empty span { font-size: 11px; color: var(--text-muted); }

    /* ── Calendar popup — 1.23 ──────────────────────────── */
    .cal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 600;
      backdrop-filter: blur(2px);
    }
    .cal-popup {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      overflow: hidden;
      animation: popIn 0.18s ease;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.95) translateY(-8px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .cal-popup-actions {
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      background: var(--bg-card);
    }
    .btn-cal-cancel {
      padding: 7px 18px; font-size: 13px;
      background: none; color: var(--text-muted);
      border-radius: var(--radius-sm);
    }
    .btn-cal-cancel:hover { color: var(--text-primary); background: var(--accent-hover); }
    .btn-cal-apply {
      padding: 7px 18px; font-size: 13px; font-weight: 600;
      background: var(--highlight-selected); color: #fff;
      border-radius: var(--radius-sm);
      transition: opacity 0.15s;
    }
    .btn-cal-apply:hover { opacity: 0.88; }

    /* ── Footer — 1.35 / 1.56: in-flow (not fixed) so it never overlays content */
    .app-footer {
      flex-shrink: 0;
      background: var(--nav-bg);
      border-top: 1px solid var(--border);
      padding: 12px 24px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .footer-brand {
      display: flex;
      align-items: center;
      gap: 9px;
      flex-shrink: 0;
    }

    .footer-logo-text {
      font-size: 18px;
      font-weight: 700;
      color: var(--nav-text);
      letter-spacing: -0.3px;
      font-family: 'Google Sans Flex', sans-serif;
    }

    .footer-tagline {
      flex: 1;
      font-size: 12px;
      line-height: 1.55;
      color: var(--nav-text-muted);
      min-width: 180px;
      margin: 0;
    }

    .footer-copy {
      font-size: 11px;
      color: var(--nav-text-muted);
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* ── Profile popup — 1.50 ──────────────────────────── */
    .profile-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 600;
    }
    .profile-popup {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      width: 360px; max-width: 94vw;
      padding: 20px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .profile-header {
      display: flex; align-items: center; justify-content: space-between;
    }
    .profile-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .profile-close-btn {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.15s;
    }
    .profile-close-btn:hover { background: var(--accent-hover); color: var(--text-primary); }
    .profile-info {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .profile-info-row { display: flex; gap: 10px; align-items: baseline; }
    .profile-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; width: 72px; flex-shrink: 0; }
    .profile-value { font-size: 13px; color: var(--text-primary); font-weight: 500; word-break: break-all; }
    .profile-section-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; }
    .profile-field { display: flex; flex-direction: column; gap: 5px; }
    .profile-field-label { font-size: 12px; font-weight: 500; color: var(--text-secondary); }
    .profile-input {
      width: 100%; padding: 8px 10px; font-size: 13px;
      background: var(--bg-card); color: var(--text-primary);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      box-sizing: border-box;
    }
    .profile-input:focus { outline: none; border-color: var(--highlight-selected); }
    .profile-input:disabled { opacity: 0.5; }
    .profile-error { font-size: 12px; color: #e05252; padding: 6px 10px; background: rgba(224,82,82,0.1); border-radius: var(--radius-sm); }
    .profile-success { font-size: 12px; color: #4caf7d; padding: 6px 10px; background: rgba(76,175,125,0.1); border-radius: var(--radius-sm); }
    .profile-actions { display: flex; justify-content: flex-end; }
    .btn-profile-save {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; font-size: 13px; font-weight: 600;
      background: var(--highlight-selected); color: #fff;
      border-radius: var(--radius-sm);
      transition: opacity 0.15s;
    }
    .btn-profile-save:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Responsive ─────────────────────────────────────── */
    /* Nav collapse is controlled solely by the hamburger toggle (navCollapsed).
       No media query auto-collapses it — the user's explicit toggle is the
       single source of truth for open vs. closed state.                      */

    /* Mobile overrides */
    @media (max-width: 700px) {
      .header-date { display: none; }
      .timeline-view-container { padding: 10px; }

      /* ── 1.84: Footer — thin + only at bottom of scroll ─── */
      .app-footer {
        display: none;
        padding: 5px 12px;
        padding-bottom: calc(5px + env(safe-area-inset-bottom, 0px));
        gap: 10px;
      }
      .app-footer.footer-visible { display: flex; }
      .footer-brand svg { display: none; }
      .footer-brand { gap: 4px; }
      .footer-logo-text { font-size: 10px; }
      .footer-tagline { font-size: 8px; min-width: 0; }
      .footer-copy { font-size: 8px; }
    }

    /* ── 1.62: Quick Shortcuts Bar / 1.84: wrap to 2 rows ───── */
    .shortcuts-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }

    .shortcuts-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
      padding-right: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .shortcut-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 20px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .shortcut-chip:hover:not(:disabled) {
      background: var(--nav-item-active);
      border-color: var(--nav-bg);
      color: var(--nav-bg);
    }
    .shortcut-chip:disabled { opacity: 0.5; cursor: not-allowed; }
    .shortcut-chip--active {
      background: var(--bg-card);
      border-color: var(--nav-bg);
      color: var(--text-secondary);
    }
    .shortcut-chip--active:hover:not(:disabled) {
      background: var(--nav-item-active);
      border-color: var(--nav-bg);
      color: var(--nav-bg);
    }

    .shortcut-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── 1.85: Quick action panel ─────────────────────────────── */
    .quick-action-panel {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-top: 4px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .quick-action-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 0 6px;
      box-shadow: 0 1px 0 var(--border);
    }
    .quick-action-row--log {
      box-shadow: none;
      padding-bottom: 2px;
    }
    .quick-anchor-btn {
      padding: 4px 14px;
      border-radius: 20px;
      border: 1px solid var(--border-light);
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
      text-transform: lowercase;
    }
    .quick-anchor-btn:hover {
      background: var(--nav-item-active);
      border-color: var(--nav-bg);
      color: var(--nav-bg);
    }
    .quick-anchor-btn--active {
      background: var(--nav-bg);
      border-color: var(--nav-bg);
      color: var(--nav-text);
    }
    .quick-anchor-btn--active:hover { opacity: 0.9; }
    .quick-dur-chip {
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid var(--border-light);
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .quick-dur-chip:hover {
      background: var(--nav-item-active);
      border-color: var(--nav-bg);
      color: var(--nav-bg);
    }
    .quick-dur-chip--active {
      background: var(--nav-bg);
      border-color: var(--nav-bg);
      color: var(--nav-text);
    }
    .quick-dur-chip--active:hover { opacity: 0.9; }
    .quick-log-btn {
      padding: 5px 20px;
      border-radius: 20px;
      border: none;
      background: var(--nav-bg);
      color: var(--nav-text);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.12s;
    }
    .quick-log-btn:hover:not(:disabled) { opacity: 0.85; }
    .quick-log-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Toast */
    .shortcut-toast {
      position: fixed;
      bottom: 84px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 400;
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 8px 8px 8px 16px;
      box-shadow: var(--shadow);
      white-space: nowrap;
      animation: toastSlideUp 0.2s ease;
    }
    .shortcut-toast-msg {
      font-size: 13px;
      color: var(--text-primary);
    }
    .shortcut-toast-undo {
      background: none;
      border: 1px solid var(--border-light);
      border-radius: 14px;
      padding: 4px 12px;
      font-size: 11px;
      color: var(--accent);
      cursor: pointer;
    }
    .shortcut-toast-undo:hover { background: var(--bg-card); }

    @keyframes toastSlideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ── 1.61: Log Now FAB ───────────────────────────────────── */
    .log-now-fab {
      position: fixed;
      bottom: 72px;
      right: 20px;
      z-index: 250;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--nav-bg);
      color: var(--nav-text);
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(0,0,0,0.45);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .log-now-fab:hover {
      transform: scale(1.06);
      box-shadow: 0 6px 22px rgba(0,0,0,0.55);
    }

    /* Log Now Sheet */
    .log-now-backdrop {
      position: fixed;
      inset: 0;
      z-index: 300;
      background: rgba(0,0,0,0.45);
    }

    .log-now-sheet {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 301;
      width: 100%;
      max-width: 480px;
      background: var(--bg-surface);
      border-top: 1px solid var(--border);
      border-radius: 16px 16px 0 0;
      padding: 20px 20px 36px;
      animation: slideUp 0.22s ease;
    }
    /* Unified sheet: fixed height, scrollable body */
    .uni-sheet {
      display: flex;
      flex-direction: column;
      height: 520px;
      max-height: 80dvh;
      padding: 12px 20px 36px;
      overflow: hidden;
    }
    .uni-sheet .uni-tabs { flex-shrink: 0; }
    .uni-sheet ng-container { display: contents; }
    .uni-sheet .log-now-fields {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding-top: 8px;
      min-height: 0;
    }
    .uni-sheet .log-now-actions { flex-shrink: 0; padding-top: 12px; }
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100%); }
      to   { transform: translateX(-50%) translateY(0); }
    }

    /* ── 1.83: Unified sheet tab pills ── */
    .uni-tabs {
      display: flex;
      gap: 6px;
      padding: 0 0 14px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 4px;
    }
    .uni-tab {
      flex: 1;
      padding: 7px 6px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .uni-tab--active {
      background: var(--nav-bg);
      color: var(--nav-text);
      border-color: var(--nav-bg);
    }

    .log-now-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .log-now-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .log-now-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
    }

    .log-now-fields {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }
    .log-now-select, .log-now-input {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      box-sizing: border-box;
      font-family: inherit;
    }
    textarea.log-now-input {
      resize: none;
      line-height: 1.5;
      height: calc(1.5em * 3 + 20px);
    }
    /* ── 1.78: Log Now drum time pickers ────────────────── */
    .ln-time-pickers {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 8px;
    }
    .ln-time-pickers--single {
      justify-content: flex-start;
    }
    .ln-time-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex: 1;
    }
    .ln-time-block-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .ln-time-arrow {
      font-size: 18px;
      color: var(--text-muted);
      flex-shrink: 0;
      padding-top: 20px;
    }
    .ln-drum-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .ln-drum-colon {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      padding-bottom: 10px;
      flex-shrink: 0;
    }
    .ln-drum-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    .ln-drum-wrapper {
      position: relative;
      width: 56px;
      height: 75px;
      overflow: hidden;
    }
    .ln-drum-wrapper::before,
    .ln-drum-wrapper::after {
      content: '';
      position: absolute;
      left: 0; right: 0;
      height: 25px;
      z-index: 2;
      pointer-events: none;
    }
    .ln-drum-wrapper::before {
      top: 0;
      background: linear-gradient(to bottom, var(--bg-card) 10%, transparent);
    }
    .ln-drum-wrapper::after {
      bottom: 0;
      background: linear-gradient(to top, var(--bg-card) 10%, transparent);
    }
    .ln-drum-center-band {
      position: absolute;
      top: 50%; left: 3px; right: 3px;
      height: 25px;
      transform: translateY(-50%);
      border-top: 1px solid var(--border-light);
      border-bottom: 1px solid var(--border-light);
      background: rgba(74, 144, 226, 0.06);
      border-radius: 4px;
      pointer-events: none;
      z-index: 1;
    }
    .ln-drum {
      position: relative;
      z-index: 3;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .ln-drum::-webkit-scrollbar { display: none; }
    .ln-drum-spacer { height: 25px; flex-shrink: 0; display: block; }
    .ln-drum-item {
      height: 25px;
      scroll-snap-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      user-select: none;
      transition: color 0.1s, font-size 0.1s, font-weight 0.1s;
    }
    .ln-drum-item--sel {
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 700;
    }
    .ln-drum-unit {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }

    .log-now-actions {
      display: flex;
      gap: 10px;
    }
    .log-now-cancel {
      flex: 1;
      padding: 11px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
    }
    .log-now-save {
      flex: 2;
      padding: 11px;
      background: var(--highlight-selected);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .log-now-save:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── 1.63: Continue Last Log ─────────────────────────────── */
    .continue-log-row {
      padding: 6px 12px 10px;
      display: flex;
    }

    .continue-log-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      background: var(--bg-card);
      border: 1px dashed var(--border-light);
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      width: 100%;
      justify-content: center;
    }
    .continue-log-btn:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--text-primary);
      background: var(--nav-item-hover);
    }
    .continue-log-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .continue-log-btn strong { color: var(--text-primary); font-weight: 600; }

    .continue-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .continue-since {
      color: var(--text-muted);
      font-size: 11px;
      margin-left: 2px;
    }

    /* ── 1.71/1.72/1.73: Running Log Banner ──────────────────── */
    .running-log-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: color-mix(in srgb, var(--accent) 8%, var(--bg-surface));
      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius);
      animation: toastSlideUp 0.25s ease;
    }

    .running-log-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }

    .running-log-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .running-log-dot--pulse {
      animation: runningPulse 1.6s ease-in-out infinite;
    }
    @keyframes runningPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.45; transform: scale(1.4); }
    }

    .running-log-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .running-log-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .running-log-sub {
      font-size: 11px;
      color: var(--text-muted);
    }

    .running-log-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .running-log-clock {
      font-size: 20px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
      letter-spacing: 0.5px;
      line-height: 1;
    }
    .running-log-planned {
      font-size: 10px;
      color: var(--text-muted);
    }

    .running-log-progress {
      width: 80px;
      height: 4px;
      background: var(--border-light);
      border-radius: 2px;
      overflow: hidden;
    }
    .running-log-progress-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 1s linear;
    }
    .running-log-progress-fill--done { background: #5BAD6F; }

    .running-log-stop-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 14px;
      background: #e05c5c;
      border: none;
      border-radius: 14px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .running-log-stop-btn:hover { opacity: 0.85; }

    /* ── 1.73: Pulsing Stop FAB ─────────────────────────────── */
    .log-now-fab--stop {
      background: #e05c5c !important;
      animation: fabPulse 1.6s ease-in-out infinite;
    }
    @keyframes fabPulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(224,92,92,0.5), 0 0 0 0 rgba(224,92,92,0.35); }
      50%       { box-shadow: 0 4px 20px rgba(224,92,92,0.5), 0 0 0 10px rgba(224,92,92,0); }
    }

    /* ── 1.71: Start Timer sheet extras ─────────────────────── */
    .start-log-planned-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .start-log-planned-label {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .start-log-planned-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .start-log-chip {
      padding: 5px 12px;
      border-radius: 14px;
      border: 1px solid var(--border-light);
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .start-log-chip:hover { border-color: var(--accent); color: var(--text-primary); }
    .start-log-chip--active,
    .start-log-chip--active:focus,
    .start-log-chip--active:active {
      border-color: var(--highlight-selected);
      background: var(--highlight-selected);
      color: #fff;
      font-weight: 600;
      outline: none;
    }
    .log-now-save--start {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ── 1.68: Wrap-Up Banner ────────────────────────────────── */
    .wrapup-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      background: color-mix(in srgb, var(--accent) 12%, var(--bg-surface));
      border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
      border-radius: var(--radius);
      animation: toastSlideUp 0.2s ease;
    }

    .wrapup-banner-icon {
      color: var(--accent);
      flex-shrink: 0;
    }

    .wrapup-banner-text {
      flex: 1;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .wrapup-banner-text strong { color: var(--text-primary); }

    .wrapup-start-btn {
      padding: 5px 14px;
      background: var(--accent);
      border: none;
      border-radius: 14px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .wrapup-start-btn:hover { opacity: 0.88; }

    .wrapup-dismiss-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 13px;
      cursor: pointer;
      padding: 2px 4px;
      flex-shrink: 0;
    }
    .wrapup-dismiss-btn:hover { color: var(--text-primary); }

    /* Wrap-Up Sheet extras (builds on .log-now-sheet) */
    .wrapup-header-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .wrapup-step-dots {
      display: flex;
      gap: 5px;
    }

    .wrapup-step-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--border-light);
      transition: background 0.2s;
    }
    .wrapup-step-dot--done   { background: var(--accent); opacity: 0.45; }
    .wrapup-step-dot--active { background: var(--accent); }

    .wrapup-gap-time {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 0 14px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 14px;
    }

    .wrapup-time {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .wrapup-time-arrow {
      color: var(--text-muted);
      font-size: 16px;
      flex-shrink: 0;
    }

    .wrapup-duration-badge {
      margin-left: auto;
      padding: 3px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: 12px;
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 600;
    }

    /* ── 1.80: Three-button Add Log group ────────────────── */
    .add-log-btn-group {
      display: flex;
      gap: 8px;
    }
    .btn-add-entry {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      padding: 8px 6px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .btn-add-entry:hover {
      background: var(--accent-hover);
      color: var(--text-primary);
      border-color: var(--accent);
    }
    .btn-add-entry--activity {
      background: var(--highlight-selected);
      border-color: transparent;
      color: #fff;
    }
    .btn-add-entry--activity:hover {
      opacity: 0.88;
      background: var(--highlight-selected);
      color: #fff;
      border-color: transparent;
    }

    /* ── 1.81 / 1.80: Domain tabs ───────────────────────── */
    .ln-domain-tabs {
      display: flex;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .ln-domain-tab {
      flex: 1;
      padding: 8px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .ln-domain-tab--active {
      background: var(--highlight-selected);
      color: #fff;
    }

    /* ── Log type drum (used in Log Now and Add Point) ─── */
    .ln-type-drum-wrap {
      position: relative;
      width: 100%;
      height: 75px;
      overflow: hidden;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .ln-type-drum-wrap::before,
    .ln-type-drum-wrap::after {
      content: '';
      position: absolute;
      left: 0; right: 0;
      height: 25px;
      z-index: 2;
      pointer-events: none;
    }
    .ln-type-drum-wrap::before {
      top: 0;
      background: linear-gradient(to bottom, var(--bg-card) 10%, transparent);
    }
    .ln-type-drum-wrap::after {
      bottom: 0;
      background: linear-gradient(to top, var(--bg-card) 10%, transparent);
    }
    .ln-type-drum-item {
      height: 25px;
      scroll-snap-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      font-size: 10px;
      font-weight: 500;
      color: var(--text-muted);
      user-select: none;
      transition: color 0.12s, font-size 0.12s, font-weight 0.12s;
    }
    .ln-type-drum-item--sel {
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 700;
    }
    .ln-type-dot-sm {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── 1.80: Add Point time row ────────────────────────── */
    .ln-point-time-row {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
    }
    .ln-point-time-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      flex-shrink: 0;
    }
    .ln-point-time-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 15px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      outline: none;
    }

    /* ── 1.82: Shortcuts bar edit button ────────────────── */
    .shortcuts-edit-btn {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      background: none;
      border: 1px solid transparent;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }
    .shortcuts-edit-btn:hover {
      background: var(--accent-hover);
      color: var(--text-primary);
      border-color: var(--border);
    }

    /* ── 1.82: Quick Prefs popup ─────────────────────────── */
    .quick-prefs-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 600;
    }
    .quick-prefs-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 601;
      width: 340px;
      max-width: 94vw;
      max-height: 80vh;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: popIn 0.18s ease;
    }
    .quick-prefs-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 16px 16px 12px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .quick-prefs-title-row {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .quick-prefs-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .quick-prefs-sub {
      font-size: 11px;
      color: var(--text-muted);
    }
    .quick-prefs-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .quick-prefs-close:hover { color: var(--text-primary); }

    .quick-prefs-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
    }
    .quick-prefs-domain-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 0 6px;
    }
    .quick-pref-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s;
      margin-bottom: 4px;
      background: var(--bg-card);
    }
    .quick-pref-item:hover { background: var(--accent-hover); }
    .quick-pref-item--on {
      border-color: rgba(74,144,226,0.4);
      background: rgba(74,144,226,0.08);
    }
    .quick-pref-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .quick-pref-name {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }
    .quick-pref-badge {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--bg-surface);
      padding: 2px 6px;
      border-radius: 8px;
    }
    .quick-pref-toggle-icon {
      display: flex;
      align-items: center;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .quick-prefs-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .quick-prefs-reset {
      background: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 12px;
      padding: 7px 14px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .quick-prefs-reset:hover { background: var(--accent-hover); color: var(--text-primary); }
    .quick-prefs-save {
      flex: 1;
      background: var(--highlight-selected);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      padding: 8px;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .quick-prefs-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .quick-prefs-save:hover:not(:disabled) { opacity: 0.88; }
  `]
})
export class AppComponent implements OnInit {
  @ViewChild('timelineRef') timelineRef!: TimelineComponent;

  isAuthenticated = false;
  currentUser     = this.authService.getUser();

  activeView: 'logger' | 'timeline' = 'logger';
  theme: 'dark' | 'light' = 'dark';
  readonly currentYear = new Date().getFullYear();

  // ── 1.22: Nav collapse — collapsed by default ───────────
  navCollapsed = true;

  // ── 1.42: Palette / theme editor ─────────────────────────
  showThemeEditor = false;

  // ── 1.50: Profile popup ───────────────────────────────────
  showProfile    = false;
  profileChanging = false;
  profileError   = '';
  profileSuccess = '';
  profilePass    = { current: '', next: '', confirm: '' };

  // ── 1.45/1.47: Merge state ─────────────────────────────────────
  private mergeSourceIds: [string, string] | null = null;
  formLogTypeId: string | null = null;

  // ── 1.47: Global confirm dialog ────────────────────────────────
  confirmDialog: { title: string; message: string; detail?: string; okLabel?: string; onConfirm: () => void } | null = null;
  private pendingMerge: DragSelection | null = null;

  selectedDate: Date = new Date();
  logs:         LogEntry[] = [];
  isLoading     = false;
  highlightedLogId: string | null = null;

  showForm      = false;
  formStartTime = '09:00';
  formEndTime   = '10:00';
  editingEntry: LogEntry | null = null;

  // ── 1.23: Calendar popup ─────────────────────────────────
  showCalendarPopup = false;
  pendingDate: Date = new Date();

  // ── 1.30: Metric card highlight ──────────────────────────
  metricLogIds: Set<string> | null = null;

  // ── 1.54: Inline edit + quick-add + sort ─────────────────
  inlineEditId: string | null = null;
  inlineEdit = { title: '', startAt: '', endAt: '', logTypeId: '' };
  inlineSaving = false;
  inlineLogTypes: any[] = [];
  logSortOrder: 'asc' | 'desc' = 'desc';

  // ── 1.84: Footer scroll visibility (mobile only) ─────────────
  footerVisible = false;

  // ── 1.62: Quick Shortcuts Bar ─────────────────────────────────
  shortcutToast: { message: string; logId: string } | null = null;
  shortcutSaving = false;
  private toastTimer: any = null;

  // ── 1.85: Quick action panel (start/conclude + duration) ──────
  quickActionChip:     any | null = null;
  quickActionAnchor:   'start' | 'conclude' = 'conclude';
  quickActionDuration: number = 30; // minutes
  readonly quickDurations = [
    { mins: 15, label: '15m' },
    { mins: 30, label: '30m' },
    { mins: 45, label: '45m' },
    { mins: 60, label: '1h'  },
  ];

  // ── 1.61: Log Now FAB ─────────────────────────────────────────
  logNowOpen   = false;
  logNowTypeId = '';
  logNowTitle  = '';
  logNowStart  = '09:00';
  logNowEnd    = '09:00';
  logNowSaving = false;
  readonly logNowHours    = Array.from({ length: 24 }, (_, i) => i);
  readonly logNowMinutes  = [15, 30, 45, 0]; // quarter-hour steps only
  readonly addPointMinutes = [0, 15, 30, 45]; // quarter-hour steps for Add Point

  // ── 1.81: Log Now domain + type drum ─────────────────────────
  logNowDomain: 'work' | 'personal' = 'work';
  logNowTypeIndex = 0;

  // ── 1.80: Add Point sheet ────────────────────────────────────
  addPointOpen      = false;
  addPointDomain: 'work' | 'personal' = 'work';
  addPointTypeIndex = 0;
  addPointTypeId    = '';
  addPointTitle     = '';
  addPointTime      = '09:00';
  addPointSaving    = false;

  // ── 1.83: Unified log-creation sheet (replaces 3 separate sheets) ──
  unifiedSheetOpen = false;
  unifiedSheetTab: 0 | 1 | 2 = 0; // 0=Add log, 1=Add point, 2=Start timer
  private uniTouchStartX = 0;

  // ── 1.82: Quick Prefs ─────────────────────────────────────────
  quickPrefsOpen    = false;
  quickPrefsSaving  = false;
  quickPrefsItems:  { logTypeId: string; defaultMins: number }[] = [];
  quickPrefsEdit    = new Set<string>();

  // ── 1.83: Day-level metadata ──────────────────────────────────
  dayMetadata:       DayMetadata | null = null;
  showImportantLogs  = false;

  readonly dayTypeOptions: { value: DayType; label: string }[] = [
    { value: 'working',    label: 'Working Day' },
    { value: 'wfh',        label: 'WFH'         },
    { value: 'holiday',    label: 'Holiday'      },
    { value: 'paid_leave', label: 'Paid Leave'   },
    { value: 'sick_leave', label: 'Sick Leave'   },
  ];
  dayTypeDropdownOpen = false;

  // ── 1.63: Continue Last Log ───────────────────────────────────
  // (reuses shortcutSaving / shortcutToast / toastTimer)

  // ── 1.71/1.72/1.73: Running Log ──────────────────────────────
  activeLog:     ActiveLog | null = null;
  activeLogTick  = 0;            // seconds elapsed since startedAt
  private activeLogTimerRef: any = null;

  // Start-timer sheet state
  startLogOpen      = false;
  startLogDomain: 'work' | 'personal' = 'work';
  startLogTypeIndex = 0;
  startLogTypeId    = '';
  startLogTitle     = '';
  startLogPlanned   = '';           // '' | '15' | '30' | '60' | '90' | '120'
  startLogSaving    = false;

  // ── 1.68: End-of-Day Wrap-Up ──────────────────────────────────
  wrapUpOpen    = false;
  wrapUpGaps:   Array<{ start: string; end: string; mins: number }> = [];
  wrapUpIdx     = 0;
  wrapUpTypeId  = '';
  wrapUpTitle   = '';
  wrapUpSaving  = false;
  private wrapUpDismissedDate = '';

  constructor(
    private logService:      LogService,
    private authService:     AuthService,
    private logTypeService:  LogTypeService,
    private prefService:     PreferenceService,
    private dayLevelService: DayLevelService,
  ) {}

  get todayLabel(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  get selectedDateStr(): string {
    const d = this.selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get dateShortLabel(): string {
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('renmito-theme') as 'dark' | 'light' | null;
    this.theme = savedTheme ?? 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);

    // ── 1.42: Apply localStorage palette instantly (zero-flicker fast path) ─
    const cachedPalette = loadSavedPalette();
    if (cachedPalette) { applyPaletteToDOM(cachedPalette); }

    // Default is collapsed; only expand if explicitly saved as 'false'
    this.navCollapsed = localStorage.getItem('renmito-nav-collapsed') !== 'false';

    this.isAuthenticated = this.authService.isLoggedIn();
    if (this.isAuthenticated) {
      this.currentUser = this.authService.getUser();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      this.selectedDate = today;
      this.loadLogs();
      // Pre-load log types for shortcuts bar and Log Now FAB
      this.logTypeService.getLogTypes().subscribe((t: any[]) => this.inlineLogTypes = t);
      // Sync palette from DB (may differ if the user changed it on another device)
      this.syncPaletteFromDB();
    }
  }

  onLoggedIn(): void {
    this.isAuthenticated = true;
    this.currentUser     = this.authService.getUser();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.selectedDate = today;
    this.loadLogs();
    // Always fetch the freshest palette from DB right after login
    this.syncPaletteFromDB();
  }

  /** Fetch preferences from DB — apply palette + restore any running log.
   *  1.52: If the user has no saved palette in DB, wipe any stale cache that may
   *  have been loaded from localStorage before we knew which user was logging in —
   *  this prevents one user's theme from bleeding into another user's session.
   *  1.71: activeLog is restored here so the ticking timer resumes even after a
   *  page reload or when the user opens the app on a different device. */
  private syncPaletteFromDB(): void {
    this.prefService.getPreferences().subscribe(prefs => {
      if (prefs?.palette) {
        applyPaletteToDOM(prefs.palette);
        localStorage.setItem('renmito-palette', JSON.stringify(prefs.palette));
      } else {
        clearPaletteFromDOM();
      }
      // 1.71: Resume running log ticker if one was already active
      if (prefs?.activeLog) {
        this.activeLog = prefs.activeLog;
        this.startActiveLogTimer();
      } else {
        this.stopActiveLogTimer();
        this.activeLog = null;
      }
      // 1.82: Load quick shortcuts
      this.quickPrefsItems = prefs?.quickShortcuts ?? [];
    });
  }

  logout(): void {
    this.confirmDialog = {
      title: 'Log out',
      message: 'Are you sure you want to log out of Renmito?',
      okLabel: 'Log out',
      onConfirm: () => {
        this.authService.logout();
        this.logTypeService.clearCache();
        // 1.52: Wipe theme cache on logout so the next user on this browser
        // cannot see a previous user's palette or dark/light preference
        clearPaletteFromDOM();
        localStorage.removeItem('renmito-theme');
        this.theme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
        this.stopActiveLogTimer();
        this.activeLog       = null;
        this.isAuthenticated = false;
        this.currentUser     = null;
        this.logs            = [];
      }
    };
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('renmito-theme', this.theme);
  }

  // ── 1.22 ────────────────────────────────────────────────
  toggleNav(): void {
    this.navCollapsed = !this.navCollapsed;
    localStorage.setItem('renmito-nav-collapsed', String(this.navCollapsed));
  }

  // ── 1.50: Profile popup ───────────────────────────────────
  openProfile(): void {
    this.profilePass    = { current: '', next: '', confirm: '' };
    this.profileError   = '';
    this.profileSuccess = '';
    this.showProfile    = true;
  }

  closeProfile(): void { this.showProfile = false; }

  onProfileOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('profile-overlay')) this.closeProfile();
  }

  submitChangePassword(): void {
    this.profileError   = '';
    this.profileSuccess = '';
    if (this.profilePass.next !== this.profilePass.confirm) {
      this.profileError = 'New passwords do not match.'; return;
    }
    if (this.profilePass.next.length < 8) {
      this.profileError = 'New password must be at least 8 characters.'; return;
    }
    this.profileChanging = true;
    this.authService.changePassword(this.profilePass.current, this.profilePass.next).subscribe({
      next: () => {
        this.profileChanging = false;
        this.profileSuccess  = 'Password updated successfully.';
        this.profilePass     = { current: '', next: '', confirm: '' };
      },
      error: (err) => {
        this.profileChanging = false;
        this.profileError    = err?.error?.error ?? 'Failed to update password.';
      }
    });
  }

  // ── 1.31: Day navigation ────────────────────────────────
  get isToday(): boolean {
    const t = new Date();
    return this.selectedDate.getFullYear() === t.getFullYear() &&
           this.selectedDate.getMonth()    === t.getMonth()    &&
           this.selectedDate.getDate()     === t.getDate();
  }

  prevDay(): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    this.selectedDate     = d;
    this.highlightedLogId = null;
    this.metricLogIds     = null;
    this.loadLogs();
  }

  nextDay(): void {
    if (this.isToday) return;
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    this.selectedDate     = d;
    this.highlightedLogId = null;
    this.metricLogIds     = null;
    this.loadLogs();
  }

  goToToday(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.selectedDate     = today;
    this.highlightedLogId = null;
    this.metricLogIds     = null;
    this.loadLogs();
  }

  // ── 1.23 ────────────────────────────────────────────────
  openCalendarPopup(): void {
    this.pendingDate = new Date(this.selectedDate);
    this.showCalendarPopup = true;
  }

  closeCalendarPopup(): void {
    this.showCalendarPopup = false;
  }

  onPendingDateSelected(date: Date): void {
    this.pendingDate = date;
  }

  applyPendingDate(): void {
    this.selectedDate    = this.pendingDate;
    this.highlightedLogId = null;
    this.loadLogs();
    this.closeCalendarPopup();
  }

  onCalOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('cal-overlay')) {
      this.closeCalendarPopup();
    }
  }

  // ── Log loading ──────────────────────────────────────────
  loadLogs(): void {
    this.isLoading = true;
    this.logService.getLogsForDate(this.selectedDate).subscribe({
      next: (logs) => {
        this.logs = logs.sort((a, b) =>
          this.timeToMinutes(a.startAt) - this.timeToMinutes(b.startAt)
        );
        this.isLoading = false;
      },
      error: () => {
        this.logs      = [];
        this.isLoading = false;
      }
    });
    this.loadDayMetadata();
  }

  // ── 1.83: Day metadata ────────────────────────────────────
  private loadDayMetadata(): void {
    this.dayLevelService.getMetadata(this.selectedDateStr).subscribe({
      next:  meta => { this.dayMetadata = meta; },
      error: ()   => { this.dayMetadata = null; }
    });
  }

  openImportantLogs(): void {
    this.showImportantLogs = true;
  }

  get selectedDayTypeLabel(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.label ?? 'Day Type';
  }

  setDayType(dayType: DayType): void {
    if (!this.dayMetadata) return;
    // Optimistic update
    this.dayMetadata = { ...this.dayMetadata, dayType };
    this.dayLevelService.setDayType(this.selectedDateStr, dayType).subscribe({
      next:  meta  => { if (meta) this.dayMetadata = meta; },
      error: ()    => { this.loadDayMetadata(); } // revert on error
    });
  }

  focusLog(log: LogEntry): void {
    this.highlightedLogId = log.id;
    this.timelineRef?.scrollToLog(log);
  }

  // ── 1.54: Inline list editing ────────────────────────────
  get inlineCurrentColor(): string | null {
    const t = this.inlineLogTypes.find((t: any) => t._id === this.inlineEdit.logTypeId);
    return t?.color ?? null;
  }

  get sortedLogs(): LogEntry[] {
    return this.logSortOrder === 'asc' ? this.logs : [...this.logs].reverse();
  }

  toggleLogSort(): void {
    this.logSortOrder = this.logSortOrder === 'asc' ? 'desc' : 'asc';
  }

  onLogItemClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();
    if (this.inlineEditId === log.id) return;
    this.inlineEditId = log.id;
    this.inlineEdit = {
      title:     log.title,
      startAt:   log.startAt,
      endAt:     log.endAt ?? '',
      logTypeId: log.logType?.id ?? ''
    };
    this.highlightedLogId = log.id;
    this.timelineRef?.scrollToLog(log);
    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((types: any[]) => this.inlineLogTypes = types);
    }
  }

  cancelInlineEdit(): void { this.inlineEditId = null; }

  confirmDeleteLog(log: LogEntry): void {
    this.cancelInlineEdit();
    const label = log.title || log.logType?.name || 'this log';
    this.confirmDialog = {
      title:   'Delete log',
      message: `Delete "${label}"?`,
      detail:  'This action cannot be undone.',
      okLabel: 'Delete',
      onConfirm: () => this.onLogDeleted(log.id)
    };
  }

  saveInlineEdit(log: LogEntry): void {
    if (this.inlineSaving) return;
    this.inlineSaving = true;
    const payload: Partial<CreateLogEntry> = log.entryType === 'point'
      ? { title: this.inlineEdit.title, logTypeId: this.inlineEdit.logTypeId,
          entryType: 'point', pointTime: this.inlineEdit.startAt }
      : { title: this.inlineEdit.title, logTypeId: this.inlineEdit.logTypeId,
          startTime: this.inlineEdit.startAt, endTime: this.inlineEdit.endAt };
    this.logService.updateLog(this.selectedDate, log.id, payload).subscribe({
      next:  () => { this.inlineSaving = false; this.inlineEditId = null; this.loadLogs(); },
      error: () => { this.inlineSaving = false; alert('Failed to save changes.'); }
    });
  }

  onInlineKeydown(event: KeyboardEvent, log: LogEntry): void {
    if (event.key === 'Enter')  { event.preventDefault(); this.saveInlineEdit(log); }
    if (event.key === 'Escape') { this.cancelInlineEdit(); }
  }

  /** Shift a time field by deltaMins (±10), clamped to 00:00–23:59. */
  adjustTime(field: 'startAt' | 'endAt', deltaMins: number): void {
    const val = this.inlineEdit[field];
    if (!val) return;
    const [h, m] = val.split(':').map(Number);
    const clamped = Math.max(0, Math.min(1439, h * 60 + m + deltaMins));
    this.inlineEdit[field] = `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
  }

  openAddLogForm(): void {
    const lastLog = this.logs[this.logs.length - 1];
    const rawStart  = lastLog
      ? this.timeToMinutes(lastLog.endAt ?? lastLog.startAt)
      : this.timeToMinutes('09:00');
    const startMins = Math.min(rawStart, 22 * 60 + 30);
    this.formStartTime = this.minsToTimeStr(startMins);
    this.formEndTime   = this.minsToTimeStr(Math.min(startMins + 60, 23 * 60 + 59));
    this.editingEntry  = null;
    this.showForm      = true;
  }

  // ── 1.62: Quick Shortcuts ─────────────────────────────────────

  /** Top log types for the shortcuts bar — uses configured list if set, else smart defaults. */
  get shortcutDisplayTypes(): any[] {
    if (!this.inlineLogTypes.length) return [];
    if (this.quickPrefsItems.length > 0) {
      return this.quickPrefsItems
        .map(p => this.inlineLogTypes.find((lt: any) => lt._id === p.logTypeId))
        .filter(Boolean);
    }
    const usedIds = new Set(this.logs.map(l => l.logType?.id).filter(Boolean));
    return [...this.inlineLogTypes]
      .sort((a, b) => {
        const aUsed = usedIds.has(a._id) ? 0 : 1;
        const bUsed = usedIds.has(b._id) ? 0 : 1;
        if (aUsed !== bUsed) return aUsed - bUsed;
        if (a.domain === 'work' && b.domain !== 'work') return -1;
        if (a.domain !== 'work' && b.domain === 'work') return 1;
        return 0;
      })
      .slice(0, 6);
  }

  // ── 1.84: Show footer only when view-area is scrolled to bottom (mobile) ──
  onViewAreaScroll(e: Event): void {
    const el = e.target as HTMLElement;
    this.footerVisible = el.scrollHeight - el.scrollTop <= el.clientHeight + 24;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.quickActionChip) this.quickActionChip = null;
  }

  onShortcutTap(lt: any): void {
    if (this.shortcutSaving) return;
    // Deselect if same chip tapped again
    if (this.quickActionChip?._id === lt._id) {
      this.quickActionChip = null;
      return;
    }
    // Select chip and populate defaults
    this.quickActionChip   = lt;
    this.quickActionAnchor = 'conclude';
    const pref = this.quickPrefsItems.find(p => p.logTypeId === lt._id);
    const rawMins = pref?.defaultMins ?? 30;
    // Snap to nearest supported duration
    const durations = [15, 30, 45, 60];
    this.quickActionDuration = durations.reduce((prev, curr) =>
      Math.abs(curr - rawMins) < Math.abs(prev - rawMins) ? curr : prev
    );
  }

  commitQuickLog(): void {
    if (!this.quickActionChip || this.shortcutSaving) return;
    const lt      = this.quickActionChip;
    const nowMins = this.timeToMinutes(this.currentTimeStr());
    let startMins: number, endMins: number;
    if (this.quickActionAnchor === 'start') {
      startMins = nowMins;
      endMins   = nowMins + this.quickActionDuration;
    } else {
      endMins   = nowMins;
      startMins = nowMins - this.quickActionDuration;
    }
    if (startMins < 0)          startMins = 0;
    if (endMins   > 24 * 60)    endMins   = 24 * 60;
    if (endMins   <= startMins) return;

    const startStr = this.minsToTimeStr(startMins);
    const endStr   = this.minsToTimeStr(endMins);

    this.shortcutSaving = true;
    this.logService.createLog(this.selectedDate, {
      title:     lt.name,
      logTypeId: lt._id,
      startTime: startStr,
      endTime:   endStr,
    }).subscribe({
      next: (created) => {
        this.shortcutSaving   = false;
        this.quickActionChip  = null;
        this.loadLogs();
        const diff = endMins - startMins;
        const h = Math.floor(diff / 60), m = diff % 60;
        const dur = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
        this.shortcutToast = { message: `${lt.name} · ${dur}`, logId: created.id };
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.shortcutToast = null, 3000);
      },
      error: () => { this.shortcutSaving = false; }
    });
  }

  undoShortcut(): void {
    if (!this.shortcutToast) return;
    const id = this.shortcutToast.logId;
    this.shortcutToast = null;
    clearTimeout(this.toastTimer);
    this.logService.deleteLog(this.selectedDate, id).subscribe({
      next:  () => this.loadLogs(),
      error: () => {}
    });
  }

  // ── 1.71/1.72/1.73: Running Log ──────────────────────────────

  /** MM:SS or H:MM:SS elapsed since the running log was started. */
  get activeLogElapsedStr(): string {
    const s   = this.activeLogTick;
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  /** 0–100 progress through the planned duration. 0 if no plan set. */
  get activeLogPlannedPct(): number {
    if (!this.activeLog?.plannedMins) return 0;
    return Math.min(100, (this.activeLogTick / (this.activeLog.plannedMins * 60)) * 100);
  }

  /** Display name for the running log type. */
  get activeLogTypeName(): string {
    if (!this.activeLog) return '';
    const lt = this.inlineLogTypes.find((t: any) => t._id === this.activeLog!.logTypeId);
    return lt?.name ?? 'Running Log';
  }

  /** Color for the running log dot. */
  get activeLogTypeColor(): string {
    if (!this.activeLog) return '#9B9B9B';
    const lt = this.inlineLogTypes.find((t: any) => t._id === this.activeLog!.logTypeId);
    return lt?.color ?? '#9B9B9B';
  }

  private startActiveLogTimer(): void {
    this.stopActiveLogTimer();
    if (!this.activeLog) return;
    const update = () => {
      const elapsed = Date.now() - new Date(this.activeLog!.startedAt).getTime();
      this.activeLogTick = Math.max(0, Math.floor(elapsed / 1000));
    };
    update();
    this.activeLogTimerRef = setInterval(update, 1000);
  }

  private stopActiveLogTimer(): void {
    if (this.activeLogTimerRef) {
      clearInterval(this.activeLogTimerRef);
      this.activeLogTimerRef = null;
    }
  }

  /** Opens the unified sheet on the "Start Timer" tab. */
  openStartLog(): void {
    this._prepStartLog();
    this.unifiedSheetTab  = 2;
    this.unifiedSheetOpen = true;
  }

  private _prepStartLog(): void {
    this.startLogDomain = 'work';
    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((t: any[]) => {
        this.inlineLogTypes = t;
        this._initStartLog();
      });
    } else {
      this._initStartLog();
    }
  }

  private _initStartLog(): void {
    const lastTypeId = this.logs.length
      ? (this.logs[this.logs.length - 1].logType?.id ?? null)
      : null;
    const filtered = this.startLogFilteredTypes;
    const idx = lastTypeId ? filtered.findIndex((t: any) => t._id === lastTypeId) : -1;
    this.startLogTypeIndex = idx >= 0 ? idx : 0;
    this.startLogTypeId    = filtered[this.startLogTypeIndex]?._id ?? this.inlineLogTypes[0]?._id ?? '';
    this.startLogTitle     = '';
    this.startLogPlanned   = '';
    setTimeout(() => this.scrollStartLogTypeDrum(), 40);
  }

  closeStartLog(): void { this.unifiedSheetOpen = false; }

  get startLogFilteredTypes(): any[] {
    return this.inlineLogTypes.filter((lt: any) => lt.domain === this.startLogDomain);
  }

  setStartLogDomain(domain: 'work' | 'personal'): void {
    this.startLogDomain    = domain;
    this.startLogTypeIndex = 0;
    this.startLogTypeId    = this.startLogFilteredTypes[0]?._id ?? '';
    setTimeout(() => this.scrollStartLogTypeDrum(), 20);
  }

  onStartLogTypeScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.startLogFilteredTypes.length - 1, Math.round(el.scrollTop / 25)));
    if (idx === this.startLogTypeIndex) return;
    this.startLogTypeIndex = idx;
    this.startLogTypeId    = this.startLogFilteredTypes[idx]?._id ?? '';
  }

  private scrollStartLogTypeDrum(): void {
    const el = document.querySelector('.ln-drum-sl-types') as HTMLElement | null;
    if (el) el.scrollTop = this.startLogTypeIndex * 25;
  }

  /** Sends PUT /preferences/active-log — server records startedAt. */
  saveStartLog(): void {
    if (this.startLogSaving || !this.startLogTypeId) return;
    const lt          = this.inlineLogTypes.find((t: any) => t._id === this.startLogTypeId);
    const title       = this.startLogTitle.trim() || (lt?.name ?? 'Log');
    const plannedMins = this.startLogPlanned ? parseInt(this.startLogPlanned, 10) : null;

    this.startLogSaving = true;
    this.prefService.startActiveLog({ logTypeId: this.startLogTypeId, title, plannedMins })
      .subscribe({
        next: (activeLog) => {
          this.startLogSaving   = false;
          this.unifiedSheetOpen = false;
          if (activeLog) {
            this.activeLog = activeLog;
            this.startActiveLogTimer();
          }
        },
        error: () => { this.startLogSaving = false; }
      });
  }

  /**
   * 1.71 — Stops the running log: creates the log entry then clears activeLog from DB.
   * If the log started before today, start time is clamped to 00:00 of today.
   */
  stopRunningLog(): void {
    if (!this.activeLog) return;

    const startedAt     = new Date(this.activeLog.startedAt);
    const now           = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    const effectiveStart = startedAt < todayMidnight ? todayMidnight : startedAt;
    const startAt = `${String(effectiveStart.getHours()).padStart(2, '0')}:${String(effectiveStart.getMinutes()).padStart(2, '0')}`;
    const endAt   = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const lt    = this.inlineLogTypes.find((t: any) => t._id === this.activeLog!.logTypeId);
    const title = this.activeLog.title || (lt?.name ?? 'Log');

    // Optimistically clear local state for instant UI feedback
    this.stopActiveLogTimer();
    const savedLog = { ...this.activeLog };
    this.activeLog = null;

    this.logService.createLog(this.selectedDate, {
      title,
      logTypeId: savedLog.logTypeId,
      startTime: startAt,
      endTime:   endAt,
    }).subscribe({
      next: () => {
        this.prefService.stopActiveLog().subscribe();
        this.loadLogs();
        const diff = this.timeToMinutes(endAt) - this.timeToMinutes(startAt);
        if (diff > 0) {
          const h = Math.floor(diff / 60), m = diff % 60;
          const dur = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
          this.shortcutToast = { message: `${lt?.name ?? 'Log'} · ${dur}`, logId: '' };
          clearTimeout(this.toastTimer);
          this.toastTimer = setTimeout(() => this.shortcutToast = null, 3500);
        }
      },
      error: () => {
        // Restore if save failed
        this.activeLog = savedLog;
        this.startActiveLogTimer();
        alert('Failed to save the running log. Timer has been resumed.');
      }
    });
  }

  // ── 1.61: Log Now FAB ─────────────────────────────────────────

  /**
   * Smart default start: end of last log, capped to now - 30 min if
   * the last log ended more than 30 min ago.
   */
  private get smartDefaultStart(): string {
    const last    = this.logs[this.logs.length - 1];
    const nowMins = this.timeToMinutes(this.currentTimeStr());
    if (!last) return this.minsToTimeStr(Math.max(0, nowMins - 30));
    const lastEndMins = this.timeToMinutes(last.endAt ?? last.startAt);
    return this.minsToTimeStr(
      nowMins - lastEndMins > 30 ? Math.max(0, nowMins - 30) : lastEndMins
    );
  }

  // ── 1.78: Log Now drum picker getters ──────────────────────
  get logNowStartHour():   number { return +this.logNowStart.split(':')[0]; }
  get logNowStartMinute(): number { return +this.logNowStart.split(':')[1]; }
  get logNowEndHour():     number { return +this.logNowEnd.split(':')[0]; }
  get logNowEndMinute():   number { return +this.logNowEnd.split(':')[1]; }

  /** Map a raw minute (0-59) to the nearest quarter-hour index in logNowMinutes ([15,30,45,0]). */
  private minuteToQtrIndex(m: number): number {
    // snap to 0, 15, 30, 45 → find index in [15,30,45,0]
    const snapped = Math.round(m / 15) * 15 % 60;
    const idx = this.logNowMinutes.indexOf(snapped);
    return idx >= 0 ? idx : 0;
  }

  /** Scroll all four Log Now drums to match the current start/end times. */
  private scrollLogNowDrums(): void {
    const item = 25; // px per drum row
    const sh = document.querySelector('.ln-drum-start-h') as HTMLElement | null;
    const sm = document.querySelector('.ln-drum-start-m') as HTMLElement | null;
    const eh = document.querySelector('.ln-drum-end-h')   as HTMLElement | null;
    const em = document.querySelector('.ln-drum-end-m')   as HTMLElement | null;
    if (sh) sh.scrollTop = this.logNowStartHour                           * item;
    if (sm) sm.scrollTop = this.minuteToQtrIndex(this.logNowStartMinute)  * item;
    if (eh) eh.scrollTop = this.logNowEndHour                             * item;
    if (em) em.scrollTop = this.minuteToQtrIndex(this.logNowEndMinute)    * item;
  }

  onLogNowStartHourScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const h  = Math.max(0, Math.min(23, Math.round(el.scrollTop / 25)));
    if (h === this.logNowStartHour) return;
    this.logNowStart = `${String(h).padStart(2, '0')}:${this.logNowStart.split(':')[1]}`;
  }
  onLogNowStartMinuteScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.logNowMinutes.length - 1, Math.round(el.scrollTop / 25)));
    const m   = this.logNowMinutes[idx];
    if (m === this.logNowStartMinute) return;
    this.logNowStart = `${this.logNowStart.split(':')[0]}:${String(m).padStart(2, '0')}`;
  }
  onLogNowEndHourScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const h  = Math.max(0, Math.min(23, Math.round(el.scrollTop / 25)));
    if (h === this.logNowEndHour) return;
    this.logNowEnd = `${String(h).padStart(2, '0')}:${this.logNowEnd.split(':')[1]}`;
  }
  onLogNowEndMinuteScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.logNowMinutes.length - 1, Math.round(el.scrollTop / 25)));
    const m   = this.logNowMinutes[idx];
    if (m === this.logNowEndMinute) return;
    this.logNowEnd = `${this.logNowEnd.split(':')[0]}:${String(m).padStart(2, '0')}`;
  }

  /** Snap a HH:MM string to the nearest quarter-hour. */
  private snapToQuarter(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const snapped = Math.round(m / 15) * 15;
    if (snapped === 60) {
      const newH = Math.min(23, h + 1);
      return `${String(newH).padStart(2, '0')}:00`;
    }
    return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
  }

  openLogNow(): void {
    this._prepLogNow();
    this.unifiedSheetTab  = 0;
    this.unifiedSheetOpen = true;
    setTimeout(() => { this.scrollLogNowDrums(); this.scrollLogNowTypeDrum(); }, 40);
  }

  private _prepLogNow(): void {
    const now      = this.snapToQuarter(this.currentTimeStr());
    const startStr = this.snapToQuarter(this.smartDefaultStart);
    this.logNowStart     = startStr;
    this.logNowEnd       = now;
    this.logNowDomain    = 'work';
    this.logNowTypeIndex = 0;
    this.logNowTitle     = '';
    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((t: any[]) => {
        this.inlineLogTypes = t;
        this._initLogNowType();
        setTimeout(() => { this.scrollLogNowDrums(); this.scrollLogNowTypeDrum(); }, 40);
      });
    } else {
      this._initLogNowType();
    }
  }

  private _initLogNowType(): void {
    const workTypes = this.inlineLogTypes.filter((lt: any) => lt.domain === 'work');
    this.logNowTypeId    = workTypes[0]?._id ?? this.inlineLogTypes[0]?._id ?? '';
    this.logNowTypeIndex = 0;
    this.logNowDomain    = 'work';
  }

  closeLogNow(): void { this.unifiedSheetOpen = false; }
  closeUnifiedSheet(): void { this.unifiedSheetOpen = false; }

  onUnifiedSwipeStart(e: TouchEvent): void {
    this.uniTouchStartX = e.changedTouches[0].clientX;
  }
  onUnifiedSwipeEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.uniTouchStartX;
    if (dx > 60 && this.unifiedSheetTab > 0) {
      this.unifiedSheetTab = (this.unifiedSheetTab - 1) as 0|1|2;
      this._onTabSwitch();
    } else if (dx < -60 && this.unifiedSheetTab < 2) {
      this.unifiedSheetTab = (this.unifiedSheetTab + 1) as 0|1|2;
      this._onTabSwitch();
    }
  }
  switchTab(tab: 0|1|2): void {
    this.unifiedSheetTab = tab;
    this._onTabSwitch();
  }
  private _onTabSwitch(): void {
    // Re-init scroll drums for the newly visible tab
    setTimeout(() => {
      if (this.unifiedSheetTab === 0) { this.scrollLogNowDrums(); this.scrollLogNowTypeDrum(); }
      if (this.unifiedSheetTab === 1) { this.scrollAddPointTypeDrum(); this.scrollAddPointTimeDrums(); }
      if (this.unifiedSheetTab === 2) { this.scrollStartLogTypeDrum(); }
    }, 40);
  }

  get logNowFilteredTypes(): any[] {
    return this.inlineLogTypes.filter((lt: any) => lt.domain === this.logNowDomain);
  }

  setLogNowDomain(domain: 'work' | 'personal'): void {
    this.logNowDomain    = domain;
    this.logNowTypeIndex = 0;
    this.logNowTypeId    = this.logNowFilteredTypes[0]?._id ?? '';
    setTimeout(() => this.scrollLogNowTypeDrum(), 20);
  }

  onLogNowTypeScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.logNowFilteredTypes.length - 1, Math.round(el.scrollTop / 25)));
    if (idx === this.logNowTypeIndex) return;
    this.logNowTypeIndex = idx;
    this.logNowTypeId    = this.logNowFilteredTypes[idx]?._id ?? '';
  }

  private scrollLogNowTypeDrum(): void {
    const el = document.querySelector('.ln-drum-ln-types') as HTMLElement | null;
    if (el) el.scrollTop = this.logNowTypeIndex * 25;
  }

  saveLogNow(): void {
    if (this.logNowSaving || !this.logNowTypeId) return;
    const lt    = this.inlineLogTypes.find((t: any) => t._id === this.logNowTypeId);
    const title = this.logNowTitle.trim() || (lt?.name ?? 'Log');
    this.logNowSaving = true;
    this.logService.createLog(this.selectedDate, {
      title,
      logTypeId: this.logNowTypeId,
      startTime: this.logNowStart,
      endTime:   this.logNowEnd,
    }).subscribe({
      next:  () => { this.logNowSaving = false; this.unifiedSheetOpen = false; this.loadLogs(); },
      error: () => { this.logNowSaving = false; }
    });
  }

  // ── 1.80: Add Point ──────────────────────────────────────────
  get addPointFilteredTypes(): any[] {
    return this.inlineLogTypes.filter((lt: any) => lt.domain === this.addPointDomain);
  }

  openAddPoint(): void {
    this._prepAddPoint();
    this.unifiedSheetTab  = 1;
    this.unifiedSheetOpen = true;
    setTimeout(() => { this.scrollAddPointTypeDrum(); this.scrollAddPointTimeDrums(); }, 40);
  }

  private _prepAddPoint(): void {
    this.addPointDomain    = 'work';
    this.addPointTypeIndex = 0;
    this.addPointTitle     = '';
    const n = new Date();
    this.addPointTime = this.snapToQuarter(
      `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
    );
    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((t: any[]) => {
        this.inlineLogTypes = t;
        this._initAddPoint();
        setTimeout(() => { this.scrollAddPointTypeDrum(); this.scrollAddPointTimeDrums(); }, 40);
      });
    } else {
      this._initAddPoint();
    }
  }

  private _initAddPoint(): void {
    const types = this.addPointFilteredTypes;
    this.addPointTypeId    = types[0]?._id ?? '';
    this.addPointTypeIndex = 0;
  }

  closeAddPoint(): void { this.unifiedSheetOpen = false; }

  setAddPointDomain(domain: 'work' | 'personal'): void {
    this.addPointDomain    = domain;
    this.addPointTypeIndex = 0;
    this.addPointTypeId    = this.addPointFilteredTypes[0]?._id ?? '';
    setTimeout(() => this.scrollAddPointTypeDrum(), 20);
  }

  onAddPointTypeScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.addPointFilteredTypes.length - 1, Math.round(el.scrollTop / 25)));
    if (idx === this.addPointTypeIndex) return;
    this.addPointTypeIndex = idx;
    this.addPointTypeId    = this.addPointFilteredTypes[idx]?._id ?? '';
  }

  private scrollAddPointTypeDrum(): void {
    const el = document.querySelector('.ln-drum-ap-types') as HTMLElement | null;
    if (el) el.scrollTop = this.addPointTypeIndex * 25;
  }

  get addPointHour():   number { return +this.addPointTime.split(':')[0]; }
  get addPointMinute(): number { return +this.addPointTime.split(':')[1]; }

  private addPointMinuteToIdx(m: number): number {
    const snapped = Math.round(m / 15) * 15 % 60;
    const idx = this.addPointMinutes.indexOf(snapped);
    return idx >= 0 ? idx : 0;
  }

  private scrollAddPointTimeDrums(): void {
    const item = 25;
    const ah = document.querySelector('.ln-drum-ap-h') as HTMLElement | null;
    const am = document.querySelector('.ln-drum-ap-m') as HTMLElement | null;
    if (ah) ah.scrollTop = this.addPointHour * item;
    if (am) am.scrollTop = this.addPointMinuteToIdx(this.addPointMinute) * item;
  }

  onAddPointHourScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const h  = Math.max(0, Math.min(23, Math.round(el.scrollTop / 25)));
    if (h === this.addPointHour) return;
    this.addPointTime = `${String(h).padStart(2, '0')}:${this.addPointTime.split(':')[1]}`;
  }

  onAddPointMinuteScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.addPointMinutes.length - 1, Math.round(el.scrollTop / 25)));
    const m   = this.addPointMinutes[idx];
    if (m === this.addPointMinute) return;
    this.addPointTime = `${this.addPointTime.split(':')[0]}:${String(m).padStart(2, '0')}`;
  }

  saveAddPoint(): void {
    if (this.addPointSaving || !this.addPointTypeId) return;
    const lt    = this.inlineLogTypes.find((t: any) => t._id === this.addPointTypeId);
    const title = this.addPointTitle.trim() || (lt?.name ?? 'Point');
    this.addPointSaving = true;
    this.logService.createLog(this.selectedDate, {
      title,
      logTypeId: this.addPointTypeId,
      entryType: 'point',
      pointTime: this.addPointTime,
      startTime: this.addPointTime,
      endTime:   this.addPointTime,
    }).subscribe({
      next:  () => { this.addPointSaving = false; this.unifiedSheetOpen = false; this.loadLogs(); },
      error: () => { this.addPointSaving = false; }
    });
  }

  // ── 1.82: Quick Prefs ─────────────────────────────────────────

  get quickPrefsWorkTypes(): any[] {
    return this.inlineLogTypes.filter((lt: any) => lt.domain === 'work');
  }
  get quickPrefsPersonalTypes(): any[] {
    return this.inlineLogTypes.filter((lt: any) => lt.domain === 'personal');
  }

  openQuickPrefs(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((t: any[]) => {
        this.inlineLogTypes = t;
        this._doOpenQuickPrefs();
      });
    } else {
      this._doOpenQuickPrefs();
    }
  }

  private _doOpenQuickPrefs(): void {
    this.quickPrefsEdit = new Set(this.quickPrefsItems.map(p => p.logTypeId));
    this.quickPrefsOpen = true;
  }

  closeQuickPrefs(): void { this.quickPrefsOpen = false; }

  isInQuickPrefs(logTypeId: string): boolean {
    return this.quickPrefsEdit.has(logTypeId);
  }

  toggleQuickPref(logTypeId: string): void {
    if (this.quickPrefsEdit.has(logTypeId)) {
      this.quickPrefsEdit.delete(logTypeId);
    } else {
      this.quickPrefsEdit.add(logTypeId);
    }
    // Force Angular change detection
    this.quickPrefsEdit = new Set(this.quickPrefsEdit);
  }

  saveQuickPrefs(): void {
    if (this.quickPrefsSaving) return;
    const shortcuts = [...this.quickPrefsEdit].map(id => ({ logTypeId: id, defaultMins: 30 }));
    this.quickPrefsSaving = true;
    this.prefService.updateQuickShortcuts(shortcuts).subscribe({
      next: () => {
        this.quickPrefsItems  = shortcuts;
        this.quickPrefsSaving = false;
        this.quickPrefsOpen   = false;
      },
      error: () => { this.quickPrefsSaving = false; }
    });
  }

  resetQuickPrefs(): void {
    this.quickPrefsEdit = new Set<string>();
  }

  // ── 1.63: Continue Last Log ──────────────────────────────────

  /** Last range log that has an end time — used by the Continue chip. */
  get lastRangeLog(): LogEntry | null {
    const range = this.logs.filter(l => l.entryType === 'range' && !!l.endAt);
    return range.length ? range[range.length - 1] : null;
  }

  continueLastLog(): void {
    const last = this.lastRangeLog;
    if (!last || this.shortcutSaving) return;
    const now       = this.currentTimeStr();
    const startStr  = last.endAt!;
    const startMins = this.timeToMinutes(startStr);
    const endMins   = this.timeToMinutes(now);
    if (endMins <= startMins) return;

    this.shortcutSaving = true;
    this.logService.createLog(this.selectedDate, {
      title:     last.title || (last.logType?.name ?? 'Log'),
      logTypeId: last.logType?.id ?? '',
      startTime: startStr,
      endTime:   now,
    }).subscribe({
      next: (created) => {
        this.shortcutSaving = false;
        this.loadLogs();
        const diff = endMins - startMins;
        const h = Math.floor(diff / 60), m = diff % 60;
        const dur = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
        const name = last.logType?.name ?? 'Log';
        this.shortcutToast = { message: `${name} continued · ${dur}`, logId: created.id };
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.shortcutToast = null, 3000);
      },
      error: () => { this.shortcutSaving = false; }
    });
  }

  // ── 1.68: End-of-Day Wrap-Up ─────────────────────────────────

  private localDateKey(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** Unlogged gaps ≥15 min between consecutive range logs for the selected day. */
  get todayGaps(): Array<{ start: string; end: string; mins: number }> {
    const sorted = this.logs
      .filter(l => l.entryType === 'range' && l.startAt && l.endAt)
      .sort((a, b) => this.timeToMinutes(a.startAt) - this.timeToMinutes(b.startAt));
    const gaps: Array<{ start: string; end: string; mins: number }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapStart = sorted[i].endAt!;
      const gapEnd   = sorted[i + 1].startAt;
      const gapMins  = this.timeToMinutes(gapEnd) - this.timeToMinutes(gapStart);
      if (gapMins >= 15) gaps.push({ start: gapStart, end: gapEnd, mins: gapMins });
    }
    return gaps;
  }

  /** Show the wrap-up banner after 5 PM on today's date when gaps exist. */
  get showWrapUpBanner(): boolean {
    return this.isToday
      && !this.wrapUpOpen
      && new Date().getHours() >= 17
      && this.wrapUpDismissedDate !== this.localDateKey(new Date())
      && this.todayGaps.length > 0;
  }

  get totalGapLabel(): string { return this.formatGapMins(this.todayGaps.reduce((s, g) => s + g.mins, 0)); }
  get wrapUpCurrentGap() { return this.wrapUpGaps[this.wrapUpIdx] ?? null; }

  formatGapMins(mins: number): string {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  openWrapUp(): void {
    this.wrapUpGaps    = [...this.todayGaps];
    this.wrapUpIdx     = 0;
    this.wrapUpTypeId  = this.inlineLogTypes[0]?._id ?? '';
    this.wrapUpTitle   = '';
    this.wrapUpOpen    = true;
  }

  closeWrapUp(): void { this.wrapUpOpen = false; }

  dismissWrapUp(): void { this.wrapUpDismissedDate = this.localDateKey(new Date()); }

  wrapUpSkip(): void { this.advanceWrapUp(); }

  wrapUpSave(): void {
    const gap = this.wrapUpCurrentGap;
    if (!gap || this.wrapUpSaving || !this.wrapUpTypeId) return;
    const lt    = this.inlineLogTypes.find((t: any) => t._id === this.wrapUpTypeId);
    const title = this.wrapUpTitle.trim() || (lt?.name ?? 'Log');
    this.wrapUpSaving = true;
    this.logService.createLog(this.selectedDate, {
      title,
      logTypeId: this.wrapUpTypeId,
      startTime: gap.start,
      endTime:   gap.end,
    }).subscribe({
      next:  () => { this.wrapUpSaving = false; this.loadLogs(); this.advanceWrapUp(); },
      error: () => { this.wrapUpSaving = false; }
    });
  }

  private advanceWrapUp(): void {
    if (this.wrapUpIdx < this.wrapUpGaps.length - 1) {
      this.wrapUpIdx++;
      this.wrapUpTypeId = this.inlineLogTypes[0]?._id ?? '';
      this.wrapUpTitle  = '';
    } else {
      this.wrapUpOpen          = false;
      this.wrapUpDismissedDate = this.localDateKey(new Date());
    }
  }

  private minsToTimeStr(mins: number): string {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  private currentTimeStr(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }

  getDuration(log: LogEntry): string {
    if (log.entryType === 'point' || !log.endAt) return '';
    const diff = this.timeToMinutes(log.endAt) - this.timeToMinutes(log.startAt);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60), m = diff % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  onSelectionChanged(_selection: DragSelection): void { /* no-op */ }

  // ── 1.30 ────────────────────────────────────────────────
  onCardHighlight(ids: string[] | null): void {
    this.metricLogIds = ids ? new Set(ids) : null;
  }

  onCreateLogClicked(selection: DragSelection): void {
    this.formStartTime = selection.startTime;
    this.formEndTime   = selection.endTime;
    this.editingEntry  = null;
    this.showForm      = true;
  }

  editLog(log: LogEntry): void {
    this.formStartTime = log.startAt;
    this.formEndTime   = log.endAt ?? '01:00';
    this.editingEntry  = log;
    this.showForm      = true;
  }

  onLogSaved(entry: CreateLogEntry): void {
    let targetDate = this.selectedDate;
    if (entry.date && entry.date !== this.selectedDateStr) {
      const [y, m, d] = entry.date.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
    }
    this.logService.createLog(targetDate, entry).subscribe({
      next: () => {
        const idsToDelete = this.mergeSourceIds;
        this.mergeSourceIds = null;
        this.closeForm();
        if (idsToDelete) {
          // Destructive merge: delete both source point logs then reload
          forkJoin([
            this.logService.deleteLog(this.selectedDate, idsToDelete[0]),
            this.logService.deleteLog(this.selectedDate, idsToDelete[1])
          ]).subscribe({ next: () => this.loadLogs(), error: () => this.loadLogs() });
        } else {
          this.loadLogs();
        }
      },
      error: () => alert('Failed to save log. Please try again.')
    });
  }

  onLogUpdated(event: { id: string; entry: Partial<CreateLogEntry>; newDate?: string }): void {
    let targetDate = this.selectedDate;
    if (event.newDate) {
      const [y, m, d] = event.newDate.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
    }
    this.logService.updateLog(targetDate, event.id, event.entry).subscribe({
      next: () => { this.closeForm(); this.loadLogs(); },
      error: () => alert('Failed to update log. Please try again.')
    });
  }

  onLogDeleted(id: string): void {
    this.logService.deleteLog(this.selectedDate, id).subscribe({
      next: () => { this.closeForm(); this.loadLogs(); },
      error: () => alert('Failed to delete log. Please try again.')
    });
  }

  downloadCSV(): void {
    if (this.logs.length === 0) return;
    const dateStr = this.selectedDate.toISOString().split('T')[0];
    const header  = ['Date', 'Start Time', 'End Time', 'Duration', 'Activity Type', 'Title'];
    const rows    = this.logs.map(log => [
      dateStr,
      log.startAt,
      log.endAt ?? '',
      this.getDuration(log),
      log.logType?.name ?? '',
      `"${log.title.replace(/"/g, '""')}"`
    ]);
    const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `renmito-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  closeForm(): void {
    this.showForm         = false;
    this.editingEntry     = null;
    this.highlightedLogId = null;
    this.formLogTypeId    = null;
    // Always reset any in-progress merge state on the timeline
    this.timelineRef?.cancelMerge();
  }

  /** Two point logs were paired — confirm then open the Create form pre-filled. */
  onMergePointsSelected(selection: DragSelection): void {
    const diff = selection.endMinutes - selection.startMinutes;
    const h = Math.floor(diff / 60), m = diff % 60;
    const durStr = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;

    this.pendingMerge  = selection;
    this.confirmDialog = {
      title:   'Merge into time range?',
      message: 'The two point logs will be deleted after the new entry is saved.',
      detail:  `${selection.startTime} – ${selection.endTime}  (${durStr})`,
      okLabel: 'Merge',
      onConfirm: () => {
        const s = this.pendingMerge!;
        this.pendingMerge    = null;
        this.formStartTime   = s.startTime;
        this.formEndTime     = s.endTime;
        this.editingEntry    = null;
        this.mergeSourceIds  = s.mergeSourceIds ?? null;
        this.formLogTypeId   = s.mergeLogTypeId ?? null;
        this.showForm        = true;
      }
    };
  }

  onGlobalConfirm(): void {
    const fn = this.confirmDialog?.onConfirm;
    this.confirmDialog = null;
    fn?.();
  }

  onGlobalCancel(): void {
    if (this.pendingMerge) {
      this.timelineRef?.cancelMerge();
      this.pendingMerge = null;
    }
    this.confirmDialog = null;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
