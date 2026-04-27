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
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { LogEntry } from '../../models/log.model';

export interface DragSelection {
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  /** Set when two point logs are merged — IDs to delete after the range log is saved. */
  mergeSourceIds?: [string, string];
  /** Log-type id of the earliest point log — pre-fills the Create form. */
  mergeLogTypeId?: string;
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
      <div class="timeline-header" [class.timeline-header--no-toggle]="!collapsible"
           (click)="collapsible && (isCollapsed = !isCollapsed)">

        <!-- Collapse toggle (visual only — click handled by parent div) -->
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

        <!-- Normal mode: drag-selection badge — stopPropagation so clicks here don't toggle -->
        <div class="selection-badge" *ngIf="!mergeMode" (click)="$event.stopPropagation()">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
               style="flex-shrink:0;color:var(--highlight-selected)">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <ng-container *ngIf="dragSelection || isDragging; else noSel">
            <span class="sel-time">
              {{ isDragging ? dragStartTimeLabel : dragSelection!.startTime }} – {{ isDragging ? dragCurrentTimeLabel : dragSelection!.endTime }}
            </span>
            <span class="sel-dur" *ngIf="!isDragging">{{ selectionDuration }}</span>
          </ng-container>
          <ng-template #noSel>
            <span class="sel-hint">Drag or tap to select</span>
          </ng-template>
          <button class="btn-create-log" (click)="openCreateForm()">+ Create Log</button>
        </div>

        <!-- Merge mode: pick-second-point banner -->
        <div class="merge-banner" *ngIf="mergeMode" (click)="$event.stopPropagation()">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
               style="flex-shrink:0;color:#F6A623">
            <circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4"/>
            <line x1="6.5" y1="8" x2="9.5" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1.5 1.5"/>
          </svg>
          <span class="merge-hint">Select another point log to create a time range</span>
          <button class="btn-cancel-merge" (click)="cancelMerge()">Cancel</button>
        </div>

      </div>

      <!-- ── Scrollable timeline canvas ─────────────── -->
      <div class="scroll-container" #scrollContainer *ngIf="!collapsible || !isCollapsed">
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
               *ngFor="let hour of hours; trackBy: trackByIndex"
               [style.top.px]="hour * hourHeight">
            {{ formatHour(hour) }}
          </div>
          <div class="hour-label" [style.top.px]="24 * hourHeight">24:00</div>

          <!-- Hour grid lines (full width from strip rightward) -->
          <div class="hour-line"
               *ngFor="let hour of hours; trackBy: trackByIndex"
               [style.top.px]="hour * hourHeight"></div>
          <div class="hour-line" [style.top.px]="24 * hourHeight"></div>

          <!-- 10-minute tick marks -->
          <div class="tick-line"
               *ngFor="let tick of tickMarks; trackBy: trackByPos"
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
            *ngFor="let log of rangeLogs; trackBy: trackByLogId"
            [class.log-bar--highlighted]="isBarHighlighted(log)"
            [class.log-bar--dimmed]="isBarDimmed(log)"
            [style.top.px]="timeToPixels(log.startAt)"
            [style.height.px]="barHeight(log)"
            [style.background]="log.logType?.color ?? '#9B9B9B'"
            [attr.data-log-id]="log.id"
            [title]="log.title + ' (' + log.startAt + ' – ' + (log.endAt ?? '') + ')'"
            (click)="onBarClick(log, $event)"
          >
            <span class="log-bar-label">{{ log.logType?.name ?? log.title }}</span>
          </div>

          <!-- Point log markers -->
          <div
            class="point-marker"
            *ngFor="let log of pointLogs; trackBy: trackByLogId"
            [class.point-marker--highlighted]="isBarHighlighted(log)"
            [class.point-marker--dimmed]="isBarDimmed(log)"
            [class.point-marker--selected]="selectedPointLog?.id === log.id && !mergeMode"
            [class.point-marker--anchor]="mergeMode && selectedPointLog?.id === log.id"
            [class.point-marker--target]="mergeMode && selectedPointLog?.id !== log.id"
            [style.top.px]="timeToPixels(log.startAt)"
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
            <span class="point-marker-time">{{ log.startAt }}</span>

            <!-- Merge trigger button — shown on the selected marker when NOT yet in merge mode -->
            <button
              *ngIf="selectedPointLog?.id === log.id && !mergeMode"
              class="point-merge-btn"
              (click)="enterMergeMode($event)"
              title="Pair with another point log to create a time range"
              aria-label="Start merge"
            >+</button>
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
      min-height: 38px;
      cursor: pointer;
    }
    .timeline-header--no-toggle { cursor: default; }

    /* ── Collapse toggle ─────────────────────────────── */
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

    .sel-hint {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
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

    /* ── Scroll container ────────────────────────────── */
    .scroll-container {
      overflow-y: auto;
      overflow-x: hidden;
      /* 1.53: subtract ~60px for the fixed footer so last entries
               don't slip behind it (210px = header + timeline chrome) */
      height: calc(100vh - 270px);
      height: calc(100dvh - 270px);
      min-height: 400px;
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

    /* ── Timeline canvas ─────────────────────────────── */
    /*
     * touch-action: none is required on the canvas so the browser does NOT
     * intercept touch events as scroll gestures. Without it, the browser
     * cancels pointer events mid-drag and breaks time-range selection.
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

    /* ── Point log markers ─────────────────────────────── */
    .point-marker {
      position: absolute;
      left: 70px;
      right: 6px;
      /* Visible stripe + invisible padding above/below for easier tapping */
      height: 20px;
      background: transparent;
      border-top: 3px solid;
      display: flex;
      align-items: flex-start;
      padding-top: 0;
      cursor: pointer;
      z-index: 3;
      transform: translateY(-10px); /* centre the 3px line in the 20px hit area */
      transition: filter 0.15s;
    }
    .point-marker:hover { filter: brightness(1.3); z-index: 4; }

    .point-marker-dot {
      position: absolute;
      left: -10px;
      top: -6px;          /* vertically centre on the 3px border-top */
      width: 13px;
      height: 13px;
      border-radius: 50%;
      border: 2px solid var(--timeline-bg);
      flex-shrink: 0;
    }

    .point-marker-label {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      background: var(--timeline-bg);
      border-radius: 3px;
      white-space: nowrap;
      text-shadow: none;
      margin-left: 8px;
      transform: translateY(-9px);
      pointer-events: none;
    }

    .point-marker-time {
      font-size: 10px;
      color: var(--timeline-text-muted);
      margin-left: 4px;
      transform: translateY(-9px);
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }

    .point-marker--highlighted {
      filter: brightness(1.3);
      z-index: 6;
    }

    .point-marker--dimmed {
      opacity: 0.18;
    }

    /* Selected (awaiting merge mode) */
    .point-marker--selected {
      z-index: 8;
      filter: brightness(1.2);
    }
    .point-marker--selected .point-marker-dot {
      box-shadow: 0 0 0 3px rgba(255,255,255,0.35);
    }

    /* Anchor: the first point log chosen, in merge mode */
    .point-marker--anchor {
      z-index: 8;
      opacity: 1;
    }
    .point-marker--anchor .point-marker-dot {
      box-shadow: 0 0 0 3px rgba(246,166,35,0.6);
    }

    /* Target: all OTHER point logs during merge mode — pulsing invite */
    .point-marker--target {
      z-index: 7;
      cursor: crosshair;
      animation: mergePulse 1.4s ease-in-out infinite;
    }
    @keyframes mergePulse {
      0%, 100% { filter: brightness(1);   opacity: 1; }
      50%       { filter: brightness(1.4); opacity: 0.85; }
    }
    .point-marker--target .point-marker-dot {
      box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
    }
    .point-marker--target:hover {
      filter: brightness(1.6) !important;
      animation: none;
    }

    /* "+" merge trigger button */
    .point-merge-btn {
      position: absolute;
      right: -6px;
      top: -14px;
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

    /* ── Merge mode header banner ─────────────────────── */
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

    .merge-hint {
      font-size: 12px;
      font-weight: 600;
      color: #F6A623;
      flex: 1;
    }

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
  /** When false, the timeline is always expanded with no collapse toggle. */
  @Input() collapsible = true;
  @Output() selectionMade      = new EventEmitter<DragSelection>();
  @Output() createLogClicked   = new EventEmitter<DragSelection>();
  @Output() logClicked         = new EventEmitter<LogEntry>();
  @Output() mergePointsSelected = new EventEmitter<DragSelection>();

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
  hourHeight = 26;                   // mutable — changed by pinch-to-zoom / init
  readonly MIN_HOUR_HEIGHT = 20;     // most compressed view
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

  /* ── Collapse state ─────────────────────────────── */
  private _isCollapsed = true;
  get isCollapsed(): boolean { return this._isCollapsed; }
  set isCollapsed(val: boolean) {
    this._isCollapsed = val;
    if (!val) {
      // Fit 24h on first expand (scroll container wasn't in DOM before)
      setTimeout(() => {
        const container = this.scrollContainerRef?.nativeElement;
        if (container && container.clientHeight > 0) {
          this.hourHeight = Math.max(this.MIN_HOUR_HEIGHT, Math.floor(container.clientHeight / 24));
          this.initDefaultSelection();
          this.cdr.detectChanges();
        }
      }, 0);
    }
  }

  /* ── Point-log merge state ──────────────────────── */
  selectedPointLog: LogEntry | null = null; // first-click selection
  mergeMode = false;                        // true after "+" is pressed

  /* ── Date / time state ──────────────────────────── */
  isToday            = false;
  currentTimeMins    = 0;
  get currentTimePixels(): number { return this.minutesToPixels(this.currentTimeMins); }

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef) {}

  /** Fit all 24 hours into the visible scroll container on first render. */
  ngAfterViewInit(): void {
    const container = this.scrollContainerRef?.nativeElement;
    if (container) {
      const h = container.clientHeight;
      if (h > 0) {
        this.hourHeight = Math.max(this.MIN_HOUR_HEIGHT, Math.floor(h / 24));
        this.initDefaultSelection();
        this.cdr.detectChanges();
      }
    }
  }

  /** Clicking outside the timeline resets the time selection to present time. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.initDefaultSelection();
      this.cdr.detectChanges();
    }
  }

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
    const diff = this.timeToMinutes(log.endAt ?? '00:00') - this.timeToMinutes(log.startAt);
    if (diff <= 0) return 0;
    return this.minutesToPixels(diff);
  }

  get rangeLogs(): LogEntry[] {
    return this.logs.filter(l => l.entryType !== 'point');
  }

  get pointLogs(): LogEntry[] {
    return this.logs.filter(l => l.entryType === 'point');
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

    // Let log-bar and point-marker clicks pass through to their own (click) handlers
    if ((event.target as HTMLElement).closest('.log-bar,.point-marker')) return;

    // Capture pointer and track for pinch detection
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

    // Single pointer — drag-select logic
    if (event.pointerType === 'mouse' && event.button !== 0) return;

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

  /** Range-bar click → always opens edit form. */
  onBarClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.cancelMerge(); // clear any merge state when editing a range log
    this.logClicked.emit(log);
  }

  /**
   * Point-marker click:
   *  - Merge mode ON  → pick this as the range endpoint and emit the pair
   *  - Merge mode OFF, same log clicked again → open edit form
   *  - Merge mode OFF, new log clicked → select it (show + button)
   */
  onPointMarkerClick(log: LogEntry, event: MouseEvent): void {
    event.stopPropagation();

    if (this.mergeMode) {
      // Same anchor tapped → cancel
      if (log.id === this.selectedPointLog?.id) {
        this.cancelMerge();
        return;
      }

      // Pair the two points into a time range
      const t1 = this.timeToMinutes(this.selectedPointLog!.startAt);
      const t2 = this.timeToMinutes(log.startAt);
      const startMins = Math.min(t1, t2);
      const endMins   = Math.max(t1, t2);

      // Log type from the earliest point log
      const earlyLog = t1 <= t2 ? this.selectedPointLog! : log;

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

    // Not in merge mode
    if (this.selectedPointLog?.id === log.id) {
      // Second tap on same log → open edit form
      this.selectedPointLog = null;
      this.logClicked.emit(log);
    } else {
      // First tap → select (show + button)
      this.selectedPointLog = log;
    }
  }

  /** Called when the "+" button on a selected point marker is clicked. */
  enterMergeMode(event: MouseEvent): void {
    event.stopPropagation();
    if (this.selectedPointLog) {
      this.mergeMode = true;
    }
  }

  /** Resets all merge state without touching any logs. */
  cancelMerge(): void {
    this.selectedPointLog = null;
    this.mergeMode        = false;
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


  clearSelection(): void {
    this.initDefaultSelection();
  }

  openCreateForm(): void {
    if (this.dragSelection) {
      this.createLogClicked.emit(this.dragSelection);
    } else {
      this.createLogClicked.emit({ startTime: '09:00', endTime: '10:00', startMinutes: 540, endMinutes: 600 });
    }
  }

  trackByIndex(index: number): number { return index; }
  trackByLogId(_i: number, log: LogEntry): string { return log.id; }
  trackByPos(_i: number, tick: TickMark): number { return tick.pos; }
}
