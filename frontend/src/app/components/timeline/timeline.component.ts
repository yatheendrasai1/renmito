import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  HostListener,
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

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-wrapper">
      <div class="timeline-date-label">
        {{ dateLabel }}
      </div>

      <div class="timeline-scroll-container" #scrollContainer>
        <div
          class="timeline-track"
          #track
          (mousedown)="onMouseDown($event)"
          (mousemove)="onTrackMouseMove($event)"
          (mouseenter)="onTrackMouseEnter()"
          (mouseleave)="onTrackMouseLeave()"
        >
          <!-- Hour columns -->
          <div class="hour-column" *ngFor="let hour of hours" [style.left.px]="hour * HOUR_WIDTH">
            <div class="hour-label">{{ formatHour(hour) }}</div>
            <!-- Quarter subdivisions -->
            <div class="quarter-line" [style.left.px]="HOUR_WIDTH * 0.25"></div>
            <div class="quarter-line" [style.left.px]="HOUR_WIDTH * 0.5"></div>
            <div class="quarter-line" [style.left.px]="HOUR_WIDTH * 0.75"></div>
            <div class="hour-line"></div>
          </div>

          <!-- End cap hour line for 24:00 -->
          <div class="hour-end-line" [style.left.px]="24 * HOUR_WIDTH"></div>

          <!-- Log entry bars -->
          <div
            class="log-bar"
            *ngFor="let log of logs"
            [class.log-bar--highlighted]="log.id === highlightedLogId"
            [style.left.px]="timeToPixels(log.startTime)"
            [style.width.px]="barWidth(log)"
            [style.background]="log.color"
            [attr.data-log-id]="log.id"
            [title]="log.label + ' (' + log.startTime + ' – ' + log.endTime + ')'"
            (click)="onBarClick(log, $event)"
          >
            <span class="log-bar-label">{{ log.label }}</span>
          </div>

          <!-- Drag selection overlay -->
          <div
            class="drag-overlay"
            *ngIf="isDragging || hasDragSelection"
            [style.left.px]="dragOverlayLeft"
            [style.width.px]="dragOverlayWidth"
          ></div>

          <!-- Current time indicator -->
          <div
            class="current-time-line"
            *ngIf="isToday"
            [style.left.px]="currentTimePixels"
          >
            <div class="current-time-dot"></div>
          </div>

          <!-- Hover indicator: dashed line + time pill (idle, not dragging) -->
          <ng-container *ngIf="isHoveringTrack && !isDragging">
            <div class="hover-line" [style.left.px]="hoverX"></div>
            <div class="hover-pill"
                 [style.left.px]="hoverX"
                 [class.hover-pill--flip]="hoverX > TOTAL_WIDTH - 60">
              {{ hoverTimeLabel }}
            </div>
          </ng-container>

          <!-- During drag: start time + live end time pills -->
          <ng-container *ngIf="isDragging">
            <div class="drag-anchor-pill"
                 [style.left.px]="dragStartX"
                 [class.drag-anchor-pill--flip]="dragStartX > TOTAL_WIDTH - 60">
              {{ dragStartTimeLabel }}
            </div>
            <div class="drag-end-pill"
                 [style.left.px]="dragCurrentX"
                 [class.drag-end-pill--flip]="dragCurrentX > TOTAL_WIDTH - 60">
              {{ dragCurrentTimeLabel }}
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Drag selection info bar -->
      <div class="selection-bar" *ngIf="hasDragSelection && !isDragging">
        <div class="selection-info">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="margin-right:6px; vertical-align:middle; flex-shrink:0;">
            <circle cx="8" cy="8" r="6.5" stroke="#4A90E2" stroke-width="1.5"/>
            <path d="M8 5v3l2 2" stroke="#4A90E2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="selection-time">{{ dragSelection?.startTime }} – {{ dragSelection?.endTime }}</span>
          <span class="selection-duration">{{ selectionDuration }}</span>
        </div>
        <div class="selection-actions">
          <button class="btn-create-log" (click)="openCreateForm()">
            + Create Log
          </button>
          <button class="btn-clear-selection" (click)="clearSelection()" aria-label="Clear selection">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .timeline-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0;
      min-width: 0;
      width: 100%;
    }

    .timeline-date-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 8px;
      padding-left: 4px;
    }

    .timeline-scroll-container {
      overflow-x: auto;
      overflow-y: visible;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--timeline-bg);
      width: 100%;
      box-sizing: border-box;
    }

    .timeline-track {
      position: relative;
      width: 1920px;   /* 24 * 80px */
      height: 200px;
      cursor: crosshair;
      background: var(--timeline-bg);
      border-radius: var(--radius);
      overflow: visible;
    }

    .hour-column {
      position: absolute;
      top: 0;
      height: 100%;
      width: 80px;
    }

    .hour-label {
      position: absolute;
      top: 6px;
      left: 4px;
      font-size: 10px;
      font-weight: 500;
      color: var(--timeline-text);
      pointer-events: none;
      white-space: nowrap;
      letter-spacing: 0.3px;
    }

    .hour-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      height: 100%;
      background: var(--border);
      pointer-events: none;
    }

    .hour-end-line {
      position: absolute;
      top: 0;
      width: 1px;
      height: 100%;
      background: var(--border);
      pointer-events: none;
    }

    .quarter-line {
      position: absolute;
      top: 28px;
      width: 1px;
      height: calc(100% - 28px);
      background: var(--timeline-line);
      opacity: 0.5;
      pointer-events: none;
    }

    .log-bar {
      position: absolute;
      top: 28px;
      height: calc(100% - 36px);
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding: 0 8px;
      cursor: pointer;
      overflow: hidden;
      transition: filter 0.15s ease, transform 0.1s ease;
      min-width: 4px;
      z-index: 2;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }

    .log-bar:hover {
      filter: brightness(1.15);
      transform: scaleY(1.04);
      z-index: 3;
    }

    .log-bar--highlighted {
      outline: 2px solid #fff;
      outline-offset: 2px;
      filter: brightness(1.2);
      transform: scaleY(1.08);
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
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    .drag-overlay {
      position: absolute;
      top: 28px;
      height: calc(100% - 36px);
      background: var(--drag-overlay);
      border: 1px solid rgba(74, 144, 226, 0.6);
      border-radius: 3px;
      pointer-events: none;
      z-index: 4;
    }

    .current-time-line {
      position: absolute;
      top: 0;
      width: 2px;
      height: 100%;
      background: var(--highlight-today);
      pointer-events: none;
      z-index: 5;
      opacity: 0.8;
    }

    .current-time-dot {
      position: absolute;
      top: 26px;
      left: -4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--highlight-today);
    }

    /* ── Hover indicator ────────────────────────────────── */
    .hover-line {
      position: absolute;
      top: 0;
      width: 1px;
      height: 100%;
      background: var(--timeline-text-muted);
      opacity: 0.7;
      pointer-events: none;
      z-index: 6;
      border-left: 1px dashed var(--timeline-text);
    }

    .hover-pill {
      position: absolute;
      top: 4px;
      transform: translateX(-50%);
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

    .hover-pill--flip {
      transform: translateX(-100%);
    }

    /* ── Drag time pills ─────────────────────────────────── */
    .drag-anchor-pill {
      position: absolute;
      top: 4px;
      transform: translateX(-50%);
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

    .drag-anchor-pill--flip {
      transform: translateX(-100%);
    }

    .drag-end-pill {
      position: absolute;
      top: 4px;
      transform: translateX(-50%);
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

    .drag-end-pill--flip {
      transform: translateX(-100%);
    }

    .selection-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-surface);
      border: 1px solid rgba(74, 144, 226, 0.4);
      border-top: none;
      border-radius: 0 0 var(--radius) var(--radius);
      padding: 8px 14px;
      gap: 12px;
    }

    .selection-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .selection-time {
      font-size: 14px;
      font-weight: 600;
      color: var(--highlight-selected);
    }

    .selection-duration {
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-card);
      padding: 2px 8px;
      border-radius: 10px;
    }

    .selection-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-create-log {
      background: var(--highlight-selected);
      color: white;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: var(--radius-sm);
    }

    .btn-create-log:hover {
      background: #3a7fcf;
    }

    .btn-clear-selection {
      background: var(--bg-card);
      color: var(--text-muted);
      padding: 6px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-clear-selection:hover {
      background: var(--accent-hover);
      color: var(--text-primary);
    }
  `]
})
export class TimelineComponent implements OnChanges {
  @Input() logs: LogEntry[] = [];
  @Input() selectedDate: Date = new Date();
  @Input() highlightedLogId: string | null = null;
  @Output() selectionMade = new EventEmitter<DragSelection>();
  @Output() createLogClicked = new EventEmitter<DragSelection>();
  @Output() logClicked = new EventEmitter<LogEntry>();

  @ViewChild('track', { static: false }) trackRef!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollContainer', { static: false }) scrollContainerRef!: ElementRef<HTMLDivElement>;

  readonly HOUR_WIDTH = 80;
  readonly TOTAL_MINUTES = 1440;
  readonly TOTAL_WIDTH = 1920; // 24 * 80

  hours = Array.from({ length: 24 }, (_, i) => i);

  isDragging = false;
  hasDragSelection = false;
  dragStartX = 0;
  dragCurrentX = 0;
  dragSelection: DragSelection | null = null;
  isToday = false;
  currentTimePixels = 0;

  /* hover state */
  isHoveringTrack = false;
  hoverX = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  get dateLabel(): string {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  get dragOverlayLeft(): number {
    return Math.min(this.dragStartX, this.dragCurrentX);
  }

  get dragOverlayWidth(): number {
    return Math.abs(this.dragCurrentX - this.dragStartX);
  }

  get selectionDuration(): string {
    if (!this.dragSelection) return '';
    const diff = this.dragSelection.endMinutes - this.dragSelection.startMinutes;
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  /** Exact minute-precision time at hover position. */
  get hoverTimeLabel(): string {
    return this.minutesToTime(Math.round(this.pixelsToMinutes(this.hoverX)));
  }

  /** Drag start time (minute precision). */
  get dragStartTimeLabel(): string {
    return this.minutesToTime(Math.round(this.pixelsToMinutes(this.dragStartX)));
  }

  /** Live drag end time (minute precision — finer than the final quarter-snap). */
  get dragCurrentTimeLabel(): string {
    return this.minutesToTime(Math.round(this.pixelsToMinutes(this.dragCurrentX)));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate'] && this.selectedDate) {
      this.checkIsToday();
      this.clearSelection();
    }
  }

  checkIsToday(): void {
    const today = new Date();
    const sel = this.selectedDate;
    this.isToday =
      today.getFullYear() === sel.getFullYear() &&
      today.getMonth() === sel.getMonth() &&
      today.getDate() === sel.getDate();

    if (this.isToday) {
      const now = new Date();
      const totalMins = now.getHours() * 60 + now.getMinutes();
      this.currentTimePixels = (totalMins / this.TOTAL_MINUTES) * this.TOTAL_WIDTH;
    }
  }

  formatHour(hour: number): string {
    return String(hour).padStart(2, '0') + ':00';
  }

  timeToPixels(time: string): number {
    const mins = this.timeToMinutes(time);
    return (mins / this.TOTAL_MINUTES) * this.TOTAL_WIDTH;
  }

  barWidth(log: LogEntry): number {
    const startMins = this.timeToMinutes(log.startTime);
    const endMins = this.timeToMinutes(log.endTime);
    const diff = endMins - startMins;
    if (diff <= 0) return 0;
    return (diff / this.TOTAL_MINUTES) * this.TOTAL_WIDTH;
  }

  getTrackX(event: MouseEvent): number {
    if (!this.trackRef) return 0;
    const rect = this.trackRef.nativeElement.getBoundingClientRect();
    return event.clientX - rect.left;
  }

  pixelsToMinutes(px: number): number {
    return (px / this.TOTAL_WIDTH) * this.TOTAL_MINUTES;
  }

  snapToQuarter(minutes: number): number {
    return Math.round(minutes / 15) * 15;
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

  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const x = Math.max(0, Math.min(this.getTrackX(event), this.TOTAL_WIDTH));
    this.isDragging = true;
    this.hasDragSelection = false;
    this.dragStartX = x;
    this.dragCurrentX = x;
    this.dragSelection = null;
  }

  /** Track-level mousemove: updates hover position AND drag end during drag. */
  onTrackMouseMove(event: MouseEvent): void {
    if (!this.trackRef) return;
    const x = Math.max(0, Math.min(this.getTrackX(event), this.TOTAL_WIDTH));
    this.hoverX = x;
    if (this.isDragging) {
      this.dragCurrentX = x;
    }
    this.cdr.detectChanges();
  }

  onTrackMouseEnter(): void {
    this.isHoveringTrack = true;
  }

  onTrackMouseLeave(): void {
    this.isHoveringTrack = false;
    // drag continues — let document:mouseup end it
    this.cdr.detectChanges();
  }

  /** Document-level mousemove: keeps drag alive when cursor leaves the track. */
  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.trackRef) return;
    const x = Math.max(0, Math.min(this.getTrackX(event), this.TOTAL_WIDTH));
    this.dragCurrentX = x;
    this.hoverX = x;
    this.cdr.detectChanges();
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    const left = Math.min(this.dragStartX, this.dragCurrentX);
    const right = Math.max(this.dragStartX, this.dragCurrentX);

    let startMins = this.snapToQuarter(this.pixelsToMinutes(left));
    let endMins = this.snapToQuarter(this.pixelsToMinutes(right));

    // Minimum selection of 15 minutes
    if (endMins - startMins < 15) {
      endMins = startMins + 15;
    }

    startMins = Math.max(0, Math.min(startMins, this.TOTAL_MINUTES));
    endMins = Math.max(0, Math.min(endMins, this.TOTAL_MINUTES));

    const startTimeStr = this.minutesToTime(startMins);
    const endTimeStr = this.minutesToTime(endMins);

    // Recalculate overlay based on snapped values
    this.dragStartX = (startMins / this.TOTAL_MINUTES) * this.TOTAL_WIDTH;
    this.dragCurrentX = (endMins / this.TOTAL_MINUTES) * this.TOTAL_WIDTH;

    this.dragSelection = {
      startTime: startTimeStr,
      endTime: endTimeStr,
      startMinutes: startMins,
      endMinutes: endMins
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

  /** Scroll the timeline so the given log bar is centred in the visible area. */
  scrollToLog(log: LogEntry): void {
    if (!this.scrollContainerRef) return;
    const container = this.scrollContainerRef.nativeElement;
    const barLeft  = this.timeToPixels(log.startTime);
    const barRight = barLeft + this.barWidth(log);
    const barCenter = (barLeft + barRight) / 2;
    const containerWidth = container.clientWidth;
    const targetScroll = barCenter - containerWidth / 2;
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
  }

  clearSelection(): void {
    this.hasDragSelection = false;
    this.isDragging = false;
    this.dragSelection = null;
    this.dragStartX = 0;
    this.dragCurrentX = 0;
  }

  openCreateForm(): void {
    if (this.dragSelection) {
      this.createLogClicked.emit(this.dragSelection);
    }
  }
}
