import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TypeOption {
  id: string;
  label: string;
  color: string;
}

export interface TypeChangeEvent {
  id: string;
  category: 'work' | 'personal';
  label: string;
  color: string;
}

interface DropdownPos { top: number; left: number; width: number; }

@Component({
  selector: 'app-type-selector',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ts-root">

      <!-- ── Two pills ─────────────────────────────────── -->
      <div class="ts-pills-row">

        <button #domainPill type="button" class="ts-pill ts-pill--domain"
                [class.ts-pill--open]="openDropdown === 'domain'"
                (click)="toggleDropdown('domain', $event)">
          <span class="ts-domain-dot"
                [class.ts-domain-dot--personal]="category === 'personal'"></span>
          {{ category === 'work' ? 'Work' : 'Personal' }}
          <svg class="ts-chevron" [class.ts-chevron--up]="openDropdown === 'domain'"
               width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <button #typePill type="button" class="ts-pill ts-pill--type"
                [class.ts-pill--open]="openDropdown === 'type'"
                (click)="toggleDropdown('type', $event)">
          <span class="ts-type-dot" [style.background]="selectedColor"></span>
          {{ selectedLabel }}
          <svg class="ts-chevron" [class.ts-chevron--up]="openDropdown === 'type'"
               width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

      </div>

    </div>

    <!-- ── Dropdowns — rendered outside component via fixed position ── -->
    <div *ngIf="openDropdown && dropPos"
         class="ts-dropdown"
         [style.top.px]="dropPos.top"
         [style.left.px]="dropPos.left"
         [style.width.px]="dropPos.width">

      <!-- Domain options -->
      <ng-container *ngIf="openDropdown === 'domain'">
        <button type="button" class="ts-dropdown-item"
                [class.ts-dropdown-item--active]="category === 'work'"
                (click)="selectDomain('work')">
          <span class="ts-domain-dot"></span>Work
        </button>
        <button type="button" class="ts-dropdown-item"
                [class.ts-dropdown-item--active]="category === 'personal'"
                (click)="selectDomain('personal')">
          <span class="ts-domain-dot ts-domain-dot--personal"></span>Personal
        </button>
      </ng-container>

      <!-- Type options -->
      <ng-container *ngIf="openDropdown === 'type'">
        <button type="button" class="ts-dropdown-item"
                *ngFor="let opt of activeTypes; trackBy: trackById"
                [class.ts-dropdown-item--active]="opt.id === selectedId"
                (click)="selectType(opt)">
          <span class="ts-type-dot" [style.background]="opt.color"></span>
          {{ opt.label }}
        </button>
        <p *ngIf="activeTypes.length === 0" class="ts-empty">No types for this domain</p>
      </ng-container>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .ts-root { display: flex; flex-direction: column; }

    /* ── Pills row ──────────────────────────────────────── */
    .ts-pills-row { display: flex; gap: 8px; }

    .ts-pill {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 0 14px; height: 38px; border-radius: 999px;
      border: 1.5px solid var(--border);
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 13px; font-weight: 600;
      cursor: pointer; white-space: nowrap;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .ts-pill:hover {
      border-color: var(--border-light, rgba(128,128,128,0.45));
      color: var(--text-primary);
    }
    .ts-pill--open {
      border-color: var(--highlight-selected);
      color: var(--text-primary);
      background: color-mix(in srgb, var(--highlight-selected) 8%, var(--bg-card));
    }
    .ts-pill--type { flex: 1; }

    /* ── Dots ───────────────────────────────────────────── */
    .ts-domain-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      background: #4a90e2;
    }
    .ts-domain-dot--personal { background: #9b59b6; }

    .ts-type-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }

    /* ── Chevron ────────────────────────────────────────── */
    .ts-chevron {
      margin-left: auto; flex-shrink: 0;
      color: var(--text-muted);
      transition: transform 0.18s ease;
    }
    .ts-chevron--up { transform: rotate(180deg); }

    /* ── Dropdown (fixed overlay) ───────────────────────── */
    .ts-dropdown {
      position: fixed;
      z-index: 500;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.28);
      overflow: hidden;
      max-height: 240px;
      overflow-y: auto;
      animation: tsDropIn 0.14s ease;
    }
    @keyframes tsDropIn {
      from { opacity: 0; transform: translateY(-5px); }
      to   { opacity: 1; transform: none; }
    }

    .ts-dropdown-item {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 11px 16px;
      background: none; border: none;
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 13px; font-weight: 500;
      cursor: pointer; text-align: left;
      transition: background 0.12s, color 0.12s;
      box-sizing: border-box;
    }
    .ts-dropdown-item:last-child { border-bottom: none; }
    .ts-dropdown-item:hover {
      background: color-mix(in srgb, var(--highlight-selected) 8%, transparent);
      color: var(--text-primary);
    }
    .ts-dropdown-item--active {
      color: var(--highlight-selected); font-weight: 700;
      background: color-mix(in srgb, var(--highlight-selected) 10%, transparent);
    }

    .ts-empty {
      font-size: 12px; color: var(--text-muted);
      font-style: italic; margin: 0; padding: 12px 16px;
    }
  `],
})
export class TypeSelectorComponent {
  @Input() workTypes:     TypeOption[] = [];
  @Input() personalTypes: TypeOption[] = [];
  @Input() selectedId  = '';
  @Input() category: 'work' | 'personal' = 'work';

  @Output() typeChange = new EventEmitter<TypeChangeEvent>();

  @ViewChild('domainPill') domainPillRef!: ElementRef<HTMLButtonElement>;
  @ViewChild('typePill')   typePillRef!:   ElementRef<HTMLButtonElement>;

  openDropdown: 'domain' | 'type' | null = null;
  dropPos: DropdownPos | null = null;

  constructor(private elRef: ElementRef, private cd: ChangeDetectorRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target) && this.openDropdown !== null) {
      this.openDropdown = null;
      this.dropPos = null;
      this.cd.markForCheck();
    }
  }

  get activeTypes(): TypeOption[] {
    return this.category === 'work' ? this.workTypes : this.personalTypes;
  }

  get selectedLabel(): string {
    return this.activeTypes.find(t => t.id === this.selectedId)?.label ?? 'Select type';
  }

  get selectedColor(): string {
    return this.activeTypes.find(t => t.id === this.selectedId)?.color ?? 'var(--border)';
  }

  toggleDropdown(which: 'domain' | 'type', event: Event): void {
    event.stopPropagation();

    if (this.openDropdown === which) {
      this.openDropdown = null;
      this.dropPos = null;
    } else {
      const pill = which === 'domain'
        ? this.domainPillRef.nativeElement
        : this.typePillRef.nativeElement;
      const pillRect = pill.getBoundingClientRect();

      // The sheet has transform: translateX(-50%) which makes it the containing
      // block for position:fixed children. Coordinates must be relative to the
      // sheet's top-left corner, not the viewport.
      const sheetEl = this.elRef.nativeElement.closest('.log-now-sheet') as HTMLElement | null;
      const sheetRect = sheetEl ? sheetEl.getBoundingClientRect() : { top: 0, left: 0 };

      this.dropPos = {
        top:   pillRect.bottom - sheetRect.top + 6,
        left:  pillRect.left  - sheetRect.left,
        width: pillRect.width,
      };
      this.openDropdown = which;
    }

    this.cd.markForCheck();
  }

  selectDomain(cat: 'work' | 'personal'): void {
    if (this.category !== cat) {
      this.category = cat;
      const first = this.activeTypes[0];
      if (first) {
        this.selectedId = first.id;
        this.typeChange.emit({ id: first.id, category: cat, label: first.label, color: first.color });
      }
    }
    this.openDropdown = null;
    this.dropPos = null;
    this.cd.markForCheck();
  }

  selectType(opt: TypeOption): void {
    this.selectedId = opt.id;
    this.typeChange.emit({ id: opt.id, category: this.category, label: opt.label, color: opt.color });
    this.openDropdown = null;
    this.dropPos = null;
    this.cd.markForCheck();
  }

  trackById(_i: number, opt: TypeOption): string { return opt.id; }
}
