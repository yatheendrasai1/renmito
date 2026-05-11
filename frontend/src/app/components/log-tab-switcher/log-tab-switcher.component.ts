import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

const TABS = ['Add log', 'Add point', 'Start timer'] as const;
type TabLabel = typeof TABS[number];

@Component({
  selector: 'app-log-tab-switcher',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lts-root">

      <!-- Top bar: Back / title -->
      <div class="lts-topbar">
        <button type="button" class="lts-back" (click)="backClick.emit()">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back
        </button>
        <span class="lts-date-label">{{ dateLabel }}</span>
      </div>

      <!-- Sliding pill tab track -->
      <div class="lts-track">
        <div class="lts-indicator"
             [style.transform]="'translateX(' + ((activeTab - 1) * 100) + '%)'">
        </div>
        <button type="button" class="lts-tab"
                *ngFor="let tab of tabs; let i = index; trackBy: trackByIndex"
                [class.lts-tab--active]="activeTab === i + 1"
                (click)="selectTab(i)">
          {{ tab }}
        </button>
      </div>

    </div>
  `,
  styles: [`
    .lts-root {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* ── Top bar ────────────────────────────────────────── */
    .lts-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .lts-back {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      padding: 8px 4px;
      border-radius: 999px;
      min-height: 44px;
      transition: color 0.15s;
    }
    .lts-back:hover { color: var(--text-primary); }

    .lts-date-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: 0.2px;
    }

    /* ── Sliding tab track ──────────────────────────────── */
    .lts-track {
      position: relative;
      display: flex;
      background: var(--bg-card);
      border-radius: 999px;
      padding: 3px;
      min-height: 44px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Sliding pill indicator — translateX(N*100%) lands on the Nth tab
       because indicator width = (trackWidth - 6px) / 3 = one tab width */
    .lts-indicator {
      position: absolute;
      top: 3px;
      bottom: 3px;
      left: 3px;
      width: calc((100% - 6px) / 3);
      background: var(--nav-bg, #1a1a1a);
      border-radius: 999px;
      transition: transform 0.24s cubic-bezier(0.34, 1.2, 0.64, 1);
      pointer-events: none;
      will-change: transform;
    }

    .lts-tab {
      flex: 1;
      position: relative;
      z-index: 1;
      border: none;
      background: none;
      font-size: 12.5px;
      font-weight: 400;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: 999px;
      padding: 0 4px;
      min-height: 38px;
      transition: color 0.2s;
      white-space: nowrap;
    }
    .lts-tab--active {
      color: var(--nav-text, #fff);
      font-weight: 600;
    }
  `],
})
export class LogTabSwitcherComponent {
  @Input() activeTab: 1 | 2 | 3 = 1;
  @Input() dateLabel = '';

  @Output() tabChange = new EventEmitter<string>();
  @Output() backClick = new EventEmitter<void>();

  readonly tabs: readonly TabLabel[] = TABS;

  selectTab(index: number): void {
    this.tabChange.emit(this.tabs[index]);
  }

  trackByIndex(i: number): number { return i; }
}
