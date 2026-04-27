import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ColorPalette,
  PALETTE_PRESETS,
  loadSavedPalette,
} from '../theme-editor/theme-editor.component';

@Component({
  selector: 'app-palette-sheet',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qp-backdrop" (click)="closed.emit()"></div>
    <div class="qp-panel" (click)="$event.stopPropagation()">
      <div class="qp-header">
        <span class="qp-title">Theme</span>
        <button class="qp-close" (click)="closed.emit()" aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="qp-section-label">Built-in</div>
      <div class="qp-grid">
        <button class="qp-chip"
                *ngFor="let p of builtinPresets; trackBy: trackByName"
                [class.qp-chip--active]="isActive(p)"
                (click)="paletteSelected.emit(p)"
                [title]="p.name">
          <div class="qp-swatches">
            <div class="qp-swatch" [style.background]="p.bg"></div>
            <div class="qp-swatch" [style.background]="p.primary"></div>
            <div class="qp-swatch" [style.background]="p.secondary"></div>
            <div class="qp-swatch" [style.background]="p.accent"></div>
          </div>
          <span class="qp-name">{{ p.name }}</span>
        </button>
      </div>

      <ng-container *ngIf="customPresets.length > 0">
        <div class="qp-section-label">My Presets</div>
        <div class="qp-grid">
          <button class="qp-chip"
                  *ngFor="let p of customPresets; trackBy: trackByName"
                  [class.qp-chip--active]="isActive(p)"
                  (click)="paletteSelected.emit(p)"
                  [title]="p.name">
            <div class="qp-swatches">
              <div class="qp-swatch" [style.background]="p.bg"></div>
              <div class="qp-swatch" [style.background]="p.primary"></div>
              <div class="qp-swatch" [style.background]="p.secondary"></div>
              <div class="qp-swatch" [style.background]="p.accent"></div>
            </div>
            <span class="qp-name">{{ p.name }}</span>
          </button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .qp-backdrop {
      position: fixed; inset: 0; z-index: 490;
    }
    .qp-panel {
      position: fixed;
      bottom: 80px;
      left: 12px;
      width: 260px;
      background: #1E1E2E;
      border: 1px solid #3A3A55;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.55);
      z-index: 495;
      color: #E0E4F0;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13px;
      padding: 0 0 10px;
      animation: qpIn 0.18s ease;
    }
    @keyframes qpIn {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .qp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px 10px;
      border-bottom: 1px solid #2E2E45;
    }
    .qp-title { font-size: 12px; font-weight: 700; color: #C8D0E8; letter-spacing: 0.3px; }
    .qp-close {
      width: 24px; height: 24px; border-radius: 5px;
      background: rgba(255,255,255,0.06); border: none;
      color: #8090A8; display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.12s;
    }
    .qp-close:hover { background: rgba(255,255,255,0.14); color: #E0E4F0; }
    .qp-section-label {
      font-size: 9px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase;
      color: #5A6A88; padding: 10px 14px 6px;
    }
    .qp-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; padding: 0 10px;
    }
    .qp-chip {
      background: #252535; border: 1.5px solid #2E2E45;
      border-radius: 7px; padding: 7px 8px;
      cursor: pointer; display: flex; flex-direction: column; gap: 5px;
      text-align: left; transition: border-color 0.15s, background 0.15s;
    }
    .qp-chip:hover { border-color: #5A6A88; background: #2C2C42; }
    .qp-chip--active { border-color: #7A8AC8 !important; background: #2C2C48 !important; }
    .qp-swatches { display: flex; gap: 3px; }
    .qp-swatch {
      width: 14px; height: 14px; border-radius: 3px;
      border: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
    }
    .qp-name { font-size: 10px; font-weight: 600; color: #8090A8; line-height: 1; }
    .qp-chip--active .qp-name { color: #C0CFEF; }
  `],
})
export class PaletteSheetComponent {
  @Input() customPresets: ColorPalette[] = [];
  @Output() paletteSelected = new EventEmitter<ColorPalette>();
  @Output() closed = new EventEmitter<void>();

  readonly builtinPresets = PALETTE_PRESETS;

  trackByName(_i: number, item: ColorPalette): string { return item.name; }

  isActive(p: ColorPalette): boolean {
    const active = loadSavedPalette();
    return !!active &&
      active.bg        === p.bg        &&
      active.primary   === p.primary   &&
      active.secondary === p.secondary &&
      active.accent    === p.accent;
  }
}
