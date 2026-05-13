import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, switchMap } from 'rxjs/operators';
import { Location } from '@angular/common';
import { DiaryService } from '../../services/diary.service';
import { Season, Episode, Sentiment } from '../../models/diary.model';

@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: #0f1021;
      color: #fff;
      position: relative;
    }

    /* ── Sub-header ──────────────────────────────────── */
    .sub-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      flex-shrink: 0;
      background: #0f1021;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border: none;
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.75);
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .back-btn:hover { background: rgba(255,255,255,0.12); }

    .sh-spacer { flex: 1; }

    .sh-icon-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.15s, color 0.15s;
      position: relative;
    }
    .sh-icon-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

    /* ── 3-dot dropdown ──────────────────────────────── */
    .overflow-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      background: #1e1e2e;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 6px;
      min-width: 160px;
      z-index: 300;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .om-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      color: rgba(255,255,255,0.8);
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      transition: background 0.12s;
    }
    .om-item:hover { background: rgba(255,255,255,0.07); }
    .om-item--danger { color: #f87171; }
    .om-item--danger:hover { background: rgba(248,113,113,0.1); }

    /* ── Scrollable main area ────────────────────────── */
    .diary-scroll {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* ── Hero card ───────────────────────────────────── */
    .hero-card {
      margin: 12px 12px 0;
      border-radius: 20px;
      background: linear-gradient(135deg, #3b1f6e 0%, #7b2d6e 100%);
      padding: 14px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .hero-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .date-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(0,0,0,0.25);
      border-radius: 20px;
      padding: 5px 12px 5px 5px;
      cursor: pointer;
      border: none;
      color: #fff;
      transition: background 0.15s;
    }
    .date-chip:hover { background: rgba(0,0,0,0.38); }

    .date-num-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #fff;
      color: #3b1f6e;
      font-size: 13px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .date-chip-label {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .date-chip-chevron {
      opacity: 0.65;
      display: flex;
      align-items: center;
    }

    .season-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 20px;
      background: rgba(0,0,0,0.28);
      border: none;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
    }
    .season-chip:hover { background: rgba(0,0,0,0.42); }

    .season-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .season-add-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 20px;
      background: rgba(255,255,255,0.1);
      border: 1px dashed rgba(255,255,255,0.3);
      color: rgba(255,255,255,0.55);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .season-add-chip:hover { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.55); color: #fff; }

    /* ── Title section ───────────────────────────────── */
    .title-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.5);
      margin-bottom: -4px;
    }

    .title-editable {
      font-size: 24px;
      font-weight: 800;
      line-height: 1.25;
      color: #fff;
      outline: none;
      min-height: 30px;
      word-break: break-word;
    }
    .title-editable:empty::before {
      content: attr(data-placeholder);
      color: rgba(255,255,255,0.3);
      font-weight: 700;
      pointer-events: none;
    }

    .hero-divider {
      height: 1px;
      background: rgba(255,255,255,0.15);
      margin: 2px 0;
    }

    /* ── Meta row ────────────────────────────────────── */
    .hero-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .hero-meta-left {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sentiment-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 20px;
      background: rgba(255,255,255,0.12);
      border: none;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .sentiment-chip:hover { background: rgba(255,255,255,0.2); }
    .sentiment-chip--empty { color: rgba(255,255,255,0.45); }

    /* ── Entry body ──────────────────────────────────── */
    .entry-section {
      padding: 20px 16px 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .entry-label-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .entry-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(155,155,180,0.7);
      white-space: nowrap;
    }

    .entry-label-line {
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.07);
    }

    .body-editable {
      font-size: 16px;
      line-height: 1.75;
      color: #fff;
      outline: none;
      flex: 1;
      min-height: 0;
      word-break: break-word;
    }
    .body-editable:empty::before {
      content: attr(data-placeholder);
      color: rgba(255,255,255,0.2);
      font-style: italic;
      pointer-events: none;
    }



    /* ── Formatting toolbar ──────────────────────────── */
    .fmt-toolbar {
      flex-shrink: 0;
      background: #161828;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      padding: 10px 16px;
      padding-bottom: calc(10px + env(safe-area-inset-bottom));
      gap: 4px;
    }

    .fmt-btn {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      color: rgba(255,255,255,0.55);
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      border-radius: 10px;
      transition: background 0.12s, color 0.12s;
    }
    .fmt-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .fmt-btn--active { color: #fff; background: rgba(255,255,255,0.12); }
    .fmt-btn--highlight {
      background: #f4845f;
      color: #fff;
    }
    .fmt-btn--highlight:hover { background: #e0724e; }
    .fmt-btn--highlight.fmt-btn--active { background: #f4845f; box-shadow: 0 0 0 2px rgba(244,132,95,0.4); }

    .fmt-spacer { flex: 1; }

    .word-count-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: rgba(255,255,255,0.07);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      white-space: nowrap;
    }
    .wc-sep { opacity: 0.4; }

    /* ── Save indicator ──────────────────────────────── */
    .save-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
    }
    .save-pill {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .save-pill--saving { color: rgba(255,255,255,0.35); }
    .save-pill--saved  { color: #4ade80; }

    /* ── Calendar popover ────────────────────────────── */
    .cal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 200;
    }
    .cal-popover {
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 201;
      background: #1e1e2e;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 16px;
      width: min(320px, 92vw);
      box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    }
    .cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .cal-month-nav {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      border-radius: 6px;
      font-size: 16px;
      transition: color 0.15s;
    }
    .cal-month-nav:hover { color: #fff; }
    .cal-month-label { font-size: 13px; font-weight: 600; color: #fff; }
    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }
    .cal-dow {
      text-align: center;
      font-size: 10px;
      color: rgba(255,255,255,0.3);
      padding-bottom: 6px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .cal-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      border-radius: 50%;
      cursor: pointer;
      color: #fff;
      border: none;
      background: none;
      transition: background 0.12s;
    }
    .cal-day:hover:not(.cal-day--empty) { background: rgba(255,255,255,0.08); }
    .cal-day--empty { pointer-events: none; }
    .cal-day--selected { background: #7c6cf5 !important; color: #fff; font-weight: 700; }
    .cal-day--today:not(.cal-day--selected) { border: 1.5px solid #7c6cf5; color: #7c6cf5; font-weight: 600; }

    /* ── Season bottom sheet ─────────────────────────── */
    .sheet-overlay {
      position: fixed;
      inset: 0;
      z-index: 300;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .bottom-sheet {
      background: #1e1e2e;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px 20px 0 0;
      padding: 20px 20px 32px;
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: slideUp 0.22s ease;
      max-height: 70vh;
      overflow-y: auto;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }
    .sheet-handle {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: rgba(255,255,255,0.15);
      margin: 0 auto -4px;
    }
    .sheet-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }

    /* Season picker */
    .season-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .season-list-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.12s;
    }
    .season-list-item:hover { background: rgba(255,255,255,0.05); }
    .season-list-item--selected { background: rgba(124,108,245,0.1); border-color: #7c6cf5; }
    .sl-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .sl-name { font-size: 14px; font-weight: 500; color: #fff; flex: 1; }
    .sl-date { font-size: 11px; color: rgba(255,255,255,0.4); }

    .sheet-divider { height: 1px; background: rgba(255,255,255,0.07); }

    .new-season-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
    }
    .sheet-input {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      padding: 10px 12px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .sheet-input:focus { border-color: #7c6cf5; }

    .sheet-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .btn {
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .btn--ghost { background: transparent; border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.6); }
    .btn--ghost:hover { color: #fff; }
    .btn--primary { background: #7c6cf5; color: #fff; }
    .btn--primary:disabled { opacity: 0.35; cursor: default; }

    /* Sentiment picker */
    .sentiment-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }
    .sentiment-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
      background: rgba(255,255,255,0.04);
      transition: all 0.12s;
    }
    .sentiment-option:hover { background: rgba(255,255,255,0.08); }
    .sentiment-option--selected { background: rgba(124,108,245,0.15); border-color: #7c6cf5; }
    .sent-emoji { font-size: 18px; }
    .sent-label { font-size: 13px; font-weight: 500; color: #fff; }

    /* Rich text styles inside contenteditable */
    .body-editable ::ng-deep mark.highlight-orange {
      background: rgba(244,132,95,0.3);
      color: #f4845f;
      border-radius: 3px;
      padding: 0 2px;
    }
  `],
  template: `
    <!-- ── Overlays ─────────────────────────────────────────────────────────── -->

    <!-- Calendar -->
    <div class="cal-backdrop" *ngIf="calOpen" (click)="calOpen = false; cdr.markForCheck()"></div>
    <div class="cal-popover" *ngIf="calOpen" (click)="$event.stopPropagation()">
      <div class="cal-header">
        <button class="cal-month-nav" (click)="shiftMonth(-1)">‹</button>
        <span class="cal-month-label">{{ monthLabel }}</span>
        <button class="cal-month-nav" (click)="shiftMonth(1)">›</button>
      </div>
      <div class="cal-grid">
        <div class="cal-dow" *ngFor="let d of DOW">{{ d }}</div>
        <button
          class="cal-day"
          [class.cal-day--empty]="!cell.day"
          [class.cal-day--selected]="isSelected(cell)"
          [class.cal-day--today]="cell.isToday"
          *ngFor="let cell of calCells"
          (click)="cell.day && pickDay(cell.day)"
        >{{ cell.day || '' }}</button>
      </div>
    </div>

    <!-- Season picker bottom sheet -->
    <div class="sheet-overlay" *ngIf="seasonPickerOpen" (click)="closeSeasonPicker()">
      <div class="bottom-sheet" (click)="$event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-title">Add to a Season</div>

        <div class="season-list" *ngIf="seasons.length > 0">
          <div
            class="season-list-item"
            [class.season-list-item--selected]="episode?.seasonId === s._id"
            *ngFor="let s of seasons"
            (click)="selectSeason(s)"
          >
            <span class="sl-dot" [style.background]="s.color"></span>
            <span class="sl-name">{{ s.name }}</span>
            <span class="sl-date">{{ s.startDate }}</span>
          </div>
        </div>
        <div *ngIf="seasons.length === 0" style="font-size:13px;color:rgba(255,255,255,0.4)">
          No seasons yet — create one below.
        </div>

        <div class="sheet-divider"></div>

        <div class="new-season-label">New Season</div>
        <input class="sheet-input" placeholder="Season name" [(ngModel)]="newSeasonName">
        <input class="sheet-input" type="date" [(ngModel)]="newSeasonDate">
        <div class="sheet-actions">
          <button class="btn btn--ghost" (click)="closeSeasonPicker()">Cancel</button>
          <button
            class="btn btn--primary"
            [disabled]="!newSeasonName.trim() || !newSeasonDate"
            (click)="createAndSelectSeason()"
          >Create &amp; Select</button>
        </div>
      </div>
    </div>

    <!-- Sentiment picker bottom sheet -->
    <div class="sheet-overlay" *ngIf="sentimentPickerOpen" (click)="closeSentimentPicker()">
      <div class="bottom-sheet" (click)="$event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-title">How are you feeling?</div>
        <div class="sentiment-grid">
          <div
            class="sentiment-option"
            [class.sentiment-option--selected]="episode?.sentiment?.label === s.label"
            *ngFor="let s of SENTIMENTS"
            (click)="selectSentiment(s)"
          >
            <span class="sent-emoji">{{ s.emoji }}</span>
            <span class="sent-label">{{ s.label }}</span>
          </div>
        </div>
        <div class="sheet-actions" style="margin-top: 4px">
          <button class="btn btn--ghost" (click)="closeSentimentPicker()">Cancel</button>
          <button class="btn btn--ghost" *ngIf="episode?.sentiment?.label" (click)="clearSentiment()">Clear</button>
        </div>
      </div>
    </div>

    <!-- ── Sub-header ────────────────────────────────────────────────────────── -->
    <div class="sub-header">
      <button class="back-btn" (click)="goBack()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Diary
      </button>

      <div class="sh-spacer"></div>

      <button class="sh-icon-btn" (click)="toggleCal(); $event.stopPropagation()" aria-label="Calendar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
      </button>

      <div style="position: relative;">
        <button class="sh-icon-btn" (click)="toggleOverflowMenu($event)" aria-label="More options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="5"  r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <div class="overflow-menu" *ngIf="overflowOpen" (click)="$event.stopPropagation()">
          <button class="om-item om-item--danger" (click)="deleteEpisode()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
            Delete Entry
          </button>
        </div>
      </div>
    </div>

    <!-- ── Scrollable content ─────────────────────────────────────────────────── -->
    <div class="diary-scroll" (click)="closeOverflows()">

      <!-- Hero Card -->
      <div class="hero-card">

        <!-- Top row: date chip + season chip -->
        <div class="hero-top-row">
          <button class="date-chip" (click)="toggleCal(); $event.stopPropagation()">
            <span class="date-num-badge">{{ selectedDay }}</span>
            <span class="date-chip-label">{{ weekdayMonthLabel }}</span>
            <span class="date-chip-chevron">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </span>
          </button>

          <ng-container *ngIf="currentSeason; else noSeason">
            <button class="season-chip" (click)="openSeasonPicker(); $event.stopPropagation()">
              <span class="season-dot" [style.background]="currentSeason.color"></span>
              {{ currentSeason.name }}
            </button>
          </ng-container>
          <ng-template #noSeason>
            <button class="season-add-chip" (click)="openSeasonPicker(); $event.stopPropagation()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
              Season
            </button>
          </ng-template>
        </div>

        <!-- Title -->
        <div class="title-label">Episode Title</div>
        <div
          #titleEl
          class="title-editable"
          contenteditable="true"
          data-placeholder="Name this episode…"
          (input)="onTitleInput()"
          (keydown)="onTitleKeydown($event)"
        ></div>

        <div class="hero-divider"></div>

        <!-- Meta row -->
        <div class="hero-meta-row">
          <span class="hero-meta-left">
            Day {{ episode?.dayNumber ?? 1 }}
            <ng-container *ngIf="startedWritingTime">
              · Started writing {{ startedWritingTime }}
            </ng-container>
          </span>
          <button
            class="sentiment-chip"
            [class.sentiment-chip--empty]="!episode?.sentiment?.label"
            (click)="openSentimentPicker(); $event.stopPropagation()"
          >
            <ng-container *ngIf="episode?.sentiment?.label; else noSentiment">
              {{ episode!.sentiment.emoji }} {{ episode!.sentiment.label }}
            </ng-container>
            <ng-template #noSentiment>+ Mood</ng-template>
          </button>
        </div>

      </div><!-- /hero-card -->

      <!-- Entry section -->
      <div class="entry-section">
        <div class="entry-label-row">
          <span class="entry-label">The Entry</span>
          <div class="entry-label-line"></div>
        </div>

        <div
          #bodyEl
          class="body-editable"
          contenteditable="true"
          data-placeholder="What happened today…"
          (input)="onBodyInput()"
        ></div>

      </div>

    </div><!-- /diary-scroll -->

    <!-- ── Formatting toolbar ──────────────────────────────────────────────── -->
    <div class="fmt-toolbar">
      <button class="fmt-btn" [class.fmt-btn--active]="boldActive" (click)="formatBold()" title="Bold">
        <strong>B</strong>
      </button>
      <button class="fmt-btn" [class.fmt-btn--active]="italicActive" (click)="formatItalic()" title="Italic">
        <em>I</em>
      </button>
      <button
        class="fmt-btn fmt-btn--highlight"
        [class.fmt-btn--active]="highlightMode"
        (click)="toggleHighlightMode()"
        title="Highlight"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="fmt-btn" title="Voice / activity" style="opacity:0.4;cursor:default">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </button>

      <div class="fmt-spacer"></div>

      <span class="save-pill save-pill--saving" *ngIf="saveStatus === 'saving'">
        <span class="save-dot"></span>saving…
      </span>
      <span class="save-pill save-pill--saved" *ngIf="saveStatus === 'saved'">
        <span class="save-dot"></span>saved
      </span>

      <div class="word-count-pill">
        <span>{{ wordCount }}</span>
        <span class="wc-sep">·</span>
        <span>{{ readTime }} min</span>
      </div>
    </div>
  `,
})
export class DiaryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('titleEl') titleEl!: ElementRef<HTMLDivElement>;
  @ViewChild('bodyEl')  bodyEl!:  ElementRef<HTMLDivElement>;

  private destroy$    = new Subject<void>();
  private saveSubject = new Subject<void>();
  private viewReady   = false;
  private pendingEpisode: Episode | null = null;

  readonly DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  readonly SENTIMENTS = [
    { label: 'Calm',       emoji: '🌿' },
    { label: 'Happy',      emoji: '😊' },
    { label: 'Grateful',   emoji: '🙏' },
    { label: 'Energized',  emoji: '⚡' },
    { label: 'Focused',    emoji: '🎯' },
    { label: 'Creative',   emoji: '🎨' },
    { label: 'Reflective', emoji: '🌙' },
    { label: 'Anxious',    emoji: '😰' },
    { label: 'Low',        emoji: '😔' },
    { label: 'Tired',      emoji: '😴' },
  ];

  selectedYear  = 0;
  selectedMonth = 0;
  selectedDay   = 0;
  viewYear      = 0;
  viewMonth     = 0;

  calOpen           = false;
  seasonPickerOpen  = false;
  sentimentPickerOpen = false;
  overflowOpen      = false;

  episode: Episode | null = null;
  seasons: Season[]       = [];

  saveStatus: '' | 'saving' | 'saved' = '';
  wordCount  = 0;
  readTime   = 1;
  highlightMode = false;
  boldActive    = false;
  italicActive  = false;

  newSeasonName = '';
  newSeasonDate = '';

  calCells: { day: number | null; isToday: boolean }[] = [];

  constructor(
    private diary:    DiaryService,
    private location: Location,
    public  cdr:      ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.selectedYear  = today.getFullYear();
    this.selectedMonth = today.getMonth() + 1;
    this.selectedDay   = today.getDate();
    this.viewYear      = this.selectedYear;
    this.viewMonth     = this.selectedMonth;

    this.buildCalendar();
    this.loadEpisode();
    this.loadSeasons();

    // Debounced auto-save
    this.saveSubject.pipe(
      debounceTime(800),
      switchMap(() => {
        this.saveStatus = 'saving';
        this.cdr.markForCheck();
        return this.diary.upsertEpisode(this.selectedDateStr, {
          episodeName: this.titleEl?.nativeElement.textContent?.trim() ?? '',
          content:     this.bodyEl?.nativeElement.innerHTML ?? '',
          seasonId:    this.episode?.seasonId ?? null,
          sentiment:   this.episode?.sentiment ?? { label: '', emoji: '' },
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: ep => {
        this.episode    = ep;
        this.saveStatus = 'saved';
        this.cdr.markForCheck();
        setTimeout(() => { this.saveStatus = ''; this.cdr.markForCheck(); }, 2000);
      },
      error: () => { this.saveStatus = ''; this.cdr.markForCheck(); },
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.pendingEpisode) {
      this.applyEpisodeToEditors(this.pendingEpisode);
      this.pendingEpisode = null;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    this.location.back();
  }

  closeOverflows(): void {
    if (this.overflowOpen) { this.overflowOpen = false; this.cdr.markForCheck(); }
    if (this.calOpen)      { this.calOpen      = false; this.cdr.markForCheck(); }
  }

  toggleOverflowMenu(e: Event): void {
    e.stopPropagation();
    this.overflowOpen = !this.overflowOpen;
    this.calOpen      = false;
    this.cdr.markForCheck();
  }

  // ── Date helpers ──────────────────────────────────────────────────────────

  get weekdayMonthLabel(): string {
    return new Date(this.selectedYear, this.selectedMonth - 1, this.selectedDay)
      .toLocaleDateString('en-US', { weekday: 'short', month: 'long', year: 'numeric' });
  }

  get selectedDateStr(): string {
    return `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(this.selectedDay).padStart(2, '0')}`;
  }

  get monthLabel(): string {
    return new Date(this.viewYear, this.viewMonth - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  get startedWritingTime(): string {
    if (!this.episode?.startedWritingAt) return '';
    const d = new Date(this.episode.startedWritingAt);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  buildCalendar(): void {
    const today    = new Date();
    const firstDow = new Date(this.viewYear, this.viewMonth - 1, 1).getDay();
    const lastDay  = new Date(this.viewYear, this.viewMonth, 0).getDate();
    const cells: { day: number | null; isToday: boolean }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, isToday: false });
    for (let d = 1; d <= lastDay; d++) {
      cells.push({
        day: d,
        isToday: d === today.getDate() &&
                 this.viewMonth === today.getMonth() + 1 &&
                 this.viewYear  === today.getFullYear(),
      });
    }
    this.calCells = cells;
  }

  isSelected(cell: { day: number | null }): boolean {
    return cell.day === this.selectedDay &&
           this.viewMonth === this.selectedMonth &&
           this.viewYear  === this.selectedYear;
  }

  toggleCal(): void {
    this.calOpen      = !this.calOpen;
    this.overflowOpen = false;
    this.cdr.markForCheck();
  }

  shiftMonth(delta: number): void {
    let m = this.viewMonth + delta;
    let y = this.viewYear;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    this.viewMonth = m;
    this.viewYear  = y;
    this.buildCalendar();
    this.cdr.markForCheck();
  }

  pickDay(day: number): void {
    this.selectedYear  = this.viewYear;
    this.selectedMonth = this.viewMonth;
    this.selectedDay   = day;
    this.calOpen       = false;
    this.loadEpisode();
    this.cdr.markForCheck();
  }

  shiftDay(delta: number): void {
    const d = new Date(this.selectedYear, this.selectedMonth - 1, this.selectedDay + delta);
    this.selectedYear  = d.getFullYear();
    this.selectedMonth = d.getMonth() + 1;
    this.selectedDay   = d.getDate();
    if (this.selectedMonth !== this.viewMonth || this.selectedYear !== this.viewYear) {
      this.viewYear  = this.selectedYear;
      this.viewMonth = this.selectedMonth;
      this.buildCalendar();
    }
    this.calOpen = false;
    this.loadEpisode();
    this.cdr.markForCheck();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  loadEpisode(): void {
    this.diary.getEpisode(this.selectedDateStr).pipe(
      takeUntil(this.destroy$)
    ).subscribe(ep => {
      this.episode    = ep;
      this.saveStatus = '';
      this.cdr.markForCheck();
      if (this.viewReady) {
        this.applyEpisodeToEditors(ep);
      } else {
        this.pendingEpisode = ep;
      }
    });
  }

  applyEpisodeToEditors(ep: Episode): void {
    if (this.titleEl?.nativeElement) {
      this.titleEl.nativeElement.textContent = ep.episodeName || '';
    }
    if (this.bodyEl?.nativeElement) {
      this.bodyEl.nativeElement.innerHTML = ep.content || '';
      this.updateWordCount();
    }
  }

  loadSeasons(): void {
    this.diary.listSeasons().pipe(
      takeUntil(this.destroy$)
    ).subscribe(seasons => {
      this.seasons = seasons;
      this.cdr.markForCheck();
    });
  }

  get currentSeason(): Season | null {
    if (!this.episode?.seasonId) return null;
    return this.seasons.find(s => s._id === this.episode!.seasonId) ?? null;
  }

  // ── Editor input ──────────────────────────────────────────────────────────

  onTitleInput(): void {
    this.saveSubject.next();
  }

  onTitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.bodyEl?.nativeElement.focus();
    }
  }

  onBodyInput(): void {
    this.updateWordCount();
    this.updateFormatState();
    this.saveSubject.next();
  }

  updateWordCount(): void {
    const text = (this.bodyEl?.nativeElement.textContent || '').trim();
    this.wordCount = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
    this.readTime  = Math.max(1, Math.ceil(this.wordCount / 200));
    this.cdr.markForCheck();
  }

  updateFormatState(): void {
    this.boldActive   = document.queryCommandState('bold');
    this.italicActive = document.queryCommandState('italic');
    this.cdr.markForCheck();
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  formatBold(): void {
    this.bodyEl?.nativeElement.focus();
    document.execCommand('bold', false, '');
    this.updateFormatState();
    this.saveSubject.next();
  }

  formatItalic(): void {
    this.bodyEl?.nativeElement.focus();
    document.execCommand('italic', false, '');
    this.updateFormatState();
    this.saveSubject.next();
  }

  toggleHighlightMode(): void {
    this.highlightMode = !this.highlightMode;
    if (this.highlightMode) {
      this.applyHighlight();
    }
    this.cdr.markForCheck();
  }

  applyHighlight(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !this.bodyEl?.nativeElement.contains(sel.anchorNode)) {
      return;
    }
    const range = sel.getRangeAt(0);
    const mark  = document.createElement('mark');
    mark.className = 'highlight-orange';
    try {
      range.surroundContents(mark);
    } catch {
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    }
    sel.removeAllRanges();
    this.highlightMode = false;
    this.onBodyInput();
    this.cdr.markForCheck();
  }

  // ── Season picker ─────────────────────────────────────────────────────────

  openSeasonPicker(): void {
    this.newSeasonName = '';
    this.newSeasonDate = this.selectedDateStr;
    this.seasonPickerOpen = true;
    this.diary.clearSeasonsCache();
    this.diary.listSeasons().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.seasons = s;
      this.cdr.markForCheck();
    });
  }

  closeSeasonPicker(): void {
    this.seasonPickerOpen = false;
    this.cdr.markForCheck();
  }

  selectSeason(season: Season): void {
    this.diary.upsertEpisode(this.selectedDateStr, {
      episodeName: this.titleEl?.nativeElement.textContent?.trim() ?? '',
      content:     this.bodyEl?.nativeElement.innerHTML ?? '',
      seasonId:    season._id,
      sentiment:   this.episode?.sentiment ?? { label: '', emoji: '' },
    }).pipe(takeUntil(this.destroy$)).subscribe(ep => {
      this.episode = ep;
      this.seasonPickerOpen = false;
      this.saveStatus = 'saved';
      this.cdr.markForCheck();
      setTimeout(() => { this.saveStatus = ''; this.cdr.markForCheck(); }, 2000);
    });
  }

  removeSeason(): void {
    this.diary.upsertEpisode(this.selectedDateStr, {
      episodeName: this.titleEl?.nativeElement.textContent?.trim() ?? '',
      content:     this.bodyEl?.nativeElement.innerHTML ?? '',
      seasonId:    null,
      sentiment:   this.episode?.sentiment ?? { label: '', emoji: '' },
    }).pipe(takeUntil(this.destroy$)).subscribe(ep => {
      this.episode = ep;
      this.saveStatus = 'saved';
      this.cdr.markForCheck();
      setTimeout(() => { this.saveStatus = ''; this.cdr.markForCheck(); }, 2000);
    });
  }

  createAndSelectSeason(): void {
    if (!this.newSeasonName.trim() || !this.newSeasonDate) return;
    this.diary.createSeason({ name: this.newSeasonName.trim(), startDate: this.newSeasonDate })
      .pipe(takeUntil(this.destroy$))
      .subscribe(season => {
        this.seasons = [...this.seasons, season];
        this.selectSeason(season);
      });
  }

  // ── Sentiment picker ──────────────────────────────────────────────────────

  openSentimentPicker(): void {
    this.sentimentPickerOpen = true;
    this.cdr.markForCheck();
  }

  closeSentimentPicker(): void {
    this.sentimentPickerOpen = false;
    this.cdr.markForCheck();
  }

  selectSentiment(s: { label: string; emoji: string }): void {
    if (!this.episode) return;
    this.diary.upsertEpisode(this.selectedDateStr, {
      episodeName: this.titleEl?.nativeElement.textContent?.trim() ?? '',
      content:     this.bodyEl?.nativeElement.innerHTML ?? '',
      seasonId:    this.episode.seasonId,
      sentiment:   s,
    }).pipe(takeUntil(this.destroy$)).subscribe(ep => {
      this.episode = ep;
      this.sentimentPickerOpen = false;
      this.saveStatus = 'saved';
      this.cdr.markForCheck();
      setTimeout(() => { this.saveStatus = ''; this.cdr.markForCheck(); }, 2000);
    });
  }

  clearSentiment(): void {
    if (!this.episode) return;
    this.selectSentiment({ label: '', emoji: '' });
  }

  // ── Delete episode ────────────────────────────────────────────────────────

  deleteEpisode(): void {
    this.overflowOpen = false;
    this.diary.deleteEpisode(this.selectedDateStr).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.episode = null;
      if (this.titleEl?.nativeElement) this.titleEl.nativeElement.textContent = '';
      if (this.bodyEl?.nativeElement)  this.bodyEl.nativeElement.innerHTML = '';
      this.wordCount = 0;
      this.readTime  = 1;
      this.saveStatus = '';
      this.cdr.markForCheck();
    });
  }
}
