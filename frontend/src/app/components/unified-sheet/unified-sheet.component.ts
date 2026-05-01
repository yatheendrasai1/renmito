import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { LogService } from '../../services/log.service';
import { LogTypeService } from '../../services/log-type.service';
import { PreferenceService, ActiveLog } from '../../services/preference.service';
import { LogType } from '../../models/log-type.model';
import { LogEntry } from '../../models/log.model';

@Component({
  selector: 'app-unified-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- backdrop -->
    <div class="log-now-backdrop" (click)="closeSheet()"></div>

    <!-- sheet -->
    <div class="log-now-sheet uni-sheet"
         (touchstart)="onSwipeStart($event)"
         (touchend)="onSwipeEnd($event)">

      <!-- Tab pills -->
      <div class="uni-tabs">
        <button class="uni-tab" [class.uni-tab--active]="tab === 1" (click)="switchTab(1)">Add log</button>
        <button class="uni-tab" [class.uni-tab--active]="tab === 2" (click)="switchTab(2)">Add point</button>
        <button class="uni-tab" [class.uni-tab--active]="tab === 3" (click)="switchTab(3)">Start timer</button>
      </div>

      <!-- ── Tab 1: Add log ── -->
      <ng-container *ngIf="tab === 1">
        <div class="log-now-fields">
          <div class="ln-domain-tabs">
            <button class="ln-domain-tab" [class.ln-domain-tab--active]="logNowDomain === 'work'"
                    (click)="setLogNowDomain('work')">Work</button>
            <button class="ln-domain-tab" [class.ln-domain-tab--active]="logNowDomain === 'personal'"
                    (click)="setLogNowDomain('personal')">Personal</button>
          </div>
          <div class="ln-type-drum-wrap">
            <div class="ln-drum-center-band"></div>
            <div class="ln-drum ln-drum-ln-types" (scroll)="onLogNowTypeScroll($event)">
              <div class="ln-drum-spacer"></div>
              <div class="ln-type-drum-item"
                   *ngFor="let lt of logNowFilteredTypes; let i = index; trackBy: trackByLogTypeId"
                   [class.ln-type-drum-item--sel]="i === logNowTypeIndex">
                <span class="ln-type-dot-sm" [style.background]="lt.color"></span>
                {{ lt.name }}
              </div>
              <div class="ln-drum-spacer"></div>
            </div>
          </div>
          <textarea class="log-now-input"
                    placeholder="Title (optional — defaults to type name)"
                    [(ngModel)]="logNowTitle"></textarea>
          <div class="ln-time-pickers">
            <div class="ln-time-block">
              <span class="ln-time-block-label">Start</span>
              <div class="ln-drum-group">
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-start-h" (scroll)="onLogNowStartHourScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let h of logNowHours; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="h === logNowStartHour">
                        {{ h | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">h</span>
                </div>
                <div class="ln-drum-colon">:</div>
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-start-m" (scroll)="onLogNowStartMinuteScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let m of logNowMinutes; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="m === logNowStartMinute">
                        {{ m | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">m</span>
                </div>
              </div>
            </div>
            <div class="ln-time-arrow">→</div>
            <div class="ln-time-block">
              <span class="ln-time-block-label">End</span>
              <div class="ln-drum-group">
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-end-h" (scroll)="onLogNowEndHourScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let h of logNowHours; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="h === logNowEndHour">
                        {{ h | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">h</span>
                </div>
                <div class="ln-drum-colon">:</div>
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-end-m" (scroll)="onLogNowEndMinuteScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let m of logNowMinutes; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="m === logNowEndMinute">
                        {{ m | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeSheet()">Cancel</button>
          <button class="log-now-save" (click)="saveLogNow()"
                  [disabled]="logNowSaving || !logNowTypeId">
            {{ logNowSaving ? 'Saving…' : 'Save Log' }}
          </button>
        </div>
      </ng-container>

      <!-- ── Tab 2: Add point ── -->
      <ng-container *ngIf="tab === 2">
        <div class="log-now-fields">
          <div class="ln-domain-tabs">
            <button class="ln-domain-tab" [class.ln-domain-tab--active]="addPointDomain === 'work'"
                    (click)="setAddPointDomain('work')">Work</button>
            <button class="ln-domain-tab" [class.ln-domain-tab--active]="addPointDomain === 'personal'"
                    (click)="setAddPointDomain('personal')">Personal</button>
          </div>
          <div class="ln-type-drum-wrap">
            <div class="ln-drum-center-band"></div>
            <div class="ln-drum ln-drum-ap-types" (scroll)="onAddPointTypeScroll($event)">
              <div class="ln-drum-spacer"></div>
              <div class="ln-type-drum-item"
                   *ngFor="let lt of addPointFilteredTypes; let i = index; trackBy: trackByLogTypeId"
                   [class.ln-type-drum-item--sel]="i === addPointTypeIndex">
                <span class="ln-type-dot-sm" [style.background]="lt.color"></span>
                {{ lt.name }}
              </div>
              <div class="ln-drum-spacer"></div>
            </div>
          </div>
          <textarea class="log-now-input" placeholder="Title (optional)" [(ngModel)]="addPointTitle"></textarea>
          <div class="ln-time-pickers ln-time-pickers--single">
            <div class="ln-time-block">
              <span class="ln-time-block-label">Time</span>
              <div class="ln-drum-group">
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-ap-h" (scroll)="onAddPointHourScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let h of logNowHours; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="h === addPointHour">
                        {{ h | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">h</span>
                </div>
                <div class="ln-drum-colon">:</div>
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-ap-m" (scroll)="onAddPointMinuteScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let m of addPointMinutes; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="m === addPointMinute">
                        {{ m | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeSheet()">Cancel</button>
          <button class="log-now-save" (click)="saveAddPoint()"
                  [disabled]="addPointSaving || !addPointTypeId">
            {{ addPointSaving ? 'Saving…' : 'Add Point' }}
          </button>
        </div>
      </ng-container>

      <!-- ── Tab 3: Start timer ── -->
      <ng-container *ngIf="tab === 3">
        <div class="log-now-fields">
          <div class="ln-domain-tabs">
            <button class="ln-domain-tab" [class.ln-domain-tab--active]="startLogDomain === 'work'"
                    (click)="setStartLogDomain('work')">Work</button>
            <button class="ln-domain-tab" [class.ln-domain-tab--active]="startLogDomain === 'personal'"
                    (click)="setStartLogDomain('personal')">Personal</button>
          </div>
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
          <textarea class="log-now-input"
                    placeholder="Title (optional — defaults to type name)"
                    [(ngModel)]="startLogTitle"></textarea>
          <div class="start-log-planned-row">
            <span class="start-log-planned-label">Plan for:</span>
            <div class="start-log-planned-chips">
              <button *ngFor="let opt of plannedOpts; trackBy: trackByIndex"
                      class="start-log-chip"
                      [class.start-log-chip--active]="startLogPlanned === opt.v"
                      (click)="startLogPlanned = opt.v">
                {{ opt.l }}
              </button>
            </div>
          </div>
        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeSheet()">Cancel</button>
          <button class="log-now-save log-now-save--start" (click)="saveStartLog()"
                  [disabled]="startLogSaving || !startLogTypeId">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {{ startLogSaving ? 'Starting…' : 'Start Timer' }}
          </button>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .log-now-backdrop {
      position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.45);
    }
    .log-now-sheet {
      position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
      z-index: 301; width: 100%; max-width: 480px;
      background: var(--bg-surface); border-top: 1px solid var(--border);
      border-radius: 16px 16px 0 0; padding: 20px 20px 36px;
      animation: slideUp 0.22s ease;
    }
    .uni-sheet {
      display: flex; flex-direction: column;
      height: 520px; max-height: 80dvh;
      padding: 12px 20px 36px; overflow: hidden;
    }
    .uni-sheet .uni-tabs { flex-shrink: 0; }
    .uni-sheet ng-container { display: contents; }
    .uni-sheet .log-now-fields {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding-top: 8px; min-height: 0;
    }
    .uni-sheet .log-now-actions { flex-shrink: 0; padding-top: 12px; }
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100%); }
      to   { transform: translateX(-50%) translateY(0); }
    }
    .uni-tabs {
      display: flex; gap: 6px; padding: 0 0 14px;
      border-bottom: 1px solid var(--border); margin-bottom: 4px;
    }
    .uni-tab {
      flex: 1; padding: 7px 6px; border: 1px solid var(--border); border-radius: 8px;
      background: transparent; color: var(--text-secondary); font-size: 13px;
      font-weight: 500; cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .uni-tab--active { background: var(--nav-bg); color: var(--nav-text); border-color: var(--nav-bg); }
    .log-now-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .log-now-input {
      width: 100%; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 14px;
      box-sizing: border-box; font-family: inherit; resize: none;
      line-height: 1.5; height: calc(1.5em * 3 + 20px);
    }
    .log-now-actions { display: flex; gap: 10px; }
    .log-now-cancel {
      flex: 1; padding: 11px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-secondary); font-size: 14px; cursor: pointer;
    }
    .log-now-save {
      flex: 2; padding: 11px; background: var(--highlight-selected); border: none;
      border-radius: 8px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .log-now-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .log-now-save--start { display: flex; align-items: center; gap: 6px; }

    /* Domain tabs */
    .ln-domain-tabs {
      display: flex; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-sm); overflow: hidden;
    }
    .ln-domain-tab {
      flex: 1; padding: 8px; background: transparent; border: none;
      color: var(--text-muted); font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .ln-domain-tab--active { background: var(--highlight-selected); color: #fff; }

    /* Type drum */
    .ln-type-drum-wrap {
      position: relative; width: 100%; height: 75px; overflow: hidden;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .ln-type-drum-wrap::before, .ln-type-drum-wrap::after {
      content: ''; position: absolute; left: 0; right: 0; height: 25px; z-index: 2; pointer-events: none;
    }
    .ln-type-drum-wrap::before { top: 0; background: linear-gradient(to bottom, var(--bg-card) 10%, transparent); }
    .ln-type-drum-wrap::after { bottom: 0; background: linear-gradient(to top, var(--bg-card) 10%, transparent); }
    .ln-type-drum-item {
      height: 25px; scroll-snap-align: center; display: flex; align-items: center;
      justify-content: center; gap: 7px; font-size: 10px; font-weight: 500;
      color: var(--text-muted); user-select: none; transition: color 0.12s, font-size 0.12s, font-weight 0.12s;
    }
    .ln-type-drum-item--sel { color: var(--text-primary); font-size: 12px; font-weight: 700; }
    .ln-type-dot-sm { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

    /* Time pickers / drums */
    .ln-time-pickers {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 8px;
    }
    .ln-time-pickers--single { justify-content: flex-start; }
    .ln-time-block { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
    .ln-time-block-label {
      font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px;
    }
    .ln-time-arrow { font-size: 18px; color: var(--text-muted); flex-shrink: 0; padding-top: 20px; }
    .ln-drum-group { display: flex; align-items: center; gap: 4px; }
    .ln-drum-colon {
      font-size: 18px; font-weight: 700; color: var(--text-primary); line-height: 1; padding-bottom: 10px; flex-shrink: 0;
    }
    .ln-drum-col { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .ln-drum-wrapper { position: relative; width: 56px; height: 75px; overflow: hidden; }
    .ln-drum-wrapper::before, .ln-drum-wrapper::after {
      content: ''; position: absolute; left: 0; right: 0; height: 25px; z-index: 2; pointer-events: none;
    }
    .ln-drum-wrapper::before { top: 0; background: linear-gradient(to bottom, var(--bg-card) 10%, transparent); }
    .ln-drum-wrapper::after { bottom: 0; background: linear-gradient(to top, var(--bg-card) 10%, transparent); }
    .ln-drum-center-band {
      position: absolute; top: 50%; left: 3px; right: 3px; height: 25px; transform: translateY(-50%);
      border-top: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light);
      background: rgba(74,144,226,0.06); border-radius: 4px; pointer-events: none; z-index: 1;
    }
    .ln-drum {
      position: relative; z-index: 3; width: 100%; height: 100%;
      overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .ln-drum::-webkit-scrollbar { display: none; }
    .ln-drum-spacer { height: 25px; flex-shrink: 0; display: block; }
    .ln-drum-item {
      height: 25px; scroll-snap-align: center; display: flex; align-items: center;
      justify-content: center; font-size: 11px; font-weight: 500; color: var(--text-muted);
      font-variant-numeric: tabular-nums; user-select: none; transition: color 0.1s, font-size 0.1s, font-weight 0.1s;
    }
    .ln-drum-item--sel { color: var(--text-primary); font-size: 14px; font-weight: 700; }
    .ln-drum-unit {
      font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.7px;
    }

    /* Planned duration chips */
    .start-log-planned-row { display: flex; flex-direction: column; gap: 8px; }
    .start-log-planned-label {
      font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px;
    }
    .start-log-planned-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .start-log-chip {
      padding: 5px 12px; border-radius: 14px; border: 1px solid var(--border-light);
      background: var(--bg-card); color: var(--text-secondary); font-size: 12px; cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .start-log-chip:hover { border-color: var(--accent); color: var(--text-primary); }
    .start-log-chip--active, .start-log-chip--active:focus, .start-log-chip--active:active {
      border-color: var(--highlight-selected); background: var(--highlight-selected);
      color: #fff; font-weight: 600; outline: none;
    }

  `],
})
export class UnifiedSheetComponent implements OnInit, OnDestroy {
  @Input() initialTab: 1|2|3 = 1;
  @Input() selectedDate: Date = new Date();
  @Input() logs: LogEntry[] = [];

  @Output() closed         = new EventEmitter<void>();
  @Output() logCreated     = new EventEmitter<void>();
  @Output() timerStarted   = new EventEmitter<ActiveLog>();
  @Output() showToast      = new EventEmitter<{ message: string; logId: string }>();

  private readonly destroy$ = new Subject<void>();

  // ── Drum constants ────────────────────────────────────────────────
  readonly logNowHours     = Array.from({ length: 24 }, (_, i) => i);
  readonly logNowMinutes   = [15, 30, 45, 0];
  readonly addPointMinutes = [0, 15, 30, 45];
  readonly plannedOpts = [
    {v:'',l:'no time bound'},{v:'15',l:'15m'},{v:'30',l:'30m'},
    {v:'60',l:'1h'},{v:'90',l:'1.5h'},{v:'120',l:'2h'},
  ];

  // ── Internal state ────────────────────────────────────────────────
  tab: 1|2|3 = 1;
  private logTypes: LogType[] = [];
  private uniTouchStartX = 0;
  private uniTouchStartY = 0;

  // Log Now (tab 1)
  logNowDomain: 'work' | 'personal' = 'work';
  logNowTypeIndex = 0;
  logNowTypeId    = '';
  logNowTitle     = '';
  logNowStart     = '09:00';
  logNowEnd       = '09:00';
  logNowSaving    = false;

  // Add Point (tab 2)
  addPointDomain: 'work' | 'personal' = 'work';
  addPointTypeIndex = 0;
  addPointTypeId    = '';
  addPointTitle     = '';
  addPointTime      = '09:00';
  addPointSaving    = false;

  // Start Timer (tab 3)
  startLogDomain: 'work' | 'personal' = 'work';
  startLogTypeIndex = 0;
  startLogTypeId    = '';
  startLogTitle     = '';
  startLogPlanned   = '';
  startLogSaving    = false;

  constructor(
    private logService:     LogService,
    private logTypeService: LogTypeService,
    private prefService:    PreferenceService,
    private cd:             ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.tab = this.initialTab;
    this.logTypeService.getLogTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe(types => {
        this.logTypes = types;
        this._initAllTabs();
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private get selectedDateStr(): string {
    const d = this.selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // ── Initialisation ────────────────────────────────────────────────
  private _initAllTabs(): void {
    this._initLogNow();
    this._initAddPoint();
    this._initStartLog();
    setTimeout(() => this._scrollCurrentTab(), 40);
  }

  private _initLogNow(): void {
    const now      = this._snapToQuarter(this._currentTimeStr());
    const startStr = this._snapToQuarter(this._smartDefaultStart());
    this.logNowStart     = startStr;
    this.logNowEnd       = now;
    this.logNowDomain    = 'work';
    this.logNowTypeIndex = 0;
    this.logNowTitle     = '';
    const workTypes = this.logTypes.filter(lt => lt.domain === 'work');
    this.logNowTypeId = workTypes[0]?._id ?? this.logTypes[0]?._id ?? '';
  }

  private _initAddPoint(): void {
    this.addPointDomain    = 'work';
    this.addPointTypeIndex = 0;
    this.addPointTitle     = '';
    const n = new Date();
    this.addPointTime = this._snapToQuarter(
      `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
    );
    const types = this.addPointFilteredTypes;
    this.addPointTypeId    = types[0]?._id ?? '';
  }

  private _initStartLog(): void {
    this.startLogDomain    = 'work';
    this.startLogTypeIndex = 0;
    this.startLogTitle     = '';
    this.startLogPlanned   = '';
    const filtered = this.startLogFilteredTypes;
    this.startLogTypeId = filtered[0]?._id ?? this.logTypes[0]?._id ?? '';
  }

  private _scrollCurrentTab(): void {
    if (this.tab === 1) { this._scrollLogNowDrums(); this._scrollLogNowTypeDrum(); }
    if (this.tab === 2) { this._scrollAddPointTypeDrum(); this._scrollAddPointTimeDrums(); }
    if (this.tab === 3) { this._scrollStartLogTypeDrum(); }
  }

  // ── Tab management ────────────────────────────────────────────────
  switchTab(t: 1|2|3): void {
    this.tab = t;
    setTimeout(() => this._scrollCurrentTab(), 40);
  }

  onSwipeStart(e: TouchEvent): void {
    this.uniTouchStartX = e.changedTouches[0].clientX;
    this.uniTouchStartY = e.changedTouches[0].clientY;
  }
  onSwipeEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.uniTouchStartX;
    const dy = e.changedTouches[0].clientY - this.uniTouchStartY;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    if (dx > 60 && this.tab > 1) {
      this.tab = (this.tab - 1) as 1|2|3;
      setTimeout(() => this._scrollCurrentTab(), 40);
    } else if (dx < -60 && this.tab < 3) {
      this.tab = (this.tab + 1) as 1|2|3;
      setTimeout(() => this._scrollCurrentTab(), 40);
    }
  }

  closeSheet(): void {
    this.closed.emit();
  }

  // ── Log Now helpers ───────────────────────────────────────────────
  get logNowFilteredTypes(): LogType[] {
    return this.logTypes.filter(lt => lt.domain === this.logNowDomain);
  }
  get logNowStartHour():   number { return +this.logNowStart.split(':')[0]; }
  get logNowStartMinute(): number { return +this.logNowStart.split(':')[1]; }
  get logNowEndHour():     number { return +this.logNowEnd.split(':')[0]; }
  get logNowEndMinute():   number { return +this.logNowEnd.split(':')[1]; }

  setLogNowDomain(domain: 'work' | 'personal'): void {
    this.logNowDomain    = domain;
    this.logNowTypeIndex = 0;
    this.logNowTypeId    = this.logNowFilteredTypes[0]?._id ?? '';
    setTimeout(() => this._scrollLogNowTypeDrum(), 20);
  }
  onLogNowTypeScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.logNowFilteredTypes.length - 1, Math.round(el.scrollTop / 25)));
    if (idx === this.logNowTypeIndex) return;
    this.logNowTypeIndex = idx;
    this.logNowTypeId    = this.logNowFilteredTypes[idx]?._id ?? '';
  }
  onLogNowStartHourScroll(event: Event): void {
    const h = Math.max(0, Math.min(23, Math.round((event.target as HTMLElement).scrollTop / 25)));
    if (h === this.logNowStartHour) return;
    this.logNowStart = `${String(h).padStart(2,'0')}:${this.logNowStart.split(':')[1]}`;
  }
  onLogNowStartMinuteScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.logNowMinutes.length - 1, Math.round(el.scrollTop / 25)));
    const m   = this.logNowMinutes[idx];
    if (m === this.logNowStartMinute) return;
    this.logNowStart = `${this.logNowStart.split(':')[0]}:${String(m).padStart(2,'0')}`;
  }
  onLogNowEndHourScroll(event: Event): void {
    const h = Math.max(0, Math.min(23, Math.round((event.target as HTMLElement).scrollTop / 25)));
    if (h === this.logNowEndHour) return;
    this.logNowEnd = `${String(h).padStart(2,'0')}:${this.logNowEnd.split(':')[1]}`;
  }
  onLogNowEndMinuteScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.logNowMinutes.length - 1, Math.round(el.scrollTop / 25)));
    const m   = this.logNowMinutes[idx];
    if (m === this.logNowEndMinute) return;
    this.logNowEnd = `${this.logNowEnd.split(':')[0]}:${String(m).padStart(2,'0')}`;
  }

  saveLogNow(): void {
    if (this.logNowSaving || !this.logNowTypeId) return;
    const lt    = this.logTypes.find(t => t._id === this.logNowTypeId);
    const title = this.logNowTitle.trim() || (lt?.name ?? 'Log');
    this.logNowSaving = true;
    this.logService.createLog(this.selectedDate, {
      title, logTypeId: this.logNowTypeId, startTime: this.logNowStart, endTime: this.logNowEnd,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => { this.logNowSaving = false; this.closed.emit(); this.logCreated.emit(); this.cd.markForCheck(); },
      error: () => { this.logNowSaving = false; this.cd.markForCheck(); },
    });
  }

  // ── Add Point helpers ─────────────────────────────────────────────
  get addPointFilteredTypes(): LogType[] {
    return this.logTypes.filter(lt => lt.domain === this.addPointDomain);
  }
  get addPointHour():   number { return +this.addPointTime.split(':')[0]; }
  get addPointMinute(): number { return +this.addPointTime.split(':')[1]; }

  setAddPointDomain(domain: 'work' | 'personal'): void {
    this.addPointDomain    = domain;
    this.addPointTypeIndex = 0;
    this.addPointTypeId    = this.addPointFilteredTypes[0]?._id ?? '';
    setTimeout(() => this._scrollAddPointTypeDrum(), 20);
  }
  onAddPointTypeScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.addPointFilteredTypes.length - 1, Math.round(el.scrollTop / 25)));
    if (idx === this.addPointTypeIndex) return;
    this.addPointTypeIndex = idx;
    this.addPointTypeId    = this.addPointFilteredTypes[idx]?._id ?? '';
  }
  onAddPointHourScroll(event: Event): void {
    const h = Math.max(0, Math.min(23, Math.round((event.target as HTMLElement).scrollTop / 25)));
    if (h === this.addPointHour) return;
    this.addPointTime = `${String(h).padStart(2,'0')}:${this.addPointTime.split(':')[1]}`;
  }
  onAddPointMinuteScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.addPointMinutes.length - 1, Math.round(el.scrollTop / 25)));
    const m   = this.addPointMinutes[idx];
    if (m === this.addPointMinute) return;
    this.addPointTime = `${this.addPointTime.split(':')[0]}:${String(m).padStart(2,'0')}`;
  }

  saveAddPoint(): void {
    if (this.addPointSaving || !this.addPointTypeId) return;
    const lt    = this.logTypes.find(t => t._id === this.addPointTypeId);
    const title = this.addPointTitle.trim() || (lt?.name ?? 'Point');
    this.addPointSaving = true;
    this.logService.createLog(this.selectedDate, {
      title, logTypeId: this.addPointTypeId, entryType: 'point',
      pointTime: this.addPointTime, startTime: this.addPointTime, endTime: this.addPointTime,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => { this.addPointSaving = false; this.closed.emit(); this.logCreated.emit(); this.cd.markForCheck(); },
      error: () => { this.addPointSaving = false; this.cd.markForCheck(); },
    });
  }

  // ── Start Log helpers ─────────────────────────────────────────────
  get startLogFilteredTypes(): LogType[] {
    return this.logTypes.filter(lt => lt.domain === this.startLogDomain);
  }

  setStartLogDomain(domain: 'work' | 'personal'): void {
    this.startLogDomain    = domain;
    this.startLogTypeIndex = 0;
    this.startLogTypeId    = this.startLogFilteredTypes[0]?._id ?? '';
    setTimeout(() => this._scrollStartLogTypeDrum(), 20);
  }
  onStartLogTypeScroll(event: Event): void {
    const el  = event.target as HTMLElement;
    const idx = Math.max(0, Math.min(this.startLogFilteredTypes.length - 1, Math.round(el.scrollTop / 25)));
    if (idx === this.startLogTypeIndex) return;
    this.startLogTypeIndex = idx;
    this.startLogTypeId    = this.startLogFilteredTypes[idx]?._id ?? '';
  }

  saveStartLog(): void {
    if (this.startLogSaving || !this.startLogTypeId) return;
    const lt          = this.logTypes.find(t => t._id === this.startLogTypeId);
    const title       = this.startLogTitle.trim() || (lt?.name ?? 'Log');
    const plannedMins = this.startLogPlanned ? parseInt(this.startLogPlanned, 10) : null;
    this.startLogSaving = true;
    this.prefService.startActiveLog({ logTypeId: this.startLogTypeId, title, plannedMins })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activeLog) => {
          this.startLogSaving = false;
          this.closed.emit();
          if (activeLog) this.timerStarted.emit(activeLog);
          this.cd.markForCheck();
        },
        error: () => { this.startLogSaving = false; this.cd.markForCheck(); },
      });
  }

  // ── TrackBy ───────────────────────────────────────────────────────
  trackByLogTypeId(_i: number, lt: LogType): string { return lt._id; }
  trackByIndex(i: number): number { return i; }

  // ── Private scroll helpers ────────────────────────────────────────
  private _scrollLogNowTypeDrum(): void {
    const el = document.querySelector('.ln-drum-ln-types') as HTMLElement | null;
    if (el) el.scrollTop = this.logNowTypeIndex * 25;
  }
  private _scrollAddPointTypeDrum(): void {
    const el = document.querySelector('.ln-drum-ap-types') as HTMLElement | null;
    if (el) el.scrollTop = this.addPointTypeIndex * 25;
  }
  private _scrollStartLogTypeDrum(): void {
    const el = document.querySelector('.ln-drum-sl-types') as HTMLElement | null;
    if (el) el.scrollTop = this.startLogTypeIndex * 25;
  }
  private _scrollLogNowDrums(): void {
    const item = 25;
    const sh = document.querySelector('.ln-drum-start-h') as HTMLElement | null;
    const sm = document.querySelector('.ln-drum-start-m') as HTMLElement | null;
    const eh = document.querySelector('.ln-drum-end-h')   as HTMLElement | null;
    const em = document.querySelector('.ln-drum-end-m')   as HTMLElement | null;
    if (sh) sh.scrollTop = this.logNowStartHour                          * item;
    if (sm) sm.scrollTop = this._minuteToQtrIndex(this.logNowStartMinute) * item;
    if (eh) eh.scrollTop = this.logNowEndHour                            * item;
    if (em) em.scrollTop = this._minuteToQtrIndex(this.logNowEndMinute)  * item;
  }
  private _scrollAddPointTimeDrums(): void {
    const ah = document.querySelector('.ln-drum-ap-h') as HTMLElement | null;
    const am = document.querySelector('.ln-drum-ap-m') as HTMLElement | null;
    if (ah) ah.scrollTop = this.addPointHour * 25;
    if (am) am.scrollTop = this._addPointMinuteToIdx(this.addPointMinute) * 25;
  }
  // ── Time utilities ────────────────────────────────────────────────
  private _currentTimeStr(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }
  private _minsToTimeStr(mins: number): string {
    return `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`;
  }
  private _timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
  private _snapToQuarter(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const snapped = Math.round(m / 15) * 15;
    if (snapped === 60) {
      return `${String(Math.min(23, h+1)).padStart(2,'0')}:00`;
    }
    return `${String(h).padStart(2,'0')}:${String(snapped).padStart(2,'0')}`;
  }
  private _minuteToQtrIndex(m: number): number {
    const snapped = Math.round(m / 15) * 15 % 60;
    const idx = this.logNowMinutes.indexOf(snapped);
    return idx >= 0 ? idx : 0;
  }
  private _addPointMinuteToIdx(m: number): number {
    const snapped = Math.round(m / 15) * 15 % 60;
    const idx = this.addPointMinutes.indexOf(snapped);
    return idx >= 0 ? idx : 0;
  }
  private _smartDefaultStart(): string {
    const last    = this.logs[this.logs.length - 1];
    const nowMins = this._timeToMinutes(this._currentTimeStr());
    if (!last) return this._minsToTimeStr(Math.max(0, nowMins - 30));
    const lastEndMins = this._timeToMinutes(last.endAt ?? last.startAt);
    return this._minsToTimeStr(nowMins - lastEndMins > 30 ? Math.max(0, nowMins - 30) : lastEndMins);
  }

  // ── Public opener helpers (called by AppComponent via @ViewChild or state) ──
  prepForAddPoint(domain: 'work' | 'personal', typeId: string, time: string): void {
    if (this.logTypes.length) {
      this.addPointDomain    = domain;
      const types = this.logTypes.filter(lt => lt.domain === domain);
      this.addPointTypeIndex = Math.max(0, types.findIndex(t => t._id === typeId));
      this.addPointTypeId    = typeId;
      this.addPointTime      = time;
      this.addPointTitle     = '';
      this.tab = 2;
      setTimeout(() => { this._scrollAddPointTypeDrum(); this._scrollAddPointTimeDrums(); }, 40);
    }
  }
}
