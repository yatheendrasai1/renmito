import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy,
  SimpleChanges, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TimeRange { from: string; to: string; }

@Component({
  selector: 'app-time-range-slider',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trs">

      <!-- ── Track area ─────────────────────────────── -->
      <div class="trs-track-area">
        <!-- floating label above handles -->
        <div class="trs-range-label"
             [class.trs-range-label--hidden]="fillWidth < 3 && mode === 'range'"
             [style.left.%]="labelLeft">
          {{ rangeLabelText }}
        </div>

        <!-- the bar itself -->
        <div class="trs-track" #track (pointerdown)="onTrackClick($event)">
          <div class="trs-fill"
               [style.left.%]="fillLeft"
               [style.width.%]="mode === 'range' ? fillWidth : 0"></div>

          <!-- start handle -->
          <div class="trs-handle" [style.left.%]="startPct"
               (pointerdown)="onHandleDown($event, 'start')">
            <div class="trs-handle-grip"></div>
          </div>

          <!-- end handle (range mode only) -->
          <div *ngIf="mode === 'range'" class="trs-handle trs-handle--end"
               [style.left.%]="endPct"
               (pointerdown)="onHandleDown($event, 'end')">
            <div class="trs-handle-grip"></div>
          </div>
        </div>

        <!-- axis labels -->
        <div class="trs-axis">
          <span *ngFor="let lbl of axisLabels; trackBy: trackByIdx">{{ lbl }}</span>
        </div>
      </div>

      <!-- ── Time cards (click to open native time picker) ── -->
      <div class="trs-cards">
        <div class="trs-card trs-card--tap" (click)="fromInputRef.click()">
          <span class="trs-card-lbl">{{ mode === 'point' ? 'TIME' : 'START' }}</span>
          <span class="trs-card-time">{{ startLabel }}</span>
        </div>
        <ng-container *ngIf="mode === 'range'">
          <div class="trs-card-sep">
            <span class="trs-sep-arrow">→</span>
            <span class="trs-sep-dur">{{ durationLabel }}</span>
          </div>
          <div class="trs-card trs-card--tap" (click)="toInputRef.click()">
            <span class="trs-card-lbl">END</span>
            <span class="trs-card-time">{{ endLabel }}</span>
          </div>
        </ng-container>
      </div>

      <!-- Hidden native time pickers -->
      <input #fromInput type="time" class="trs-hidden-picker"
             [value]="startLabel" (change)="onFromChange($event)"/>
      <input #toInput type="time" class="trs-hidden-picker"
             [value]="endLabel" (change)="onToChange($event)"/>

      <!-- ── Preset buttons ─────────────────────────── -->
      <div class="trs-presets">
        <button *ngFor="let p of presets; trackBy: trackByIdx"
                class="trs-preset"
                [class.trs-preset--active]="activePreset === p.id"
                (click)="applyPreset(p.id)">
          {{ p.label }}
        </button>
      </div>

    </div>
  `,
  styles: [`
    .trs {
      display: flex; flex-direction: column; gap: 10px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 14px 14px 12px;
    }

    /* ── Track ─────────────────────────────────────── */
    .trs-track-area { position: relative; padding-top: 22px; }

    .trs-range-label {
      position: absolute; top: 0; transform: translateX(-50%);
      font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
      background: var(--highlight-selected); color: #fff;
      padding: 2px 7px; border-radius: 10px; white-space: nowrap;
      pointer-events: none; transition: left 0.05s, opacity 0.15s;
      z-index: 5;
    }
    .trs-range-label--hidden { opacity: 0; }

    .trs-track {
      position: relative; height: 6px; border-radius: 3px;
      background: var(--border); cursor: pointer; touch-action: none;
    }

    .trs-fill {
      position: absolute; top: 0; height: 100%; border-radius: 3px;
      background: var(--highlight-selected); pointer-events: none;
      transition: left 0.05s, width 0.05s;
    }

    .trs-handle {
      position: absolute; top: 50%; transform: translate(-50%, -50%);
      width: 18px; height: 30px;
      background: var(--text-primary); border-radius: 6px;
      cursor: grab; touch-action: none; z-index: 4;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      transition: left 0.05s;
    }
    .trs-handle:active { cursor: grabbing; transform: translate(-50%, -50%) scale(1.08); }

    .trs-handle-grip {
      width: 3px; height: 14px; border-radius: 2px;
      background: color-mix(in srgb, var(--bg-surface) 50%, transparent);
      box-shadow: -3px 0 0 color-mix(in srgb, var(--bg-surface) 50%, transparent),
                   3px 0 0 color-mix(in srgb, var(--bg-surface) 50%, transparent);
    }

    /* ── Axis ──────────────────────────────────────── */
    .trs-axis {
      display: flex; justify-content: space-between;
      margin-top: 6px; padding: 0 1px;
    }
    .trs-axis span {
      font-size: 10px; color: var(--text-muted); font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    /* ── Time cards ────────────────────────────────── */
    .trs-cards {
      display: flex; align-items: center; gap: 8px;
    }
    .trs-card {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 6px 10px;
    }
    .trs-card--tap {
      cursor: pointer; transition: border-color 0.15s, background 0.15s;
    }
    .trs-card--tap:hover {
      border-color: var(--highlight-selected);
      background: color-mix(in srgb, var(--highlight-selected) 6%, var(--bg-surface));
    }
    .trs-card-lbl {
      font-size: 9px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.8px;
    }
    .trs-card-time {
      font-size: 18px; font-weight: 700; color: var(--text-primary);
      font-variant-numeric: tabular-nums; letter-spacing: 0.5px;
    }
    .trs-card-sep {
      display: flex; flex-direction: column; align-items: center;
      gap: 2px; flex-shrink: 0;
    }
    .trs-sep-arrow { font-size: 16px; color: var(--text-muted); line-height: 1; }
    .trs-sep-dur   { font-size: 9px; font-weight: 700; color: var(--highlight-selected);
                     letter-spacing: 0.3px; white-space: nowrap; }

    /* ── Presets ───────────────────────────────────── */
    .trs-presets {
      display: flex; gap: 5px; flex-wrap: wrap;
    }
    .trs-preset {
      padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 500;
      border: 1.5px solid var(--border); background: transparent;
      color: var(--text-secondary); cursor: pointer; white-space: nowrap;
      transition: background 0.13s, color 0.13s, border-color 0.13s;
    }
    .trs-preset:hover { border-color: var(--highlight-selected); color: var(--text-primary); }
    .trs-preset--active {
      background: var(--text-primary); border-color: var(--text-primary); color: var(--bg-surface);
    }

    /* ── Hidden native pickers ─────────────────────── */
    .trs-hidden-picker {
      position: absolute; opacity: 0; pointer-events: none;
      width: 1px; height: 1px; overflow: hidden;
    }
  `],
})
export class TimeRangeSliderComponent implements OnInit, OnChanges, OnDestroy {
  @Input() initialFrom = '09:00';
  @Input() initialTo   = '09:30';
  @Input() mode: 'range' | 'point' = 'range';
  @Output() timeRangeChange = new EventEmitter<TimeRange>();

  @ViewChild('track',     { static: true  }) trackRef!:     ElementRef<HTMLElement>;
  @ViewChild('fromInput', { static: true  }) fromInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('toInput',   { static: true  }) toInputRef!:   ElementRef<HTMLInputElement>;

  startMins = 540;
  endMins   = 570;

  activePreset: string | null = null;

  readonly axisLabels = ['00', '06', '12', '18', '24'];
  private readonly TOTAL = 1440;
  private readonly SNAP  = 15;
  private readonly MIN_GAP = 15;

  private dragging: 'start' | 'end' | null = null;
  private trackRect: DOMRect | null = null;
  private readonly _onMove = (e: PointerEvent) => this._handleMove(e);
  private readonly _onUp   = ()                => this._handleUp();

  constructor(private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.startMins = this._parse(this.initialFrom);
    this.endMins   = this.mode === 'point' ? this.startMins : this._parse(this.initialTo);
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!c['initialFrom']?.firstChange && c['initialFrom']) {
      this.startMins = this._parse(this.initialFrom);
    }
    if (!c['initialTo']?.firstChange && c['initialTo'] && this.mode === 'range') {
      this.endMins = this._parse(this.initialTo);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerup', this._onUp);
  }

  // ── Computed ──────────────────────────────────────────────────────
  get startPct(): number { return this.startMins / this.TOTAL * 100; }
  get endPct():   number { return this.endMins   / this.TOTAL * 100; }
  get fillLeft(): number { return this.startPct; }
  get fillWidth():number { return this.endPct - this.startPct; }
  get startLabel():string { return this._fmt(this.startMins); }
  get endLabel():  string { return this._fmt(this.endMins); }

  get rangeLabelText(): string {
    return this.mode === 'point'
      ? this.startLabel
      : `${this.startLabel} → ${this.endLabel}`;
  }

  get durationLabel(): string {
    const mins = this.endMins - this.startMins;
    if (mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  get labelLeft(): number {
    const mid = this.mode === 'point'
      ? this.startPct
      : this.fillLeft + this.fillWidth / 2;
    return Math.max(6, Math.min(94, mid));
  }

  get presets(): { id: string; label: string }[] {
    return this.mode === 'range'
      ? [
          { id: 'now', label: 'Just now' },
          { id: '30m', label: '30m'      },
          { id: '1h',  label: '1h'       },
          { id: '2h',  label: '2h'       },
        ]
      : [
          { id: 'now', label: 'Just now' },
          { id: '-15', label: '-15m'     },
          { id: '-30', label: '-30m'     },
          { id: '-60', label: '-1h'      },
        ];
  }

  onFromChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    const mins = this._parse(val);
    if (mins < 0) return;
    this.startMins = mins;
    if (this.mode === 'point') this.endMins = mins;
    else if (this.endMins < this.startMins + this.MIN_GAP) {
      this.endMins = Math.min(this.TOTAL, this.startMins + this.MIN_GAP);
    }
    this.activePreset = null;
    this._emit();
    this.cd.markForCheck();
  }

  onToChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    const mins = this._parse(val);
    if (mins < 0) return;
    this.endMins = Math.max(this.startMins + this.MIN_GAP, Math.min(this.TOTAL, mins));
    this.activePreset = null;
    this._emit();
    this.cd.markForCheck();
  }

  // ── Track click (move nearest handle) ───────────────────────────────
  onTrackClick(e: PointerEvent): void {
    const rect = this.trackRef.nativeElement.getBoundingClientRect();
    const mins = this._snapTo(((e.clientX - rect.left) / rect.width) * this.TOTAL);
    if (this.mode === 'point') {
      this.startMins = Math.max(0, Math.min(this.TOTAL, mins));
      this.endMins   = this.startMins;
    } else {
      const dStart = Math.abs(mins - this.startMins);
      const dEnd   = Math.abs(mins - this.endMins);
      if (dStart <= dEnd) {
        this.startMins = Math.max(0, Math.min(this.endMins - this.MIN_GAP, mins));
      } else {
        this.endMins = Math.max(this.startMins + this.MIN_GAP, Math.min(this.TOTAL, mins));
      }
    }
    this.activePreset = null;
    this._emit();
    this.cd.markForCheck();
  }

  // ── Handle drag ─────────────────────────────────────────────────────
  onHandleDown(e: PointerEvent, handle: 'start' | 'end'): void {
    e.stopPropagation();
    e.preventDefault();
    this.dragging  = handle;
    this.trackRect = this.trackRef.nativeElement.getBoundingClientRect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.addEventListener('pointermove', this._onMove);
    document.addEventListener('pointerup',   this._onUp);
  }

  private _handleMove(e: PointerEvent): void {
    if (!this.dragging || !this.trackRect) return;
    const pct  = Math.max(0, Math.min(1, (e.clientX - this.trackRect.left) / this.trackRect.width));
    const mins = this._snapTo(pct * this.TOTAL);
    if (this.dragging === 'start') {
      const max = this.mode === 'point' ? this.TOTAL : this.endMins - this.MIN_GAP;
      this.startMins = Math.max(0, Math.min(max, mins));
      if (this.mode === 'point') this.endMins = this.startMins;
    } else {
      this.endMins = Math.max(this.startMins + this.MIN_GAP, Math.min(this.TOTAL, mins));
    }
    this.activePreset = null;
    this._emit();
    this.cd.markForCheck();
  }

  private _handleUp(): void {
    this.dragging  = null;
    this.trackRect = null;
    document.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerup',   this._onUp);
  }

  // ── Presets ──────────────────────────────────────────────────────────
  applyPreset(id: string): void {
    const now = new Date();
    const nowMins = this._snapTo(now.getHours() * 60 + now.getMinutes());
    if (id === 'now') {
      this.startMins = nowMins;
      this.endMins   = this.mode === 'point' ? nowMins : Math.min(this.TOTAL, nowMins + 15);
    } else if (id === '30m') {
      this.endMins = Math.min(this.TOTAL, this.startMins + 30);
    } else if (id === '1h') {
      this.endMins = Math.min(this.TOTAL, this.startMins + 60);
    } else if (id === '2h') {
      this.endMins = Math.min(this.TOTAL, this.startMins + 120);
    } else if (id === '-15') {
      this.startMins = Math.max(0, nowMins - 15);
      this.endMins   = this.startMins;
    } else if (id === '-30') {
      this.startMins = Math.max(0, nowMins - 30);
      this.endMins   = this.startMins;
    } else if (id === '-60') {
      this.startMins = Math.max(0, nowMins - 60);
      this.endMins   = this.startMins;
    }
    this.activePreset = id;
    this._emit();
    this.cd.markForCheck();
  }

  trackByIdx(i: number): number { return i; }

  // ── Helpers ──────────────────────────────────────────────────────────
  private _emit(): void {
    this.timeRangeChange.emit({ from: this.startLabel, to: this.endLabel });
  }

  private _snapTo(mins: number): number {
    return Math.round(mins / this.SNAP) * this.SNAP;
  }

  private _parse(t: string): number {
    if (!t) return -1;
    const parts = t.split(':').map(Number);
    if (parts.length < 2 || parts.some(isNaN)) return -1;
    const mins = parts[0] * 60 + parts[1];
    return Math.max(0, Math.min(this.TOTAL, mins));
  }

  private _fmt(mins: number): string {
    const clamped = Math.max(0, Math.min(this.TOTAL, mins));
    const h = Math.floor(clamped / 60) % 24;
    const m = clamped % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
}
