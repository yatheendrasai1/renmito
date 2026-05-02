import { Component, AfterViewInit, HostListener, OnInit, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CalendarComponent } from './components/calendar/calendar.component';
import { TimelineComponent, DragSelection } from './components/timeline/timeline.component';
import { LogFormComponent } from './components/log-form/log-form.component';
import { LoginComponent } from './auth/login.component';
import { ThemeEditorComponent, applyPaletteToDOM, loadSavedPalette, clearPaletteFromDOM, PALETTE_PRESETS, ColorPalette } from './components/theme-editor/theme-editor.component';
import { LogService } from './services/log.service';
import { AuthService } from './services/auth.service';
import { LogTypeService } from './services/log-type.service';
import { PreferenceService, ActiveLog } from './services/preference.service';
import { DayLevelService, DayMetadata, DayType } from './services/day-level.service';
import { LogEntry, CreateLogEntry } from './models/log.model';
import { LogType } from './models/log-type.model';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ImportantLogsComponent } from './components/important-logs/important-logs.component';
import { JourneyService } from './services/journey.service';
import { AiService, ParsedLog, RenniMessage, ChatResponse } from './services/ai.service';
import { NotesSheetComponent } from './components/notes-sheet/notes-sheet.component';
import { NotesService } from './services/notes.service';
import { environment } from '../environments/environment';
import { PaletteSheetComponent } from './components/palette-sheet/palette-sheet.component';
import { UnifiedSheetComponent } from './components/unified-sheet/unified-sheet.component';
import { RenniChatComponent } from './components/renni-chat/renni-chat.component';
import { AppStateService, OpenLogFormParams, ConfirmDialogParams } from './services/app-state.service';

// ── Performance Profiler ─────────────────────────────────────────────────────
// Tracks startup HTTP calls with performance.mark/measure (visible in DevTools
// Performance panel under "User Timings"). Prints a summary table to the console
// once all startup calls settle.  Check DevTools → Performance → User Timings
// or just read the "[Renmito Perf]" group in the Console tab.
const PERF = (() => {
  const marks = new Map<string, number>();
  let   pendingCalls = 0;         // incremented on start, decremented on end
  let   summaryScheduled = false;

  function tryPrintSummary() {
    if (pendingCalls > 0) return;
    if (summaryScheduled) return;
    summaryScheduled = true;
    // Give Angular one more tick to finish rendering before printing
    setTimeout(() => {
      const entries = performance.getEntriesByType('measure')
        .filter(e => e.name.startsWith('renmito:'))
        .map(e => ({
          operation: e.name.replace('renmito:', ''),
          'ms': Math.round(e.duration),
          verdict: e.duration < 200 ? '✅ fast' : e.duration < 600 ? '⚠️  slow' : '🔴 very slow',
        }))
        .sort((a, b) => b['ms'] - a['ms']);
      if (!environment.production) {
        console.groupCollapsed('%c[Renmito Perf] Startup summary', 'color:#a78bfa;font-weight:bold');
        console.table(entries);
        const worst = entries[0];
        if (worst?.['ms'] > 600) {
          console.warn(`[Renmito Perf] Bottleneck: "${worst.operation}" took ${worst['ms']}ms — check network tab for that request.`);
        }
        console.groupEnd();
      }
    }, 0);
  }

  return {
    /** Mark the start of a named operation. */
    start(label: string): void {
      marks.set(label, performance.now());
      performance.mark(`renmito:${label}:start`);
      pendingCalls++;
    },

    /** Mark the end of a named operation and record a measure. */
    end(label: string, detail = ''): void {
      const startMark = `renmito:${label}:start`;
      const endMark   = `renmito:${label}:end`;
      performance.mark(endMark);
      try { performance.measure(`renmito:${label}`, startMark, endMark); } catch { /* mark may not exist */ }
      const elapsed = performance.now() - (marks.get(label) ?? performance.now());
      const badge   = elapsed < 200 ? '🟢' : elapsed < 600 ? '🟡' : '🔴';
      if (!environment.production) {
        console.debug(
          `%c[Renmito Perf]%c ${badge} ${label}${detail ? ' · ' + detail : ''} — ${elapsed.toFixed(1)} ms`,
          'color:#a78bfa;font-weight:bold', 'color:inherit'
        );
      }
      pendingCalls = Math.max(0, pendingCalls - 1);
      tryPrintSummary();
    },

    /** Mark a one-shot instant event (no duration). */
    instant(label: string): void {
      performance.mark(`renmito:${label}`);
      if (!environment.production) {
        console.debug(
          `%c[Renmito Perf]%c ⚡ ${label} @ ${performance.now().toFixed(1)} ms`,
          'color:#a78bfa;font-weight:bold', 'color:inherit'
        );
      }
    },
  };
})();

@Component({
  selector: 'app-root',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, CalendarComponent, LogFormComponent, LoginComponent, ConfirmDialogComponent, ImportantLogsComponent, NotesSheetComponent, PaletteSheetComponent, UnifiedSheetComponent, RenniChatComponent],
  template: `
    <!-- ── Login gate ──────────────────────────────────── -->
    <app-login *ngIf="!isAuthenticated" (loggedIn)="onLoggedIn()"></app-login>

    <!-- ── Main app ────────────────────────────────────── -->
    <ng-container *ngIf="isAuthenticated">
    <div class="app-shell">

      <!-- ── Top strip ─────────────────────────────────── -->
      <div class="top-strip">
        <button class="top-strip-menu" (click)="appState.openNavRequested$.next()"
                title="Menu" aria-label="Open menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span class="top-strip-title">Renmito</span>
      </div>

      <!-- ── Body ───────────────────────────────────────── -->
      <div class="app-body">

        <!-- Left Navigation — always overlay, never pushes content -->
        <nav class="left-nav"
             [class.left-nav--collapsed]="!navOverlayOpen"
             [class.left-nav--overlay]="navOverlayOpen"
             (click)="navOverlayOpen = false">
          <div class="nav-group">
            <span class="nav-group-label">Renmito</span>

            <!-- Profile -->
            <button class="left-nav-item" *ngIf="currentUser" (click)="openProfile(); navOverlayOpen = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>{{ currentUser.userName }}</span>
            </button>

            <!-- Configurations -->
            <a
              class="left-nav-item"
              routerLink="/configuration"
              routerLinkActive="left-nav-item--active"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>Configurations</span>
            </a>

            <!-- Intelligence -->
            <a
              class="left-nav-item"
              routerLink="/intelligence"
              routerLinkActive="left-nav-item--active"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
              </svg>
              <span>Intelligence</span>
            </a>

            <!-- Theme -->
            <button
              class="left-nav-item"
              [class.left-nav-item--active]="showPalettePicker"
              (click)="$event.stopPropagation(); togglePalettePicker()"
              title="Quick theme"
              aria-label="Quick theme switcher"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
                <line x1="16" y1="8" x2="2" y2="22"/>
                <line x1="17.5" y1="15" x2="9" y2="15"/>
              </svg>
              <span>Theme</span>
            </button>

            <!-- Log out -->
            <button class="left-nav-item nav-logout" (click)="logout()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Log out</span>
            </button>
          </div>
        </nav>

        <!-- ── View area ───────────────────────────────── -->
        <div class="view-area content-area" (scroll)="onViewScroll($event)">
          <router-outlet></router-outlet>
        </div><!-- /view-area -->
      <!-- 1.93: Mobile nav overlay backdrop -->
      <div class="nav-dim-backdrop" *ngIf="navOverlayOpen" (click)="navOverlayOpen = false"></div>

      </div><!-- /app-body -->

      <!-- ── 1.62: Undo toast ──────────────────────────────── -->
      <div class="shortcut-toast" *ngIf="shortcutToast">
        <span class="shortcut-toast-msg">✓ {{ shortcutToast.message }}</span>
        <button class="shortcut-toast-undo" (click)="undoShortcut()">Undo</button>
      </div>

      <!-- ── 1.61: Renni FAB ── -->
      <button class="renni-fab"
              *ngIf="isAuthenticated"
              (click)="renniChatOpen = true"
              title="Chat with Renni — AI log assistant">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
          <path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25L5 3Z"/>
          <path d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z"/>
        </svg>
      </button>

      <!-- ── 1.61: Log Now FAB ── -->
      <button class="log-now-fab"
              *ngIf="isAuthenticated"
              (click)="isJourneysRoute ? appState.createJourneyRequested$.next() : openLogNow()"
              [title]="isJourneysRoute ? 'New Journey' : 'Log Now — tap to record what you just did'">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <!-- ── Renni chat popup ── -->
      <app-renni-chat
        *ngIf="renniChatOpen"
        [selectedDate]="appState.selectedDate"
        [logs]="appState.logs$.value"
        (closed)="renniChatOpen = false"
        (logCreated)="appState.reloadLogs()">
      </app-renni-chat>

      <!-- ── 1.83: Unified log-creation sheet (Add log / Add point / Start timer) ── -->
      <app-unified-sheet
        *ngIf="unifiedSheetOpen"
        #unifiedSheetRef
        [initialTab]="unifiedSheetInitialTab"
        [selectedDate]="appState.selectedDate"
        [logs]="appState.logs$.value"
        (closed)="unifiedSheetOpen = false"
        (logCreated)="appState.reloadLogs()"
        (timerStarted)="onTimerStarted($event)"
        (showToast)="onUnifiedSheetToast($event)">
      </app-unified-sheet>


      <!-- ── Timer-edit sheet: opens immediately when timer starts ── -->
      <div class="log-now-backdrop" *ngIf="timerEditOpen" (click)="closeTimerEdit()"></div>
      <div class="log-now-sheet timer-edit-sheet" *ngIf="timerEditOpen">

        <!-- Live clock header -->
        <div class="te-clock-row">
          <span class="running-log-dot running-log-dot--pulse"
                [style.background]="activeLogTypeColor"></span>
          <span class="te-recording-label">Recording</span>
          <span class="te-elapsed">
            {{ activeLog ? activeLogElapsedStr : (startLogSaving ? 'Starting…' : '0:00') }}
          </span>
        </div>

        <div class="log-now-fields te-fields">
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
                   *ngFor="let lt of startLogFilteredTypes; let i = index; trackBy: trackByLogTypeId"
                   [class.ln-type-drum-item--sel]="i === startLogTypeIndex">
                <span class="ln-type-dot-sm" [style.background]="lt.color"></span>
                {{ lt.name }}
              </div>
              <div class="ln-drum-spacer"></div>
            </div>
          </div>
          <!-- Description -->
          <textarea class="log-now-input"
                    placeholder="Description (optional)"
                    [(ngModel)]="startLogTitle"
                    (ngModelChange)="onTimerTitleChange($event)"></textarea>
        </div>

        <div class="log-now-actions te-actions">
          <button class="log-now-cancel te-dismiss-btn" (click)="closeTimerEdit()">
            Keep running
          </button>
          <button class="log-now-save log-now-save--start"
                  (click)="stopRunningLog(); closeTimerEdit()"
                  [disabled]="!activeLog">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="10" height="10" rx="2"/>
            </svg>
            Stop & Save
          </button>
        </div>
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

      <!-- ── Bottom Tab Bar ── -->
      <nav class="bottom-tab-bar" (click)="navOverlayOpen = false">
        <a class="bottom-tab" routerLink="/logger" routerLinkActive="bottom-tab--active">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span class="bottom-tab-label">Logger</span>
        </a>
        <a class="bottom-tab" routerLink="/timeline" routerLinkActive="bottom-tab--active">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
            <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/>
            <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>
            <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>
          </svg>
          <span class="bottom-tab-label">Timeline</span>
        </a>
        <a class="bottom-tab" routerLink="/journeys" routerLinkActive="bottom-tab--active">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="bottom-tab-label">Journeys</span>
        </a>
        <a class="bottom-tab" routerLink="/report" routerLinkActive="bottom-tab--active">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
          <span class="bottom-tab-label">Reports</span>
        </a>
      </nav>
    </div><!-- /app-shell -->

    <!-- ── Theme picker — centered modal ─────────────────── -->
    <div class="palette-modal-backdrop" *ngIf="showPalettePicker" (click)="showPalettePicker = false"></div>
    <div class="palette-modal-wrap" *ngIf="showPalettePicker" (click)="$event.stopPropagation()">
      <app-palette-sheet
        [customPresets]="navCustomPresets"
        (paletteSelected)="applyQuickPalette($event)"
        (closed)="showPalettePicker = false">
      </app-palette-sheet>
    </div>

    <!-- ── 1.68: End-of-Day Wrap-Up Sheet ───────────────── -->
    <div class="log-now-backdrop" *ngIf="wrapUpOpen" (click)="closeWrapUp()"></div>
    <div class="log-now-sheet wrapup-sheet" *ngIf="wrapUpOpen">
      <div class="log-now-header">
        <div class="wrapup-header-left">
          <span class="log-now-title">Fill Gap {{ wrapUpIdx + 1 }} / {{ wrapUpGaps.length }}</span>
          <div class="wrapup-step-dots">
            <span *ngFor="let g of wrapUpGaps; let i = index; trackBy: trackByIndex"
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
          <option *ngFor="let lt of inlineLogTypes; trackBy: trackByLogTypeId" [value]="lt._id">{{ lt.name }}</option>
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

    <!-- ── 1.83: Important Logs popup ─────────────────────── -->
    <app-important-logs
      *ngIf="showImportantLogs"
      [selectedDate]="appState.selectedDate"
      [logs]="appState.logs$.value"
      [metadata]="appState.dayMetadata$.value"
      (close)="showImportantLogs = false"
      (metadataChanged)="appState.dayMetadata$.next($event)"
      (logsChanged)="appState.reloadLogs()"
    ></app-important-logs>

    <!-- Notes bottom sheet -->
    <app-notes-sheet
      *ngIf="showNotesSheet"
      [date]="appState.selectedDate"
      (close)="closeNotesSheet()"
    ></app-notes-sheet>

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
      height: 100%;
      overflow: hidden;
      background: var(--bg-primary);
    }

    /* ── Top strip (hamburger + Renmito) ─────────────────── */
    .top-strip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px 2px;
      flex-shrink: 0;
    }
    .top-strip-menu {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .top-strip-menu:hover { background: var(--accent-hover); color: var(--text-primary); }
    .top-strip-title {
      font-size: 24px; font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.3px;
      font-family: 'Google Sans Flex', sans-serif;
    }

    /* ── Notes + Important Logs row (logger view, below metrics) */
    .notes-important-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .notes-col {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
      text-align: left;
      width: 100%;
    }
    .notes-col:hover { border-color: var(--accent); color: var(--text-primary); }
    .notes-col-label { flex: 1; }
    .notes-row-count {
      min-width: 18px; height: 18px;
      padding: 0 5px;
      background: var(--accent);
      color: #fff;
      font-size: 10px; font-weight: 700;
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
    }

    /* ── Day-type pill (in date-bar) ────────────────────── */
    .hdr-dt { position: relative; }

    .hdr-dt-trigger {
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: filter 0.15s;
      flex-shrink: 0;
    }
    .hdr-dt-trigger:hover { filter: brightness(0.9); }

    .hdr-dt-dot {
      width: 11px; height: 11px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .hdr-dt-chevron { display: none; }

    .hdr-dt-panel {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      min-width: 140px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      z-index: 500;
      padding: 4px;
      animation: dtPanelIn 0.14s ease;
    }
    @keyframes dtPanelIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .hdr-dt-option {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 8px 10px;
      border-radius: calc(var(--radius) - 2px);
      background: transparent;
      color: var(--text-secondary);
      font-size: 12px; font-weight: 500;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
      text-align: left;
    }
    .hdr-dt-option:hover { background: var(--nav-item-hover); color: var(--text-primary); }
    .hdr-dt-option--active { color: var(--text-primary); font-weight: 600; }

    /* ── Body ────────────────────────────────────────────── */
    .app-body { display: flex; flex: 1; overflow: hidden; }

    /* ── Left Nav — 1.22 collapsible ────────────────────── */
    /* Nav is always fixed — never participates in flex layout.
       Hidden off-screen by default; slides in via transform when overlay is open. */
    .left-nav {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 210px;
      background: var(--nav-bg);
      border-right: 1px solid var(--border);
      padding: 20px 10px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 24px;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      z-index: 100;
      box-shadow: 4px 0 24px rgba(0,0,0,0.4);
    }

    .left-nav--collapsed { /* off-screen via base transform, nothing extra needed */ }
    .left-nav--overlay   { transform: translateX(0); }

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
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap; overflow: hidden;
    }
    .left-nav-item svg { flex-shrink: 0; }
    .left-nav-item:hover { background: var(--nav-item-hover); color: var(--nav-text); }
    .left-nav-item--active {
      background: var(--nav-item-active) !important;
      color: var(--nav-item-active-border) !important;
      font-weight: 600;
    }

    .nav-group--bottom { margin-top: auto; }
    .nav-logout { color: var(--text-muted) !important; }
    .nav-logout:hover { color: #f87171 !important; background: rgba(248,113,113,0.08) !important; }

    /* ── View area ──────────────────────────────────────── */
    /* 1.53: scrollbar-gutter:stable reserves scrollbar lane so it never
             causes a layout shift when it appears / disappears            */
    .view-area { flex: 1; overflow-y: auto; scrollbar-gutter: stable; padding: 10px 24px calc(58px + env(safe-area-inset-bottom, 0px) + 20px); min-width: 0; }

    /* ── Content area (full width now — no calendar panel) ─ */
    .content-area {
      display: flex; flex-direction: column;
      gap: 14px; min-width: 0;
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
      font-size: 9px; font-weight: 700;
      color: var(--text-primary);
    }
    .date-bar-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
    .date-bar-btn {
      width: 34px; height: 34px;
      background: var(--bg-card);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .date-bar-btn:hover:not(:disabled) { background: var(--accent-hover); color: var(--text-primary); }
    .date-bar-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .date-bar-btn--today { color: var(--highlight-selected) !important; }

    /* ── 1.83: Day type dropdown ────────────────────────────── */
    .day-type-bar { padding: 8px 4px 2px; position: relative; display: flex; align-items: center; gap: 8px; }
    .dt-notes-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .dt-notes-btn:hover { border-color: var(--highlight-selected); color: var(--text-primary); }
    .dt-notes-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 16px; height: 16px;
      padding: 0 4px;
      background: var(--highlight-selected);
      color: #fff;
      font-size: 10px; font-weight: 700;
      border-radius: 8px;
      line-height: 1;
    }
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

    /* ── Vertical Timeline ─────────────────────────────────── */
    .log-list-skeleton { display: flex; flex-direction: column; }
    .tl-skeleton-row { padding-bottom: 8px; }
    .tl-sk-time {display: none; }
    .tl-sk-spine { display: none; }
    .tl-sk-line  { display: none; }
    .tl-sk-dot   { display: none; }
    .tl-sk-card {
      height: 52px; border-radius: var(--radius-sm); margin-top: 6px; align-self: start;
      background: linear-gradient(90deg, var(--bg-card) 25%, var(--accent-hover) 50%, var(--bg-card) 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .log-list { display: flex; flex-direction: column; }

    /* Log row */
    .tl-item { cursor: pointer; }
    .tl-item--dimmed { opacity: 0.38; }
    .tl-item--editing { cursor: default; }

    /* ── Swipe wrapper ─────────────────────────────────── */
    .swipe-wrap {
      position: relative; overflow: hidden;
      border-radius: var(--radius-sm); margin-bottom: 8px;
    }

    /* Reveal layers sit behind the sliding card */
    .swipe-reveal {
      position: absolute; inset: 0;
      display: flex; align-items: center; gap: 7px;
      padding: 0 18px;
      font-size: 12px; font-weight: 700;
      border-radius: var(--radius-sm);
      opacity: 0; transition: opacity 0.1s, filter 0.1s;
    }
    .swipe-reveal--active  { opacity: 1; }
    .swipe-reveal--ready   { filter: brightness(1.15); }
    .swipe-reveal--edit    { background: rgba(74,144,226,0.9); color: #fff; justify-content: flex-start; }
    .swipe-reveal--delete  { background: rgba(210,55,55,0.9);  color: #fff; justify-content: flex-end; }

    /* Card slides on top */
    .tl-card {
      position: relative; z-index: 1;
      background: var(--bg-card); border: 1px solid transparent;
      border-radius: var(--radius-sm); padding: 10px 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.03);
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
      min-width: 0; will-change: transform;
    }
    .tl-card--snapping {
      transition: transform 0.24s cubic-bezier(0.25,1,0.5,1),
                  background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .tl-item:hover .tl-card { background: var(--accent-hover); border-color: var(--border); box-shadow: 0 4px 14px rgba(0,0,0,0.26); }
    .tl-item--active .tl-card   { border-color: rgba(74,144,226,0.5) !important; background: rgba(74,144,226,0.08) !important; }
    .tl-item--metric-active .tl-card { border-color: rgba(74,144,226,0.6) !important; background: rgba(74,144,226,0.12) !important; }
    .tl-item--editing .tl-card  { border-color: var(--border-light) !important; background: var(--bg-card) !important; }
    .tl-item--active:hover .tl-card, .tl-item--metric-active:hover .tl-card { background: unset; }

    .tl-card-header { display: flex; align-items: flex-start; gap: 6px; }
    .tl-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .tl-card-actions { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; gap: 2px; }

    .log-list-label { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .log-list-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .log-list-type-badge { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.4px; }
    .log-list-time { font-size: 11px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .log-prev-day-date { color: var(--text-muted); font-style: italic; }
    .log-list-duration { font-size: 11px; color: var(--text-muted); background: var(--bg-surface); padding: 1px 6px; border-radius: 6px; font-variant-numeric: tabular-nums; }

    /* Action buttons — low opacity by default, full on hover */
    .log-list-edit-btn {
      background: none; color: var(--text-muted); border: none;
      padding: 5px; border-radius: var(--radius-sm); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0.45; transition: opacity 0.15s, background 0.15s, color 0.15s; flex-shrink: 0;
    }
    .tl-item:hover .log-list-edit-btn { opacity: 1; }
    .log-list-edit-btn:hover { background: var(--accent-hover); color: var(--text-primary); }
    .log-list-delete-btn {
      background: none; color: var(--text-muted); border: none;
      padding: 5px; border-radius: var(--radius-sm); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0.45; transition: opacity 0.15s, background 0.15s, color 0.15s; flex-shrink: 0;
    }
    .tl-item:hover .log-list-delete-btn { opacity: 1; }
    .log-list-delete-btn:hover { background: rgba(158,59,59,0.14); color: #9E3B3B; }

    /* ── Inline edit mode ──── */
    .log-list-inline {
      min-width: 0; display: flex; flex-direction: column; gap: 8px; padding: 2px 0;
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


    .log-list-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 28px 16px; text-align: center; opacity: 0.5;
    }
    .log-list-empty p { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin: 0; }
    .log-list-empty span { font-size: 11px; color: var(--text-muted); }

    /* ── Calendar popup — 1.23 ──────────────────────────── */
    /* ── Palette centered modal ─────────────────────────── */
    .palette-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 600;
      backdrop-filter: blur(2px);
    }
    .palette-modal-wrap {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      z-index: 601;
      pointer-events: none;
    }
    .palette-modal-wrap > * { pointer-events: auto; }

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

    /* ── Bottom Tab Bar ─────────────────────────────────── */
    .bottom-tab-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(58px + env(safe-area-inset-bottom, 0px));
      background: var(--nav-bg);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      padding-top: 8px;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      z-index: 150;
    }

    .bottom-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 2px 0;
      color: var(--nav-text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }

    .bottom-tab--active {
      color: var(--accent);
    }

    .bottom-tab-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    /* ── Palette quick-picker ─────────────────────────── */
    .qp-backdrop {
      position: fixed; inset: 0; z-index: 490;
    }
    .qp-panel {
      position: fixed;
      bottom: 80px;
      left: 12px;
      width: 260px;
      background: #1E1E2E;
      border: 1px solid #3A3A55;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.55);
      z-index: 495;
      color: #E0E4F0;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13px;
      padding: 0 0 10px;
      animation: qpIn 0.18s ease;
    }
    @keyframes qpIn {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .qp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px 10px;
      border-bottom: 1px solid #2E2E45;
    }
    .qp-title { font-size: 12px; font-weight: 700; color: #C8D0E8; letter-spacing: 0.3px; }
    .qp-close {
      width: 24px; height: 24px; border-radius: 5px;
      background: rgba(255,255,255,0.06); border: none;
      color: #8090A8; display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.12s;
    }
    .qp-close:hover { background: rgba(255,255,255,0.14); color: #E0E4F0; }
    .qp-section-label {
      font-size: 9px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase;
      color: #5A6A88; padding: 10px 14px 6px;
    }
    .qp-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; padding: 0 10px;
    }
    .qp-chip {
      background: #252535; border: 1.5px solid #2E2E45;
      border-radius: 7px; padding: 7px 8px;
      cursor: pointer; display: flex; flex-direction: column; gap: 5px;
      text-align: left; transition: border-color 0.15s, background 0.15s;
    }
    .qp-chip:hover { border-color: #5A6A88; background: #2C2C42; }
    .qp-chip--active { border-color: #7A8AC8 !important; background: #2C2C48 !important; }
    .qp-swatches { display: flex; gap: 3px; }
    .qp-swatch {
      width: 14px; height: 14px; border-radius: 3px;
      border: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
    }
    .qp-name { font-size: 10px; font-weight: 600; color: #8090A8; line-height: 1; }
    .qp-chip--active .qp-name { color: #C0CFEF; }

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

    .nav-dim-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 99;
    }

    /* Mobile overrides */
    @media (max-width: 700px) {
      .header-date { display: none; }
      .timeline-view-container { padding: 10px; }

      /* Footer is replaced by the bottom tab bar on mobile */
      .app-footer { display: none; }

    }

    /* Toast */
    .shortcut-toast {
      position: fixed;
      bottom: calc(58px + env(safe-area-inset-bottom, 0px) + 26px);
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

    /* ── Renni FAB ───────────────────────────────────────────── */
    .renni-fab {
      position: fixed;
      bottom: calc(58px + env(safe-area-inset-bottom, 0px) + 16px + 52px + 10px);
      right: 20px;
      z-index: 250;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(124,58,237,0.45);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .renni-fab:hover {
      transform: scale(1.06);
      box-shadow: 0 6px 22px rgba(124,58,237,0.6);
    }

    /* ── 1.61: Log Now FAB ───────────────────────────────────── */
    .log-now-fab {
      position: fixed;
      bottom: calc(58px + env(safe-area-inset-bottom, 0px) + 16px);
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
    .uni-tab--renni {
      display: flex; align-items: center; justify-content: center;
    }
    .uni-tab--renni.uni-tab--active {
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      border-color: #7c3aed; color: #fff;
    }

    /* ── Renni chat UI ── */
    .renni-chat-area {
      flex: 1; display: flex; flex-direction: column;
      min-height: 0; overflow: hidden;
    }
    .renni-messages {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding: 8px 0 4px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .renni-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 24px 16px; text-align: center;
      opacity: 0.6;
    }
    .renni-empty p { font-size: 0.85rem; line-height: 1.5; margin: 0; }
    .renni-star { color: #a78bfa; }
    .renni-msg { display: flex; flex-direction: column; max-width: 88%; }
    .renni-msg--user { align-self: flex-end; align-items: flex-end; }
    .renni-msg--renni { align-self: flex-start; align-items: flex-start; }
    .renni-bubble {
      padding: 9px 13px; border-radius: 16px;
      font-size: 0.86rem; line-height: 1.45; word-break: break-word;
    }
    .renni-bubble--user {
      background: var(--accent, #6366f1); color: #fff;
      border-radius: 16px 16px 4px 16px;
    }
    .renni-bubble--renni {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px 16px 16px 4px;
    }
    .renni-confirmed {
      background: rgba(167,139,250,0.15);
      border-color: rgba(167,139,250,0.3);
      color: #a78bfa; font-weight: 500;
    }
    .renni-thinking {
      display: flex; gap: 5px; padding: 12px 16px; align-items: center;
    }
    .renni-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor; opacity: 0.5;
      animation: renniPulse 1.2s ease-in-out infinite;
    }
    .renni-dot:nth-child(2) { animation-delay: 0.2s; }
    .renni-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes renniPulse {
      0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
      40%           { opacity: 0.9; transform: scale(1); }
    }
    .renni-log-card {
      background: rgba(167,139,250,0.07);
      border: 1px solid rgba(167,139,250,0.2);
      border-radius: 12px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .renni-log-card-intro {
      font-size: 0.78rem; opacity: 0.7; padding-bottom: 2px;
    }
    .renni-preview {
      background: rgba(167,139,250,0.08);
      border: 1px solid rgba(167,139,250,0.2);
      border-radius: 8px; padding: 8px 10px;
      display: flex; flex-direction: column; gap: 7px;
    }
    .renni-card-top {
      display: flex; align-items: center; justify-content: space-between;
    }
    .renni-card-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.76rem; font-weight: 600; color: #a78bfa;
    }
    .renni-domain-dot { opacity: 0.65; font-weight: 400; }
    .renni-remove-btn {
      background: none; border: none; cursor: pointer;
      color: inherit; opacity: 0.4; padding: 2px;
      display: flex; align-items: center;
    }
    .renni-remove-btn:hover { opacity: 0.8; }
    .renni-edit-row { display: flex; align-items: center; gap: 8px; }
    .renni-preview-label { font-size: 0.72rem; opacity: 0.55; width: 38px; flex-shrink: 0; }
    .renni-edit-input {
      flex: 1; padding: 5px 8px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px; color: inherit; font-size: 0.83rem;
    }
    .renni-edit-input:focus { outline: none; border-color: rgba(167,139,250,0.5); }
    .renni-time-input { flex: 0 0 72px; font-family: monospace; }
    .renni-time-sep   { opacity: 0.5; font-size: 0.8rem; }
    .renni-log-actions {
      display: flex; gap: 8px; padding-top: 2px;
    }
    .renni-discard-btn {
      flex: 1; padding: 7px 10px; border-radius: 8px; font-size: 0.82rem;
      background: transparent; border: 1px solid rgba(255,255,255,0.15);
      color: var(--text-secondary); cursor: pointer;
    }
    .renni-confirm-btn {
      flex: 2; padding: 7px 10px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      border: none; color: #fff; cursor: pointer;
    }
    .renni-confirm-btn:disabled { opacity: 0.6; cursor: default; }
    .renni-error {
      font-size: 0.78rem; color: #f87171;
      background: rgba(248,113,113,0.1); border-radius: 6px; padding: 6px 9px;
    }
    .renni-input-row {
      flex-shrink: 0; display: flex; gap: 8px; align-items: flex-end;
      padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.07);
      margin-top: 4px;
    }
    .renni-input-field {
      flex: 1; resize: none; min-height: 36px; max-height: 80px;
      padding: 8px 10px; border-radius: 10px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      color: inherit; font-size: 0.87rem; line-height: 1.4;
      font-family: inherit;
    }
    .renni-input-field:focus { outline: none; border-color: rgba(167,139,250,0.4); }
    .renni-send-btn {
      flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      border: none; color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .renni-send-btn:disabled { opacity: 0.45; cursor: default; }

    /* AI badge on log cards */
    .log-ai-badge {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 0.68rem; font-weight: 600; letter-spacing: 0.03em;
      padding: 2px 6px; border-radius: 10px;
      background: rgba(167,139,250,0.15); color: #a78bfa;
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

    /* ── Running banner edit icon ── */
    .running-log-left {
      cursor: pointer;
      border-radius: var(--radius-sm);
      padding: 2px 4px 2px 0;
      transition: background 0.15s;
    }
    .running-log-left:hover { background: rgba(255,255,255,0.06); }
    .running-log-edit-icon {
      color: var(--text-muted); opacity: 0; flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .running-log-left:hover .running-log-edit-icon { opacity: 0.7; }

    /* ── Timer-edit bottom sheet ──────────────────────────────── */
    .timer-edit-sheet {
      display: flex;
      flex-direction: column;
      max-height: 72dvh;
      padding: 20px 20px 36px;
      gap: 0;
    }
    .te-clock-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .te-recording-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      flex: 1;
    }
    .te-elapsed {
      font-size: 30px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
      letter-spacing: 1px;
      line-height: 1;
    }
    .te-fields {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      min-height: 0;
      padding-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .te-actions {
      flex-shrink: 0;
      padding-top: 14px;
    }
    .te-dismiss-btn {
      color: var(--text-muted);
      font-size: 12px;
    }

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


    /* ── 1.90: Add-point long-press wrapper ── */
    .add-point-wrap {
      flex: 1; position: relative;
      display: flex; flex-direction: column;
      user-select: none; -webkit-user-select: none;
    }
    .add-point-backdrop {
      position: fixed; inset: 0; z-index: 199;
    }
    .add-point-menu {
      position: absolute; top: calc(100% + 6px); left: 50%;
      transform: translateX(-50%);
      z-index: 200;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      overflow: hidden;
      min-width: 190px;
      animation: slideDown 0.15s ease;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .add-point-menu-item {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 11px 14px;
      background: none; border: none; color: var(--text-primary);
      font-size: 13px; font-weight: 500; cursor: pointer; text-align: left;
      transition: background 0.12s;
    }
    .add-point-menu-item:not(:last-child) { border-bottom: 1px solid var(--border); }
    .add-point-menu-item:hover { background: var(--accent-hover); }
    .add-point-menu-item svg { color: var(--text-muted); flex-shrink: 0; }
    .add-point-menu-text {
      display: flex; flex-direction: column; gap: 1px;
    }
    .add-point-menu-sub {
      font-size: 10px; color: var(--text-muted); font-weight: 400;
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

  `]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('unifiedSheetRef') unifiedSheetRef?: UnifiedSheetComponent;

  isAuthenticated = false;
  currentUser     = this.authService.getUser();

  theme: 'dark' | 'light' = 'dark';
  readonly currentYear = new Date().getFullYear();

  get isJourneysRoute(): boolean { return this.router.url === '/journeys'; }
  get isDateNavRoute(): boolean {
    return this.router.url === '/logger' || this.router.url === '/timeline';
  }
  get activeLog() { return this.appState.activeLog$.value; }
  get inlineLogTypes() { return this.appState.inlineLogTypes$.value; }

  setDayType(dt: DayType): void { this.appState.setDayType(dt); }

  navOverlayOpen = false;
  private navEdgeSwipeTracking = false;
  private navEdgeSwipeStartX = 0;
  private navEdgeSwipeStartY = 0;
  private navEdgeIsHorizontal: boolean | null = null;

  // ── Palette quick-picker (nav ink-pen button) ─────────────
  showPalettePicker    = false;
  readonly builtinPalettePresets = PALETTE_PRESETS;
  navCustomPresets: ColorPalette[] = [];

  // ── 1.50: Profile popup ───────────────────────────────────
  showProfile    = false;
  profileChanging = false;
  profileError   = '';
  profileSuccess = '';
  profilePass    = { current: '', next: '', confirm: '' };

  // ── Merge state (for timeline merge action) ───────────────────
  private mergeSourceIds: [string, string] | null = null;
  formLogTypeId: string | null = null;

  // ── Global confirm dialog ─────────────────────────────────────
  confirmDialog: { title: string; message: string; detail?: string; okLabel?: string; onConfirm: () => void } | null = null;
  private pendingMerge: DragSelection | null = null;

  // ── Log form modal ────────────────────────────────────────────
  showForm      = false;
  formStartTime = '09:00';
  formEndTime   = '10:00';
  editingEntry: LogEntry | null = null;

  // ── Calendar popup ────────────────────────────────────────────
  showCalendarPopup = false;
  pendingDate: Date = new Date();

  // ── Footer scroll visibility ──────────────────────────────────
  footerVisible = false;

  onViewScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.footerVisible = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
  }

  // ── Shortcut toast (shown from logger shortcuts + unified sheet)
  shortcutToast: { message: string; logId: string } | null = null;
  private readonly destroy$ = new Subject<void>();
  private toastTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  // ── Renni chat popup ─────────────────────────────────────────
  renniChatOpen = false;

  // ── Unified log-creation sheet ────────────────────────────────
  unifiedSheetOpen = false;
  unifiedSheetInitialTab: 1 | 2 | 3 = 1;

  // ── Renni AI chat (used inside UnifiedSheetComponent) ─────────
  private uniTouchStartX = 0;
  private uniTouchStartY = 0;

  // ── Important Logs / Notes sheet ──────────────────────────────
  showImportantLogs = false;
  showNotesSheet    = false;

  // ── Running Log / Timer-edit sheet ───────────────────────────
  timerEditOpen     = false;
  startLogDomain: 'work' | 'personal' = 'work';
  startLogTypeIndex = 0;
  startLogTypeId    = '';
  startLogTitle     = '';
  startLogPlanned   = '';
  startLogSaving    = false;

  // ── Wrap-Up sheet ─────────────────────────────────────────────
  wrapUpOpen    = false;
  wrapUpGaps:   Array<{ start: string; end: string; mins: number }> = [];
  wrapUpIdx     = 0;
  wrapUpTypeId  = '';
  wrapUpTitle   = '';
  wrapUpSaving  = false;

  constructor(
    public  appState:        AppStateService,
    private logService:      LogService,
    private authService:     AuthService,
    private logTypeService:  LogTypeService,
    private prefService:     PreferenceService,
    private dayLevelService: DayLevelService,
    private journeyService:  JourneyService,
    private aiService:       AiService,
    private notesService:    NotesService,
    private router:          Router,
  ) {}

  get todayLabel(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  get selectedDateStr(): string { return this.appState.selectedDateStr; }

  get dateShortLabel(): string { return this.appState.dateShortLabel; }

  ngOnInit(): void {
    PERF.instant('ngOnInit:start');

    const savedTheme = localStorage.getItem('renmito-theme') as 'dark' | 'light' | null;
    this.theme = savedTheme ?? 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);

    const cachedPalette = loadSavedPalette();
    if (cachedPalette) { applyPaletteToDOM(cachedPalette); }

    this.isAuthenticated = this.authService.isLoggedIn();
    this.appState.isAuthenticated$.next(this.isAuthenticated);
    if (this.isAuthenticated) {
      this.currentUser = this.authService.getUser();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      this.appState.selectedDate$.next(today);
      this.appState.reloadLogs();
      PERF.start('api:log-types');
      this.logTypeService.getLogTypes().pipe(takeUntil(this.destroy$)).subscribe({
        next: (t) => { this.appState.inlineLogTypes$.next(t); PERF.end('api:log-types', `${t.length} types`); },
        error: ()  => { PERF.end('api:log-types', 'ERROR'); }
      });
      this.syncPaletteFromDB();
    }

    // ── Subscribe to UI action signals from routed views ─────────
    this.appState.openNavRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.navOverlayOpen = true;
    });
    this.appState.openCalendarRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.pendingDate = new Date(this.appState.selectedDate);
      this.showCalendarPopup = true;
    });
    this.appState.openImportantLogsRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showImportantLogs = true;
    });
    this.appState.openNotesRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showNotesSheet = true;
    });
    this.appState.openLogFormRequested$.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.formStartTime    = params.startTime;
      this.formEndTime      = params.endTime;
      this.editingEntry     = params.editEntry ?? null;
      this.formLogTypeId    = params.logTypeId ?? null;
      this.mergeSourceIds   = params.mergeSourceIds ?? null;
      this.showForm         = true;
    });
    this.appState.openUnifiedSheetRequested$.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.unifiedSheetInitialTab = params.tab;
      this.unifiedSheetOpen       = true;
      if (params.prepDomain && params.prepTypeId) {
        setTimeout(() => this.unifiedSheetRef?.prepForAddPoint(
          params.prepDomain!, params.prepTypeId!, params.prepTime ?? this._currentTimeStr()
        ), 20);
      }
    });
    this.appState.openTimerEditRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this._syncStartLogUiToActiveLog();
      this.timerEditOpen = true;
    });
    this.appState.stopRunningLogRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.stopRunningLog();
    });
    this.appState.startTimerRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.openStartLog();
    });
    this.appState.showToastRequested$.pipe(takeUntil(this.destroy$)).subscribe(toast => {
      this.shortcutToast = toast;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.shortcutToast = null; }, 3000);
    });
    this.appState.confirmDialogRequested$.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.confirmDialog = params;
    });
    this.appState.openWrapUpRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.openWrapUp();
    });
    this.appState.createJourneyRequested$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      // JourneysComponent handles this via its own subscription when it is active
    });
  }

  ngAfterViewInit(): void {
    PERF.instant('first-render');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.appState.stopTimer();
    clearTimeout(this.toastTimer);
  }

  onLoggedIn(): void {
    this.isAuthenticated = true;
    this.appState.isAuthenticated$.next(true);
    this.currentUser = this.authService.getUser();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.appState.selectedDate$.next(today);
    this.appState.reloadLogs();
    this.syncPaletteFromDB();
  }

  private _currentTimeStr(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }

  /** Fetch preferences from DB — apply palette + restore any running log.
   *  1.52: If the user has no saved palette in DB, wipe any stale cache that may
   *  have been loaded from localStorage before we knew which user was logging in —
   *  this prevents one user's theme from bleeding into another user's session.
   *  1.71: activeLog is restored here so the ticking timer resumes even after a
   *  page reload or when the user opens the app on a different device. */
  private syncPaletteFromDB(): void {
    PERF.start('api:preferences');
    this.prefService.getPreferences().pipe(takeUntil(this.destroy$)).subscribe(prefs => {
      PERF.end('api:preferences', prefs ? 'ok' : 'null');
      if (prefs?.palette) {
        applyPaletteToDOM(prefs.palette);
        localStorage.setItem('renmito-palette', JSON.stringify(prefs.palette));
      } else {
        clearPaletteFromDOM();
      }
      if (prefs?.customPresets) { this.navCustomPresets = prefs.customPresets; }
      // 1.71: Resume running log ticker if one was already active
      this.appState.setActiveLog(prefs?.activeLog ?? null);
      // 1.82: Load quick shortcuts
      this.appState.quickShortcuts$.next(prefs?.quickShortcuts ?? []);
    });
  }

  togglePalettePicker(): void {
    this.showPalettePicker = !this.showPalettePicker;
    if (this.showPalettePicker) { this.navOverlayOpen = false; } // close nav when picker opens
  }

  isPaletteActive(p: ColorPalette): boolean {
    const active = loadSavedPalette();
    return !!active &&
      active.bg        === p.bg        &&
      active.primary   === p.primary   &&
      active.secondary === p.secondary &&
      active.accent    === p.accent;
  }

  applyQuickPalette(p: ColorPalette): void {
    applyPaletteToDOM(p);
    localStorage.setItem('renmito-palette', JSON.stringify(p));
    this.prefService.savePalette(p).pipe(takeUntil(this.destroy$)).subscribe();
  }

  logout(): void {
    this.confirmDialog = {
      title: 'Log out',
      message: 'Are you sure you want to log out of Renmito?',
      okLabel: 'Log out',
      onConfirm: () => {
        this.authService.logout();
        this.logTypeService.clearCache();
        this.logService.clearAllCaches();
        this.dayLevelService.clearAllCaches();
        this.prefService.clearPrefsCache();
        this.journeyService.clearAllCaches();
        // 1.52: Wipe theme cache on logout so the next user on this browser
        // cannot see a previous user's palette or dark/light preference
        clearPaletteFromDOM();
        localStorage.removeItem('renmito-theme');
        this.theme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
        this.appState.setActiveLog(null);
        this.appState.logs$.next([]);
        this.isAuthenticated = false;
        this.currentUser     = null;
      }
    };
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('renmito-theme', this.theme);
  }

  toggleNav(): void {
    this.navOverlayOpen = !this.navOverlayOpen;
  }

  // Swipe-right from left edge opens the nav overlay
  @HostListener('document:touchstart', ['$event'])
  onDocTouchStart(e: TouchEvent): void {
    if (this.navOverlayOpen) return;
    const t = e.touches[0];
    if (t.clientX > 40) return; // must start from the left edge
    this.navEdgeSwipeTracking = true;
    this.navEdgeSwipeStartX = t.clientX;
    this.navEdgeSwipeStartY = t.clientY;
    this.navEdgeIsHorizontal = null;
  }

  @HostListener('document:touchmove', ['$event'])
  onDocTouchMove(e: TouchEvent): void {
    if (!this.navEdgeSwipeTracking) return;
    const t = e.touches[0];
    const dx = t.clientX - this.navEdgeSwipeStartX;
    const dy = t.clientY - this.navEdgeSwipeStartY;
    if (this.navEdgeIsHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      this.navEdgeIsHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (this.navEdgeIsHorizontal === false) { this.navEdgeSwipeTracking = false; return; }
    if (dx > 60) {
      this.navOverlayOpen = true;
      this.navEdgeSwipeTracking = false;
    }
  }

  @HostListener('document:touchend')
  onDocTouchEnd(): void {
    this.navEdgeSwipeTracking = false;
    this.navEdgeIsHorizontal = null;
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
    this.authService.changePassword(this.profilePass.current, this.profilePass.next).pipe(takeUntil(this.destroy$)).subscribe({
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
  get isToday(): boolean { return this.appState.isToday; }



  closeCalendarPopup(): void {
    this.showCalendarPopup = false;
  }

  onPendingDateSelected(date: Date): void {
    this.pendingDate = date;
  }

  applyPendingDate(): void {
    this.appState.selectDate(this.pendingDate);
    this.closeCalendarPopup();
  }

  onCalOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('cal-overlay')) {
      this.closeCalendarPopup();
    }
  }





  closeNotesSheet(): void {
    this.showNotesSheet = false;
    this.appState.reloadNotesCount();
  }






    undoShortcut(): void {
    if (!this.shortcutToast) return;
    const id = this.shortcutToast.logId;
    this.shortcutToast = null;
    clearTimeout(this.toastTimer);
    this.logService.deleteLog(this.appState.selectedDate, id).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => this.appState.reloadLogs(),
      error: () => {}
    });
  }

  // ── 1.71/1.72/1.73: Running Log ──────────────────────────────

  get activeLogElapsedStr(): string { return this.appState.activeLogElapsedStr; }

  get activeLogPlannedPct(): number { return this.appState.activeLogPlannedPct; }

  /** Display name for the running log type. */
  get activeLogTypeName(): string {
    if (!this.activeLog) return '';
    const lt = this.inlineLogTypes.find((t) => t._id === this.activeLog!.logTypeId);
    return lt?.name ?? 'Running Log';
  }

  /** Color for the running log dot. */
  get activeLogTypeColor(): string {
    if (!this.activeLog) return '#9B9B9B';
    const lt = this.inlineLogTypes.find((t) => t._id === this.activeLog!.logTypeId);
    return lt?.color ?? '#9B9B9B';
  }



  /** Starts the timer immediately and opens the edit sheet. */
  openStartLog(): void {
    // If a timer is already running, just open the edit sheet to modify details
    if (this.activeLog) {
      this._syncStartLogUiToActiveLog();
      this.timerEditOpen = true;
      setTimeout(() => this.scrollStartLogTypeDrum(), 40);
      return;
    }

    this.timerEditOpen  = true;
    this.startLogTitle  = '';
    this.startLogDomain = 'work';

    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().pipe(takeUntil(this.destroy$)).subscribe((t) => {
        this.appState.inlineLogTypes$.next(t);
        this._initStartLog();
        this._immediatelyStartTimer();
      });
    } else {
      this._initStartLog();
      this._immediatelyStartTimer();
    }
  }

  private _initStartLog(): void {
    const _logs = this.appState.logs$.value;
    const lastTypeId = _logs.length
      ? (_logs[_logs.length - 1].logType?.id ?? null)
      : null;
    const filtered = this.startLogFilteredTypes;
    const idx = lastTypeId ? filtered.findIndex((t) => t._id === lastTypeId) : -1;
    this.startLogTypeIndex = idx >= 0 ? idx : 0;
    this.startLogTypeId    = filtered[this.startLogTypeIndex]?._id ?? this.inlineLogTypes[0]?._id ?? '';
    this.startLogTitle     = '';
    this.startLogPlanned   = '';
    setTimeout(() => this.scrollStartLogTypeDrum(), 40);
  }

  /** Fires the API to start the timer with defaults immediately. */
  private _immediatelyStartTimer(): void {
    if (this.activeLog) return;
    const typeId = this.startLogTypeId || this.inlineLogTypes[0]?._id;
    if (!typeId) return;

    this.startLogSaving = true;
    this.prefService.startActiveLog({ logTypeId: typeId, title: '', plannedMins: null })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activeLog) => {
          this.startLogSaving = false;
          if (activeLog) {
            // Merge any type/title the user may have already updated in the sheet
            this.appState.setActiveLog({
              ...activeLog,
              logTypeId: this.startLogTypeId || activeLog.logTypeId,
              title:     this.startLogTitle.trim()
            });
          }
        },
        error: () => { this.startLogSaving = false; }
      });
  }

  /** Syncs the sheet drum/domain UI to match a currently running timer. */
  private _syncStartLogUiToActiveLog(): void {
    if (!this.activeLog) return;
    const lt = this.inlineLogTypes.find((t) => t._id === this.activeLog!.logTypeId);
    if (lt) {
      this.startLogDomain = (lt.domain === 'work' ? 'work' : 'personal') as 'work' | 'personal';
      const filtered = this.startLogFilteredTypes;
      const idx = filtered.findIndex((t) => t._id === this.activeLog!.logTypeId);
      this.startLogTypeIndex = idx >= 0 ? idx : 0;
      this.startLogTypeId    = this.activeLog.logTypeId;
    }
    this.startLogTitle = this.activeLog.title;
  }

  openTimerEdit(): void {
    if (!this.activeLog) return;
    if (!this.inlineLogTypes.length) {
      this.logTypeService.getLogTypes().pipe(takeUntil(this.destroy$)).subscribe((t) => {
        this.appState.inlineLogTypes$.next(t);
        this._syncStartLogUiToActiveLog();
        this.timerEditOpen = true;
        setTimeout(() => this.scrollStartLogTypeDrum(), 40);
      });
      return;
    }
    this._syncStartLogUiToActiveLog();
    this.timerEditOpen = true;
    setTimeout(() => this.scrollStartLogTypeDrum(), 40);
  }

  closeTimerEdit(): void { this.timerEditOpen = false; }

  /** Called by ngModelChange on the description textarea — keeps activeLog in sync. */
  onTimerTitleChange(title: string): void {
    if (this.appState.activeLog$.value) {
      this.appState.setActiveLog({ ...this.appState.activeLog$.value, title });
    }
  }

  get startLogFilteredTypes(): LogType[] {
    return this.inlineLogTypes.filter(lt => lt.domain === this.startLogDomain);
  }

  setStartLogDomain(domain: 'work' | 'personal'): void {
    this.startLogDomain    = domain;
    this.startLogTypeIndex = 0;
    this.startLogTypeId    = this.startLogFilteredTypes[0]?._id ?? '';
    // Keep running timer in sync
    if (this.appState.activeLog$.value && this.startLogTypeId) {
      this.appState.setActiveLog({ ...this.appState.activeLog$.value, logTypeId: this.startLogTypeId });
    }
    setTimeout(() => this.scrollStartLogTypeDrum(), 20);
  }

  onStartLogTypeScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.startLogFilteredTypes.length - 1, Math.round(el.scrollTop / 25)));
    if (idx === this.startLogTypeIndex) return;
    this.startLogTypeIndex = idx;
    this.startLogTypeId    = this.startLogFilteredTypes[idx]?._id ?? '';
    // Keep running timer in sync
    if (this.appState.activeLog$.value && this.startLogTypeId) {
      this.appState.setActiveLog({ ...this.appState.activeLog$.value, logTypeId: this.startLogTypeId });
    }
  }

  private scrollStartLogTypeDrum(): void {
    const el = document.querySelector('.ln-drum-sl-types') as HTMLElement | null;
    if (el) el.scrollTop = this.startLogTypeIndex * 25;
  }

  /** Legacy — kept for the Tab 2 "Start Timer" button in the unified sheet. */
  saveStartLog(): void {
    if (this.startLogSaving || !this.startLogTypeId) return;
    const lt          = this.inlineLogTypes.find(t => t._id === this.startLogTypeId);
    const title       = this.startLogTitle.trim() || (lt?.name ?? 'Log');
    const plannedMins = this.startLogPlanned ? parseInt(this.startLogPlanned, 10) : null;

    this.startLogSaving = true;
    this.prefService.startActiveLog({ logTypeId: this.startLogTypeId, title, plannedMins })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activeLog) => {
          this.startLogSaving   = false;
          this.unifiedSheetOpen = false;
          if (activeLog) {
            this.appState.setActiveLog(activeLog);
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

    const lt    = this.inlineLogTypes.find((t) => t._id === this.activeLog!.logTypeId);
    const title = this.activeLog.title || (lt?.name ?? 'Log');

    // Optimistically clear local state for instant UI feedback
    const savedLog = { ...this.activeLog! };
    this.appState.setActiveLog(null);

    this.logService.createLog(this.appState.selectedDate, {
      title,
      logTypeId: savedLog.logTypeId,
      startTime: startAt,
      endTime:   endAt,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.prefService.stopActiveLog().pipe(takeUntil(this.destroy$)).subscribe();
        this.appState.reloadLogs();
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
        this.appState.setActiveLog(savedLog);
        alert('Failed to save the running log. Timer has been resumed.');
      }
    });
  }



  openLogNow(): void {
    this.unifiedSheetInitialTab = 1;
    this.unifiedSheetOpen = true;
  }

  // ── 1.68: End-of-Day Wrap-Up ─────────────────────────────────



  /** Unlogged gaps ≥15 min between consecutive range logs for the selected day. */
  get todayGaps(): Array<{ start: string; end: string; mins: number }> {
    const sorted = this.appState.logs$.value
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

  wrapUpSkip(): void { this.advanceWrapUp(); }

  wrapUpSave(): void {
    const gap = this.wrapUpCurrentGap;
    if (!gap || this.wrapUpSaving || !this.wrapUpTypeId) return;
    const lt    = this.inlineLogTypes.find((t) => t._id === this.wrapUpTypeId);
    const title = this.wrapUpTitle.trim() || (lt?.name ?? 'Log');
    this.wrapUpSaving = true;
    this.logService.createLog(this.appState.selectedDate, {
      title,
      logTypeId: this.wrapUpTypeId,
      startTime: gap.start,
      endTime:   gap.end,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => { this.wrapUpSaving = false; this.appState.reloadLogs(); this.advanceWrapUp(); },
      error: () => { this.wrapUpSaving = false; }
    });
  }

  private advanceWrapUp(): void {
    if (this.wrapUpIdx < this.wrapUpGaps.length - 1) {
      this.wrapUpIdx++;
      this.wrapUpTypeId = this.inlineLogTypes[0]?._id ?? '';
      this.wrapUpTitle  = '';
    } else {
      this.wrapUpOpen = false;
    }
  }

  private minsToTimeStr(mins: number): string {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  currentTimeStr(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }





  onLogSaved(entry: CreateLogEntry): void {
    let targetDate = this.appState.selectedDate;
    if (entry.date && entry.date !== this.appState.selectedDateStr) {
      const [y, m, d] = entry.date.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
    }
    this.logService.createLog(targetDate, entry).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const idsToDelete = this.mergeSourceIds;
        this.mergeSourceIds = null;
        this.closeForm();
        if (idsToDelete) {
          // Destructive merge: delete both source point logs then reload
          forkJoin([
            this.logService.deleteLog(this.appState.selectedDate, idsToDelete[0]),
            this.logService.deleteLog(this.appState.selectedDate, idsToDelete[1])
          ]).pipe(takeUntil(this.destroy$)).subscribe({ next: () => this.appState.reloadLogs(), error: () => this.appState.reloadLogs() });
        } else {
          this.appState.reloadLogs();
        }
      },
      error: () => alert('Failed to save log. Please try again.')
    });
  }

  onLogUpdated(event: { id: string; entry: Partial<CreateLogEntry>; newDate?: string }): void {
    let targetDate = this.appState.selectedDate;
    if (event.newDate) {
      const [y, m, d] = event.newDate.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
    }
    this.logService.updateLog(targetDate, event.id, event.entry).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.closeForm(); this.appState.reloadLogs(); },
      error: () => alert('Failed to update log. Please try again.')
    });
  }

  onLogDeleted(id: string): void {
    this.logService.deleteLog(this.appState.selectedDate, id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.closeForm(); this.appState.reloadLogs(); },
      error: () => alert('Failed to delete log. Please try again.')
    });
  }


  closeForm(): void {
    this.showForm      = false;
    this.editingEntry  = null;
    this.formLogTypeId = null;
  }



  onGlobalConfirm(): void {
    const fn = this.confirmDialog?.onConfirm;
    this.confirmDialog = null;
    fn?.();
  }

  onGlobalCancel(): void {
    this.pendingMerge = null;
    this.confirmDialog = null;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  // ── TrackBy helpers ───────────────────────────────────────────
  onTimerStarted(activeLog: ActiveLog): void {
    this.appState.setActiveLog(activeLog);
    this._syncStartLogUiToActiveLog();
    this.timerEditOpen = true;
  }

  onUnifiedSheetToast(toast: { message: string; logId: string }): void {
    this.shortcutToast = toast;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.shortcutToast = null; }, 3000);
  }

  trackByIndex(index: number): number { return index; }
  trackByLogId(_i: number, log: LogEntry): string { return log.id; }
  trackByLogTypeId(_i: number, lt: LogType): string { return lt._id; }
  trackByName(_i: number, item: { name: string }): string { return item.name; }
  trackByValue(_i: number, item: { value: string }): string { return item.value; }
}
