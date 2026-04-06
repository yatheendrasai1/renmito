import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarComponent } from './components/calendar/calendar.component';
import { TimelineComponent, DragSelection } from './components/timeline/timeline.component';
import { LogFormComponent } from './components/log-form/log-form.component';
import { LoginComponent } from './auth/login.component';
import { MetricsComponent } from './components/metrics/metrics.component';
import { ThemeEditorComponent, applyPaletteToDOM, loadSavedPalette } from './components/theme-editor/theme-editor.component';
import { LogService } from './services/log.service';
import { AuthService } from './services/auth.service';
import { LogTypeService } from './services/log-type.service';
import { PreferenceService } from './services/preference.service';
import { LogEntry, CreateLogEntry } from './models/log.model';
import { forkJoin } from 'rxjs';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CalendarComponent, TimelineComponent, LogFormComponent, LoginComponent, MetricsComponent, ThemeEditorComponent, ConfirmDialogComponent],
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

            <!-- ── Timeline (full-width spine view — 1.51) ──── -->
            <div class="timeline-container">
              <app-timeline
                #timelineRef
                [logs]="logs"
                [selectedDate]="selectedDate"
                [highlightedLogId]="highlightedLogId"
                [metricLogIds]="metricLogIds"
                [isLoading]="isLoading"
                (createLogClicked)="onCreateLogClicked($event)"
                (logClicked)="editLog($event)"
              ></app-timeline>
            </div>

          </div><!-- /content-area -->

          <!-- ── Footer — 1.35 ─────────────────────────────── -->
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
              Your personal time chronicle — log your day, reflect on your patterns, and make every hour count.
            </p>
            <span class="footer-copy">© {{ currentYear }} Renmito</span>
          </footer>

        </div><!-- /view-area -->
      </div><!-- /app-body -->
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
    .view-area { flex: 1; overflow-y: auto; padding: 20px 24px; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); min-width: 0; }

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

    /* ── Timeline container — 1.51 full-width spine ───────── */
    .timeline-container { min-width: 0; }

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

    /* ── Footer — 1.35 ─────────────────────────────────── */
    .app-footer {
      margin-top: 20px;
      background: var(--nav-bg);
      border-radius: var(--radius);
      padding: 18px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
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

    @media (max-width: 700px) {
      .header-date { display: none; }
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

  /** Fetch preferences from DB, apply active palette and update localStorage cache. */
  private syncPaletteFromDB(): void {
    this.prefService.getPreferences().subscribe(prefs => {
      if (prefs?.palette) {
        applyPaletteToDOM(prefs.palette);
        localStorage.setItem('renmito-palette', JSON.stringify(prefs.palette));
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
