import {
  Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, HostListener,
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
  styles: [`:host { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .date-title-row { display: flex; align-items: center; gap: 8px; }
    .date-above-bar { font-size: 17px; font-weight: 700; color: var(--text-primary); line-height: 1; cursor: pointer; text-decoration: none; }
  `],
  template: `
    <!-- ── Day-type pill · Date · Nav buttons ───────────── -->
    <div class="date-title-row">
      <div class="hdr-dt" *ngIf="dayMetadata">
        <button class="hdr-dt-trigger"
                (click)="dayTypeDropdownOpen = !dayTypeDropdownOpen; $event.stopPropagation()"
                [attr.aria-expanded]="dayTypeDropdownOpen">
          <span class="hdr-dt-dot" [style.background]="dayTypeColor"></span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" class="hdr-dt-chevron"
               [style.transform]="dayTypeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="hdr-dt-panel" *ngIf="dayTypeDropdownOpen" (click)="$event.stopPropagation()">
          <button *ngFor="let opt of dayTypeOptions"
                  class="hdr-dt-option"
                  [class.hdr-dt-option--active]="dayMetadata?.dayType === opt.value"
                  (click)="setDayType(opt.value); dayTypeDropdownOpen = false">
            <span class="hdr-dt-dot" [style.background]="opt.color"></span>
            {{ opt.label }}
          </button>
        </div>
      </div>
      <span class="date-above-bar" (click)="appState.openCalendarRequested$.next()">{{ appState.dateShortLabel }}</span>
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
        <button class="date-bar-btn date-bar-btn--today"
                [disabled]="appState.isToday"
                (click)="appState.goToToday()" title="Go to today" aria-label="Go to today">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button class="date-bar-btn"
                (click)="appState.openImportantLogsRequested$.next()"
                title="Important Logs" aria-label="Important Logs">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
    </div>

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

  readonly dayTypeOptions: { value: DayType; label: string; color: string }[] = [
    { value: 'working',    label: 'Working Day', color: '#4ade80' },
    { value: 'wfh',        label: 'WFH',         color: '#facc15' },
    { value: 'holiday',    label: 'Holiday',      color: '#60a5fa' },
    { value: 'paid_leave', label: 'Paid Leave',   color: '#fb923c' },
    { value: 'sick_leave', label: 'Sick Leave',   color: '#f87171' },
  ];

  get selectedDayTypeLabel(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.label ?? 'Day Type';
  }

  get dayTypeColor(): string {
    return this.dayTypeOptions.find(o => o.value === this.dayMetadata?.dayType)?.color ?? '#4ade80';
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

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.dayTypeDropdownOpen) { this.dayTypeDropdownOpen = false; this.cdr.markForCheck(); }
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
