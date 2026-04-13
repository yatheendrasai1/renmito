import {
  Component, Input, Output, EventEmitter,
  ElementRef, HostListener, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface LogTypeGroup {
  domain: string;
  label:  string;
  color:  string;   // representative color for the group header dot
  types:  any[];
}

const DOMAIN_ORDER  = ['work', 'personal', 'family'] as const;
const DOMAIN_LABELS: Record<string, string> = {
  work:     'Work',
  personal: 'Personal',
  family:   'Family',
};

@Component({
  selector: 'app-log-type-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="lts-root" [class.lts-root--open]="isOpen">

      <!-- ── Trigger button ───────────────────────────── -->
      <button type="button" class="lts-trigger" (click)="toggle($event)">
        <span class="lts-trigger-dot" [style.background]="selectedColor"></span>
        <span class="lts-trigger-label">{{ selectedName || placeholder }}</span>
        <svg class="lts-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- ── Dropdown panel ────────────────────────────── -->
      <div class="lts-panel" *ngIf="isOpen" (click)="$event.stopPropagation()">
        <ng-container *ngFor="let group of groups">
          <!-- Domain header -->
          <div class="lts-group-header">
            <span class="lts-group-dot" [style.background]="group.color"></span>
            <span class="lts-group-label">{{ group.label }}</span>
          </div>
          <!-- Types in this domain -->
          <button
            *ngFor="let lt of group.types"
            type="button"
            class="lts-option"
            [class.lts-option--active]="lt._id === selectedId"
            (click)="select(lt)">
            <span class="lts-option-dot" [style.background]="lt.color"></span>
            <span class="lts-option-name">{{ lt.name }}</span>
            <svg *ngIf="lt._id === selectedId" class="lts-check"
                 width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </ng-container>

        <div *ngIf="groups.length === 0" class="lts-empty">Loading…</div>
      </div>

    </div>
  `,
  styles: [`
    .lts-root {
      position: relative;
      width: 100%;
    }

    /* ── Trigger ──────────────────────────────────────── */
    .lts-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .lts-trigger:hover,
    .lts-root--open .lts-trigger {
      border-color: var(--accent);
    }

    .lts-trigger-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .lts-trigger-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lts-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
      transition: transform 0.15s;
    }
    .lts-root--open .lts-chevron { transform: rotate(180deg); }

    /* ── Panel ────────────────────────────────────────── */
    .lts-panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      z-index: 500;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 24px rgba(0,0,0,0.22);
      max-height: 260px;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 4px 0;
    }

    /* ── Group header ─────────────────────────────────── */
    .lts-group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.9px;
      color: var(--text-muted);
    }
    .lts-group-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      opacity: 0.7;
    }

    /* ── Option row ───────────────────────────────────── */
    .lts-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 12px 8px 20px;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: background 0.12s;
    }
    .lts-option:hover    { background: var(--nav-item-hover); }
    .lts-option--active  { background: color-mix(in srgb, var(--accent) 10%, var(--bg-card)); }

    .lts-option-dot {
      width: 9px; height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .lts-option-name { flex: 1; }
    .lts-check { color: var(--accent); flex-shrink: 0; }

    .lts-empty {
      padding: 12px 16px;
      font-size: 12px;
      color: var(--text-muted);
    }
  `]
})
export class LogTypeSelectComponent {
  @Input()  logTypes:   any[]  = [];
  @Input()  selectedId: string = '';
  @Input()  placeholder        = 'Select type…';
  @Output() selectedIdChange   = new EventEmitter<string>();

  isOpen = false;

  constructor(private elRef: ElementRef) {}

  // ── Derived getters ──────────────────────────────────

  get groups(): LogTypeGroup[] {
    const buckets: Record<string, any[]> = {};
    for (const lt of this.logTypes) {
      const d = lt.domain ?? 'personal';
      (buckets[d] ??= []).push(lt);
    }
    return DOMAIN_ORDER
      .filter(d => buckets[d]?.length)
      .map(d => ({
        domain: d,
        label:  DOMAIN_LABELS[d] ?? d,
        color:  buckets[d][0]?.color ?? '#9B9B9B',
        types:  buckets[d],
      }));
  }

  get selectedType(): any | undefined {
    return this.logTypes.find(lt => lt._id === this.selectedId);
  }
  get selectedName():  string { return this.selectedType?.name  ?? ''; }
  get selectedColor(): string { return this.selectedType?.color ?? '#9B9B9B'; }

  // ── Interaction ──────────────────────────────────────

  toggle(e: Event): void {
    e.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  select(lt: any): void {
    this.selectedId = lt._id;
    this.selectedIdChange.emit(lt._id);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.isOpen && !this.elRef.nativeElement.contains(e.target)) {
      this.isOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.isOpen = false; }
}
