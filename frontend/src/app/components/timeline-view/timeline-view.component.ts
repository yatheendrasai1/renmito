import {
  Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppStateService } from '../../services/app-state.service';
import { DayLevelService, DayType, DayMetadata } from '../../services/day-level.service';
import { LogEntry } from '../../models/log.model';

import { TimelineComponent, DragSelection } from '../timeline/timeline.component';

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TimelineComponent],
  styles: [`:host { display: flex; flex-direction: column; gap: 14px; min-width: 0; overflow: hidden; }`],
  template: `
    <!-- ── Date bar ────────────────────────────────────── -->
    <div class="date-bar">
      <span class="date-bar-text">{{ appState.dateShortLabel }}</span>
      <div class="date-bar-actions">
        <button class="date-bar-btn" (click)="appState.prevDay()"
                title="Previous day" aria-label="Previous day">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button class="date-bar-btn" (click)="appState.nextDay()"
                [disabled]="appState.isToday"
                title="Next day" aria-label="Next day">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <button class="date-bar-btn" (click)="appState.goToToday()"
                [disabled]="appState.isToday"
                title="Go to today" aria-label="Go to today">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button class="date-bar-btn" (click)="appState.openCalendarRequested$.next()"
                title="Pick a date" aria-label="Open calendar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </button>
        <button class="date-bar-btn"
                (click)="appState.openImportantLogsRequested$.next()"
                title="Important Logs" aria-label="Important Logs">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Day type selector -->
    <div class="day-type-bar" *ngIf="dayMetadata">
      <div class="dt-select" [class.dt-select--open]="dayTypeDropdownOpen">
        <button class="dt-trigger"
                (click)="dayTypeDropdownOpen = !dayTypeDropdownOpen; $event.stopPropagation()">
          <span class="dt-trigger-label">{{ selectedDayTypeLabel }}</span>
          <svg class="dt-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="dt-panel" *ngIf="dayTypeDropdownOpen" (click)="$event.stopPropagation()">
          <button *ngFor="let opt of dayTypeOptions"
                  class="dt-option"
                  [class.dt-option--active]="dayMetadata!.dayType === opt.value"
                  (click)="setDayType(opt.value); dayTypeDropdownOpen = false">
            {{ opt.label }}
          </button>
        </div>
      </div>
      <button class="dt-notes-btn" (click)="appState.openNotesRequested$.next()" title="Day notes">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        Notes<span class="dt-notes-count" *ngIf="notesCount > 0">{{ notesCount }}</span>
      </button>
    </div>
    <div class="dt-backdrop" *ngIf="dayTypeDropdownOpen" (click)="dayTypeDropdownOpen = false"></div>

    <!-- Timeline -->
    <div class="timeline-view-container">
      <app-timeline
        #timelineRef
        [logs]="logs"
        [selectedDate]="selectedDate"
        [highlightedLogId]="highlightedLogId"
        [metricLogIds]="metricLogIds"
        [collapsible]="false"
        (selectionMade)="onSelectionChanged($event)"
        (createLogClicked)="onCreateLogClicked($event)"
        (logClicked)="onLogClicked($event)"
        (mergePointsSelected)="onMergePointsSelected($event)"
      ></app-timeline>
    </div>
  `,
})
export class TimelineViewComponent implements OnInit, OnDestroy {
  @ViewChild('timelineRef') timelineRef?: TimelineComponent;

  private readonly destroy$ = new Subject<void>();

  logs:             LogEntry[]         = [];
  selectedDate:     Date               = new Date();
  dayMetadata:      DayMetadata | null = null;
  notesCount        = 0;
  highlightedLogId: string | null      = null;
  metricLogIds:     Set<string> | null = null;
  dayTypeDropdownOpen = false;

  readonly dayTypeOptions: { value: DayType; label: string }[] = [
    { value: 'working',    label: 'Working Day' },
    { value: 'wfh',        label: 'WFH'         },
    { value: 'holiday',    label: 'Holiday'      },
    { value: 'paid_leave', label: 'Paid Leave'   },
    { value: 'sick_leave', label: 'Sick Leave'   },
  ];

  get selectedDayTypeLabel(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.label ?? 'Day Type';
  }

  setDayType(dayType: DayType): void { this.appState.setDayType(dayType); }

  constructor(
    public  appState:         AppStateService,
    private _dayLevelService: DayLevelService,
    private cdr:              ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.appState.logs$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.logs = v; this.cdr.markForCheck();
    });
    this.appState.selectedDate$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.selectedDate = v; this.cdr.markForCheck();
    });
    this.appState.dayMetadata$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.dayMetadata = v; this.cdr.markForCheck();
    });
    this.appState.notesCount$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.notesCount = v; this.cdr.markForCheck();
    });
    this.appState.highlightedLogId$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.highlightedLogId = v; this.cdr.markForCheck();
    });
    this.appState.metricLogIds$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.metricLogIds = v; this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSelectionChanged(_selection: DragSelection): void { /* no-op */ }

  onCreateLogClicked(selection: DragSelection): void {
    this.appState.openLogFormRequested$.next({
      startTime: selection.startTime,
      endTime:   selection.endTime,
      editEntry: null,
    });
  }

  onLogClicked(log: LogEntry): void {
    this.appState.openLogFormRequested$.next({
      startTime: log.startAt,
      endTime:   log.endAt ?? '01:00',
      editEntry: log,
    });
  }

  onMergePointsSelected(selection: DragSelection): void {
    const diff = selection.endMinutes - selection.startMinutes;
    const h = Math.floor(diff / 60), m = diff % 60;
    const durStr = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
    this.appState.confirmDialogRequested$.next({
      title:   'Merge into time range?',
      message: 'The two point logs will be deleted after the new entry is saved.',
      detail:  `${selection.startTime} – ${selection.endTime}  (${durStr})`,
      okLabel: 'Merge',
      onConfirm: () => {
        this.appState.openLogFormRequested$.next({
          startTime:     selection.startTime,
          endTime:       selection.endTime,
          editEntry:     null,
          logTypeId:     selection.mergeLogTypeId ?? null,
          mergeSourceIds: selection.mergeSourceIds ?? null,
        });
        this.timelineRef?.cancelMerge();
      }
    });
  }
}
