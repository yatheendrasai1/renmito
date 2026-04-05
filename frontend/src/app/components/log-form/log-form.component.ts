import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogTypeService } from '../../services/log-type.service';
import { LogType } from '../../models/log-type.model';
import { LogEntry, CreateLogEntry } from '../../models/log.model';

const DOMAIN_ORDER: Array<'work' | 'personal' | 'family'> = ['work', 'personal', 'family'];
const DOMAIN_LABELS: Record<string, string> = { work: 'Work', personal: 'Personal', family: 'Family' };

@Component({
  selector: 'app-log-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="form-overlay" (click)="onOverlayClick($event)">
      <div class="form-panel" role="dialog" aria-modal="true" aria-label="Log entry form">

        <!-- Header -->
        <div class="form-header">
          <h3>{{ editMode ? 'Edit Log Entry' : 'New Log Entry' }}</h3>
          <button class="close-btn" (click)="cancel()" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Time range + Date -->
        <div class="time-range-card">

          <!-- Row 1: Time -->
          <div class="time-range-row">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--highlight-selected)">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="time-field">
              <span class="time-field-label">Start</span>
              <input type="time" name="formStartTime" [(ngModel)]="formStartTime" class="time-input"/>
            </div>
            <span class="time-arrow">→</span>
            <div class="time-field">
              <span class="time-field-label">End</span>
              <input type="time" name="formEndTime" [(ngModel)]="formEndTime" class="time-input"/>
            </div>
            <span class="duration-label" *ngIf="durationLabel">{{ durationLabel }}</span>
            <span class="duration-label duration-label--error" *ngIf="!durationLabel && formStartTime && formEndTime">end ≤ start</span>
          </div>

          <!-- Divider -->
          <div class="time-card-divider"></div>

          <!-- Row 2: Date -->
          <div class="date-row">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--text-muted)">
              <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <span class="time-field-label" style="align-self:center">Date</span>
            <input type="date" name="formDate" [(ngModel)]="formDate" class="date-input"/>
          </div>

        </div>

        <form (ngSubmit)="save()" #logForm="ngForm">

          <!-- ── Activity Type ────────────────────────────── -->
          <div class="form-group">
            <label>Activity Type</label>

            <!-- Loading skeleton -->
            <div class="type-loading" *ngIf="loadingTypes">
              <span class="skeleton-chip" *ngFor="let i of [1,2,3,4,5]"></span>
            </div>

            <!-- Error -->
            <div class="type-error" *ngIf="typeLoadError">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Could not load log types.
              <button type="button" class="retry-btn" (click)="loadLogTypes()">Retry</button>
            </div>

            <!-- Domain-grouped chips -->
            <ng-container *ngIf="!loadingTypes && !typeLoadError">
              <div *ngFor="let group of groupedTypes" class="domain-group">
                <span class="domain-label">{{ domainLabel(group.domain) }}</span>
                <div class="chip-row">
                  <button
                    type="button"
                    class="activity-chip"
                    *ngFor="let lt of group.types"
                    [class.activity-chip--active]="isActive(lt)"
                    [style.border-color]="lt.color"
                    [style.background-color]="isActive(lt) ? lt.color + '28' : 'transparent'"
                    [style.color]="isActive(lt) ? lt.color : ''"
                    (click)="selectLogType(lt)"
                  >
                    <span class="chip-dot" [style.background]="lt.color"></span>
                    {{ lt.name }}
                    <span class="chip-source-badge" *ngIf="lt.source === 'user'" title="Your custom type">★</span>
                  </button>
                </div>
              </div>

              <!-- ── Create New Log Type ───────────────────── -->
              <div class="create-type-section">
                <button
                  type="button"
                  class="create-type-toggle"
                  (click)="toggleCreateForm()"
                  [class.create-type-toggle--open]="showCreateForm"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="8" y1="2" x2="8" y2="14"/>
                    <line x1="2" y1="8" x2="14" y2="8"/>
                  </svg>
                  New log type
                </button>

                <!-- Inline create form -->
                <div class="create-type-form" *ngIf="showCreateForm">

                  <div class="create-type-error" *ngIf="createTypeError">
                    {{ createTypeError }}
                  </div>

                  <div class="create-fields">
                    <div class="create-field create-field--name">
                      <label class="create-label">Name</label>
                      <input
                        type="text"
                        name="newTypeName"
                        [(ngModel)]="newTypeName"
                        placeholder="e.g. Deep Work, Therapy…"
                        maxlength="40"
                        autocomplete="off"
                        class="create-input"
                        [disabled]="creatingType"
                      />
                    </div>

                    <div class="create-field create-field--domain">
                      <label class="create-label">Domain</label>
                      <select name="newTypeDomain" [(ngModel)]="newTypeDomain" [disabled]="creatingType" class="create-select">
                        <option value="work">Work</option>
                        <option value="personal">Personal</option>
                        <option value="family">Family</option>
                      </select>
                    </div>

                    <div class="create-field create-field--color">
                      <label class="create-label">Color</label>
                      <div class="color-wrap">
                        <input type="color" name="newTypeColor" [(ngModel)]="newTypeColor" [disabled]="creatingType" class="create-color"/>
                        <span class="color-hex">{{ newTypeColor }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="create-actions">
                    <button type="button" class="btn-create-cancel" (click)="cancelCreateForm()" [disabled]="creatingType">
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="btn-create-submit"
                      (click)="submitCreateType()"
                      [disabled]="creatingType || !newTypeName.trim()"
                    >
                      <span class="btn-spinner" *ngIf="creatingType"></span>
                      <span>{{ creatingType ? 'Creating…' : 'Create & Select' }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </ng-container>
          </div>

          <!-- ── Description ────────────────────────────────── -->
          <div class="form-group">
            <label for="labelInput">Description</label>
            <input
              type="text"
              id="labelInput"
              name="labelInput"
              [(ngModel)]="labelValue"
              placeholder="What were you doing?"
              required
              maxlength="120"
              autocomplete="off"
            />
          </div>

          <!-- ── Actions ─────────────────────────────────────── -->
          <div class="form-actions">
            <button type="button" class="btn-cancel" (click)="cancel()">Cancel</button>
            <button type="submit" class="btn-save" [disabled]="!canSave">
              {{ editMode ? 'Update Log' : 'Save Log' }}
            </button>
          </div>
        </form>

        <!-- Delete (edit mode only) -->
        <div *ngIf="editMode" class="delete-section">
          <button class="btn-delete" (click)="deleteEntry()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="margin-right:4px;vertical-align:middle;">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9H3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Delete Entry
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .form-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; backdrop-filter: blur(2px);
    }
    .form-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      padding: 24px;
      width: 500px; max-width: 96vw;
      max-height: 90vh; overflow-y: auto;
      box-shadow: var(--shadow);
      animation: slideIn 0.2s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-14px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    .form-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .form-header h3 { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .close-btn { background: none; color: var(--text-muted); padding: 4px; border-radius: var(--radius-sm); display: flex; align-items: center; }
    .close-btn:hover { background: var(--bg-card); color: var(--text-primary); }

    /* Time + Date card */
    .time-range-card { background: var(--bg-card); border-radius: var(--radius-sm); margin-bottom: 20px; overflow: hidden; }
    .time-range-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; flex-wrap: wrap; }
    .time-card-divider { height: 1px; background: var(--border-light); margin: 0 14px; }
    .date-row { display: flex; align-items: center; gap: 8px; padding: 8px 14px; }
    .date-input { background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 12px; font-weight: 600; padding: 4px 8px; width: 150px; cursor: pointer; }
    .date-input:focus { border-color: var(--highlight-selected); outline: none; color: var(--highlight-selected); }
    .date-input::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; filter: invert(0.5); }
    .time-field { display: flex; flex-direction: column; gap: 2px; }
    .time-field-label { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.7px; }
    .time-input { background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-sm); color: var(--highlight-selected); font-size: 14px; font-weight: 700; padding: 4px 8px; width: 120px; font-variant-numeric: tabular-nums; cursor: pointer; }
    .time-input:focus { border-color: var(--highlight-selected); outline: none; }
    .time-input::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; filter: invert(0.5); }
    .time-arrow { font-size: 16px; color: var(--text-muted); flex-shrink: 0; margin-top: 14px; }
    .duration-label { font-size: 11px; color: var(--text-muted); margin-top: 14px; white-space: nowrap; }
    .duration-label--error { color: #e94560; font-weight: 600; }

    /* Form group */
    .form-group { margin-bottom: 18px; }
    .form-group > label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.7px; }

    /* Skeleton */
    .type-loading { display: flex; flex-wrap: wrap; gap: 7px; }
    .skeleton-chip { width: 80px; height: 28px; border-radius: 20px; background: linear-gradient(90deg, var(--bg-card) 25%, var(--accent-hover) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Error */
    .type-error { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #ef5350; padding: 8px 10px; background: rgba(239,83,80,0.08); border-radius: var(--radius-sm); }
    .retry-btn { background: none; color: var(--highlight-selected); font-size: 12px; font-weight: 600; text-decoration: underline; margin-left: 4px; }

    /* Domain groups */
    .domain-group { margin-bottom: 12px; }
    .domain-label { display: inline-block; font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }

    /* Chips */
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .activity-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 20px; border: 1.5px solid transparent; background: var(--bg-card); color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s; }
    .activity-chip:hover { transform: translateY(-1px); color: var(--text-primary); }
    .activity-chip--active { font-weight: 700; border-width: 2px; }
    .chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .chip-source-badge { font-size: 9px; opacity: 0.7; margin-left: 1px; }

    /* ── Create new log type ─────────────────────────────── */
    .create-type-section { margin-top: 12px; }

    .create-type-toggle {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600;
      color: var(--highlight-selected);
      background: none;
      padding: 5px 10px;
      border-radius: var(--radius-sm);
      border: 1.5px dashed rgba(74,144,226,0.4);
      transition: background 0.15s, border-color 0.15s;
    }
    .create-type-toggle:hover { background: rgba(74,144,226,0.08); border-color: var(--highlight-selected); }
    .create-type-toggle--open { background: rgba(74,144,226,0.08); border-style: solid; }

    .create-type-form {
      margin-top: 10px;
      padding: 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      display: flex; flex-direction: column; gap: 12px;
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    .create-type-error {
      font-size: 12px; color: #ef5350;
      padding: 7px 10px;
      background: rgba(239,83,80,0.1);
      border-radius: var(--radius-sm);
    }

    .create-fields { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }

    .create-field { display: flex; flex-direction: column; gap: 5px; }
    .create-field--name { flex: 1; min-width: 140px; }
    .create-field--domain { width: 110px; }
    .create-field--color { width: 90px; }

    .create-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; }

    .create-input, .create-select {
      padding: 7px 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
    }
    .create-input:focus, .create-select:focus { outline: none; border-color: var(--highlight-selected); }
    .create-input::placeholder { color: var(--text-muted); }
    .create-input:disabled, .create-select:disabled { opacity: 0.5; }

    .color-wrap { display: flex; align-items: center; gap: 8px; }
    .create-color { width: 36px; height: 32px; padding: 2px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; background: none; }
    .create-color:disabled { opacity: 0.5; cursor: not-allowed; }
    .color-hex { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

    .create-actions { display: flex; gap: 8px; justify-content: flex-end; }

    .btn-create-cancel {
      padding: 7px 14px; font-size: 12px;
      background: none; color: var(--text-muted);
      border-radius: var(--radius-sm);
    }
    .btn-create-cancel:hover:not(:disabled) { color: var(--text-primary); background: var(--accent-hover); }
    .btn-create-cancel:disabled { opacity: 0.4; }

    .btn-create-submit {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 14px; font-size: 12px; font-weight: 600;
      background: var(--highlight-selected); color: #fff;
      border-radius: var(--radius-sm);
      transition: opacity 0.15s;
    }
    .btn-create-submit:hover:not(:disabled) { opacity: 0.88; }
    .btn-create-submit:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Input text */
    input[type="text"] { width: 100%; }

    /* Actions */
    .form-actions { display: flex; gap: 10px; margin-top: 20px; }
    .btn-cancel { flex: 1; padding: 10px; background: var(--bg-card); color: var(--text-secondary); }
    .btn-cancel:hover { background: var(--accent-hover); color: var(--text-primary); }
    .btn-save { flex: 2; padding: 10px; background: var(--highlight-selected); color: #fff; font-weight: 700; }
    .btn-save:hover:not(:disabled) { opacity: 0.88; }
    .btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Delete */
    .delete-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: center; }
    .btn-delete { background: none; color: #e94560; font-size: 12px; padding: 6px 12px; border-radius: var(--radius-sm); }
    .btn-delete:hover { background: rgba(233,69,96,0.1); }
  `]
})
export class LogFormComponent implements OnInit, OnChanges {
  @Input() startTime   = '00:00';
  @Input() endTime     = '01:00';
  @Input() editEntry:   LogEntry | null = null;
  @Input() currentDate = '';

  @Output() saved     = new EventEmitter<CreateLogEntry>();
  @Output() updated   = new EventEmitter<{ id: string; entry: Partial<CreateLogEntry>; newDate?: string }>();
  @Output() deleted   = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  // ── log types ─────────────────────────────────────────
  logTypes:     LogType[] = [];
  groupedTypes: { domain: string; types: LogType[] }[] = [];
  loadingTypes  = true;
  typeLoadError = false;

  // ── time ──────────────────────────────────────────────
  formStartTime = '00:00';
  formEndTime   = '01:00';
  formDate      = '';

  // ── type selection ─────────────────────────────────────
  selectedLogType: LogType | null = null;

  // ── description ────────────────────────────────────────
  labelValue = '';
  editMode   = false;

  // ── create new type inline form ────────────────────────
  showCreateForm  = false;
  newTypeName     = '';
  newTypeDomain:  'work' | 'personal' | 'family' = 'work';
  newTypeColor    = '#4A90E2';
  creatingType    = false;
  createTypeError = '';

  constructor(private logTypeService: LogTypeService) {}

  // ── computed ───────────────────────────────────────────

  get durationLabel(): string {
    const diff = this.toMins(this.formEndTime) - this.toMins(this.formStartTime);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60), m = diff % 60;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  }

  get canSave(): boolean {
    return !!this.selectedLogType &&
           !!this.labelValue.trim() &&
           this.toMins(this.formEndTime) > this.toMins(this.formStartTime);
  }

  isActive(lt: LogType): boolean {
    return this.selectedLogType?._id === lt._id;
  }

  domainLabel(domain: string): string {
    return DOMAIN_LABELS[domain] ?? domain;
  }

  // ── lifecycle ──────────────────────────────────────────

  ngOnInit(): void { this.loadLogTypes(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editEntry'] || changes['startTime'] || changes['endTime']) {
      this.initForm();
    }
  }

  loadLogTypes(): void {
    this.loadingTypes  = true;
    this.typeLoadError = false;

    this.logTypeService.getLogTypes().subscribe({
      next: (types) => {
        this.logTypes     = types;
        this.groupedTypes = this.buildGroups(types);
        this.loadingTypes = false;
        this.initForm();
      },
      error: () => {
        this.loadingTypes  = false;
        this.typeLoadError = true;
      }
    });
  }

  initForm(): void {
    if (this.editEntry) {
      this.editMode      = true;
      this.formStartTime = this.editEntry.startAt;
      this.formEndTime   = this.editEntry.endAt;
      this.formDate      = this.editEntry.date;
      this.labelValue    = this.editEntry.title;

      // Restore log type — match by id first, then by name
      this.selectedLogType =
        this.logTypes.find(lt => lt._id === this.editEntry!.logType?.id) ??
        this.logTypes.find(lt => lt.name.toLowerCase() === this.editEntry!.logType?.name?.toLowerCase()) ??
        null;
    } else {
      this.editMode        = false;
      this.formStartTime   = this.startTime;
      this.formEndTime     = this.endTime;
      this.formDate        = this.currentDate;
      this.labelValue      = '';
      this.selectedLogType = this.logTypes.find(lt => lt.domain === 'work') ?? this.logTypes[0] ?? null;
    }
  }

  // ── chip selection ─────────────────────────────────────

  selectLogType(lt: LogType): void {
    this.selectedLogType = lt;
    this.showCreateForm  = false;   // close create form if open
  }

  // ── create new type ────────────────────────────────────

  toggleCreateForm(): void {
    this.showCreateForm  = !this.showCreateForm;
    this.createTypeError = '';
    if (this.showCreateForm) {
      this.newTypeName  = '';
      this.newTypeDomain = 'work';
      this.newTypeColor  = '#4A90E2';
    }
  }

  cancelCreateForm(): void {
    this.showCreateForm  = false;
    this.createTypeError = '';
  }

  submitCreateType(): void {
    if (!this.newTypeName.trim() || this.creatingType) return;

    this.creatingType    = true;
    this.createTypeError = '';

    this.logTypeService.createLogType({
      name:   this.newTypeName.trim(),
      domain: this.newTypeDomain,
      color:  this.newTypeColor
    }).subscribe({
      next: (created) => {
        this.creatingType   = false;
        this.showCreateForm = false;

        // Add the new type to local list and rebuild groups
        this.logTypes = [...this.logTypes, created];
        this.groupedTypes = this.buildGroups(this.logTypes);

        // Auto-select it
        this.selectedLogType = created;
      },
      error: (err) => {
        this.creatingType    = false;
        this.createTypeError = err?.error?.error ?? 'Failed to create log type. Please try again.';
      }
    });
  }

  // ── form submit ────────────────────────────────────────

  save(): void {
    if (!this.canSave) return;

    const entry: CreateLogEntry = {
      startTime: this.formStartTime,
      endTime:   this.formEndTime,
      title:     this.labelValue.trim(),
      logTypeId: this.selectedLogType!._id,
      date:      this.formDate || undefined
    };

    if (this.editMode && this.editEntry) {
      const payload: { id: string; entry: Partial<CreateLogEntry>; newDate?: string } = {
        id: this.editEntry.id, entry
      };
      if (this.formDate && this.formDate !== this.editEntry.date) {
        payload.newDate = this.formDate;
      }
      this.updated.emit(payload);
    } else {
      this.saved.emit(entry);
    }
  }

  deleteEntry(): void {
    if (this.editEntry) this.deleted.emit(this.editEntry.id);
  }

  cancel(): void { this.cancelled.emit(); }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('form-overlay')) this.cancel();
  }

  // ── private ────────────────────────────────────────────

  private buildGroups(types: LogType[]): { domain: string; types: LogType[] }[] {
    const map = new Map<string, LogType[]>();
    for (const lt of types) {
      if (!map.has(lt.domain)) map.set(lt.domain, []);
      map.get(lt.domain)!.push(lt);
    }
    return DOMAIN_ORDER
      .filter(d => map.has(d))
      .map(d => ({ domain: d, types: map.get(d)! }))
      .concat(
        Array.from(map.entries())
          .filter(([d]) => !DOMAIN_ORDER.includes(d as any))
          .map(([d, t]) => ({ domain: d as 'work' | 'personal' | 'family', types: t }))
      );
  }

  private toMins(time: string): number {
    if (!time?.includes(':')) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
