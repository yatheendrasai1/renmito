import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActiveLog } from '../../services/preference.service';
import { LogType } from '../../models/log-type.model';

@Component({
  selector: 'app-active-log-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="running-log-banner" *ngIf="activeLog">
      <div class="running-log-left" (click)="editTimer.emit()" title="Edit timer details">
        <span class="running-log-dot"
              [style.background]="typeColor"
              [class.running-log-dot--pulse]="true"></span>
        <div class="running-log-info">
          <span class="running-log-name">{{ activeLog.title || typeName }}</span>
          <span class="running-log-sub">{{ typeName }}</span>
        </div>
        <svg class="running-log-edit-icon" width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="running-log-center">
        <span class="running-log-clock">{{ elapsedStr }}</span>
        <div class="running-log-progress" *ngIf="activeLog.plannedMins">
          <div class="running-log-progress-fill"
               [style.width.%]="plannedPct"
               [class.running-log-progress-fill--done]="plannedPct >= 100"></div>
        </div>
        <span class="running-log-planned" *ngIf="activeLog.plannedMins">
          {{ plannedPct >= 100 ? '✓ Done' : 'of ' + activeLog.plannedMins + 'm planned' }}
        </span>
      </div>
      <button class="running-log-stop-btn" (click)="stop.emit()" title="Stop and save log">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="2" width="10" height="10" rx="2"/>
        </svg>
        Stop
      </button>
    </div>
  `,
  styles: [`
    .running-log-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: color-mix(in srgb, var(--accent) 8%, var(--bg-surface));
      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius);
      animation: toastSlideUp 0.25s ease;
    }

    .running-log-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
      cursor: pointer;
      border-radius: var(--radius-sm);
      padding: 2px 4px 2px 0;
      transition: background 0.15s;
    }
    .running-log-left:hover { background: rgba(255,255,255,0.06); }

    .running-log-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .running-log-dot--pulse {
      animation: runningPulse 1.6s ease-in-out infinite;
    }
    @keyframes runningPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.45; transform: scale(1.4); }
    }

    .running-log-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .running-log-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .running-log-sub {
      font-size: 11px;
      color: var(--text-muted);
    }

    .running-log-edit-icon {
      color: var(--text-muted); opacity: 0; flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .running-log-left:hover .running-log-edit-icon { opacity: 0.7; }

    .running-log-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .running-log-clock {
      font-size: 20px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
      letter-spacing: 0.5px;
      line-height: 1;
    }
    .running-log-planned {
      font-size: 10px;
      color: var(--text-muted);
    }

    .running-log-progress {
      width: 80px;
      height: 4px;
      background: var(--border-light);
      border-radius: 2px;
      overflow: hidden;
    }
    .running-log-progress-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 1s linear;
    }
    .running-log-progress-fill--done { background: #5BAD6F; }

    .running-log-stop-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 14px;
      background: #e05c5c;
      border: none;
      border-radius: 14px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .running-log-stop-btn:hover { opacity: 0.85; }

    @keyframes toastSlideUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class ActiveLogBarComponent {
  @Input() activeLog: ActiveLog | null = null;
  @Input() logTypes: LogType[] = [];
  @Input() elapsedStr = '';
  @Input() plannedPct = 0;
  @Output() editTimer = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();

  get typeName(): string {
    if (!this.activeLog) return '';
    return this.logTypes.find(t => t._id === this.activeLog!.logTypeId)?.name ?? 'Running Log';
  }

  get typeColor(): string {
    if (!this.activeLog) return '#9B9B9B';
    return this.logTypes.find(t => t._id === this.activeLog!.logTypeId)?.color ?? '#9B9B9B';
  }
}
