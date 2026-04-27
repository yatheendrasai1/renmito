import {
  Component, Input, Output, EventEmitter,
  OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogType } from '../../models/log-type.model';

const ESSENTIALS: ReadonlyArray<{ name: string }> = [
  { name: 'Breakfast' },
  { name: 'Lunch' },
  { name: 'Dinner' },
  { name: 'Sleep' },
  { name: 'Woke Up' },
];

@Component({
  selector: 'app-daily-essentials-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shortcuts-bar essentials-bar" (click)="$event.stopPropagation()">
      <span class="shortcuts-label">Daily Essentials</span>
      <div class="essential-chip-wrap"
           *ngFor="let e of essentials; trackBy: trackByName"
           (pointerdown)="onPointerDown(e, $event)"
           (pointerup)="onPointerUp()"
           (pointerleave)="onPointerUp()"
           (click)="onClick(e, $event)">
        <button class="shortcut-chip essential-chip"
                [class.essential-chip--pressing]="pressName === e.name"
                style="pointer-events:none; width:100%">
          <span class="shortcut-dot" [style.background]="colorOf(e.name)"></span>
          {{ e.name }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .shortcuts-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }

    .shortcuts-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
      padding-right: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .shortcut-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 20px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .shortcut-chip:hover:not(:disabled) {
      background: var(--nav-item-active);
      border-color: var(--nav-bg);
      color: var(--nav-bg);
    }

    .shortcut-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .essentials-bar { margin-top: 4px; }

    .essential-chip-wrap {
      position: relative;
      flex-shrink: 0;
      touch-action: none;
      user-select: none;
    }
    .essential-chip--pressing {
      outline: 2px solid var(--nav-bg);
      outline-offset: 1px;
      transition: outline 0.1s;
    }
  `],
})
export class DailyEssentialsBarComponent implements OnDestroy {
  @Input() logTypes: LogType[] = [];
  @Output() stampNow = new EventEmitter<string>();
  @Output() openForm = new EventEmitter<string>();

  readonly essentials = ESSENTIALS;
  pressName: string | null = null;
  private pressTriggered = false;
  private pressTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private cd: ChangeDetectorRef) {}

  trackByName(_i: number, item: { name: string }): string { return item.name; }

  colorOf(name: string): string {
    return this.logTypes.find(t => t.name.toLowerCase() === name.toLowerCase())?.color ?? '#888888';
  }

  onPointerDown(e: { name: string }, _event: PointerEvent): void {
    this.pressTriggered = false;
    this.pressName = e.name;
    this.cd.markForCheck();
    this.pressTimer = setTimeout(() => {
      this.pressTriggered = true;
      this.pressName = null;
      this.cd.markForCheck();
      this.stampNow.emit(e.name);
    }, 2000);
  }

  onPointerUp(): void {
    clearTimeout(this.pressTimer);
    this.pressName = null;
    this.cd.markForCheck();
  }

  onClick(e: { name: string }, _event: MouseEvent): void {
    if (this.pressTriggered) { this.pressTriggered = false; return; }
    this.openForm.emit(e.name);
  }

  ngOnDestroy(): void {
    clearTimeout(this.pressTimer);
  }
}
