import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, OnDestroy, SimpleChanges, HostListener,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface Enhancement {
  id: string;
  version: string;
  type: 'feature' | 'minor' | 'major' | 'trivial' | 'internal';
  title: string;
  description: string;
  status: 'implemented' | 'in-progress' | 'planned';
  implementedAt: string;
  tags: string[];
  priority: string | null;
  relatedTo: string[];
  requestedBy: string;
  breaking: boolean;
  timeSpentMins: number | null;
  pullRequest: string | null;
  branch: string | null;
  screenshot: string | null;
  changelog: string;
  notes: string;
}

@Component({
  selector: 'app-enhancements-drawer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div
      class="drawer-backdrop"
      [class.drawer-backdrop--visible]="isOpen"
      (click)="close.emit()"
    ></div>

    <!-- Drawer panel -->
    <aside class="drawer" [class.drawer--open]="isOpen" role="complementary" aria-label="Enhancement log">

      <!-- Header -->
      <div class="drawer-header">
        <div class="drawer-header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="16" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="drawer-title">Enhancement Log</span>
        </div>
        <div class="drawer-header-right">
          <span class="drawer-count" *ngIf="enhancements.length">{{ enhancements.length }} total</span>
          <button class="drawer-close-btn" (click)="close.emit()" aria-label="Close enhancement log">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div class="drawer-loading" *ngIf="isLoading">
        <span class="spinner"></span>
        Loading enhancement log…
      </div>

      <!-- Error -->
      <div class="drawer-error" *ngIf="loadError">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Could not load enhancements.json
      </div>

      <!-- Enhancement list -->
      <div class="drawer-body" *ngIf="!isLoading && !loadError">
        <div class="drawer-card" *ngFor="let e of enhancements; let last = last; trackBy: trackById">

          <!-- Card top row -->
          <div class="card-top">
            <div class="card-badges">
              <span class="badge badge-version">v{{ e.version }}</span>
              <span class="badge" [ngClass]="'badge-type--' + e.type">{{ e.type }}</span>
              <span class="badge" [ngClass]="'badge-status--' + e.status">{{ e.status }}</span>
              <span class="badge badge-breaking" *ngIf="e.breaking">breaking</span>
            </div>
            <span class="card-date">{{ formatDate(e.implementedAt) }}</span>
          </div>

          <!-- Title -->
          <h3 class="card-title">{{ e.id }} — {{ e.title }}</h3>

          <!-- Description -->
          <p class="card-description">{{ e.description }}</p>

          <!-- Tags -->
          <div class="card-tags" *ngIf="e.tags.length">
            <span class="tag" *ngFor="let tag of e.tags; trackBy: trackByIndex">{{ tag }}</span>
          </div>

          <!-- Related -->
          <div class="card-related" *ngIf="e.relatedTo.length">
            <span class="related-label">Related:</span>
            <span class="related-id" *ngFor="let rid of e.relatedTo; trackBy: trackByIndex">{{ rid }}</span>
          </div>

          <!-- Notes -->
          <p class="card-notes" *ngIf="e.notes">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:4px;flex-shrink:0;">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/>
              <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <circle cx="8" cy="5" r="0.7" fill="currentColor"/>
            </svg>{{ e.notes }}
          </p>

          <div class="card-divider" *ngIf="!last"></div>
        </div>
      </div>

      <!-- Footer -->
      <div class="drawer-footer" *ngIf="!isLoading && !loadError">
        Stored in <code>src/assets/enhancements.json</code>
      </div>
    </aside>
  `,
  styles: [`
    /* Backdrop */
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0);
      z-index: 300;
      pointer-events: none;
      transition: background 0.3s ease;
    }
    .drawer-backdrop--visible {
      background: rgba(0,0,0,0.45);
      pointer-events: all;
    }

    /* Drawer panel */
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      height: 100dvh;
      background: var(--bg-surface);
      border-left: 1px solid var(--border);
      box-shadow: -8px 0 32px rgba(0,0,0,0.25);
      z-index: 400;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }
    .drawer--open {
      transform: translateX(0);
    }

    /* Header */
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 18px;
      height: 60px;
      flex-shrink: 0;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
    }

    .drawer-header-left {
      display: flex;
      align-items: center;
      gap: 9px;
      color: var(--text-primary);
    }

    .drawer-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }

    .drawer-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .drawer-count {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-card);
      padding: 2px 8px;
      border-radius: 10px;
    }

    .drawer-close-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--bg-card);
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .drawer-close-btn:hover {
      background: var(--accent-hover);
      color: var(--text-primary);
    }

    /* Body */
    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    /* Loading / Error */
    .drawer-loading, .drawer-error {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-direction: column;
      color: var(--text-muted);
      font-size: 13px;
      padding: 40px;
      text-align: center;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border);
      border-top-color: var(--highlight-selected);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Cards */
    .drawer-card {
      padding: 14px 0;
    }

    .card-divider {
      height: 1px;
      background: var(--border);
      margin: 0;
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .card-badges {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }

    /* Badges */
    .badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      padding: 2px 7px;
      border-radius: 10px;
    }

    .badge-version {
      background: var(--bg-card);
      color: var(--text-secondary);
      font-family: monospace;
      font-size: 10px;
    }

    /* type badges */
    .badge-type--feature  { background: rgba(74,144,226,0.18); color: #4A90E2; }
    .badge-type--minor    { background: rgba(80,227,194,0.18); color: #50E3C2; }
    .badge-type--major    { background: rgba(245,166,35,0.18);  color: #F5A623; }
    .badge-type--trivial  { background: rgba(155,155,155,0.18); color: #9B9B9B; }
    .badge-type--internal { background: rgba(189,16,224,0.15);  color: #BD10E0; }

    /* status badges */
    .badge-status--implemented { background: rgba(126,211,33,0.15);  color: #7ED321; }
    .badge-status--in-progress { background: rgba(245,166,35,0.18);  color: #F5A623; }
    .badge-status--planned     { background: rgba(155,155,155,0.15); color: #9B9B9B; }

    /* breaking badge */
    .badge-breaking { background: rgba(233,69,96,0.15); color: #e94560; }

    .card-date {
      font-size: 10px;
      color: var(--text-muted);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .card-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 6px;
      line-height: 1.4;
    }

    .card-description {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0 0 8px;
    }

    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 6px;
    }
    .tag {
      font-size: 10px;
      color: var(--text-muted);
      background: var(--bg-card);
      padding: 1px 7px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .card-related {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 6px;
    }
    .related-label {
      font-size: 10px;
      color: var(--text-muted);
    }
    .related-id {
      font-size: 10px;
      font-weight: 600;
      color: var(--highlight-selected);
      background: rgba(74,144,226,0.1);
      padding: 1px 6px;
      border-radius: 6px;
    }

    .card-notes {
      font-size: 11px;
      color: var(--text-muted);
      font-style: italic;
      margin: 4px 0 0;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 4px;
    }

    /* Footer */
    .drawer-footer {
      padding: 10px 18px;
      font-size: 10px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
      text-align: center;
    }
    .drawer-footer code {
      font-family: monospace;
      font-size: 10px;
      background: var(--bg-card);
      padding: 1px 5px;
      border-radius: 3px;
    }

    @media (max-width: 480px) {
      .drawer { width: 100vw; }
    }
  `]
})
export class EnhancementsDrawerComponent implements OnInit, OnChanges, OnDestroy {
  @Input()  isOpen = false;
  @Output() close  = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();
  enhancements: Enhancement[] = [];
  isLoading = false;
  loadError = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.loadEnhancements();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Load lazily on first open if not already loaded
    if (changes['isOpen']?.currentValue === true && this.enhancements.length === 0 && !this.isLoading) {
      this.loadEnhancements();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.close.emit();
  }

  loadEnhancements(): void {
    this.isLoading = true;
    this.loadError = false;
    this.http.get<{ enhancements: Enhancement[] }>('/assets/enhancements.json').pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        // Show newest first
        this.enhancements = [...data.enhancements].reverse();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = true;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  trackById(_i: number, e: Enhancement): string { return e.id; }
  trackByIndex(index: number): number { return index; }
}
