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

      <!-- ── Header: selection/create bar ─────────────── -->
      <div class="timeline-header">

        <div class="selection-badge" *ngIf="!isDragging">
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

        <!-- Mobile-only scroll controls (touch-action:none on canvas blocks swipe scroll) -->
        <div class="mobile-scroll-btns">
          <button class="mobile-scroll-btn" (click)="scrollTimeline(-180)" aria-label="Scroll up 3 hours">▲</button>
          <button class="mobile-scroll-btn mobile-scroll-btn--now" (click)="scrollToNow()" aria-label="Jump to now">Now</button>
          <button class="mobile-scroll-btn" (click)="scrollTimeline(180)" aria-label="Scroll down 3 hours">▼</button>
        </div>

      </div>

      <!-- ── Scrollable timeline canvas ─────────────── -->
      <div class="scroll-container" #scrollContainer>
        <div
          class="timeline-canvas"
          #track
          [style.height.px]="totalHeight"
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
               [style.top.px]="hour * hourHeight">
            {{ formatHour(hour) }}
          </div>
          <div class="hour-label" [style.top.px]="24 * hourHeight">24:00</div>

          <!-- Hour grid lines (full width from strip rightward) -->
          <div class="hour-line"
               *ngFor="let hour of hours"
               [style.top.px]="hour * hourHeight"></div>
          <div class="hour-line" [style.top.px]="24 * hourHeight"></div>

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
            [class.log-bar--highlighted]="isBarHighlighted(log)"
            [class.log-bar--dimmed]="isBarDimmed(log)"
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
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 38px;
    }

    /* ── Selection / create badge ────────────────────── */
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

    /* Consistent scrollbar that respects the container's border-radius */
    .scroll-container::-webkit-scrollbar { width: 5px; }
    .scroll-container::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 0 var(--radius) var(--radius) 0;
    }
    .scroll-container::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    .scroll-container::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }

    /* ── Mobile scroll buttons (only shown ≤ 700px) ──── */
    .mobile-scroll-btns {
      display: none;
      align-items: center;
      gap: 4px;
      margin-left: auto;
    }
    @media (max-width: 700px) {
      .mobile-scroll-btns { display: flex; }
    }

    .mobile-scroll-btn {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-primary);
      border-radius: var(--radius-sm);
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      line-height: 1;
      transition: background 0.15s, border-color 0.15s;
      /* Ensure tap target is comfortably large on mobile */
      min-width: 36px;
      min-height: 32px;
    }
    .mobile-scroll-btn:hover,
    .mobile-scroll-btn:active { background: var(--accent-hover); border-color: var(--border-light); }

    .mobile-scroll-btn--now {
      color: var(--highlight-selected);
      border-color: var(--highlight-selected);
      min-width: 44px;
    }

    /* ── Timeline canvas ─────────────────────────────── */
    /*
     * touch-action: none is required on the canvas so the browser does NOT
     * intercept touch events as scroll gestures. Without it, the browser
     * cancels pointer events mid-drag and breaks time-range selection.
     * Scrolling on mobile is handled instead by the ▲ / Now / ▼ tap buttons
     * in the timeline header (only rendered on ≤ 700px screens).
     * Canvas height is driven by [style.height.px]="totalHeight" (hourHeight × 24)
     * so it stretches/shrinks automatically as the user pinch-zooms.
     */
    .timeline-canvas {
      position: relative;
      width: 100%;
      /* height is set dynamically via [style.height.px]="totalHeight" */
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

    .log-bar--dimmed {
      opacity: 0.18;
      filter: grayscale(0.5);
      transition: opacity 0.2s, filter 0.2s;
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
  @Input() logs:             LogEntry[] = [];
  @Input() selectedDate:     Date = new Date();
  @Input() highlightedLogId: string | null = null;
  @Input() metricLogIds:     Set<string> | null = null;
  @Output() selectionMade    = new EventEmitter<DragSelection>();
  @Output() createLogClicked = new EventEmitter<DragSelection>();
  @Output() logClicked       = new EventEmitter<LogEntry>();

  @ViewChild('track', { static: false })
  trackRef!: ElementRef<HTMLDivElement>;

  @ViewChild('scrollContainer', { static: false })
  scrollContainerRef!: ElementRef<HTMLDivElement>;

  /* ── Dimensions ──────────────────────────────────────
   * hourHeight: pixels per hour — default 26 (520px container ÷ 20 hours = 26px/hr,
   *   showing ~20 hours at a glance without scrolling).
   * Changed at runtime by pinch-to-zoom. totalHeight = 24 × hourHeight
   * drives the canvas height binding and all pixel↔minute conversions.
   * TOTAL_MINUTES stays fixed (minutes in a day never changes).
   * ──────────────────────────────────────────────────── */
  hourHeight = 26;                   // mutable — changed by pinch-to-zoom
  readonly MIN_HOUR_HEIGHT = 25;     // most compressed view
  readonly MAX_HOUR_HEIGHT = 150;    // most zoomed-in view
  readonly TOTAL_MINUTES   = 1440;

  get totalHeight(): number { return 24 * this.hourHeight; }

  hours = Array.from({ length: 24 }, (_, i) => i);

  /** 10-minute tick marks — recomputed whenever hourHeight changes. */
  get tickMarks(): TickMark[] {
    const marks: TickMark[] = [];
    for (let h = 0; h < 24; h++) {
      for (const t of [10, 20, 30, 40, 50]) {
        marks.push({ pos: this.minutesToPixels(h * 60 + t), isHalf: t === 30 });
      }
    }
    return marks;
  }

  /* ── Drag / hover state ──────────────────────────── */
  isDragging       = false;
  hasDragSelection = false;
  dragStartY       = 0;
  dragCurrentY     = 0;
  dragSelection: DragSelection | null = null;

  isHoveringTrack = false;
  hoverY          = 0;

  /* ── Pinch-to-zoom state ────────────────────────────── */
  isPinching            = false;
  private activePointerMap = new Map<number, { x: number; y: number }>();
  private pinchStartDist   = 0;
  private pinchStartHourH  = 26;
  private pinchFocalMinute = 0; // time (minutes) that stays fixed under pinch midpoint

  /* ── Date / time state ──────────────────────────── */
  isToday            = false;
  currentTimeMins    = 0;
  get currentTimePixels(): number { return this.minutesToPixels(this.currentTimeMins); }

  constructor(private cdr: ChangeDetectorRef) {}

  /* ── Computed getters ────────────────────────────── */

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
      this.initDefaultSelection();
    }
  }

  /**
   * Sets a default selection of the last 1 hour (today) or 09:00–10:00 (other days).
   * Called on date change and on clear so the "+ Create Log" bar is always populated.
   */
  initDefaultSelection(): void {
    let endMins: number;

    if (this.isToday) {
      const now = new Date();
      endMins = this.snapToTen(now.getHours() * 60 + now.getMinutes());
      // Ensure at least 60 min from start-of-day
      if (endMins < 60) endMins = 60;
    } else {
      endMins = 10 * 60; // 10:00
    }

    const startMins = Math.max(0, endMins - 60);
    endMins         = Math.min(endMins, this.TOTAL_MINUTES);

    this.dragStartY   = this.minutesToPixels(startMins);
    this.dragCurrentY = this.minutesToPixels(endMins);
    this.isDragging   = false;

    this.dragSelection = {
      startTime:    this.minutesToTime(startMins),
      endTime:      this.minutesToTime(endMins),
      startMinutes: startMins,
      endMinutes:   endMins
    };
    this.hasDragSelection = true;
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
      this.currentTimeMins = now.getHours() * 60 + now.getMinutes();
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

  /** px → minutes. Scale depends on current hourHeight. */
  pixelsToMinutes(px: number): number {
    return (px / this.totalHeight) * this.TOTAL_MINUTES;
  }

  /** minutes → px. Scale depends on current hourHeight. */
  minutesToPixels(minutes: number): number {
    return (minutes / this.TOTAL_MINUTES) * this.totalHeight;
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
    if (!this.trackRef) return;

    // Always capture and track the pointer
    this.trackRef.nativeElement.setPointerCapture(event.pointerId);
    this.activePointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointerMap.size >= 2) {
      // Second finger down → switch to pinch mode (cancel any drag in progress)
      this.isDragging      = false;
      this.isPinching      = true;
      this.pinchStartDist  = this.calcPinchDist();
      this.pinchStartHourH = this.hourHeight;
      this.pinchFocalMinute = this.calcPinchFocalMinute();
      event.preventDefault();
      return;
    }

    // Single pointer — existing drag-select logic
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.log-bar')) return;

    event.preventDefault();

    const rawY     = Math.max(0, Math.min(this.getTrackY(event), this.totalHeight));
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

    // Update tracked position for this pointer
    if (this.activePointerMap.has(event.pointerId)) {
      this.activePointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    // Pinch in progress — delegate to pinch handler, skip drag/hover
    if (this.isPinching && this.activePointerMap.size === 2) {
      this.handlePinch();
      this.cdr.detectChanges();
      return;
    }

    const rawY = Math.max(0, Math.min(this.getTrackY(event), this.totalHeight));
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

  onPointerUp(event: PointerEvent): void {
    this.activePointerMap.delete(event.pointerId);

    // Pinch ended when fewer than 2 fingers remain
    if (this.isPinching) {
      if (this.activePointerMap.size < 2) {
        this.isPinching = false;
      }
      this.cdr.detectChanges();
      return;
    }

    if (!this.isDragging) return;
    this.isDragging      = false;
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

  /** When a metric card is active, highlighted = in the set; else fall back to single-log mode. */
  isBarHighlighted(log: LogEntry): boolean {
    if (this.metricLogIds !== null) return this.metricLogIds.has(log.id);
    return log.id === this.highlightedLogId;
  }

  /** Dim bars that are NOT in the active metric set. */
  isBarDimmed(log: LogEntry): boolean {
    if (this.metricLogIds !== null) return !this.metricLogIds.has(log.id);
    return false;
  }

  onBarClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.logClicked.emit(log);
  }

  /* ── Pinch-to-zoom helpers ──────────────────────────── */

  /** Euclidean distance between the two tracked pointers. */
  private calcPinchDist(): number {
    const pts = [...this.activePointerMap.values()];
    if (pts.length < 2) return 1;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Timeline minute that sits under the midpoint of the two fingers. */
  private calcPinchFocalMinute(): number {
    const pts = [...this.activePointerMap.values()];
    const midClientY = (pts[0].y + pts[1].y) / 2;
    const container  = this.scrollContainerRef?.nativeElement;
    if (!container) return 0;
    const rect    = container.getBoundingClientRect();
    const scrollY = container.scrollTop + midClientY - rect.top;
    return this.pixelsToMinutes(Math.max(0, scrollY));
  }

  /**
   * Called on every pointermove while two fingers are active.
   * Scales hourHeight proportionally to the change in finger spread,
   * then adjusts scrollTop so the focal minute stays under the midpoint.
   */
  private handlePinch(): void {
    const newDist = this.calcPinchDist();
    if (newDist < 1) return;

    const scale    = newDist / this.pinchStartDist;
    const newHourH = Math.max(
      this.MIN_HOUR_HEIGHT,
      Math.min(this.MAX_HOUR_HEIGHT, this.pinchStartHourH * scale)
    );
    if (Math.abs(newHourH - this.hourHeight) < 0.5) return; // skip tiny jitter

    const container = this.scrollContainerRef?.nativeElement;
    const pts       = [...this.activePointerMap.values()];
    const midClientY = (pts[0].y + pts[1].y) / 2;

    // Convert existing drag selection to minutes BEFORE scaling, re-project after
    const selStartMins = this.pixelsToMinutes(this.dragStartY);
    const selEndMins   = this.pixelsToMinutes(this.dragCurrentY);

    // Apply new zoom level
    this.hourHeight = newHourH;

    // Re-project drag selection into new pixel space
    this.dragStartY   = this.minutesToPixels(selStartMins);
    this.dragCurrentY = this.minutesToPixels(selEndMins);

    // Adjust scroll to keep focal minute under the pinch midpoint
    if (container) {
      const rect        = container.getBoundingClientRect();
      const viewOffset  = midClientY - rect.top;  // px from container top in viewport
      const newTotalH   = 24 * newHourH;
      const newFocalPx  = (this.pinchFocalMinute / this.TOTAL_MINUTES) * newTotalH;
      container.scrollTop = Math.max(0, newFocalPx - viewOffset);
    }
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

  /** Mobile scroll buttons: scroll by delta px (positive = down, negative = up). */
  scrollTimeline(delta: number): void {
    if (!this.scrollContainerRef) return;
    this.scrollContainerRef.nativeElement.scrollBy({ top: delta, behavior: 'smooth' });
  }

  /** Mobile "Now" button: centre the scroll position on the current time (today only). */
  scrollToNow(): void {
    if (!this.scrollContainerRef) return;
    const container = this.scrollContainerRef.nativeElement;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const px = this.minutesToPixels(mins);
    container.scrollTo({ top: Math.max(0, px - container.clientHeight / 2), behavior: 'smooth' });
  }

  clearSelection(): void {
    this.initDefaultSelection();
  }

  openCreateForm(): void {
    if (this.dragSelection) this.createLogClicked.emit(this.dragSelection);
  }
}
