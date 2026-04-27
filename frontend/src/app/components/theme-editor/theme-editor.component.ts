import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PreferenceService } from '../../services/preference.service';

// ─────────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────────
export interface ColorPalette {
  name:      string;
  bg:        string; // body / surfaces
  primary:   string; // nav sidebar
  secondary: string; // header + timeline bar
  accent:    string; // CTA, highlights, drag
}

// ─────────────────────────────────────────────────────────────
//  Built-in presets
// ─────────────────────────────────────────────────────────────
export const PALETTE_PRESETS: ColorPalette[] = [
  { name: 'Renmito Dark', bg: '#121320', primary: '#982598', secondary: '#15173D', accent: '#E94F37' },
  { name: 'Warm Earth',   bg: '#F4F0E4', primary: '#44A194', secondary: '#537D96', accent: '#EC8F8D' },
  { name: 'Ocean Depth',  bg: '#0C1A2E', primary: '#1A6E8A', secondary: '#0A3D5C', accent: '#E9C46A' },
  { name: 'Forest',       bg: '#1A2F1A', primary: '#2D7A5A', secondary: '#1B4332', accent: '#95D5B2' },
  { name: 'Rose Quartz',  bg: '#FFF0F3', primary: '#9B59B6', secondary: '#6C3483', accent: '#FF6B9D' },
];

const PALETTE_STORAGE_KEY = 'renmito-palette';

// ─────────────────────────────────────────────────────────────
//  CSS variables that get set by the palette
// ─────────────────────────────────────────────────────────────
const MANAGED_VARS = [
  '--header-bg', '--header-text', '--header-icon-bg', '--header-icon-hover',
  '--nav-bg', '--nav-text', '--nav-text-muted',
  '--nav-item-hover', '--nav-item-active', '--nav-item-active-border',
  '--bg-primary', '--bg-surface', '--bg-card', '--accent', '--accent-bright',
  '--accent-hover', '--text-primary', '--text-secondary', '--text-muted',
  '--border', '--border-light', '--highlight-today', '--highlight-selected',
  '--timeline-bg', '--timeline-line', '--timeline-text', '--timeline-text-muted',
  '--drag-overlay', '--shadow',
];

// ─────────────────────────────────────────────────────────────
//  Pure colour utilities  (no external dependencies)
// ─────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [
    parseInt(f.slice(0, 2), 16),
    parseInt(f.slice(2, 4), 16),
    parseInt(f.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function getLuminance(hex: string): number {
  return hexToRgb(hex).reduce((lum, v, i) => {
    const c = v / 255;
    const lin = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return lum + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function isLight(hex: string): boolean { return getLuminance(hex) > 0.35; }

function contrastText(hex: string): string { return isLight(hex) ? '#1A1C2A' : '#F1E9E9'; }

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─────────────────────────────────────────────────────────────
//  Public helpers — consumed by AppComponent.ngOnInit too
// ─────────────────────────────────────────────────────────────
export function applyPaletteToDOM(p: ColorPalette): void {
  const root = document.documentElement;
  const set  = (v: string, val: string) => root.style.setProperty(v, val);

  // ── Background → surfaces / text / borders ────────────────
  const lightBg   = isLight(p.bg);
  const bgSurface = lightBg ? lighten(p.bg, 0.6)  : darken(p.bg, 0.18);
  const bgCard    = lightBg ? darken(p.bg, 0.05)  : darken(p.bg, 0.25);
  const accentHov = lightBg ? darken(p.bg, 0.10)  : lighten(p.bg, 0.08);
  const border    = lightBg ? darken(p.bg, 0.22)  : lighten(p.bg, 0.12);
  const borderLt  = lightBg ? darken(p.bg, 0.14)  : lighten(p.bg, 0.07);

  set('--bg-primary',   p.bg);
  set('--bg-surface',   bgSurface);
  set('--bg-card',      bgCard);
  set('--accent',       bgCard);
  set('--accent-hover', accentHov);
  set('--border',       border);
  set('--border-light', borderLt);
  set('--shadow', lightBg
    ? '0 4px 20px rgba(0,0,0,0.08)'
    : '0 4px 20px rgba(0,0,0,0.45)');

  if (lightBg) {
    set('--text-primary',   '#1A1C2A');
    set('--text-secondary', '#3A4060');
    set('--text-muted',     '#6A7290');
  } else {
    set('--text-primary',   '#E0E4F0');
    set('--text-secondary', '#8090A8');
    set('--text-muted',     '#4A5878');
  }

  // ── Primary → nav sidebar ─────────────────────────────────
  const primText = contrastText(p.primary);
  const navBase  = isLight(p.primary) ? '0,0,0' : '255,255,255';

  set('--nav-bg',                 p.primary);
  set('--nav-text',               primText);
  set('--nav-text-muted',         rgba(primText, 0.55));
  set('--nav-item-hover',         `rgba(${navBase},0.12)`);
  set('--nav-item-active',        `rgba(${navBase},0.18)`);
  set('--nav-item-active-border', primText);
  set('--highlight-selected',     p.primary);

  // ── Secondary → header & timeline ─────────────────────────
  const secText = contrastText(p.secondary);
  const secRgb  = isLight(p.secondary) ? '0,0,0' : '241,233,233';
  const tlLine  = isLight(p.secondary) ? darken(p.secondary, 0.25) : lighten(p.secondary, 0.15);

  set('--header-bg',           p.secondary);
  set('--header-text',         secText);
  set('--header-icon-bg',      `rgba(${secRgb},0.13)`);
  set('--header-icon-hover',   `rgba(${secRgb},0.24)`);
  set('--timeline-bg',         p.secondary);
  set('--timeline-line',       tlLine);
  set('--timeline-text',       secText);
  set('--timeline-text-muted', rgba(secText, 0.4));

  // ── Accent → CTA / drag / highlights ──────────────────────
  set('--accent-bright',   p.accent);
  set('--highlight-today', p.accent);
  set('--drag-overlay',    rgba(p.accent, 0.35));
}

export function clearPaletteFromDOM(): void {
  MANAGED_VARS.forEach(v => document.documentElement.style.removeProperty(v));
  localStorage.removeItem(PALETTE_STORAGE_KEY);
}

export function loadSavedPalette(): ColorPalette | null {
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ColorPalette) : null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-theme-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Floating panel or inline block depending on [inline] input -->
    <div [class.te-panel]="!inline" [class.te-inline]="inline" role="dialog" aria-label="Color palette editor">

      <!-- ── Header ─── -->
      <div class="te-header">
        <div class="te-title-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13.5" cy="6.5" r="2.5"/>
            <circle cx="19"   cy="13"  r="2.5"/>
            <circle cx="6"    cy="13"  r="2.5"/>
            <circle cx="10"   cy="19"  r="2.5"/>
            <path d="M13.5 9v1M19 15.5v1M6 15.5v1M10 21v1"/>
          </svg>
          <span class="te-title">Color Palette</span>
        </div>
        <button class="te-close-btn" (click)="close.emit()" aria-label="Close palette editor">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6"  y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- ── Built-in presets ─── -->
      <div class="te-section">
        <div class="te-section-label">Built-in Presets</div>
        <div class="te-presets">
          <button
            *ngFor="let p of builtinPresets; trackBy: trackByName"
            class="te-preset-chip"
            [class.te-preset-chip--active]="isActivePreset(p)"
            (click)="selectPreset(p)"
            [title]="p.name"
          >
            <div class="te-swatch-row">
              <div class="te-swatch" [style.background]="p.bg"        title="Background"></div>
              <div class="te-swatch" [style.background]="p.primary"   title="Navigation"></div>
              <div class="te-swatch" [style.background]="p.secondary" title="Header/Timeline"></div>
              <div class="te-swatch" [style.background]="p.accent"    title="Accent"></div>
            </div>
            <span class="te-preset-name">{{ p.name }}</span>
          </button>
        </div>
      </div>

      <!-- ── My Presets ─── -->
      <div class="te-section" *ngIf="customPresets.length > 0">
        <div class="te-section-label">
          My Presets
          <span class="te-preset-count">{{ customPresets.length }}/10</span>
        </div>
        <div class="te-presets">
          <div
            *ngFor="let p of customPresets; trackBy: trackByName"
            class="te-preset-chip te-preset-chip--custom"
            [class.te-preset-chip--active]="isActivePreset(p)"
          >
            <!-- click the swatch area to apply -->
            <div class="te-preset-apply" (click)="selectPreset(p)" [title]="'Apply ' + p.name">
              <div class="te-swatch-row">
                <div class="te-swatch" [style.background]="p.bg"        title="Background"></div>
                <div class="te-swatch" [style.background]="p.primary"   title="Navigation"></div>
                <div class="te-swatch" [style.background]="p.secondary" title="Header/Timeline"></div>
                <div class="te-swatch" [style.background]="p.accent"    title="Accent"></div>
              </div>
              <span class="te-preset-name">{{ p.name }}</span>
            </div>
            <!-- delete button -->
            <button class="te-preset-delete" (click)="deletePreset(p)" [title]="'Delete ' + p.name"
                    aria-label="Delete preset">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Custom pickers ─── -->
      <div class="te-section">
        <div class="te-section-label">Customize</div>
        <div class="te-pickers">
          <div class="te-picker-row" *ngFor="let cfg of pickerConfigs; trackBy: trackByLabel">
            <label class="te-picker-label">{{ cfg.label }}</label>
            <div class="te-picker-wrap">
              <div class="te-color-preview" [style.background]="currentPalette[cfg.key]"></div>
              <input
                type="color"
                class="te-color-input"
                [ngModel]="currentPalette[cfg.key]"
                (ngModelChange)="onColorChange(cfg.key, $event)"
              >
              <span class="te-hex-val">{{ currentPalette[cfg.key] | uppercase }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Save-as-preset prompt (inline) ─── -->
      <div class="te-section te-name-prompt" *ngIf="showNamePrompt">
        <div class="te-section-label">Name your preset</div>
        <div class="te-name-row">
          <input
            class="te-name-input"
            type="text"
            [(ngModel)]="pendingName"
            placeholder="e.g. My Ocean Blue"
            maxlength="32"
            (keydown.enter)="confirmSavePreset()"
            (keydown.escape)="cancelNamePrompt()"
            #nameInput
          >
          <button class="te-name-confirm" (click)="confirmSavePreset()"
                  [disabled]="!pendingName.trim()">Save</button>
          <button class="te-name-cancel"  (click)="cancelNamePrompt()">✕</button>
        </div>
        <span class="te-name-error" *ngIf="nameError">{{ nameError }}</span>
      </div>

      <!-- ── Footer ─── -->
      <div class="te-footer">
        <button class="te-reset-btn" (click)="reset()">Reset</button>
        <div class="te-footer-right">
          <span class="te-saved-badge" *ngIf="justSaved">{{ savedMsg }}</span>
          <button class="te-save-btn" (click)="saveToProfile()"
                  [title]="'Apply & save as active theme'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Apply
          </button>
          <button class="te-preset-save-btn" (click)="openNamePrompt()"
                  [disabled]="customPresets.length >= 10"
                  [title]="customPresets.length >= 10 ? 'Maximum 10 presets reached' : 'Save as a named preset'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5"  y1="12" x2="19" y2="12"/>
            </svg>
            Save as Preset
          </button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ── Panel shell — fixed colours so it's always readable ── */
    .te-panel {
      position: fixed;
      top: 68px;
      right: 16px;
      width: 340px;
      max-height: calc(100vh - 88px);
      max-height: calc(100dvh - 88px);
      overflow-y: auto;
      background: #1E1E2E;
      border: 1px solid #3A3A55;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      z-index: 500;
      color: #E0E4F0;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13px;
      animation: teSlideIn 0.2s ease;
    }

    /* Inline mode — embedded inside a page section, not floating */
    .te-inline {
      display: block;
      width: 100%;
      background: #1E1E2E;
      border-radius: 10px;
      color: #E0E4F0;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13px;
    }
    .te-inline .te-header { border-radius: 10px 10px 0 0; }
    .te-inline .te-close-btn { display: none; }
    @keyframes teSlideIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Header ── */
    .te-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      border-bottom: 1px solid #2E2E45;
    }
    .te-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #C8D0E8;
    }
    .te-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.3px;
      color: #E0E4F0;
    }
    .te-close-btn {
      width: 28px; height: 28px;
      background: rgba(255,255,255,0.06);
      border-radius: 6px;
      border: none;
      color: #8090A8;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .te-close-btn:hover { background: rgba(255,255,255,0.14); color: #E0E4F0; }

    /* ── Sections ── */
    .te-section { padding: 14px 16px; }
    .te-section + .te-section { border-top: 1px solid #2E2E45; }

    .te-section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.1px;
      text-transform: uppercase;
      color: #5A6A88;
      margin-bottom: 10px;
    }

    /* ── Preset chips ── */
    .te-presets {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .te-preset-chip {
      background: #252535;
      border: 1.5px solid #2E2E45;
      border-radius: 8px;
      padding: 8px 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
      transition: border-color 0.15s, background 0.15s;
    }
    .te-preset-chip:hover { border-color: #5A6A88; background: #2C2C42; }
    .te-preset-chip--active {
      border-color: #7A8AC8 !important;
      background: #2C2C48 !important;
    }
    .te-swatch-row {
      display: flex;
      gap: 4px;
    }
    .te-swatch {
      width: 18px; height: 18px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .te-preset-name {
      font-size: 11px;
      font-weight: 600;
      color: #8090A8;
      line-height: 1;
    }
    .te-preset-chip--active .te-preset-name { color: #C0CFEF; }

    /* ── Color pickers ── */
    .te-pickers { display: flex; flex-direction: column; gap: 10px; }

    .te-picker-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .te-picker-label {
      font-size: 12px;
      font-weight: 500;
      color: #8090A8;
      flex: 1;
      white-space: nowrap;
    }
    .te-picker-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .te-color-preview {
      width: 28px; height: 28px;
      border-radius: 6px;
      border: 1.5px solid rgba(255,255,255,0.15);
      flex-shrink: 0;
    }
    .te-color-input {
      width: 28px; height: 28px;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      opacity: 0;
      position: absolute;
      /* overlay on top of te-color-preview via the wrapper */
    }
    /* Make the picker wrap position:relative so the invisible input overlays the preview */
    .te-picker-wrap { position: relative; }
    .te-color-input {
      position: absolute;
      left: 0; top: 0;
      width: 28px; height: 28px;
      opacity: 0;
      cursor: pointer;
    }
    .te-hex-val {
      font-size: 11px;
      font-weight: 600;
      color: #6A7A98;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.5px;
      min-width: 60px;
    }

    /* ── Custom preset chips have a delete button ── */
    .te-preset-chip--custom {
      flex-direction: row;
      align-items: center;
      gap: 0;
      padding: 0;
      overflow: hidden;
    }
    .te-preset-apply {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 8px 8px 10px;
      cursor: pointer;
      min-width: 0;
    }
    .te-preset-delete {
      flex-shrink: 0;
      width: 28px;
      height: 100%;
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,100,100,0.08);
      border: none;
      border-left: 1px solid #2E2E45;
      color: #C08080;
      cursor: pointer;
      border-radius: 0 8px 8px 0;
      transition: background 0.15s, color 0.15s;
    }
    .te-preset-delete:hover { background: rgba(255,80,80,0.22); color: #FF8080; }

    /* Preset count badge */
    .te-preset-count {
      float: right;
      font-size: 10px;
      font-weight: 600;
      color: #5A6A88;
      background: #252535;
      padding: 1px 7px;
      border-radius: 8px;
    }

    /* ── Save-as-preset inline prompt ── */
    .te-name-prompt { background: #252538; border-top: 1px solid #2E2E45; }
    .te-name-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .te-name-input {
      flex: 1;
      background: #1A1A2E;
      border: 1px solid #3A3A55;
      border-radius: 6px;
      color: #E0E4F0;
      font-size: 12px;
      padding: 6px 10px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s;
    }
    .te-name-input:focus { border-color: #5A7AE8; }
    .te-name-input::placeholder { color: #4A5A78; }
    .te-name-confirm {
      background: #4A7AE8;
      border: none;
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, opacity 0.15s;
    }
    .te-name-confirm:hover:not(:disabled) { background: #3A6ADA; }
    .te-name-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
    .te-name-cancel {
      background: rgba(255,255,255,0.06);
      border: 1px solid #3A3A55;
      border-radius: 6px;
      color: #8090A8;
      font-size: 12px;
      padding: 6px 10px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .te-name-cancel:hover { background: rgba(255,255,255,0.12); }
    .te-name-error {
      display: block;
      margin-top: 6px;
      font-size: 11px;
      color: #FF8080;
    }

    /* ── Footer ── */
    .te-footer {
      padding: 12px 16px;
      border-top: 1px solid #2E2E45;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .te-footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .te-reset-btn {
      background: rgba(255,255,255,0.06);
      border: 1px solid #3A3A55;
      border-radius: 6px;
      color: #8090A8;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .te-reset-btn:hover { background: rgba(255,255,255,0.12); color: #C0CFEF; }

    .te-save-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: #3A8A5A;
      border: none;
      border-radius: 6px;
      color: #fff;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, opacity 0.15s;
    }
    .te-save-btn:hover { background: #2A7A4A; }

    .te-preset-save-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: #4A7AE8;
      border: none;
      border-radius: 6px;
      color: #fff;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, opacity 0.15s;
    }
    .te-preset-save-btn:hover:not(:disabled) { background: #3A6ADA; }
    .te-preset-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .te-saved-badge {
      font-size: 11px;
      font-weight: 600;
      color: #6BCC9A;
      white-space: nowrap;
      animation: badgeFade 2s ease forwards;
    }
    @keyframes badgeFade {
      0%   { opacity: 1; }
      65%  { opacity: 1; }
      100% { opacity: 0; }
    }

    /* ── Scrollbar inside panel ── */
    .te-panel::-webkit-scrollbar       { width: 4px; }
    .te-panel::-webkit-scrollbar-track { background: transparent; }
    .te-panel::-webkit-scrollbar-thumb { background: #3A3A55; border-radius: 2px; }
  `]
})
export class ThemeEditorComponent implements OnInit, OnDestroy {
  @Input()  isOpen = false;
  @Input()  inline = false;
  @Output() close  = new EventEmitter<void>();

  readonly builtinPresets = PALETTE_PRESETS;
  customPresets: ColorPalette[] = [];

  currentPalette: ColorPalette = { ...PALETTE_PRESETS[0] };

  // Save-as-preset inline prompt state
  showNamePrompt = false;
  pendingName    = '';
  nameError      = '';

  justSaved = false;
  savedMsg  = 'Saved ✓';
  private readonly destroy$ = new Subject<void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  pickerConfigs: { label: string; key: keyof ColorPalette }[] = [
    { label: 'Background',          key: 'bg'        },
    { label: 'Navigation',          key: 'primary'   },
    { label: 'Header / Timeline',   key: 'secondary' },
    { label: 'Accent / Highlights', key: 'accent'    },
  ];

  constructor(private prefService: PreferenceService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.saveTimer) clearTimeout(this.saveTimer);
  }

  ngOnInit(): void {
    // Populate pickers from localStorage instantly
    const saved = loadSavedPalette();
    if (saved) { this.currentPalette = { ...saved }; }

    // Load custom presets from DB
    this.prefService.getPreferences().pipe(takeUntil(this.destroy$)).subscribe(prefs => {
      if (prefs?.customPresets) {
        this.customPresets = prefs.customPresets;
      }
    });
  }

  /** Preset / custom preset click — live preview only, no persistence. */
  selectPreset(p: ColorPalette): void {
    this.currentPalette = { ...p };
    applyPaletteToDOM(this.currentPalette);
  }

  /** Color-picker change — live preview only, no persistence. */
  onColorChange(key: keyof ColorPalette, value: string): void {
    (this.currentPalette as unknown as Record<string, string>)[key] = value;
    applyPaletteToDOM(this.currentPalette);
  }

  isActivePreset(p: ColorPalette): boolean {
    return (
      p.bg        === this.currentPalette.bg        &&
      p.primary   === this.currentPalette.primary   &&
      p.secondary === this.currentPalette.secondary &&
      p.accent    === this.currentPalette.accent
    );
  }

  /** Apply: writes active palette to localStorage + DB (no preset saved). */
  saveToProfile(): void {
    applyPaletteToDOM(this.currentPalette);
    localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(this.currentPalette));
    this.prefService.savePalette(this.currentPalette).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => this.flashSaved('Applied ✓'),
      error: () => this.flashSaved('Applied ✓'),
    });
  }

  /** Open the inline name-prompt to save as a named preset. */
  openNamePrompt(): void {
    if (this.customPresets.length >= 10) return;
    this.pendingName   = this.currentPalette.name !== 'Custom' ? this.currentPalette.name : '';
    this.nameError     = '';
    this.showNamePrompt = true;
  }

  cancelNamePrompt(): void {
    this.showNamePrompt = false;
    this.pendingName    = '';
    this.nameError      = '';
  }

  confirmSavePreset(): void {
    const name = this.pendingName.trim();
    if (!name) { this.nameError = 'Please enter a name.'; return; }
    if (this.customPresets.length >= 10) {
      this.nameError = 'Maximum 10 presets reached. Delete one first.';
      return;
    }

    const preset: ColorPalette = { ...this.currentPalette, name };
    this.prefService.addPreset(preset).pipe(takeUntil(this.destroy$)).subscribe({
      next: presets => {
        if (presets) {
          this.customPresets = presets;
          this.cancelNamePrompt();
          this.flashSaved('Preset saved ✓');
        }
      },
      error: () => { this.nameError = 'Failed to save. Please try again.'; }
    });
  }

  deletePreset(p: ColorPalette): void {
    this.prefService.deletePreset(p.name).pipe(takeUntil(this.destroy$)).subscribe(presets => {
      if (presets !== null) { this.customPresets = presets; }
    });
  }

  /** Reset: reverts to default dark preset, clears localStorage + DB. */
  reset(): void {
    this.currentPalette = { ...PALETTE_PRESETS[0] };
    applyPaletteToDOM(this.currentPalette);
    clearPaletteFromDOM();
    this.prefService.deletePalette().pipe(takeUntil(this.destroy$)).subscribe();
    this.flashSaved('Reset ✓');
  }

  private flashSaved(msg = 'Saved ✓'): void {
    this.savedMsg  = msg;
    this.justSaved = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => (this.justSaved = false), 2000);
  }

  trackByName(_i: number, p: ColorPalette): string { return p.name; }
  trackByLabel(_i: number, cfg: { label: string }): string { return cfg.label; }
}
