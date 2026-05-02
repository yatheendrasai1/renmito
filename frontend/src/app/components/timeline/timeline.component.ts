import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  AfterViewInit,
  SimpleChanges,
  ElementRef,
  HostListener,
  ViewChild,
  ChangeDetectorRef,
  ChangeDetectionStrategy
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { LogEntry } from '../../models/log.model';

export interface DragSelection {
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  mergeSourceIds?: [string, string];
  mergeLogTypeId?: string;
}

interface TickMark { pos: number; isHalf: boolean; }

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline-wrapper">

      <!-- ── Header ─────────────────────────────────────── -->
      <div class="timeline-header" [class.timeline-header--no-toggle]="!collapsible"
           (click)="collapsible && (isCollapsed = !isCollapsed)">

        <button class="timeline-collapse-btn" tabindex="-1"
                *ngIf="collapsible"
                [title]="isCollapsed ? 'Expand timeline' : 'Collapse timeline'"
                [attr.aria-expanded]="!isCollapsed">
          <svg class="collapse-chevron" [class.collapse-chevron--open]="!isCollapsed"
               width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="collapse-label">Timeline</span>
        </button>

        <span class="sel-hint" *ngIf="!mergeMode && !dragSelection">Tap timeline to select a slot</span>

        <div class="merge-banner" *ngIf="mergeMode" (click)="$event.stopPropagation()">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
               style="flex-shrink:0;color:#F6A623">
            <circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/>
            <line x1="6.5" y1="8" x2="9.5" y2="8" stroke="currentColor" stroke-width="1.4"
                  stroke-linecap="round" stroke-dasharray="1.5 1.5"/>
          </svg>
          <span class="merge-hint">Select another point log to create a time range</span>
          <button class="btn-cancel-merge" (click)="cancelMerge()">Cancel</button>
        </div>

      </div>

      <!-- ── Horizontal scrollable canvas ──────────────── -->
      <div class="scroll-container" #scrollContainer *ngIf="!collapsible || !isCollapsed">
        <div
          class="timeline-canvas"
          #track
          [style.width.px]="totalWidth"
          [style.height.px]="canvasHeight"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp($event)"
          (pointercancel)="onPointerUp($event)"
          (pointerenter)="onTrackPointerEnter($event)"
          (pointerleave)="onTrackPointerLeave($event)"
        >
          <!-- Ruler strip background (sits behind labels, above bars) -->
          <div class="ruler-strip" [style.height.px]="LABEL_H"></div>

          <!-- Hour labels -->
          <div class="hour-label"
               *ngFor="let hour of labelHours"
               [style.left.px]="hour * hourWidth + 2">
            {{ formatHour(hour) }}
          </div>

          <!-- Vertical hour grid lines -->
          <div class="hour-line"
               *ngFor="let hour of hours; trackBy: trackByIndex"
               [style.left.px]="hour * hourWidth"></div>
          <div class="hour-line" [style.left.px]="24 * hourWidth"></div>

          <!-- 10-minute tick marks -->
          <div class="tick-line"
               *ngFor="let tick of tickMarks; trackBy: trackByPos"
               [class.tick-line--half]="tick.isHalf"
               [style.left.px]="tick.pos"></div>

          <!-- Selection overlay (tap-to-select result) -->
          <div class="drag-overlay"
               *ngIf="hasDragSelection"
               [style.left.px]="dragOverlayLeft"
               [style.width.px]="dragOverlayWidth"
               [style.top.px]="LABEL_H"
               [style.height.px]="barAreaHeight"></div>

          <!-- Log tooltip: icon button pinned to the top corner of the selection -->
          <button
            class="log-tooltip-btn"
            *ngIf="hasDragSelection && dragSelection && !isPanning"
            [class.log-tooltip-btn--left]="!tooltipOnRight"
            [style.left.px]="tooltipLeft"
            [style.top.px]="LABEL_H + 3"
            title="Log this slot"
            (pointerdown)="$event.stopPropagation()"
            (pointerup)="$event.stopPropagation()"
            (click)="openCreateForm(); $event.stopPropagation()"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="8" cy="8" r="2.8" fill="currentColor"/>
            </svg>
          </button>

          <!-- Range log bars -->
          <div
            class="log-bar"
            *ngFor="let log of rangeLogs; trackBy: trackByLogId"
            [class.log-bar--highlighted]="isBarHighlighted(log)"
            [class.log-bar--dimmed]="isBarDimmed(log)"
            [style.left.px]="barLeft(log)"
            [style.width.px]="barWidth(log)"
            [style.top.px]="barTop(log)"
            [style.height.px]="BAR_H"
            [style.background]="log.logType?.color ?? '#9B9B9B'"
            [attr.data-log-id]="log.id"
            [title]="log.title + ' (' + log.startAt + ' – ' + (log.endAt ?? '') + ')'"
            (click)="onBarClick(log, $event)"
          >
            <span class="log-bar-label">{{ log.logType?.name ?? log.title }}</span>
          </div>

          <!-- Point log markers (vertical lines) -->
          <div
            class="point-marker"
            *ngFor="let log of pointLogs; trackBy: trackByLogId"
            [class.point-marker--highlighted]="isBarHighlighted(log)"
            [class.point-marker--dimmed]="isBarDimmed(log)"
            [class.point-marker--selected]="selectedPointLog?.id === log.id && !mergeMode"
            [class.point-marker--anchor]="mergeMode && selectedPointLog?.id === log.id"
            [class.point-marker--target]="mergeMode && selectedPointLog?.id !== log.id"
            [style.left.px]="timeToPixels(log.startAt)"
            [style.top.px]="LABEL_H"
            [style.height.px]="barAreaHeight"
            [style.border-color]="log.logType?.color ?? '#9B9B9B'"
            [attr.data-log-id]="log.id"
            [title]="mergeMode && selectedPointLog?.id !== log.id
              ? 'Use ' + (log.logType?.name ?? log.title) + ' (' + log.startAt + ') as range endpoint'
              : (log.logType?.name ?? log.title) + ' at ' + log.startAt"
            (click)="onPointMarkerClick(log, $event)"
          >
            <div class="point-marker-dot" [style.background]="log.logType?.color ?? '#9B9B9B'"></div>
            <span class="point-marker-label" [style.color]="log.logType?.color ?? '#9B9B9B'">
              {{ log.logType?.name ?? log.title }}
            </span>
            <button
              *ngIf="selectedPointLog?.id === log.id && !mergeMode"
              class="point-merge-btn"
              (click)="enterMergeMode($event)"
              title="Pair with another point log to create a time range"
              aria-label="Start merge"
            >+</button>
          </div>

          <!-- Current time indicator (vertical, prominent) -->
          <div class="current-time-line" *ngIf="isToday" [style.left.px]="currentTimeX">
            <div class="current-time-dot"></div>
            <span class="current-time-label">{{ currentTimeLabel }}</span>
          </div>

          <!-- Mouse hover: vertical dashed line + time pill -->
          <ng-container *ngIf="isHoveringTrack && !isPanning">
            <div class="hover-line"
                 [style.left.px]="hoverX"
                 [style.top.px]="LABEL_H"
                 [style.height.px]="barAreaHeight"></div>
            <div class="hover-pill" [style.left.px]="hoverX">{{ hoverTimeLabel }}</div>
          </ng-container>

        </div>
      </div>

    </div>
  `,
  styles: [`
    .timeline-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      width: 100%;
    }

    /* ── Header ──────────────────────────────────────── */
    .timeline-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      cursor: pointer;
    }
    .timeline-header--no-toggle { cursor: default; }

    .timeline-collapse-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: none;
      color: var(--text-muted);
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
    }
    .timeline-collapse-btn:hover { background: var(--bg-card); color: var(--text-primary); }

    .collapse-chevron {
      flex-shrink: 0;
      transform: rotate(-90deg);
      transition: transform 0.2s ease;
    }
    .collapse-chevron--open { transform: rotate(0deg); }

    .collapse-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ── Idle hint shown before first selection ──────── */
    .sel-hint {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }

    /* ── Log tooltip icon button (top corner of the selection) ── */
    .log-tooltip-btn {
      position: absolute;
      /* top / left bound in template */
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--highlight-selected);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
      box-shadow: 0 2px 8px rgba(74,144,226,0.45);
      cursor: pointer;
      pointer-events: all;
      animation: tooltipPop 0.13s ease;
      transition: transform 0.15s, opacity 0.15s;
    }
    /* When anchored to left edge, shift the button so its right side touches the edge */
    .log-tooltip-btn--left {
      transform: translateX(-100%);
    }
    .log-tooltip-btn:hover {
      transform: scale(1.12);
      opacity: 0.9;
    }
    .log-tooltip-btn--left:hover {
      transform: translateX(-100%) scale(1.12);
    }
    @keyframes tooltipPop {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }

    /* ── Scroll container ────────────────────────────── */
    .scroll-container {
      overflow-x: auto;
      overflow-y: hidden;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--timeline-bg);
      width: 100%;
      box-sizing: border-box;
    }

    .scroll-container::-webkit-scrollbar { height: 4px; }
    .scroll-container::-webkit-scrollbar-track { background: transparent; }
    .scroll-container::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    .scroll-container::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    /* ── Canvas ──────────────────────────────────────── */
    /*
     * touch-action: none prevents the browser from intercepting touch events
     * for native scroll or zoom — we handle pan and pinch entirely in JS.
     */
    .timeline-canvas {
      position: relative;
      background: var(--timeline-bg);
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    .timeline-canvas:active { cursor: grabbing; }

    /* ── Ruler strip ─────────────────────────────────── */
    .ruler-strip {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      pointer-events: none;
      z-index: 4;
    }

    /* ── Hour labels (sit inside the ruler strip) ─────── */
    .hour-label {
      position: absolute;
      top: 5px;
      font-size: 10px;
      font-weight: 600;
      color: var(--timeline-text);
      pointer-events: none;
      z-index: 5;
      white-space: nowrap;
      letter-spacing: 0.2px;
    }

    /* ── Vertical hour grid lines (bar area only, below ruler) */
    .hour-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--border);
      pointer-events: none;
      z-index: 1;
    }

    /* ── 10-minute tick marks (anchored to ruler bottom edge) */
    /* top value mirrors LABEL_H - tickHeight so they hang from the ruler bottom */
    .tick-line {
      position: absolute;
      top: 19px;   /* LABEL_H(24) - height(5) = 19 */
      height: 5px;
      width: 1px;
      background: var(--timeline-text-muted);
      opacity: 0.5;
      pointer-events: none;
      z-index: 5;
    }
    .tick-line--half {
      top: 13px;   /* LABEL_H(24) - height(11) = 13 */
      height: 11px;
      opacity: 0.7;
    }

    /* ── Selection overlay ───────────────────────────── */
    .drag-overlay {
      position: absolute;
      background: var(--drag-overlay);
      border-top: 2px solid rgba(74,144,226,0.75);
      border-left: 1px solid rgba(74,144,226,0.35);
      border-right: 1px solid rgba(74,144,226,0.35);
      border-radius: 3px 3px 0 0;
      pointer-events: none;
      z-index: 5;
      transition: left 0.1s ease, width 0.1s ease;
    }

    /* ── Log bars ────────────────────────────────────── */
    .log-bar {
      position: absolute;
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding: 0 5px;
      overflow: hidden;
      cursor: pointer;
      min-width: 4px;
      z-index: 3;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      transition: filter 0.15s, transform 0.1s;
    }
    .log-bar:hover { filter: brightness(1.15); transform: scaleY(1.06); z-index: 4; }
    .log-bar--highlighted {
      outline: 2px solid #fff;
      outline-offset: 1px;
      filter: brightness(1.2);
      z-index: 6;
      animation: bar-pulse 0.6s ease-out;
    }
    .log-bar--dimmed { opacity: 0.18; filter: grayscale(0.5); }
    @keyframes bar-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.6); }
      70%  { box-shadow: 0 0 0 6px rgba(255,255,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
    }
    .log-bar-label {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,0.95);
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    /* ── Current time indicator ──────────────────────── */
    .current-time-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--highlight-today);
      pointer-events: none;
      z-index: 8;
    }
    .current-time-dot {
      position: absolute;
      top: 7px;     /* vertically centred in the 24px ruler strip */
      left: -5px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--highlight-today);
      box-shadow: 0 0 6px var(--highlight-today);
      z-index: 10;
    }
    .current-time-label {
      position: absolute;
      top: 5px;
      left: 9px;
      font-size: 9px;
      font-weight: 700;
      color: var(--highlight-today);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10;
    }

    /* ── Hover line (mouse only) ─────────────────────── */
    .hover-line {
      position: absolute;
      width: 0;
      border-left: 1px dashed var(--timeline-text);
      opacity: 0.45;
      pointer-events: none;
      z-index: 6;
    }
    .hover-pill {
      position: absolute;
      top: 4px;     /* inside the ruler strip */
      transform: translateX(-50%);
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 5px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10;
      font-variant-numeric: tabular-nums;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }

    /* ── Point markers ───────────────────────────────── */
    .point-marker {
      position: absolute;
      width: 24px;
      transform: translateX(-50%);
      border-left: 3px solid;
      cursor: pointer;
      z-index: 3;
      transition: filter 0.15s;
    }
    .point-marker:hover { filter: brightness(1.3); z-index: 4; }
    .point-marker-dot {
      position: absolute;
      top: 4px;     /* inside the bar area (below ruler) */
      left: -7px;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      border: 2px solid var(--timeline-bg);
    }
    .point-marker-label {
      position: absolute;
      top: 9px;
      left: 4px;
      font-size: 9px;
      font-weight: 700;
      background: var(--timeline-bg);
      border-radius: 3px;
      padding: 1px 3px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0.9;
    }
    .point-marker--highlighted { filter: brightness(1.3); z-index: 6; }
    .point-marker--dimmed { opacity: 0.18; }
    .point-marker--selected { z-index: 8; filter: brightness(1.2); }
    .point-marker--selected .point-marker-dot { box-shadow: 0 0 0 3px rgba(255,255,255,0.35); }
    .point-marker--anchor { z-index: 8; }
    .point-marker--anchor .point-marker-dot { box-shadow: 0 0 0 3px rgba(246,166,35,0.6); }
    .point-marker--target {
      z-index: 7;
      cursor: crosshair;
      animation: mergePulse 1.4s ease-in-out infinite;
    }
    @keyframes mergePulse {
      0%, 100% { filter: brightness(1);   opacity: 1; }
      50%       { filter: brightness(1.4); opacity: 0.85; }
    }
    .point-marker--target .point-marker-dot { box-shadow: 0 0 0 4px rgba(255,255,255,0.2); }
    .point-marker--target:hover { filter: brightness(1.6) !important; animation: none; }

    .point-merge-btn {
      position: absolute;
      top: -10px;
      left: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #F6A623;
      border: 2px solid var(--timeline-bg);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 12;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      transition: background 0.15s, transform 0.15s;
      padding: 0;
    }
    .point-merge-btn:hover { background: #E09010; transform: scale(1.15); }

    /* ── Merge banner ────────────────────────────────── */
    .merge-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(246,166,35,0.12);
      border: 1px solid rgba(246,166,35,0.45);
      border-radius: var(--radius);
      padding: 5px 12px;
      animation: mergeSlideIn 0.18s ease;
    }
    @keyframes mergeSlideIn {
      from { opacity: 0; transform: translateX(8px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .merge-hint { font-size: 12px; font-weight: 600; color: #F6A623; flex: 1; }
    .btn-cancel-merge {
      background: rgba(246,166,35,0.15);
      border: 1px solid rgba(246,166,35,0.4);
      border-radius: var(--radius-sm);
      color: #F6A623;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-cancel-merge:hover { background: rgba(246,166,35,0.28); }
  `]
})
export class TimelineComponent implements OnChanges, AfterViewInit {
  @Input() logs:             LogEntry[] = [];
  @Input() selectedDate:     Date = new Date();
  @Input() highlightedLogId: string | null = null;
  @Input() metricLogIds:     Set<string> | null = null;
  @Input() collapsible = true;
  /** Kept for API compatibility — not used for height any more. */
  @Input() scrollHeight = '';
  @Output() selectionMade       = new EventEmitter<DragSelection>();
  @Output() createLogClicked    = new EventEmitter<DragSelection>();
  @Output() logClicked          = new EventEmitter<LogEntry>();
  @Output() mergePointsSelected = new EventEmitter<DragSelection>();

  @ViewChild('track', { static: false })
  trackRef!: ElementRef<HTMLDivElement>;

  @ViewChild('scrollContainer', { static: false })
  scrollContainerRef!: ElementRef<HTMLDivElement>;

  /* ── Dimensions ──────────────────────────────────────
   * hourWidth: pixels per hour — set on init to show 8 h in viewport.
   * Zoom limits are relative to the container so they always mean
   *   minZoom = all 24 h in view, maxZoom = 2 h in view.
   */
  hourWidth       = 46;               // overwritten in ngAfterViewInit
  readonly TOTAL_MINUTES = 1440;
  readonly LABEL_H       = 24;        // height of the ruler strip at the top
  readonly LANE_H        = 32;        // height per log-bar lane
  readonly BAR_H         = 26;        // rendered bar height within a lane

  private get _cw(): number {
    return this.scrollContainerRef?.nativeElement?.clientWidth ?? 375;
  }
  private get _minHourWidth(): number { return Math.max(12, Math.floor(this._cw / 24)); }
  private get _maxHourWidth(): number { return Math.floor(this._cw / 2); }  // 2 h in view

  get totalWidth():    number { return 24 * this.hourWidth; }
  get barAreaHeight(): number { return Math.max(1, this.numLanes) * this.LANE_H + 4; }
  get canvasHeight():  number { return this.LABEL_H + this.barAreaHeight; }

  hours      = Array.from({ length: 24 }, (_, i) => i);
  labelHours = Array.from({ length: 13 }, (_, i) => i * 2); // 0,2,4,...,24

  get tickMarks(): TickMark[] {
    const marks: TickMark[] = [];
    for (let h = 0; h < 24; h++) {
      for (const t of [10, 20, 30, 40, 50]) {
        marks.push({ pos: this.minutesToPixels(h * 60 + t), isHalf: t === 30 });
      }
    }
    return marks;
  }

  /* ── Lane assignment for overlapping range logs ───── */
  private _logLanesCache: Map<string, number> | null = null;

  get logLanes(): Map<string, number> {
    if (!this._logLanesCache) {
      const lanes   = new Map<string, number>();
      const laneEnd: number[] = [];
      const sorted  = [...this.rangeLogs].sort(
        (a, b) => this.timeToMinutes(a.startAt) - this.timeToMinutes(b.startAt)
      );
      for (const log of sorted) {
        const start = this.timeToMinutes(log.startAt);
        const end   = this.timeToMinutes(log.endAt ?? '00:00');
        let placed  = false;
        for (let i = 0; i < laneEnd.length; i++) {
          if (laneEnd[i] <= start) {
            lanes.set(log.id, i);
            laneEnd[i] = end;
            placed = true;
            break;
          }
        }
        if (!placed) {
          lanes.set(log.id, laneEnd.length);
          laneEnd.push(end);
        }
      }
      this._logLanesCache = lanes;
    }
    return this._logLanesCache;
  }

  get numLanes(): number {
    if (this.rangeLogs.length === 0) return 1;
    return Math.max(...Array.from(this.logLanes.values())) + 1;
  }

  /* ── Selection state ─────────────────────────────── */
  hasDragSelection = false;
  dragStartX       = 0;
  dragCurrentX     = 0;
  dragSelection: DragSelection | null = null;

  /* ── Pan state ───────────────────────────────────── */
  isPanning = false;
  private _downClientX  = 0;
  private _panLastClientX = 0;
  private readonly PAN_THRESHOLD = 6; // px movement before entering pan mode

  /* ── Hover (mouse only) ──────────────────────────── */
  isHoveringTrack = false;
  hoverX          = 0;

  /* ── Pinch-to-zoom state ─────────────────────────── */
  isPinching             = false;
  private activePointerMap = new Map<number, { x: number; y: number }>();
  private pinchStartDist   = 0;
  private pinchStartHourW  = 46;
  private pinchFocalMinute = 0;

  /* ── Collapse ────────────────────────────────────── */
  private _isCollapsed = true;
  get isCollapsed(): boolean { return this._isCollapsed; }
  set isCollapsed(val: boolean) {
    this._isCollapsed = val;
    if (!val) {
      setTimeout(() => {
        const cw = this._cw;
        if (cw > 0) {
          this.hourWidth = Math.floor(cw / 8);
          this._logLanesCache = null;
          this.initDefaultSelection();
          this.scrollToCurrentTime();
          this.cdr.detectChanges();
        }
      }, 50);
    }
  }

  /* ── Point-log merge ─────────────────────────────── */
  selectedPointLog: LogEntry | null = null;
  mergeMode = false;

  /* ── Date / time ─────────────────────────────────── */
  isToday         = false;
  currentTimeMins = 0;
  get currentTimeX():    number { return this.minutesToPixels(this.currentTimeMins); }
  get currentTimeLabel(): string { return this.minutesToTime(this.currentTimeMins); }

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef) {}

  ngAfterViewInit(): void {
    // Use setTimeout so the container has finished rendering and has a real clientWidth
    setTimeout(() => {
      const cw = this._cw;
      this.hourWidth = Math.floor(cw / 8); // default: 8 hours in viewport
      this.checkIsToday();
      this.initDefaultSelection();
      this.scrollToCurrentTime();
      this.cdr.detectChanges();
    }, 0);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.cdr.detectChanges();
    }
  }

  /* ── Computed getters ────────────────────────────── */

  get dragOverlayLeft():  number { return Math.min(this.dragStartX, this.dragCurrentX); }
  get dragOverlayWidth(): number { return Math.abs(this.dragCurrentX - this.dragStartX); }

  /** True when the tooltip should sit at the right edge of the selection; false → left edge. */
  get tooltipOnRight(): boolean {
    return (this.dragOverlayLeft + this.dragOverlayWidth + 60) < this.totalWidth;
  }
  /** Canvas X where the tooltip button is anchored. */
  get tooltipLeft(): number {
    return this.tooltipOnRight
      ? this.dragOverlayLeft + this.dragOverlayWidth + 3
      : this.dragOverlayLeft - 3;
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

  get hoverTimeLabel(): string {
    return this.minutesToTime(Math.round(this.pixelsToMinutes(this.hoverX)));
  }

  /* ── Lifecycle ───────────────────────────────────── */

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['logs']) {
      this._logLanesCache = null;
    }
    if (changes['selectedDate'] && this.selectedDate) {
      this.checkIsToday();
      this.initDefaultSelection();
    }
  }

  /**
   * Default selection: last 1 hour for today, 09:00–10:00 for other days.
   * Re-run whenever hourWidth changes so pixel positions stay accurate.
   */
  initDefaultSelection(): void {
    let endMins: number;
    if (this.isToday) {
      const now = new Date();
      endMins = this.snapToTen(now.getHours() * 60 + now.getMinutes());
      if (endMins < 60) endMins = 60;
    } else {
      endMins = 10 * 60;
    }
    const startMins   = Math.max(0, endMins - 60);
    const clampedEnd  = Math.min(endMins, this.TOTAL_MINUTES);

    this.dragStartX   = this.minutesToPixels(startMins);
    this.dragCurrentX = this.minutesToPixels(clampedEnd);

    this.dragSelection = {
      startTime:    this.minutesToTime(startMins),
      endTime:      this.minutesToTime(clampedEnd),
      startMinutes: startMins,
      endMinutes:   clampedEnd
    };
    this.hasDragSelection = true;
  }

  checkIsToday(): void {
    const today = new Date(), sel = this.selectedDate;
    this.isToday =
      today.getFullYear() === sel.getFullYear() &&
      today.getMonth()    === sel.getMonth()    &&
      today.getDate()     === sel.getDate();
    if (this.isToday) {
      const now = new Date();
      this.currentTimeMins = now.getHours() * 60 + now.getMinutes();
    }
  }

  /**
   * Scroll so the current-time indicator (or 8am for non-today) sits at ~30% from
   * the left of the viewport, giving the user immediate context.
   */
  scrollToCurrentTime(): void {
    const container = this.scrollContainerRef?.nativeElement;
    if (!container) return;
    const targetMins = this.isToday ? Math.max(0, this.currentTimeMins - 20) : 8 * 60;
    const x          = this.minutesToPixels(targetMins);
    container.scrollLeft = Math.max(0, x - container.clientWidth * 0.3);
  }

  /* ── Coordinate helpers ──────────────────────────── */

  formatHour(hour: number): string {
    return String(hour).padStart(2, '0') + ':00';
  }

  /** Canvas-relative X for a pointer event (accounts for scroll). */
  getTrackX(event: PointerEvent): number {
    if (!this.trackRef) return 0;
    const rect = this.trackRef.nativeElement.getBoundingClientRect();
    return event.clientX - rect.left;
  }

  pixelsToMinutes(px: number): number { return (px / this.totalWidth) * this.TOTAL_MINUTES; }
  minutesToPixels(min: number): number { return (min / this.TOTAL_MINUTES) * this.totalWidth; }
  timeToPixels(time: string): number   { return this.minutesToPixels(this.timeToMinutes(time)); }

  barLeft(log: LogEntry):  number { return this.timeToPixels(log.startAt); }
  barWidth(log: LogEntry): number {
    const diff = this.timeToMinutes(log.endAt ?? '00:00') - this.timeToMinutes(log.startAt);
    return diff <= 0 ? 0 : this.minutesToPixels(diff);
  }
  barTop(log: LogEntry): number {
    return this.LABEL_H + (this.logLanes.get(log.id) ?? 0) * this.LANE_H + 2;
  }

  get rangeLogs(): LogEntry[] { return this.logs.filter(l => l.entryType !== 'point'); }
  get pointLogs(): LogEntry[] { return this.logs.filter(l => l.entryType === 'point'); }

  snapToTen(minutes: number): number { return Math.round(minutes / 10) * 10; }

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

  /* ── Pointer handlers ────────────────────────────────
   *
   * Gesture model (all pointer types):
   *   Single touch/click + move > PAN_THRESHOLD → pan (scroll the container)
   *   Single touch/click + minimal movement     → tap → set 1-hour selection
   *   Two touches                               → pinch-to-zoom
   */

  onPointerDown(event: PointerEvent): void {
    if (!this.trackRef) return;
    if ((event.target as HTMLElement).closest('.log-bar,.point-marker,.log-tooltip-btn')) return;

    this.trackRef.nativeElement.setPointerCapture(event.pointerId);
    this.activePointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointerMap.size >= 2) {
      this.isPanning      = false;
      this.isPinching     = true;
      this.pinchStartDist = this.calcPinchDist();
      this.pinchStartHourW = this.hourWidth;
      this.pinchFocalMinute = this.calcPinchFocalMinute();
      event.preventDefault();
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();

    this._downClientX   = event.clientX;
    this._panLastClientX = event.clientX;
    this.isPanning      = false;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.trackRef) return;

    if (this.activePointerMap.has(event.pointerId)) {
      this.activePointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (this.isPinching && this.activePointerMap.size === 2) {
      this.handlePinch();
      this.cdr.detectChanges();
      return;
    }

    // Track hover position for mouse (shows the dashed line + pill)
    const rawX = Math.max(0, Math.min(this.getTrackX(event), this.totalWidth));
    this.hoverX = rawX;

    // Commit to pan once movement exceeds threshold
    if (!this.isPanning && this.activePointerMap.size === 1) {
      if (Math.abs(event.clientX - this._downClientX) > this.PAN_THRESHOLD) {
        this.isPanning = true;
      }
    }

    if (this.isPanning) {
      const container = this.scrollContainerRef?.nativeElement;
      if (container) {
        container.scrollLeft += this._panLastClientX - event.clientX;
      }
      this._panLastClientX = event.clientX;
    }

    this.cdr.detectChanges();
  }

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

    if (this.isPinching) {
      if (this.activePointerMap.size < 2) this.isPinching = false;
      this.cdr.detectChanges();
      return;
    }

    if (this.isPanning) {
      this.isPanning       = false;
      this.isHoveringTrack = false;
      this.cdr.detectChanges();
      return;
    }

    // Tap: set a 1-hour selection centred on the tapped time
    const rawX        = Math.max(0, Math.min(this.getTrackX(event), this.totalWidth));
    const tappedMins  = this.snapToTen(this.pixelsToMinutes(rawX));
    const startMins   = Math.max(0, tappedMins - 30);
    const endMins     = Math.min(Math.max(tappedMins + 30, startMins + 10), this.TOTAL_MINUTES);

    this.dragStartX   = this.minutesToPixels(startMins);
    this.dragCurrentX = this.minutesToPixels(endMins);
    this.dragSelection = {
      startTime:    this.minutesToTime(startMins),
      endTime:      this.minutesToTime(endMins),
      startMinutes: startMins,
      endMinutes:   endMins
    };
    this.hasDragSelection = true;
    this.selectionMade.emit(this.dragSelection);
    this.cdr.detectChanges();
  }

  /* ── Bar / marker helpers ────────────────────────── */

  isBarHighlighted(log: LogEntry): boolean {
    if (this.metricLogIds !== null) return this.metricLogIds.has(log.id);
    return log.id === this.highlightedLogId;
  }

  isBarDimmed(log: LogEntry): boolean {
    if (this.metricLogIds !== null) return !this.metricLogIds.has(log.id);
    return false;
  }

  onBarClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.cancelMerge();
    this.logClicked.emit(log);
  }

  onPointMarkerClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();

    if (this.mergeMode) {
      if (log.id === this.selectedPointLog?.id) { this.cancelMerge(); return; }

      const t1 = this.timeToMinutes(this.selectedPointLog!.startAt);
      const t2 = this.timeToMinutes(log.startAt);
      const startMins = Math.min(t1, t2);
      const endMins   = Math.max(t1, t2);
      const earlyLog  = t1 <= t2 ? this.selectedPointLog! : log;

      this.mergePointsSelected.emit({
        startTime:      this.minutesToTime(startMins),
        endTime:        this.minutesToTime(endMins),
        startMinutes:   startMins,
        endMinutes:     endMins,
        mergeSourceIds: [this.selectedPointLog!.id, log.id],
        mergeLogTypeId: earlyLog.logType?.id,
      });
      this.cancelMerge();
      return;
    }

    if (this.selectedPointLog?.id === log.id) {
      this.selectedPointLog = null;
      this.logClicked.emit(log);
    } else {
      this.selectedPointLog = log;
    }
  }

  enterMergeMode(event: MouseEvent): void {
    event.stopPropagation();
    if (this.selectedPointLog) this.mergeMode = true;
  }

  cancelMerge(): void {
    this.selectedPointLog = null;
    this.mergeMode        = false;
  }

  /* ── Pinch-to-zoom ───────────────────────────────── */

  private calcPinchDist(): number {
    const pts = [...this.activePointerMap.values()];
    if (pts.length < 2) return 1;
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Time (minutes) under the midpoint of the two pinch fingers. */
  private calcPinchFocalMinute(): number {
    const pts        = [...this.activePointerMap.values()];
    const midClientX = (pts[0].x + pts[1].x) / 2;
    const container  = this.scrollContainerRef?.nativeElement;
    if (!container) return 0;
    const rect    = container.getBoundingClientRect();
    const scrollX = container.scrollLeft + midClientX - rect.left;
    return this.pixelsToMinutes(Math.max(0, scrollX));
  }

  /**
   * Scale hourWidth proportionally to finger spread.
   * Clamps between minHourWidth (24 h in view) and maxHourWidth (2 h in view).
   * Adjusts scrollLeft so the focal minute stays under the pinch midpoint.
   */
  private handlePinch(): void {
    const newDist = this.calcPinchDist();
    if (newDist < 1) return;

    const scale    = newDist / this.pinchStartDist;
    const newHourW = Math.max(
      this._minHourWidth,
      Math.min(this._maxHourWidth, this.pinchStartHourW * scale)
    );
    if (Math.abs(newHourW - this.hourWidth) < 0.5) return;

    const container  = this.scrollContainerRef?.nativeElement;
    const pts        = [...this.activePointerMap.values()];
    const midClientX = (pts[0].x + pts[1].x) / 2;

    // Preserve selection in minute-space before re-scaling
    const selStartMins = this.pixelsToMinutes(this.dragStartX);
    const selEndMins   = this.pixelsToMinutes(this.dragCurrentX);

    this.hourWidth = newHourW;

    // Re-project selection into new pixel space
    this.dragStartX   = this.minutesToPixels(selStartMins);
    this.dragCurrentX = this.minutesToPixels(selEndMins);

    // Keep focal minute stationary under pinch midpoint
    if (container) {
      const rect       = container.getBoundingClientRect();
      const viewOffset = midClientX - rect.left;
      const newFocalPx = (this.pinchFocalMinute / this.TOTAL_MINUTES) * (24 * newHourW);
      container.scrollLeft = Math.max(0, newFocalPx - viewOffset);
    }
  }

  /* ── Public API ──────────────────────────────────── */

  scrollToLog(log: LogEntry): void {
    if (!this.scrollContainerRef) return;
    const container = this.scrollContainerRef.nativeElement;
    const center    = this.barLeft(log) + this.barWidth(log) / 2;
    container.scrollLeft = Math.max(0, center - container.clientWidth / 2);
  }

  clearSelection(): void { this.initDefaultSelection(); }

  openCreateForm(): void {
    if (this.dragSelection) {
      this.createLogClicked.emit(this.dragSelection);
    } else {
      this.createLogClicked.emit({ startTime: '09:00', endTime: '10:00', startMinutes: 540, endMinutes: 600 });
    }
  }

  trackByIndex(index: number):             number { return index; }
  trackByLogId(_i: number, log: LogEntry): string { return log.id; }
  trackByPos(_i: number, tick: TickMark):  number { return tick.pos; }
}
