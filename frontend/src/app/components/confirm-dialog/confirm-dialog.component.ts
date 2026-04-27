import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="confirm-overlay" *ngIf="visible" (click)="onOverlayClick($event)">
      <div class="confirm-panel">
        <h3 class="confirm-title">{{ title }}</h3>
        <p class="confirm-body" *ngIf="message">{{ message }}</p>
        <div class="confirm-detail" *ngIf="detail">{{ detail }}</div>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn--cancel" (click)="onCancel()">Cancel</button>
          <button class="confirm-btn confirm-btn--ok" (click)="onConfirm()">{{ okLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3000;
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .confirm-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      padding: 24px 24px 20px;
      width: 360px;
      max-width: 92vw;
      box-shadow: var(--shadow);
      animation: slideUp 0.18s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .confirm-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 10px;
    }

    .confirm-body {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 6px;
    }

    .confirm-detail {
      font-size: 12px;
      color: var(--highlight-selected);
      font-weight: 600;
      background: rgba(74, 144, 226, 0.08);
      border: 1px solid rgba(74, 144, 226, 0.2);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      margin-bottom: 10px;
      letter-spacing: 0.2px;
    }

    .confirm-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 18px;
    }

    .confirm-btn {
      padding: 7px 18px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .confirm-btn:hover { opacity: 0.82; }

    .confirm-btn--cancel {
      background: var(--bg-card);
      color: var(--text-secondary);
      border: 1px solid var(--border-light);
    }
    .confirm-btn--cancel:hover { background: var(--accent-hover); color: var(--text-primary); }

    .confirm-btn--ok {
      background: var(--accent-bright);
      color: #fff;
      border: none;
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() visible  = false;
  @Input() title    = 'Confirm';
  @Input() message  = '';
  /** Optional highlighted detail line (e.g. time range for merge). */
  @Input() detail   = '';
  @Input() okLabel  = 'Confirm';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void { this.confirmed.emit(); }
  onCancel():  void { this.cancelled.emit(); }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('confirm-overlay')) {
      this.cancelled.emit();
    }
  }
}
