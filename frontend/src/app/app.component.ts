import { Component, OnInit, ViewChild } from '@angular/core';
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
import { LogEntry, CreateLogEntry } from './models/log.model';
import { forkJoin } from 'rxjs';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { LogTypeSelectComponent } from './components/log-type-select/log-type-select.component';

interface QuickLogItem { label: string; name: string; category: string; color: string; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarComponent, TimelineComponent, LogFormComponent, LoginComponent, MetricsComponent, ThemeEditorComponent, ConfirmDialogComponent, LogTypeSelectComponent],
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
          </div>
        </nav>

        <!-- ── View area ───────────────────────────────── -->
        <div class="view-area">

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
              </div>
            </div>

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

            <!-- ── Quick Shortcuts — 1.62 ──────────────────────── -->
            <div class="shortcuts-bar" *ngIf="isAuthenticated && shortcutDisplayTypes.length > 0">
              <span class="shortcuts-label">Quick</span>
              <button class="shortcut-chip"
                      *ngFor="let lt of shortcutDisplayTypes"
                      [disabled]="shortcutSaving"
                      (click)="onShortcutTap(lt)"
                      [title]="'Log ' + lt.name + ' from now'">
                <span class="shortcut-dot" [style.background]="lt.color"></span>
                {{ lt.name }}
              </button>
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

            <!-- ── Quick Logs — 1.55 ──────────────────────────── -->
            <div class="quick-logs-section">

              <!-- Header / accordion toggle -->
              <div class="quick-logs-header" (click)="toggleQuickLogs()">
                <button class="quick-logs-toggle"
                        [attr.aria-expanded]="quickLogsExpanded"
                        tabindex="-1">
                  <svg class="quick-logs-chevron" width="13" height="13"
                       viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="quick-logs-title">Quick Logs</span>
                </button>
              </div>

              <!-- Body — visible when expanded -->
              <div class="quick-logs-body" *ngIf="quickLogsExpanded">

                <!-- 4-col desktop / 2-col mobile grid -->
                <div class="quick-log-grid">
                  <button class="quick-log-card"
                          *ngFor="let item of quickLogItems"
                          [class.quick-log-card--active]="quickLogActiveItem?.label === item.label"
                          (click)="selectQuickLogItem(item, $event)">
                    <span class="quick-log-card-accent"
                          [style.background]="item.color"></span>
                    <span class="quick-log-card-dot"
                          [style.background]="item.color"></span>
                    <span class="quick-log-card-label">{{ item.label }}</span>
                  </button>
                </div>

              </div>
            </div>

            <!-- ── Split: Timeline (left) + Log list (right) — 1.24 -->
            <div class="logger-split">

              <!-- Left column: Timeline -->
              <div class="split-timeline">

                <div class="timeline-container">
                  <app-timeline
                    #timelineRef
                    [logs]="logs"
                    [selectedDate]="selectedDate"
                    [highlightedLogId]="highlightedLogId"
                    [metricLogIds]="metricLogIds"
                    (selectionMade)="onSelectionChanged($event)"
                    (createLogClicked)="onCreateLogClicked($event)"
                    (logClicked)="editLog($event)"
                    (mergePointsSelected)="onMergePointsSelected($event)"
                  ></app-timeline>
                </div>

              </div>

              <!-- Right column: Log List -->
              <div class="split-logs">
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

              <!-- ── Add log row — 1.54 (top of list) ──────── -->
              <div class="add-log-backdrop" *ngIf="showAddLogMenu" (click)="showAddLogMenu = false"></div>
              <div class="log-list-add-row" *ngIf="!isLoading">
                <button class="btn-add-log" (click)="toggleAddLogMenu(); $event.stopPropagation()">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                  Add log
                </button>
                <div class="add-log-menu" *ngIf="showAddLogMenu" (click)="$event.stopPropagation()">
                  <button class="add-log-option" (click)="quickAddMeeting()">
                    <span class="add-log-option-icon">⚡</span>
                    <span class="add-log-option-text">
                      <strong>30-min placeholder</strong>
                      <span>Meeting block from last entry</span>
                    </span>
                  </button>
                  <button class="add-log-option" (click)="openAddLogForm()">
                    <span class="add-log-option-icon">✚</span>
                    <span class="add-log-option-text">
                      <strong>Create log</strong>
                      <span>Open full create form</span>
                    </span>
                  </button>
                  <button class="add-log-option" (click)="openStartLog(); showAddLogMenu = false"
                          [disabled]="!!activeLog">
                    <span class="add-log-option-icon">⏱</span>
                    <span class="add-log-option-text">
                      <strong>Start timer</strong>
                      <span>{{ activeLog ? 'Timer already running' : 'Log from now, stop when done' }}</span>
                    </span>
                  </button>
                </div>
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
                <span>Drag on the timeline above to get started.</span>
              </div>

              <!-- ── 1.63: Continue Last Log ─────────────────── -->
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

            </div><!-- /log-list-section -->
              </div><!-- /split-logs -->

            </div><!-- /logger-split -->

          </div><!-- /content-area -->

        </div><!-- /view-area -->
      </div><!-- /app-body -->

      <!-- ── 1.62: Undo toast ──────────────────────────────── -->
      <div class="shortcut-toast" *ngIf="shortcutToast">
        <span class="shortcut-toast-msg">✓ {{ shortcutToast.message }}</span>
        <button class="shortcut-toast-undo" (click)="undoShortcut()">Undo</button>
      </div>

      <!-- ── 1.61/1.73: FAB — context-switches based on running log state ── -->
      <!-- No active log → Log Now (retrospective) -->
      <button class="log-now-fab"
              *ngIf="isAuthenticated && !activeLog"
              (click)="openLogNow()"
              title="Log Now — tap to record what you just did">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <!-- Active log → pulsing Stop FAB (1.73) -->
      <button class="log-now-fab log-now-fab--stop"
              *ngIf="isAuthenticated && activeLog"
              (click)="stopRunningLog()"
              title="Stop timer and save log">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2"/>
        </svg>
      </button>

      <!-- ── 1.61: Log Now sheet + backdrop ─────────────────── -->
      <div class="log-now-backdrop" *ngIf="logNowOpen" (click)="closeLogNow()"></div>
      <div class="log-now-sheet" *ngIf="logNowOpen">
        <div class="log-now-header">
          <span class="log-now-title">Log Now</span>
          <button class="log-now-close" (click)="closeLogNow()" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="log-now-fields">
          <app-log-type-select
            [logTypes]="inlineLogTypes"
            [selectedId]="logNowTypeId"
            (selectedIdChange)="logNowTypeId = $event; onLogNowTypeChange()">
          </app-log-type-select>
          <input class="log-now-input" type="text"
                 placeholder="Title (optional — defaults to type name)"
                 [(ngModel)]="logNowTitle"/>
          <div class="log-now-times">
            <label class="log-now-time-label">Start</label>
            <input class="log-now-time" type="time" [(ngModel)]="logNowStart"/>
            <span class="log-now-arrow">→</span>
            <label class="log-now-time-label">End</label>
            <input class="log-now-time" type="time" [(ngModel)]="logNowEnd"/>
          </div>
        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeLogNow()">Cancel</button>
          <button class="log-now-save"
                  (click)="saveLogNow()"
                  [disabled]="logNowSaving || !logNowTypeId">
            {{ logNowSaving ? 'Saving…' : 'Save Log' }}
          </button>
        </div>
      </div>

      <!-- ── 1.71: Start Timer sheet + backdrop ───────────────── -->
      <div class="log-now-backdrop" *ngIf="startLogOpen" (click)="closeStartLog()"></div>
      <div class="log-now-sheet" *ngIf="startLogOpen">
        <div class="log-now-header">
          <span class="log-now-title">Start Timer</span>
          <button class="log-now-close" (click)="closeStartLog()" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="log-now-fields">
          <app-log-type-select
            [logTypes]="inlineLogTypes"
            [selectedId]="startLogTypeId"
            (selectedIdChange)="startLogTypeId = $event">
          </app-log-type-select>
          <input class="log-now-input" type="text"
                 placeholder="Title (optional — defaults to type name)"
                 [(ngModel)]="startLogTitle"/>
          <!-- 1.72: Planned duration chips -->
          <div class="start-log-planned-row">
            <span class="start-log-planned-label">Plan for:</span>
            <div class="start-log-planned-chips">
              <button *ngFor="let opt of [{v:'',l:'None'},{v:'15',l:'15m'},{v:'30',l:'30m'},{v:'60',l:'1h'},{v:'90',l:'1.5h'},{v:'120',l:'2h'}]"
                      class="start-log-chip"
                      [class.start-log-chip--active]="startLogPlanned === opt.v"
                      (click)="startLogPlanned = opt.v">
                {{ opt.l }}
              </button>
            </div>
          </div>
        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeStartLog()">Cancel</button>
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
      </div>

      <!-- ── 1.68: Wrap-Up sheet + backdrop ───────────────────── -->
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

        <!-- Gap time display -->
        <div class="wrapup-gap-time" *ngIf="wrapUpCurrentGap">
          <span class="wrapup-time">{{ wrapUpCurrentGap.start }}</span>
          <span class="wrapup-time-arrow">→</span>
          <span class="wrapup-time">{{ wrapUpCurrentGap.end }}</span>
          <span class="wrapup-duration-badge">{{ formatGapMins(wrapUpCurrentGap.mins) }}</span>
        </div>

        <div class="log-now-fields">
          <app-log-type-select
            [logTypes]="inlineLogTypes"
            [selectedId]="wrapUpTypeId"
            placeholder="Select type…"
            (selectedIdChange)="wrapUpTypeId = $event">
          </app-log-type-select>
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

      <!-- ── Footer — 1.35 / fixed full-width 1.52 ─────── -->
      <footer class="app-footer">
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

    <!-- ── Quick Logs duration picker — 1.55 ──────────────── -->
    <!-- Invisible backdrop: captures outside clicks, zero visual effect -->
    <div class="ql-backdrop" *ngIf="quickLogActiveItem"
         (click)="closeQuickLogPopup()"></div>

    <!-- Card-anchored popover: positioned via JS beside the clicked card -->
    <div class="ql-popup"
         *ngIf="quickLogActiveItem && quickLogPopupPos"
         [style.top.px]="quickLogPopupPos.top"
         [style.left.px]="quickLogPopupPos.left"
         (click)="$event.stopPropagation()">

      <!-- Up-pointing arrow toward the card -->
      <div class="ql-popup-arrow"></div>

      <!-- Header: color dot + name + close -->
      <div class="ql-popup-header"
           [style.border-bottom-color]="quickLogActiveItem.color">
        <span class="ql-popup-dot"
              [style.background]="quickLogActiveItem.color"></span>
        <span class="ql-popup-name">{{ quickLogActiveItem.label }}</span>
        <button class="ql-popup-close" (click)="closeQuickLogPopup()"
                aria-label="Close">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- ── Time selector ─────────────────────────────────── -->

      <!-- Desktop: native time input -->
      <div class="ql-time-desktop">
        <span class="ql-time-label">Start</span>
        <input class="ql-time-input" type="time"
               [ngModel]="quickSelectedTime"
               (ngModelChange)="quickSelectedTime = $event">
      </div>

      <!-- Mobile: drum / wheel picker -->
      <div class="ql-time-mobile">
        <div class="ql-drum-group">

          <!-- Hours 0–23 -->
          <div class="ql-drum-col">
            <div class="ql-drum-wrapper">
              <div class="ql-drum-center-band"></div>
              <div class="ql-drum ql-drum-hours"
                   (scroll)="onQuickHourScroll($event)">
                <div class="ql-drum-spacer"></div>
                <div class="ql-drum-item"
                     *ngFor="let h of quickHours"
                     [class.ql-drum-item--sel]="h === quickSelectedHour">
                  {{ h | number:'2.0-0' }}
                </div>
                <div class="ql-drum-spacer"></div>
              </div>
            </div>
            <span class="ql-drum-unit">h</span>
          </div>

          <div class="ql-drum-colon">:</div>

          <!-- Minutes 0–59 -->
          <div class="ql-drum-col">
            <div class="ql-drum-wrapper">
              <div class="ql-drum-center-band"></div>
              <div class="ql-drum ql-drum-mins"
                   (scroll)="onQuickMinuteScroll($event)">
                <div class="ql-drum-spacer"></div>
                <div class="ql-drum-item"
                     *ngFor="let m of quickMinutes"
                     [class.ql-drum-item--sel]="m === quickSelectedMinute">
                  {{ m | number:'2.0-0' }}
                </div>
                <div class="ql-drum-spacer"></div>
              </div>
            </div>
            <span class="ql-drum-unit">m</span>
          </div>

        </div>
      </div>

      <!-- ── Duration buttons ───────────────────────────────── -->
      <div class="ql-durations">
        <button class="ql-dur-btn"
                *ngFor="let dur of quickDurations"
                [disabled]="quickLogSaving"
                (click)="createQuickLog(dur.mins)">
          {{ dur.label }}
        </button>
      </div>

    </div>

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

    /* ── Split layout — 1.24 ───────────────────────────────
     * Desktop: timeline left | log list right (50/50)
     * Mobile:  timeline full-width, log list below         */
    .logger-split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      align-items: start;
    }

    .split-timeline {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    /* Log list column scrolls independently at the same height
       as the timeline column (~header + container + hint).    */
    .split-logs {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      position: sticky;
      top: 0;
    }
    /* 1.53: viewport-relative max-height matching the timeline scroll container */
    .split-logs .log-list-section {
      max-height: calc(100dvh - 270px);
      overflow-y: auto;
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

    /* ── Add log row — 1.54 ────────────────────────────────── */
    .log-list-add-row { position: relative; padding-top: 4px; }
    .btn-add-log {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      width: 100%; background: transparent;
      border: 1px dashed var(--border); border-radius: var(--radius-sm);
      color: var(--text-muted); font-size: 12px; padding: 7px 16px;
      cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .btn-add-log:hover { background: var(--accent-hover); color: var(--text-primary); border-color: var(--accent); }
    .add-log-backdrop { position: fixed; inset: 0; z-index: 49; }
    .add-log-menu {
      position: absolute; top: calc(100% + 6px); left: 50%;
      transform: translateX(-50%); min-width: 240px;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 50; overflow: hidden; animation: popIn 0.12s ease;
    }
    .add-log-option {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; width: 100%; background: transparent;
      border: none; border-bottom: 1px solid var(--border);
      color: var(--text-primary); cursor: pointer; text-align: left;
      transition: background 0.15s;
    }
    .add-log-option:last-child { border-bottom: none; }
    .add-log-option:hover { background: var(--accent-hover); }
    .add-log-option-icon { font-size: 16px; flex-shrink: 0; width: 24px; text-align: center; }
    .add-log-option-text { display: flex; flex-direction: column; gap: 2px; }
    .add-log-option-text strong { font-size: 12px; font-weight: 600; }
    .add-log-option-text span { font-size: 11px; color: var(--text-muted); }

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

    /* ── Quick Logs — 1.55 ──────────────────────────────── */
    .quick-logs-section {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex;
      flex-direction: column;
    }

    .quick-logs-header {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      cursor: pointer;
      user-select: none;
    }
    .quick-logs-toggle {
      display: flex;
      align-items: center;
      gap: 7px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0;
    }
    .quick-logs-toggle:hover .quick-logs-title { color: var(--text-primary); }
    .quick-logs-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
      transform: rotate(-90deg);
      transition: transform 0.2s ease;
    }
    .quick-logs-toggle[aria-expanded="true"] .quick-logs-chevron {
      transform: rotate(0deg);
    }
    .quick-logs-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: color 0.15s;
    }

    .quick-logs-body {
      padding: 0 14px 14px;
      border-top: 1px solid var(--border);
    }

    /* 4-column on desktop, 2-column on mobile */
    .quick-log-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding-top: 12px;
    }

    .quick-log-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 9px;
      padding: 16px 10px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      overflow: hidden;
      text-align: center;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .quick-log-card:hover {
      background: var(--accent-hover);
      border-color: var(--border-light);
    }
    .quick-log-card--active {
      background: var(--accent-hover) !important;
    }

    /* Thin colored top-accent stripe */
    .quick-log-card-accent {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      border-radius: var(--radius) var(--radius) 0 0;
    }

    .quick-log-card-dot {
      width: 22px; height: 22px;
      border-radius: 50%;
      flex-shrink: 0;
      display: block;
    }
    .quick-log-card-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      line-height: 1.3;
    }
    .quick-log-card--active .quick-log-card-label { color: var(--text-primary); }

    /* ── Quick Logs card-anchored popover ────────────────── */

    /* Invisible backdrop — no blur, no dim; just captures outside clicks */
    .ql-backdrop {
      position: fixed;
      inset: 0;
      z-index: 199;
    }

    /* Popover panel: fixed-positioned via JS, centered on the clicked card */
    .ql-popup {
      position: fixed;
      z-index: 200;
      transform: translateX(-50%);      /* horizontally centers on card midpoint */
      width: 236px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      overflow: visible;                /* lets the arrow poke out above */
      box-shadow: 0 6px 24px rgba(0,0,0,0.32), 0 1px 4px rgba(0,0,0,0.14);
      animation: qlPop 0.15s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes qlPop {
      from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* Up-pointing triangle arrow toward the card above */
    .ql-popup-arrow {
      position: absolute;
      top: -7px;
      left: 50%;
      transform: translateX(-50%);
      width: 0; height: 0;
    }
    .ql-popup-arrow::before,
    .ql-popup-arrow::after {
      content: '';
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 0; height: 0;
      border-style: solid;
    }
    /* border triangle (outline) */
    .ql-popup-arrow::before {
      top: 0;
      border-width: 0 7px 7px;
      border-color: transparent transparent var(--border-light);
    }
    /* fill triangle (background) */
    .ql-popup-arrow::after {
      top: 1px;
      border-width: 0 6px 6px;
      border-color: transparent transparent var(--bg-surface);
    }

    .ql-popup-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius) var(--radius) 0 0;
      overflow: hidden;
      /* bottom border colored to match item — set via inline style */
      border-bottom: 2px solid var(--border);
    }
    .ql-popup-dot {
      width: 9px; height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
      display: block;
    }
    .ql-popup-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-primary);
      flex: 1;
    }
    .ql-popup-hint {
      font-size: 10px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .ql-popup-close {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: none;
      border: none;
      color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .ql-popup-close:hover { background: var(--accent-hover); color: var(--text-primary); }

    /* ── Desktop time input ──────────────────────────────── */
    .ql-time-desktop {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
    }
    .ql-time-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      flex-shrink: 0;
    }
    .ql-time-input {
      flex: 1;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 600;
      padding: 5px 8px;
      font-family: inherit;
      font-variant-numeric: tabular-nums;
      outline: none;
      cursor: pointer;
    }
    .ql-time-input:focus { border-color: var(--highlight-selected); }

    /* ── Mobile drum/wheel picker (hidden on desktop) ─────── */
    .ql-time-mobile {
      display: none;
      align-items: center;
      justify-content: center;
      padding: 10px 12px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
    }
    .ql-drum-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ql-drum-colon {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      align-self: center;
      padding-bottom: 18px; /* aligns visually with drum center */
      flex-shrink: 0;
    }
    .ql-drum-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .ql-drum-wrapper {
      position: relative;
      width: 66px;
      height: 132px;   /* exactly 3 items × 44 px */
      overflow: hidden;
    }
    /* Top and bottom fade masks */
    .ql-drum-wrapper::before,
    .ql-drum-wrapper::after {
      content: '';
      position: absolute;
      left: 0; right: 0;
      height: 50px;
      z-index: 2;
      pointer-events: none;
    }
    .ql-drum-wrapper::before {
      top: 0;
      background: linear-gradient(to bottom, var(--bg-card) 10%, transparent);
    }
    .ql-drum-wrapper::after {
      bottom: 0;
      background: linear-gradient(to top, var(--bg-card) 10%, transparent);
    }
    /* Center selection band (thin lines bracketing the middle item) */
    .ql-drum-center-band {
      position: absolute;
      top: 50%; left: 4px; right: 4px;
      height: 44px;
      transform: translateY(-50%);
      border-top: 1px solid var(--border-light);
      border-bottom: 1px solid var(--border-light);
      background: rgba(74, 144, 226, 0.06);
      border-radius: 4px;
      pointer-events: none;
      z-index: 1;
    }
    .ql-drum {
      position: relative;
      z-index: 3;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .ql-drum::-webkit-scrollbar { display: none; }
    .ql-drum-spacer {
      height: 44px;
      flex-shrink: 0;
      display: block;
    }
    .ql-drum-item {
      height: 44px;
      scroll-snap-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 500;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      user-select: none;
      transition: color 0.12s, font-size 0.12s, font-weight 0.12s;
      letter-spacing: 0.5px;
    }
    .ql-drum-item--sel {
      color: var(--text-primary);
      font-size: 25px;
      font-weight: 700;
    }
    .ql-drum-unit {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }

    /* Duration buttons — horizontal row (desktop), vertical column (mobile) */
    .ql-durations {
      display: flex;
      flex-direction: row;
      overflow: hidden;
      border-radius: 0 0 var(--radius) var(--radius);
    }
    .ql-dur-btn {
      flex: 1;
      padding: 14px 6px;
      background: var(--bg-card);
      border: none;
      border-right: 1px solid var(--border);
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      text-align: center;
    }
    .ql-dur-btn:last-child { border-right: none; }
    .ql-dur-btn:hover:not(:disabled) {
      background: var(--accent-hover);
      color: var(--highlight-selected);
    }
    .ql-dur-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Responsive ─────────────────────────────────────── */
    /* Nav collapse is controlled solely by the hamburger toggle (navCollapsed).
       No media query auto-collapses it — the user's explicit toggle is the
       single source of truth for open vs. closed state.                      */

    /* Mobile: stack timeline above log list, both full-width */
    @media (max-width: 700px) {
      .header-date { display: none; }
      .logger-split { grid-template-columns: 1fr; }
      .split-logs { position: static; }
      .split-logs .log-list-section { max-height: none; overflow-y: visible; }

      /* Quick Logs — mobile overrides */
      .quick-log-grid { grid-template-columns: repeat(2, 1fr); }
      /* Popover spans most of the viewport width on mobile */
      .ql-popup { width: calc(100vw - 32px); }
      /* Show drum picker, hide desktop input */
      .ql-time-desktop { display: none; }
      .ql-time-mobile  { display: flex; }
      /* Duration buttons stack vertically on mobile */
      .ql-durations { flex-direction: column; }
      .ql-dur-btn {
        border-right: none;
        border-bottom: 1px solid var(--border);
        padding: 15px 18px;
        text-align: left;
        font-size: 15px;
      }
      .ql-dur-btn:last-child { border-bottom: none; }
    }

    /* ── 1.62: Quick Shortcuts Bar ──────────────────────────── */
    .shortcuts-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      overflow-x: auto;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      scrollbar-width: none;
    }
    .shortcuts-bar::-webkit-scrollbar { display: none; }

    .shortcuts-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
      padding-right: 2px;
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
      background: var(--nav-item-hover);
      border-color: var(--accent);
      color: var(--text-primary);
    }
    .shortcut-chip:disabled { opacity: 0.5; cursor: not-allowed; }

    .shortcut-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

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
      background: var(--accent);
      color: #fff;
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
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100%); }
      to   { transform: translateX(-50%) translateY(0); }
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
    }
    .log-now-times {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .log-now-time-label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }
    .log-now-time {
      flex: 1;
      padding: 10px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
    }
    .log-now-arrow {
      color: var(--text-muted);
      flex-shrink: 0;
      font-size: 14px;
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
    .start-log-chip--active {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 15%, var(--bg-card));
      color: var(--accent);
      font-weight: 600;
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
  `]
})
export class AppComponent implements OnInit {
  @ViewChild('timelineRef') timelineRef!: TimelineComponent;

  isAuthenticated = false;
  currentUser     = this.authService.getUser();

  activeView: 'logger' = 'logger';
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
  showAddLogMenu = false;
  logSortOrder: 'asc' | 'desc' = 'asc';

  // ── 1.55: Quick Logs ──────────────────────────────────────
  quickLogsExpanded   = false;
  quickLogActiveItem: QuickLogItem | null = null;
  quickLogPopupPos:   { top: number; left: number } | null = null;
  quickLogSaving      = false;
  readonly quickLogItems: QuickLogItem[] = [
    { label: 'Meeting',   name: 'Meeting',   category: 'meeting',  color: '#7898A8' },
    { label: 'Transit',   name: 'Transit',   category: 'transit',  color: '#3E6480' },
    { label: 'Code Time', name: 'Code Time', category: 'codetime', color: '#5A9CB5' },
    { label: 'Sleep',     name: 'Zleep',     category: 'sleep',    color: '#213C51' },
    { label: 'Design',    name: 'Design',    category: 'design',   color: '#7A5A74' },
    { label: 'Breakfast', name: 'Breakfast', category: 'food',     color: '#F2A65A' },
    { label: 'Lunch',     name: 'Lunch',     category: 'food',     color: '#6F8F72' },
    { label: 'Dinner',    name: 'Dinner',    category: 'food',     color: '#D97D55' },
  ];
  readonly quickDurations = [
    { label: '15m', mins: 15  },
    { label: '30m', mins: 30  },
    { label: '1h',  mins: 60  },
    { label: '2h',  mins: 120 },
  ];
  quickSelectedTime = '09:00';                                     // HH:MM — user-editable start
  readonly quickHours   = Array.from({ length: 24 }, (_, i) => i); // 0–23
  readonly quickMinutes = Array.from({ length: 60 }, (_, i) => i); // 0–59

  // ── 1.62: Quick Shortcuts Bar ─────────────────────────────────
  shortcutToast: { message: string; logId: string } | null = null;
  shortcutSaving = false;
  private toastTimer: any = null;

  // ── 1.61: Log Now FAB ─────────────────────────────────────────
  logNowOpen   = false;
  logNowTypeId = '';
  logNowTitle  = '';
  logNowStart  = '09:00';
  logNowEnd    = '09:00';
  logNowSaving = false;

  // ── 1.63: Continue Last Log ───────────────────────────────────
  // (reuses shortcutSaving / shortcutToast / toastTimer)

  // ── 1.71/1.72/1.73: Running Log ──────────────────────────────
  activeLog:     ActiveLog | null = null;
  activeLogTick  = 0;            // seconds elapsed since startedAt
  private activeLogTimerRef: any = null;

  // Start-timer sheet state
  startLogOpen    = false;
  startLogTypeId  = '';
  startLogTitle   = '';
  startLogPlanned = '';           // '' | '15' | '30' | '60' | '90' | '120'
  startLogSaving  = false;

  // ── 1.68: End-of-Day Wrap-Up ──────────────────────────────────
  wrapUpOpen    = false;
  wrapUpGaps:   Array<{ start: string; end: string; mins: number }> = [];
  wrapUpIdx     = 0;
  wrapUpTypeId  = '';
  wrapUpTitle   = '';
  wrapUpSaving  = false;
  private wrapUpDismissedDate = '';

  constructor(
    private logService:     LogService,
    private authService:    AuthService,
    private logTypeService: LogTypeService,
    private prefService:    PreferenceService
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
    this.showAddLogMenu = false;
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

  // ── 1.54: Quick-add log ──────────────────────────────────
  toggleAddLogMenu(): void {
    this.showAddLogMenu = !this.showAddLogMenu;
    if (this.showAddLogMenu && !this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((types: any[]) => this.inlineLogTypes = types);
    }
  }

  quickAddMeeting(): void {
    this.showAddLogMenu = false;
    const run = () => {
      const meeting = this.inlineLogTypes.find((t: any) =>
        t.name.toLowerCase() === 'meeting') ?? this.inlineLogTypes[0];
      if (!meeting) return;
      const lastLog   = this.logs[this.logs.length - 1];
      const rawStart  = lastLog
        ? this.timeToMinutes(lastLog.endAt ?? lastLog.startAt)
        : this.timeToMinutes(this.currentTimeStr());
      const startMins = Math.min(rawStart, 23 * 60 - 30);
      const endMins   = Math.min(startMins + 30, 23 * 60 + 59);
      this.logService.createLog(this.selectedDate, {
        title:     meeting.name,
        logTypeId: meeting._id,
        startTime: this.minsToTimeStr(startMins),
        endTime:   this.minsToTimeStr(endMins)
      }).subscribe({ next: () => this.loadLogs(),
                     error: () => alert('Failed to create placeholder.') });
    };
    if (this.inlineLogTypes.length) { run(); }
    else { this.logTypeService.getLogTypes().subscribe((t: any[]) => { this.inlineLogTypes = t; run(); }); }
  }

  openAddLogForm(): void {
    this.showAddLogMenu = false;
    const lastLog   = this.logs[this.logs.length - 1];
    const rawStart  = lastLog
      ? this.timeToMinutes(lastLog.endAt ?? lastLog.startAt)
      : this.timeToMinutes('09:00');
    const startMins = Math.min(rawStart, 22 * 60 + 30);
    this.formStartTime = this.minsToTimeStr(startMins);
    this.formEndTime   = this.minsToTimeStr(Math.min(startMins + 60, 23 * 60 + 59));
    this.editingEntry  = null;
    this.showForm      = true;
  }

  // ── 1.55: Quick Logs ────────────────────────────────────

  /** Derived from selected time — used by drum picker to mark the active item. */
  get quickSelectedHour(): number   { return +this.quickSelectedTime.split(':')[0]; }
  get quickSelectedMinute(): number { return +this.quickSelectedTime.split(':')[1]; }

  /** Default start time: end of last log for the day, or current clock time. */
  private get quickDefaultStart(): string {
    const last = this.logs[this.logs.length - 1];
    return last ? (last.endAt ?? last.startAt) : this.currentTimeStr();
  }

  toggleQuickLogs(): void {
    this.quickLogsExpanded = !this.quickLogsExpanded;
    this.closeQuickLogPopup();
    if (this.quickLogsExpanded && !this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((t: any[]) => this.inlineLogTypes = t);
    }
  }

  closeQuickLogPopup(): void {
    this.quickLogActiveItem = null;
    this.quickLogPopupPos   = null;
  }

  selectQuickLogItem(item: QuickLogItem, event: MouseEvent): void {
    event.stopPropagation();

    if (this.quickLogActiveItem?.label === item.label) {
      this.closeQuickLogPopup(); return;
    }

    // Anchor popover below the clicked card, clamped within viewport
    const card    = event.currentTarget as HTMLElement;
    const rect    = card.getBoundingClientRect();
    const popupW  = window.innerWidth <= 700 ? window.innerWidth - 32 : 236;
    const rawLeft = rect.left + rect.width / 2;
    const left    = Math.max(popupW / 2 + 8, Math.min(rawLeft, window.innerWidth - popupW / 2 - 8));

    // Seed selected time from last log end (or now)
    this.quickSelectedTime  = this.quickDefaultStart;
    this.quickLogActiveItem = item;
    this.quickLogPopupPos   = { top: rect.bottom + 8, left };

    // Scroll drum wheels to match initial time (after *ngIf renders on next tick)
    setTimeout(() => this.scrollDrumsToTime(), 40);

    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((t: any[]) => this.inlineLogTypes = t);
    }
  }

  /** Programmatically scroll hour/minute drums to match quickSelectedTime. */
  private scrollDrumsToTime(): void {
    const item = 44; // px per drum row
    const hEl  = document.querySelector('.ql-drum-hours') as HTMLElement | null;
    const mEl  = document.querySelector('.ql-drum-mins')  as HTMLElement | null;
    if (hEl) hEl.scrollTop = this.quickSelectedHour   * item;
    if (mEl) mEl.scrollTop = this.quickSelectedMinute * item;
  }

  onQuickHourScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const h   = Math.max(0, Math.min(23, Math.round(el.scrollTop / 44)));
    if (h === this.quickSelectedHour) return;
    const m   = this.quickSelectedTime.split(':')[1];
    this.quickSelectedTime = `${String(h).padStart(2, '0')}:${m}`;
  }

  onQuickMinuteScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const m   = Math.max(0, Math.min(59, Math.round(el.scrollTop / 44)));
    if (m === this.quickSelectedMinute) return;
    const h   = this.quickSelectedTime.split(':')[0];
    this.quickSelectedTime = `${h}:${String(m).padStart(2, '0')}`;
  }

  createQuickLog(durationMins: number): void {
    if (this.quickLogSaving || !this.quickLogActiveItem) return;
    const item      = this.quickLogActiveItem;
    const startTime = this.quickSelectedTime;

    const run = () => {
      const matched = this.inlineLogTypes.find((t: any) =>
        t.name.toLowerCase() === item.name.toLowerCase() || t.category === item.category
      );
      if (!matched) { alert('Log type not found. Please try again.'); return; }

      const startMins = this.timeToMinutes(startTime);
      const endMins   = Math.min(startMins + durationMins, 23 * 60 + 59);

      this.quickLogSaving = true;
      this.logService.createLog(this.selectedDate, {
        title:     item.label,
        logTypeId: matched._id,
        startTime,
        endTime:   this.minsToTimeStr(endMins),
      }).subscribe({
        next:  () => { this.quickLogSaving = false; this.closeQuickLogPopup(); this.loadLogs(); },
        error: () => { this.quickLogSaving = false; alert('Failed to create log. Please try again.'); }
      });
    };

    if (this.inlineLogTypes.length) { run(); }
    else { this.logTypeService.getLogTypes().subscribe((t: any[]) => { this.inlineLogTypes = t; run(); }); }
  }

  // ── 1.62: Quick Shortcuts ─────────────────────────────────────

  /** Top 5 log types for the shortcuts bar — types used today first, then work domain. */
  get shortcutDisplayTypes(): any[] {
    if (!this.inlineLogTypes.length) return [];
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

  onShortcutTap(lt: any): void {
    if (this.shortcutSaving) return;
    const now       = this.currentTimeStr();
    const startStr  = this.smartDefaultStart;
    const startMins = this.timeToMinutes(startStr);
    const endMins   = this.timeToMinutes(now);
    if (endMins <= startMins) return;

    this.shortcutSaving = true;
    this.logService.createLog(this.selectedDate, {
      title:     lt.name,
      logTypeId: lt._id,
      startTime: startStr,
      endTime:   now,
    }).subscribe({
      next: (created) => {
        this.shortcutSaving = false;
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

  /** Opens the "Start Timer" sheet. Pre-loads log types if needed. */
  openStartLog(): void {
    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().subscribe((t: any[]) => {
        this.inlineLogTypes = t;
        this._openStartLogSheet();
      });
    } else {
      this._openStartLogSheet();
    }
  }

  private _openStartLogSheet(): void {
    const lastTypeId = this.logs.length
      ? (this.logs[this.logs.length - 1].logType?.id ?? null)
      : null;
    const defaultLt  = lastTypeId
      ? (this.inlineLogTypes.find((t: any) => t._id === lastTypeId) ?? this.inlineLogTypes[0])
      : this.inlineLogTypes[0];
    this.startLogTypeId  = defaultLt?._id ?? '';
    this.startLogTitle   = '';
    this.startLogPlanned = '';
    this.startLogOpen    = true;
  }

  closeStartLog(): void { this.startLogOpen = false; }

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
          this.startLogSaving = false;
          this.startLogOpen   = false;
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

  openLogNow(): void {
    const now      = this.currentTimeStr();
    const startStr = this.smartDefaultStart;
    this.logNowStart = startStr;
    this.logNowEnd   = now;
    // Default to last-used type today, or first type
    const lastTypeId = this.logs.length ? (this.logs[this.logs.length - 1].logType?.id ?? null) : null;
    const defaultLt  = lastTypeId
      ? (this.inlineLogTypes.find((t: any) => t._id === lastTypeId) ?? this.inlineLogTypes[0])
      : this.inlineLogTypes[0];
    this.logNowTypeId = defaultLt?._id ?? '';
    this.logNowTitle  = '';
    this.logNowOpen   = true;
  }

  closeLogNow(): void { this.logNowOpen = false; }

  onLogNowTypeChange(): void {
    // Auto-fill title only if user hasn't typed anything yet
    if (!this.logNowTitle) {
      const lt = this.inlineLogTypes.find((t: any) => t._id === this.logNowTypeId);
      if (lt) this.logNowTitle = lt.name;
    }
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
      next:  () => { this.logNowSaving = false; this.logNowOpen = false; this.loadLogs(); },
      error: () => { this.logNowSaving = false; }
    });
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
