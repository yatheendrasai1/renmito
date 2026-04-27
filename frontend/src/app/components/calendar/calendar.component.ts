import {
  Component,
  OnInit,
  OnChanges,
  Output,
  EventEmitter,
  Input,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogService } from '../../services/log.service';

interface CalendarDay {
  date: Date | null;
  dayNumber: number | null;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  workMins: number | null;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="nav-btn" (click)="prevMonth()" aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="month-label">{{ monthLabel }}</span>
        <button class="nav-btn" (click)="nextMonth()" aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="calendar-grid">
        <div class="day-header" *ngFor="let d of dayHeaders; trackBy: trackByIndex">{{ d }}</div>
        <div
          *ngFor="let day of calendarDays; trackBy: trackByDate"
          class="day-cell"
          [class.empty]="!day.date"
          [class.today]="day.isToday"
          [class.selected]="day.isSelected"
          [class.other-month]="!day.isCurrentMonth && day.date"
          [class.range-start]="day.isRangeStart"
          [class.range-end]="day.isRangeEnd"
          [class.in-range]="day.isInRange"
          (click)="day.date && selectDate(day.date)"
        >
          <ng-container *ngIf="day.date">
            <span class="day-num">{{ day.dayNumber }}</span>
            <span class="work-label" *ngIf="day.isCurrentMonth && day.workMins">{{ formatWorkMins(day.workMins) }}</span>
          </ng-container>
        </div>
      </div>

      <button class="today-btn" (click)="goToToday()">Today</button>
    </div>
  `,
  styles: [`
    .calendar-wrapper {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      width: 280px;
      user-select: none;
    }

    .calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .month-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: 0.5px;
    }

    .nav-btn {
      background: none;
      color: var(--text-secondary);
      padding: 4px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
    }

    .nav-btn:hover {
      background: var(--bg-card);
      color: var(--text-primary);
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .day-header {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      padding: 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .day-cell {
      text-align: center;
      padding: 4px 0;
      font-size: 13px;
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
      min-height: 46px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    .day-cell:not(.empty):hover {
      background: var(--bg-card);
      color: var(--text-primary);
    }

    .day-cell.empty {
      cursor: default;
    }

    .day-cell.other-month {
      color: var(--text-muted);
      opacity: 0.5;
    }

    .day-num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
    }

    .day-cell.today .day-num {
      background: var(--highlight-today);
      color: white;
      border-radius: 50%;
      font-weight: 600;
    }

    .day-cell.selected .day-num {
      background: var(--highlight-selected);
      color: white;
      border-radius: 50%;
      font-weight: 600;
    }

    .day-cell.today.selected .day-num {
      background: var(--highlight-selected);
      box-shadow: 0 0 0 2px var(--highlight-today);
    }

    .work-label {
      font-size: 9px;
      font-weight: 600;
      color: #5BAD6F;
      line-height: 1;
      letter-spacing: 0.2px;
    }

    .today-btn {
      width: 100%;
      margin-top: 10px;
      padding: 6px;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 12px;
      border-radius: var(--radius-sm);
    }

    .today-btn:hover {
      background: var(--accent-hover);
      color: var(--text-primary);
    }

    .day-cell.in-range {
      background: color-mix(in srgb, var(--highlight-selected) 14%, transparent);
      border-radius: 0;
    }
    .day-cell.range-start,
    .day-cell.range-end {
      background: color-mix(in srgb, var(--highlight-selected) 14%, transparent);
      border-radius: 0;
    }
    .day-cell.range-start { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
    .day-cell.range-end   { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    .day-cell.range-start.range-end { border-radius: var(--radius-sm); }
  `]
})
export class CalendarComponent implements OnInit, OnChanges {
  @Input() selectedDate: Date = new Date();
  @Input() rangeFrom: Date | null = null;
  @Input() rangeTo: Date | null = null;
  @Output() dateSelected = new EventEmitter<Date>();

  dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  calendarDays: CalendarDay[] = [];
  viewYear: number = 0;
  viewMonth: number = 0;
  today: Date = new Date();
  workMinsByDate: Record<string, number> = {};

  constructor(private logService: LogService) {}

  get monthLabel(): string {
    const d = new Date(this.viewYear, this.viewMonth, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  ngOnChanges(): void {
    this.buildCalendar();
  }

  ngOnInit(): void {
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
    const anchor = this.rangeFrom ?? this.selectedDate;
    this.viewYear = anchor.getFullYear();
    this.viewMonth = anchor.getMonth();
    this.buildCalendar();
    this.loadMonthSummary();
  }

  private loadMonthSummary(): void {
    this.logService.getMonthWorkSummary(this.viewYear, this.viewMonth + 1)
      .subscribe(summary => {
        this.workMinsByDate = summary;
        this.buildCalendar();
      });
  }

  buildCalendar(): void {
    const days: CalendarDay[] = [];
    const firstDay = new Date(this.viewYear, this.viewMonth, 1);
    const lastDay = new Date(this.viewYear, this.viewMonth + 1, 0);

    // Day of week: 0=Sun,1=Mon...6=Sat → convert to Mon-first (0=Mon...6=Sun)
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1;

    // Fill leading empty cells
    for (let i = 0; i < startDow; i++) {
      days.push({ date: null, dayNumber: null, isToday: false, isSelected: false, isCurrentMonth: false, workMins: null, isRangeStart: false, isRangeEnd: false, isInRange: false });
    }

    // Pre-compute range boundaries (midnight local)
    const rf = this.rangeFrom ? new Date(this.rangeFrom).setHours(0, 0, 0, 0) : null;
    const rt = this.rangeTo   ? new Date(this.rangeTo).setHours(0, 0, 0, 0)   : null;

    // Fill days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(this.viewYear, this.viewMonth, d);
      date.setHours(0, 0, 0, 0);
      const t = date.getTime();
      const isToday = t === this.today.getTime();
      const selDate = new Date(this.selectedDate);
      selDate.setHours(0, 0, 0, 0);

      const isRangeStart = rf !== null && t === rf;
      const isRangeEnd   = rt !== null && t === rt;
      const isInRange    = rf !== null && rt !== null && t > rf && t < rt;
      const isSelected   = rf !== null
        ? (isRangeStart || isRangeEnd)
        : t === selDate.getTime();

      const dateStr = `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const workMins = this.workMinsByDate[dateStr] ?? null;
      days.push({
        date,
        dayNumber: d,
        isToday,
        isSelected,
        isCurrentMonth: true,
        workMins,
        isRangeStart,
        isRangeEnd,
        isInRange,
      });
    }

    // Fill trailing cells to complete rows
    const remaining = days.length % 7;
    if (remaining !== 0) {
      for (let i = 0; i < 7 - remaining; i++) {
        days.push({ date: null, dayNumber: null, isToday: false, isSelected: false, isCurrentMonth: false, workMins: null, isRangeStart: false, isRangeEnd: false, isInRange: false });
      }
    }

    this.calendarDays = days;
  }

  formatWorkMins(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = mins / 60;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }

  selectDate(date: Date): void {
    this.selectedDate = date;
    this.buildCalendar();
    this.dateSelected.emit(date);
  }

  prevMonth(): void {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
    this.buildCalendar();
    this.loadMonthSummary();
  }

  nextMonth(): void {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
    this.buildCalendar();
    this.loadMonthSummary();
  }

  goToToday(): void {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();
    this.selectDate(now);
    this.loadMonthSummary();
  }

  trackByIndex(index: number): number { return index; }
  trackByDate(_i: number, day: CalendarDay): number { return day.date?.getTime() ?? _i; }
}
