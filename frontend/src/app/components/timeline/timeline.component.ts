import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { LogEntry } from '../../models/log.model';

export interface DragSelection {
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
}

/** A pre-computed 10-minute tick mark entry. */
interface TickMark { pos: number; isHalf: boolean; }

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-wrapper">

      <!-- ── Header: date label + selection badge ───── -->
      <div class="timeline-header">
        <div class="timeline-date-label">{{ dateLabel }}</div>

        <div class="selection-badge" *ngIf="hasDragSelection && !isDragging">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
               style="flex-shrink:0;color:var(--highlight-selected)">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="sel-time">{{ dragSelection?.startTime }} – {{ dragSelection?.endTime }}</span>
          <span class="sel-dur">{{ selectionDuration }}</span>
          <button class="btn-create-log" (click)="openCreateForm()">+ Create Log</button>
          <button class="btn-clear-sel" (click)="clearSelection()" aria-label="Clear selection">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ── Scrollable timeline canvas ─────────────── -->
      <div class="scroll-container" #scrollContainer>
        <div
          class="timeline-canvas"
          #track
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp($event)"
          (pointercancel)="onPointerUp($event)"
          (pointerenter)="onTrackPointerEnter($event)"
          (pointerleave)="onTrackPointerLeave($event)"
        >
          <!-- Hour labels (left column) -->
          <div class="hour-label"
               *ngFor="let hour of hours"
               [style.top.px]="hour * HOUR_HEIGHT">
            {{ formatHour(hour) }}
          </div>
          <div class="hour-label" [style.top.px]="24 * HOUR_HEIGHT">24:00</div>

          <!-- Hour grid lines (full width from strip rightward) -->
          <div class="hour-line"
               *ngFor="let hour of hours"
               [style.top.px]="hour * HOUR_HEIGHT"></div>
          <div class="hour-line" [style.top.px]="24 * HOUR_HEIGHT"></div>

          <!-- 10-minute tick marks -->
          <div class="tick-line"
               *ngFor="let tick of tickMarks"
               [class.tick-line--half]="tick.isHalf"
               [style.top.px]="tick.pos"></div>

          <!-- Drag strip highlight (visual affordance, no pointer events) -->
          <div class="drag-strip-bg"></div>

          <!-- Drag selection overlay -->
          <div class="drag-overlay"
               *ngIf="isDragging || hasDragSelection"
               [style.top.px]="dragOverlayTop"
               [style.height.px]="dragOverlayHeight"></div>

          <!-- Log entry bars -->
          <div
            class="log-bar"
            *ngFor="let log of logs"
            [class.log-bar--highlighted]="log.id === highlightedLogId"
            [style.top.px]="timeToPixels(log.startAt)"
            [style.height.px]="barHeight(log)"
            [style.background]="log.logType?.color ?? '#9B9B9B'"
            [attr.data-log-id]="log.id"
            [title]="log.title + ' (' + log.startAt + ' – ' + log.endAt + ')'"
            (click)="onBarClick(log, $event)"
          >
            <span class="log-bar-label">{{ log.title }}</span>
            <span class="log-bar-time" *ngIf="barHeight(log) >= 22">
              {{ log.startAt }}–{{ log.endAt }}
            </span>
          </div>

          <!-- Current time indicator -->
          <div class="current-time-line" *ngIf="isToday"
               [style.top.px]="currentTimePixels">
            <div class="current-time-dot"></div>
          </div>

          <!-- Hover indicator: horizontal dashed line + time pill (idle) -->
          <ng-container *ngIf="isHoveringTrack && !isDragging">
            <div class="hover-line" [style.top.px]="hoverY"></div>
            <div class="hover-pill" [style.top.px]="hoverY">{{ hoverTimeLabel }}</div>
          </ng-container>

          <!-- During drag: anchor pill + live end pill -->
          <ng-container *ngIf="isDragging">
            <div class="drag-anchor-pill" [style.top.px]="dragStartY">
              {{ dragStartTimeLabel }}
            </div>
            <div class="drag-end-pill" [style.top.px]="dragCurrentY">
              {{ dragCurrentTimeLabel }}
            </div>
          </ng-container>

        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ── Wrapper ─────────────────────────────────────── */
    .timeline-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      width: 100%;
    }

    /* ── Header row ──────────────────────────────────── */
    .timeline-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 32px;
    }

    .timeline-date-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }

    /* ── Selection badge (in header) ─────────────────── */
    .selection-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-surface);
      border: 1px solid rgba(74,144,226,0.4);
      border-radius: var(--radius);
      padding: 5px 10px;
    }

    .sel-time {
      font-size: 13px;
      font-weight: 600;
      color: var(--highlight-selected);
      font-variant-numeric: tabular-nums;
    }

    .sel-dur {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-card);
      padding: 2px 7px;
      border-radius: 8px;
    }

    .btn-create-log {
      background: var(--highlight-selected);
      color: #fff;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: var(--radius-sm);
    }
    .btn-create-log:hover { opacity: 0.85; }

    .btn-clear-sel {
      background: none;
      color: var(--text-muted);
      padding: 3px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-clear-sel:hover { background: var(--bg-card); color: var(--text-primary); }

    /* ── Scroll container ────────────────────────────── */
    .scroll-container {
      overflow-y: auto;
      overflow-x: hidden;
      height: 520px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--timeline-bg);
      width: 100%;
      box-sizing: border-box;
      position: relative;
    }

    /* ── Timeline canvas ─────────────────────────────── */
    /*
     * Layout (pixels from left):
     *   0 – 46px  : hour labels
     *  46 – 70px  : drag strip  (cursor: crosshair)
     *  70px+      : log bar display area
     */
    .timeline-canvas {
      position: relative;
      width: 100%;
      height: 1440px; /* 24 hours × 60px/hr = 1440px  (1px = 1 min) */
      background: var(--timeline-bg);
      cursor: crosshair;
      user-select: none;
      touch-action: none;
    }

    /* ── Hour labels ─────────────────────────────────── */
    .hour-label {
      position: absolute;
      left: 0;
      width: 44px;
      transform: translateY(-50%);
      font-size: 10px;
      font-weight: 600;
      color: var(--timeline-text);
      text-align: right;
      padding-right: 6px;
      pointer-events: none;
      z-index: 2;
      white-space: nowrap;
      letter-spacing: 0.2px;
    }

    /* ── Grid lines ──────────────────────────────────── */
    .hour-line {
      position: absolute;
      left: 46px;
      right: 0;
      height: 1px;
      background: var(--border);
      pointer-events: none;
      z-index: 1;
    }

    .tick-line {
      position: absolute;
      left: 46px;
      width: 14px;
      height: 1px;
      background: var(--timeline-text-muted);
      opacity: 0.4;
      pointer-events: none;
    }

    /* Half-hour ticks slightly longer and more visible */
    .tick-line--half {
      width: 22px;
      opacity: 0.6;
    }

    /* ── Drag strip ──────────────────────────────────── */
    .drag-strip-bg {
      position: absolute;
      top: 0;
      left: 46px;
      width: 24px;
      height: 100%;
      background: rgba(255,255,255,0.04);
      border-right: 1px solid var(--border-light);
      pointer-events: none;
      z-index: 1;
    }

    /* ── Drag selection overlay ──────────────────────── */
    /* Spans the full width after the time-label column so the
       selected time band is clearly visible across the canvas. */
    .drag-overlay {
      position: absolute;
      left: 46px;
      right: 0;
      background: var(--drag-overlay);
      border-left: 3px solid rgba(74,144,226,0.75);
      border-top: 1px solid rgba(74,144,226,0.45);
      border-bottom: 1px solid rgba(74,144,226,0.45);
      border-radius: 0 3px 3px 0;
      pointer-events: none;
      z-index: 5;
    }

    /* ── Log entry bars ──────────────────────────────── */
    .log-bar {
      position: absolute;
      left: 74px;
      right: 6px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding: 3px 8px;
      overflow: hidden;
      cursor: pointer;
      min-height: 4px;
      z-index: 3;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transition: filter 0.15s ease, transform 0.1s ease;
    }

    .log-bar:hover {
      filter: brightness(1.15);
      transform: scaleY(1.01);
      z-index: 4;
    }

    .log-bar--highlighted {
      outline: 2px solid #fff;
      outline-offset: 2px;
      filter: brightness(1.2);
      z-index: 6;
      animation: bar-pulse 0.6s ease-out;
    }

    @keyframes bar-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.6); }
      70%  { box-shadow: 0 0 0 8px rgba(255,255,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
    }

    .log-bar-label {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.95);
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      line-height: 1.3;
    }

    .log-bar-time {
      font-size: 9px;
      color: rgba(255,255,255,0.72);
      font-variant-numeric: tabular-nums;
      pointer-events: none;
      line-height: 1.2;
    }

    /* ── Current time indicator ──────────────────────── */
    .current-time-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--highlight-today);
      pointer-events: none;
      z-index: 7;
      opacity: 0.9;
    }

    .current-time-dot {
      position: absolute;
      left: 44px;
      top: -4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--highlight-today);
    }

    /* ── Hover indicator ─────────────────────────────── */
    .hover-line {
      position: absolute;
      left: 46px;
      right: 0;
      height: 0;
      border-top: 1px dashed var(--timeline-text);
      opacity: 0.55;
      pointer-events: none;
      z-index: 6;
    }

    .hover-pill {
      position: absolute;
      left: 72px;
      transform: translateY(-50%);
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10;
      font-variant-numeric: tabular-nums;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }

    /* ── Drag time pills ─────────────────────────────── */
    .drag-anchor-pill {
      position: absolute;
      left: 72px;
      transform: translateY(-50%);
      background: var(--bg-card);
      color: var(--text-secondary);
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10;
      font-variant-numeric: tabular-nums;
    }

    .drag-end-pill {
      position: absolute;
      left: 72px;
      transform: translateY(-50%);
      background: var(--highlight-selected);
      color: #fff;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 11;
      font-variant-numeric: tabular-nums;
      box-shadow: 0 2px 8px rgba(74,144,226,0.45);
    }
  `]
})
export class TimelineComponent implements OnChanges {
  @Input() logs: LogEntry[] = [];
  @Input() selectedDate: Date = new Date();
  @Input() highlightedLogId: string | null = null;
  @Output() selectionMade    = new EventEmitter<DragSelection>();
  @Output() createLogClicked = new EventEmitter<DragSelection>();
  @Output() logClicked       = new EventEmitter<LogEntry>();

  @ViewChild('track', { static: false })
  trackRef!: ElementRef<HTMLDivElement>;

  @ViewChild('scrollContainer', { static: false })
  scrollContainerRef!: ElementRef<HTMLDivElement>;

  /* ── Dimensions ──────────────────────────────────────
   * HOUR_HEIGHT = 60px per hour → 1 px = 1 minute
   * TOTAL_HEIGHT = 24 × 60 = 1440 px  (= TOTAL_MINUTES)
   * So pixelsToMinutes(px) = px  and  minutesToPixels(m) = m
   * ──────────────────────────────────────────────────── */
  readonly HOUR_HEIGHT    = 60;
  readonly TOTAL_MINUTES  = 1440;
  readonly TOTAL_HEIGHT   = 1440; // 24 * HOUR_HEIGHT

  hours = Array.from({ length: 24 }, (_, i) => i);

  /** Pre-computed 10-minute tick marks (excludes full hour positions). */
  readonly tickMarks: TickMark[] = (() => {
    const marks: TickMark[] = [];
    for (let h = 0; h < 24; h++) {
      for (const t of [10, 20, 30, 40, 50]) {
        marks.push({ pos: h * 60 + t, isHalf: t === 30 });
      }
    }
    return marks;
  })();

  /* ── Drag / hover state ──────────────────────────── */
  isDragging       = false;
  hasDragSelection = false;
  dragStartY       = 0;
  dragCurrentY     = 0;
  dragSelection: DragSelection | null = null;

  isHoveringTrack = false;
  hoverY          = 0;

  /* ── Date / time state ──────────────────────────── */
  isToday           = false;
  currentTimePixels = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  /* ── Computed getters ────────────────────────────── */

  get dateLabel(): string {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  get dragOverlayTop(): number {
    return Math.min(this.dragStartY, this.dragCurrentY);
  }

  get dragOverlayHeight(): number {
    return Math.abs(this.dragCurrentY - this.dragStartY);
  }

  get selectionDuration(): string {
    if (!this.dragSelection) return '';
    const diff = this.dragSelection.endMinutes - this.dragSelection.startMinutes;
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60), m = diff % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  /** Exact cursor time (no snap) — shown in hover pill. */
  get hoverTimeLabel(): string {
    return this.minutesToTime(Math.round(this.pixelsToMinutes(this.hoverY)));
  }

  /** Snapped start anchor time — shown in drag anchor pill. */
  get dragStartTimeLabel(): string {
    return this.minutesToTime(Math.round(this.pixelsToMinutes(this.dragStartY)));
  }

  /** Snapped live end time — shown in drag end pill. */
  get dragCurrentTimeLabel(): string {
    return this.minutesToTime(Math.round(this.pixelsToMinutes(this.dragCurrentY)));
  }

  /* ── Lifecycle ───────────────────────────────────── */

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate'] && this.selectedDate) {
      this.checkIsToday();
      this.clearSelection();
    }
  }

  checkIsToday(): void {
    const today = new Date();
    const sel   = this.selectedDate;
    this.isToday =
      today.getFullYear() === sel.getFullYear() &&
      today.getMonth()    === sel.getMonth()    &&
      today.getDate()     === sel.getDate();

    if (this.isToday) {
      const now = new Date();
      this.currentTimePixels = this.minutesToPixels(now.getHours() * 60 + now.getMinutes());
    }
  }

  /* ── Coordinate helpers ──────────────────────────── */

  formatHour(hour: number): string {
    return String(hour).padStart(2, '0') + ':00';
  }

  /** Returns raw Y coordinate within the canvas (before snapping). */
  getTrackY(event: PointerEvent): number {
    if (!this.trackRef) return 0;
    const rect = this.trackRef.nativeElement.getBoundingClientRect();
    return event.clientY - rect.top;
  }

  /** px → minutes. With TOTAL_HEIGHT = TOTAL_MINUTES = 1440, this is 1:1. */
  pixelsToMinutes(px: number): number {
    return (px / this.TOTAL_HEIGHT) * this.TOTAL_MINUTES;
  }

  /** minutes → px. 1:1 with these dimensions. */
  minutesToPixels(minutes: number): number {
    return (minutes / this.TOTAL_MINUTES) * this.TOTAL_HEIGHT;
  }

  timeToPixels(time: string): number {
    return this.minutesToPixels(this.timeToMinutes(time));
  }

  barHeight(log: LogEntry): number {
    const diff = this.timeToMinutes(log.endAt) - this.timeToMinutes(log.startAt);
    if (diff <= 0) return 0;
    return this.minutesToPixels(diff);
  }

  /**
   * Snap to nearest 10-minute mark.
   * A-zone (0–4 min past mark) → rounds DOWN.
   * B-zone (5–9 min past mark) → rounds UP.
   */
  snapToTen(minutes: number): number {
    return Math.round(minutes / 10) * 10;
  }

  minutesToTime(minutes: number): string {
    const clamped = Math.max(0, Math.min(minutes, this.TOTAL_MINUTES));
    const h = Math.floor(clamped / 60).toString().padStart(2, '0');
    const m = (clamped % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /* ── Pointer handlers (mouse + touch unified via Pointer Events API) ──────── */

  onPointerDown(event: PointerEvent): void {
    // Primary button only for mouse; any touch/pen contact is fine
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!this.trackRef) return;

    // Don't start drag when tapping directly on a log bar (those open edit form)
    if ((event.target as HTMLElement).closest('.log-bar')) return;

    event.preventDefault();

    // Capture the pointer so pointermove/pointerup fire even outside the element
    this.trackRef.nativeElement.setPointerCapture(event.pointerId);

    const rawY     = Math.max(0, Math.min(this.getTrackY(event), this.TOTAL_HEIGHT));
    const snappedY = this.minutesToPixels(this.snapToTen(this.pixelsToMinutes(rawY)));

    this.isDragging       = true;
    this.hasDragSelection = false;
    this.dragStartY       = snappedY;
    this.dragCurrentY     = snappedY;
    this.dragSelection    = null;
  }

  /** pointermove: hover stays exact; drag end snaps live to 10-min grid.
   *  setPointerCapture keeps this firing even when the pointer leaves the canvas. */
  onPointerMove(event: PointerEvent): void {
    if (!this.trackRef) return;
    const rawY = Math.max(0, Math.min(this.getTrackY(event), this.TOTAL_HEIGHT));
    this.hoverY = rawY;
    if (this.isDragging) {
      this.dragCurrentY = this.minutesToPixels(this.snapToTen(this.pixelsToMinutes(rawY)));
    }
    this.cdr.detectChanges();
  }

  /** Show hover indicator only for mouse pointers (not touch/pen). */
  onTrackPointerEnter(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.isHoveringTrack = true;
  }

  onTrackPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      this.isHoveringTrack = false;
      this.cdr.detectChanges();
    }
  }

  onPointerUp(_event: PointerEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.isHoveringTrack = false;

    // dragStartY / dragCurrentY are already snapped — sort into start < end
    let startMins = Math.round(this.pixelsToMinutes(Math.min(this.dragStartY, this.dragCurrentY)));
    let endMins   = Math.round(this.pixelsToMinutes(Math.max(this.dragStartY, this.dragCurrentY)));

    // Minimum selection of 10 minutes
    if (endMins - startMins < 10) endMins = startMins + 10;

    startMins = Math.max(0, Math.min(startMins, this.TOTAL_MINUTES));
    endMins   = Math.max(0, Math.min(endMins,   this.TOTAL_MINUTES));

    // Snap overlay pixels to exact final values
    this.dragStartY   = this.minutesToPixels(startMins);
    this.dragCurrentY = this.minutesToPixels(endMins);

    this.dragSelection = {
      startTime:    this.minutesToTime(startMins),
      endTime:      this.minutesToTime(endMins),
      startMinutes: startMins,
      endMinutes:   endMins
    };

    if (endMins > startMins) {
      this.hasDragSelection = true;
      this.selectionMade.emit(this.dragSelection);
    } else {
      this.hasDragSelection = false;
    }

    this.cdr.detectChanges();
  }

  onBarClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.logClicked.emit(log);
  }

  /** Scroll the timeline so the given log bar is centred vertically. */
  scrollToLog(log: LogEntry): void {
    if (!this.scrollContainerRef) return;
    const container   = this.scrollContainerRef.nativeElement;
    const barTop      = this.timeToPixels(log.startAt);
    const barBottom   = barTop + this.barHeight(log);
    const barCenter   = (barTop + barBottom) / 2;
    const targetScroll = barCenter - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
  }

  clearSelection(): void {
    this.hasDragSelection = false;
    this.isDragging       = false;
    this.dragSelection    = null;
    this.dragStartY       = 0;
    this.dragCurrentY     = 0;
  }

  openCreateForm(): void {
    if (this.dragSelection) this.createLogClicked.emit(this.dragSelection);
  }
}
