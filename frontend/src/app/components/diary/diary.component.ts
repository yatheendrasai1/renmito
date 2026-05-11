import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DiaryService } from '../../services/diary.service';
import { Season, Episode } from '../../models/diary.model';

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
      background: var(--bg);
      color: var(--text);
    }

    /* ── Date bar ────────────────────────────────────── */
    .diary-datebar {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
      flex-shrink: 0;
      background: var(--bg);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .datebar-arrow {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      color: var(--text-muted, rgba(255,255,255,0.4));
      cursor: pointer;
      border-radius: 8px;
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }
    .datebar-arrow:hover {
      color: var(--text);
      background: var(--surface2, rgba(255,255,255,0.06));
    }

    .datebar-center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 0;
    }

    .datebar-label {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .datebar-cal-btn {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      color: var(--text-muted, rgba(255,255,255,0.45));
      cursor: pointer;
      border-radius: 6px;
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }
    .datebar-cal-btn:hover,
    .datebar-cal-btn--open {
      color: var(--accent, #7c6cf5);
      background: var(--accent-subtle, rgba(124,108,245,0.12));
    }

    /* ── Calendar popover ────────────────────────────── */
    .cal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
    }

    .cal-popover {
      position: fixed;
      top: 58px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 101;
      background: var(--surface-elevated, #1e1e2e);
      border: 1px solid var(--border, rgba(255,255,255,0.12));
      border-radius: 14px;
      padding: 16px;
      width: min(320px, 92vw);
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
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
      color: var(--text-muted, rgba(255,255,255,0.4));
      cursor: pointer;
      border-radius: 6px;
      font-size: 16px;
      transition: color 0.15s;
    }
    .cal-month-nav:hover { color: var(--text); }

    .cal-month-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }

    .cal-dow {
      text-align: center;
      font-size: 10px;
      color: var(--text-muted, rgba(255,255,255,0.35));
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
      color: var(--text);
      border: none;
      background: none;
      position: relative;
      transition: background 0.12s;
    }
    .cal-day:hover:not(.cal-day--empty) {
      background: var(--surface2, rgba(255,255,255,0.08));
    }
    .cal-day--empty { pointer-events: none; }
    .cal-day--selected {
      background: var(--accent, #7c6cf5) !important;
      color: #fff;
      font-weight: 700;
    }
    .cal-day--today:not(.cal-day--selected) {
      border: 1.5px solid var(--accent, #7c6cf5);
      color: var(--accent, #7c6cf5);
      font-weight: 600;
    }

    /* ── Season row ──────────────────────────────────── */
    .diary-season-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      flex-shrink: 0;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
    }

    .season-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 20px;
      background: var(--accent-subtle, rgba(124,108,245,0.12));
      border: 1px solid var(--accent, #7c6cf5);
      color: var(--accent, #7c6cf5);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }

    .season-chip-x {
      opacity: 0.6;
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    .season-chip-x:hover { opacity: 1; }

    .season-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px dashed var(--border, rgba(255,255,255,0.18));
      background: transparent;
      color: var(--text-muted, rgba(255,255,255,0.4));
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .season-add-btn:hover {
      border-color: var(--accent, #7c6cf5);
      color: var(--accent, #7c6cf5);
    }

    /* ── Writing area ────────────────────────────────── */
    .diary-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 0 16px 16px;
    }

    .diary-textarea {
      width: 100%;
      resize: none;
      background: transparent;
      border: none;
      color: var(--text);
      font-family: inherit;
      line-height: 1.7;
      box-sizing: border-box;
      outline: none;
    }
    .diary-textarea::placeholder {
      color: var(--text-muted, rgba(255,255,255,0.25));
    }

    .diary-textarea--name {
      font-size: 18px;
      font-weight: 600;
      padding: 16px 0 8px;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
      flex-shrink: 0;
    }

    .diary-textarea--content {
      flex: 1;
      font-size: 15px;
      padding: 14px 0 0;
      overflow-y: auto;
      min-height: 0;
    }

    /* ── Status bar ──────────────────────────────────── */
    .diary-statusbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 6px 16px;
      flex-shrink: 0;
      min-height: 24px;
    }

    .save-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: 5px;
      background: currentColor;
    }

    .save-status {
      display: flex;
      align-items: center;
      font-size: 11px;
      gap: 4px;
    }
    .save-status--saving { color: var(--text-muted, rgba(255,255,255,0.35)); }
    .save-status--saved  { color: #4ade80; }

    /* ── Season picker modal ─────────────────────────── */
    .season-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .season-modal {
      background: var(--surface-elevated, #1e1e2e);
      border: 1px solid var(--border, rgba(255,255,255,0.12));
      border-radius: 20px 20px 0 0;
      padding: 24px 20px 32px;
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      animation: slideUp 0.22s ease;
    }

    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }

    .modal-drag-handle {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: var(--border, rgba(255,255,255,0.15));
      margin: 0 auto -6px;
    }

    .modal-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
    }

    .season-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 180px;
      overflow-y: auto;
    }

    .season-list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.12s;
    }
    .season-list-item:hover { background: var(--surface2, rgba(255,255,255,0.05)); }
    .season-list-item--selected {
      background: var(--accent-subtle, rgba(124,108,245,0.1));
      border-color: var(--accent, #7c6cf5);
    }
    .slitem-name  { font-size: 14px; font-weight: 500; color: var(--text); }
    .slitem-date  { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.4)); }

    .divider {
      height: 1px;
      background: var(--border, rgba(255,255,255,0.07));
    }

    .new-season-form { display: flex; flex-direction: column; gap: 8px; }
    .new-season-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted, rgba(255,255,255,0.35));
    }
    .season-input {
      background: var(--surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      border-radius: 10px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      padding: 10px 12px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .season-input:focus { border-color: var(--accent, #7c6cf5); }

    .modal-actions {
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
    .btn--ghost {
      background: transparent;
      border-color: var(--border, rgba(255,255,255,0.12));
      color: var(--text-muted, rgba(255,255,255,0.6));
    }
    .btn--ghost:hover { color: var(--text); }
    .btn--primary {
      background: var(--accent, #7c6cf5);
      color: #fff;
    }
    .btn--primary:disabled { opacity: 0.35; cursor: default; }
  `],
  template: `
    <!-- Calendar popover backdrop -->
    <div class="cal-backdrop" *ngIf="calOpen" (click)="calOpen = false"></div>

    <!-- Calendar popover -->
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

    <!-- Season bottom-sheet -->
    <div class="season-overlay" *ngIf="seasonPickerOpen" (click)="closeSeasonPicker()">
      <div class="season-modal" (click)="$event.stopPropagation()">
        <div class="modal-drag-handle"></div>
        <div class="modal-title">Add to a Season</div>

        <div class="season-list" *ngIf="seasons.length > 0">
          <div
            class="season-list-item"
            [class.season-list-item--selected]="episode?.seasonId === s._id"
            *ngFor="let s of seasons"
            (click)="selectSeason(s)"
          >
            <span class="slitem-name">{{ s.name }}</span>
            <span class="slitem-date">{{ s.startDate }}</span>
          </div>
        </div>
        <div *ngIf="seasons.length === 0" style="font-size:13px;color:var(--text-muted,rgba(255,255,255,0.4))">
          No seasons yet — create one below.
        </div>

        <div class="divider"></div>

        <div class="new-season-form">
          <div class="new-season-label">New Season</div>
          <input class="season-input" placeholder="Season name" [(ngModel)]="newSeasonName">
          <input class="season-input" type="date" [(ngModel)]="newSeasonDate">
        </div>

        <div class="modal-actions">
          <button class="btn btn--ghost" (click)="closeSeasonPicker()">Cancel</button>
          <button
            class="btn btn--primary"
            [disabled]="!newSeasonName.trim() || !newSeasonDate"
            (click)="createAndSelectSeason()"
          >Create &amp; Select</button>
        </div>
      </div>
    </div>

    <!-- ── Date bar ──────────────────────────────────── -->
    <div class="diary-datebar">
      <button class="datebar-arrow" (click)="shiftDay(-1)" aria-label="Previous day">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      <div class="datebar-center">
        <span class="datebar-label">{{ shortLabel }}</span>
        <button
          class="datebar-cal-btn"
          [class.datebar-cal-btn--open]="calOpen"
          (click)="toggleCal()"
          aria-label="Open calendar"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      <button class="datebar-arrow" (click)="shiftDay(1)" aria-label="Next day">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>

    <!-- ── Season row ────────────────────────────────── -->
    <div class="diary-season-row">
      <ng-container *ngIf="currentSeasonName; else noSeason">
        <div class="season-chip" (click)="openSeasonPicker()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>{{ currentSeasonName }}</span>
          <span class="season-chip-x" (click)="$event.stopPropagation(); removeSeason()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </span>
        </div>
      </ng-container>
      <ng-template #noSeason>
        <button class="season-add-btn" (click)="openSeasonPicker()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
          add to a season
        </button>
      </ng-template>
    </div>

    <!-- ── Writing body ──────────────────────────────── -->
    <div class="diary-body">
      <textarea
        class="diary-textarea diary-textarea--name"
        rows="2"
        placeholder="Episode name…"
        [(ngModel)]="episodeName"
        (ngModelChange)="dirty = true"
        (blur)="onBlur()"
      ></textarea>

      <textarea
        class="diary-textarea diary-textarea--content"
        rows="50"
        placeholder="What happened today…"
        [(ngModel)]="content"
        (ngModelChange)="dirty = true"
        (blur)="onBlur()"
      ></textarea>
    </div>

    <!-- ── Status bar ────────────────────────────────── -->
    <div class="diary-statusbar">
      <span class="save-status save-status--saving" *ngIf="saveStatus === 'saving'">
        <span class="save-dot"></span>saving…
      </span>
      <span class="save-status save-status--saved" *ngIf="saveStatus === 'saved'">
        <span class="save-dot"></span>saved
      </span>
    </div>
  `,
})
export class DiaryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  dirty = false;

  readonly DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  selectedYear  = 0;
  selectedMonth = 0;
  selectedDay   = 0;

  viewYear  = 0;
  viewMonth = 0;

  calOpen = false;

  episode: Episode | null = null;
  seasons: Season[] = [];

  episodeName = '';
  content     = '';
  saveStatus: '' | 'saving' | 'saved' = '';

  seasonPickerOpen = false;
  newSeasonName    = '';
  newSeasonDate    = '';

  calCells: { day: number | null; isToday: boolean }[] = [];

  constructor(private diary: DiaryService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const today = new Date();
    this.selectedYear  = today.getFullYear();
    this.selectedMonth = today.getMonth() + 1;
    this.selectedDay   = today.getDate();
    this.viewYear  = this.selectedYear;
    this.viewMonth = this.selectedMonth;

    this.buildCalendar();
    this.loadEpisode();
    this.loadSeasons();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Date helpers ──────────────────────────────────────────────────────────────

  get shortLabel(): string {
    return new Date(this.selectedYear, this.selectedMonth - 1, this.selectedDay)
      .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  get selectedDateStr(): string {
    return `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(this.selectedDay).padStart(2, '0')}`;
  }

  get monthLabel(): string {
    return new Date(this.viewYear, this.viewMonth - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // ── Calendar ──────────────────────────────────────────────────────────────────

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
    this.calOpen = !this.calOpen;
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

  // ── Data ──────────────────────────────────────────────────────────────────────

  loadEpisode(): void {
    this.diary.getEpisode(this.selectedDateStr).pipe(
      takeUntil(this.destroy$)
    ).subscribe(ep => {
      this.episode     = ep;
      this.episodeName = ep.episodeName;
      this.content     = ep.content;
      this.saveStatus  = '';
      this.dirty       = false;
      this.cdr.markForCheck();
    });
  }

  loadSeasons(): void {
    this.diary.listSeasons().pipe(
      takeUntil(this.destroy$)
    ).subscribe(seasons => {
      this.seasons = seasons;
      this.cdr.markForCheck();
    });
  }

  get currentSeasonName(): string | null {
    if (!this.episode?.seasonId) return null;
    return this.seasons.find(s => s._id === this.episode!.seasonId)?.name ?? null;
  }

  // ── Auto-save on blur ─────────────────────────────────────────────────────────

  onBlur(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.persistEpisode();
  }

  persistEpisode(): void {
    this.saveStatus = 'saving';
    this.cdr.markForCheck();
    this.diary.upsertEpisode(this.selectedDateStr, {
      episodeName: this.episodeName,
      content:     this.content,
      seasonId:    this.episode?.seasonId ?? null,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ep => {
        this.episode    = ep;
        this.saveStatus = 'saved';
        this.cdr.markForCheck();
        setTimeout(() => { this.saveStatus = ''; this.cdr.markForCheck(); }, 2000);
      },
      error: () => { this.saveStatus = ''; this.cdr.markForCheck(); },
    });
  }

  // ── Season picker ─────────────────────────────────────────────────────────────

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
      episodeName: this.episodeName,
      content:     this.content,
      seasonId:    season._id,
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
      episodeName: this.episodeName,
      content:     this.content,
      seasonId:    null,
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
}
