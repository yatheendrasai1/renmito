import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ACTIVITY_TYPES, ActivityType, getActivityColor } from '../../constants/activity-types';
import { LogEntry, CreateLogEntry } from '../../models/log.model';

const CHIP_TYPES    = ['work', 'breakfast', 'lunch', 'dinner', 'transit'];
const DROPDOWN_KEYS = ['sleep', 'exercise', 'entertainment'];
const CUSTOM_COLOR  = '#9B9B9B';

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

        <!-- Time range -->
        <div class="time-display">
          <div class="time-badge">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                 style="margin-right:6px;vertical-align:middle;">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ startTime }} – {{ endTime }}
          </div>
          <span class="duration-label">{{ durationLabel }}</span>
        </div>

        <form (ngSubmit)="save()" #logForm="ngForm">

          <!-- ── Activity Type ──────────────────────────────── -->
          <div class="form-group">
            <label>Activity Type</label>

            <!-- Quick-select chips -->
            <div class="chip-row">
              <button
                type="button"
                class="activity-chip"
                *ngFor="let chip of chipItems"
                [class.activity-chip--active]="isChipActive(chip.type)"
                [style.border-color]="chip.color"
                [style.background-color]="isChipActive(chip.type) ? chip.color + '28' : 'transparent'"
                [style.color]="isChipActive(chip.type) ? chip.color : ''"
                (click)="selectChip(chip.type)"
              >
                <span class="chip-dot" [style.background]="chip.color"></span>
                {{ chip.label }}
              </button>
            </div>

            <!-- More-categories dropdown row -->
            <div class="more-row">
              <div class="select-wrapper">
                <span
                  class="dropdown-dot"
                  *ngIf="dropdownValue && dropdownValue !== 'custom'"
                  [style.background]="dropdownSelectedColor"
                ></span>
                <span
                  class="dropdown-dot dropdown-dot--custom"
                  *ngIf="dropdownValue === 'custom'"
                ></span>
                <select
                  name="dropdownSelect"
                  [(ngModel)]="dropdownValue"
                  (ngModelChange)="onDropdownChange($event)"
                  [class.has-value]="!!dropdownValue"
                >
                  <option value="">More categories…</option>
                  <option *ngFor="let act of dropdownItems" [value]="act.type">
                    {{ act.label }}
                  </option>
                  <option value="custom">✏️  Custom</option>
                </select>
              </div>
            </div>

            <!-- Custom category name input -->
            <div class="custom-row" *ngIf="isCustom">
              <input
                type="text"
                name="customTypeName"
                [(ngModel)]="customTypeName"
                (ngModelChange)="onCustomNameChange($event)"
                placeholder="Category name (e.g. Doctor Visit, Reading…)"
                maxlength="40"
                autocomplete="off"
                class="custom-input"
              />
            </div>
          </div>

          <!-- ── Description ───────────────────────────────── -->
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

          <!-- ── Actions ───────────────────────────────────── -->
          <div class="form-actions">
            <button type="button" class="btn-cancel" (click)="cancel()">Cancel</button>
            <button
              type="submit"
              class="btn-save"
              [disabled]="!canSave"
            >
              {{ editMode ? 'Update Log' : 'Save Log' }}
            </button>
          </div>
        </form>

        <!-- Delete (edit mode only) -->
        <div *ngIf="editMode" class="delete-section">
          <button class="btn-delete" (click)="deleteEntry()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                 style="margin-right:4px;vertical-align:middle;">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9H3z"
                    stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Delete Entry
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* ── Overlay & panel ─────────────────────────────── */
    .form-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    }

    .form-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      padding: 24px;
      width: 460px;
      max-width: 96vw;
      box-shadow: var(--shadow);
      animation: slideIn 0.2s ease;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-14px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }

    /* ── Header ──────────────────────────────────────── */
    .form-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .form-header h3 {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .close-btn {
      background: none;
      color: var(--text-muted);
      padding: 4px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
    }
    .close-btn:hover { background: var(--bg-card); color: var(--text-primary); }

    /* ── Time display ────────────────────────────────── */
    .time-display {
      background: var(--bg-card);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .time-badge {
      font-size: 15px;
      font-weight: 600;
      color: var(--highlight-selected);
    }

    .duration-label {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* ── Form group ──────────────────────────────────── */
    .form-group { margin-bottom: 18px; }

    .form-group label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }

    /* ── Chips ───────────────────────────────────────── */
    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 10px;
    }

    .activity-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 20px;
      border: 1.5px solid transparent;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
    }

    .activity-chip:hover {
      transform: translateY(-1px);
      color: var(--text-primary);
    }

    .activity-chip--active {
      font-weight: 700;
      border-width: 2px;
    }

    .chip-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── More-categories dropdown ────────────────────── */
    .more-row { margin-bottom: 0; }

    .select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .dropdown-dot {
      position: absolute;
      left: 11px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 1;
      flex-shrink: 0;
    }

    .dropdown-dot--custom {
      background: linear-gradient(135deg, #9B9B9B 50%, #4A90E2 50%);
    }

    select {
      width: 100%;
      padding-left: 10px;
      color: var(--text-secondary);
      font-size: 12px;
    }

    select.has-value {
      padding-left: 30px;
      color: var(--text-primary);
    }

    /* ── Custom name input ───────────────────────────── */
    .custom-row {
      margin-top: 8px;
    }

    .custom-input {
      width: 100%;
      border-left: 3px solid #9B9B9B;
      padding-left: 10px;
      font-size: 12px;
      color: var(--text-primary);
    }

    .custom-input::placeholder { color: var(--text-muted); }

    input { width: 100%; }

    /* ── Actions ─────────────────────────────────────── */
    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    .btn-cancel {
      flex: 1;
      padding: 10px;
      background: var(--bg-card);
      color: var(--text-secondary);
    }
    .btn-cancel:hover { background: var(--accent-hover); color: var(--text-primary); }

    .btn-save {
      flex: 2;
      padding: 10px;
      background: var(--highlight-selected);
      color: #fff;
      font-weight: 700;
    }
    .btn-save:hover:not(:disabled) { opacity: 0.88; }
    .btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Delete ──────────────────────────────────────── */
    .delete-section {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: center;
    }

    .btn-delete {
      background: none;
      color: #e94560;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
    }
    .btn-delete:hover { background: rgba(233,69,96,0.1); }
  `]
})
export class LogFormComponent implements OnInit, OnChanges {
  @Input() startTime = '00:00';
  @Input() endTime   = '01:00';
  @Input() editEntry: LogEntry | null = null;

  @Output() saved     = new EventEmitter<CreateLogEntry>();
  @Output() updated   = new EventEmitter<{ id: string; entry: Partial<CreateLogEntry> }>();
  @Output() deleted   = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  /* chip & dropdown data */
  readonly chipItems: ActivityType[]     = ACTIVITY_TYPES.filter(a => CHIP_TYPES.includes(a.type));
  readonly dropdownItems: ActivityType[] = ACTIVITY_TYPES.filter(a => DROPDOWN_KEYS.includes(a.type));

  /* form state */
  selectedType  = 'work';
  selectedColor = getActivityColor('work');
  labelValue    = '';
  editMode      = false;

  dropdownValue  = '';   // '' | activity type key | 'custom'
  isCustom       = false;
  customTypeName = '';

  /* ── computed ──────────────────────────────────────── */

  get durationLabel(): string {
    const diff = this.toMins(this.endTime) - this.toMins(this.startTime);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60), m = diff % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  get canSave(): boolean {
    if (!this.labelValue.trim()) return false;
    if (this.isCustom && !this.customTypeName.trim()) return false;
    return true;
  }

  get dropdownSelectedColor(): string {
    if (!this.dropdownValue || this.dropdownValue === 'custom') return CUSTOM_COLOR;
    return getActivityColor(this.dropdownValue);
  }

  isChipActive(type: string): boolean {
    return this.selectedType === type && !this.isCustom && this.dropdownValue === '';
  }

  /* ── lifecycle ─────────────────────────────────────── */

  ngOnInit(): void { this.initForm(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editEntry']) this.initForm();
  }

  initForm(): void {
    if (this.editEntry) {
      this.editMode     = true;
      this.labelValue   = this.editEntry.label;
      this.selectedColor = this.editEntry.color;
      const t = this.editEntry.type;

      if (CHIP_TYPES.includes(t)) {
        this.selectedType  = t;
        this.dropdownValue = '';
        this.isCustom      = false;
        this.customTypeName = '';
      } else if (DROPDOWN_KEYS.includes(t)) {
        this.selectedType  = t;
        this.dropdownValue = t;
        this.isCustom      = false;
        this.customTypeName = '';
      } else {
        // unknown / custom type stored previously
        this.selectedType   = t;
        this.dropdownValue  = 'custom';
        this.isCustom       = true;
        this.customTypeName = t;
      }
    } else {
      this.editMode      = false;
      this.selectedType  = 'work';
      this.selectedColor = getActivityColor('work');
      this.labelValue    = '';
      this.dropdownValue = '';
      this.isCustom      = false;
      this.customTypeName = '';
    }
  }

  /* ── event handlers ─────────────────────────────────── */

  selectChip(type: string): void {
    this.selectedType   = type;
    this.selectedColor  = getActivityColor(type);
    this.dropdownValue  = '';
    this.isCustom       = false;
    this.customTypeName = '';
  }

  onDropdownChange(value: string): void {
    this.dropdownValue = value;
    if (value === 'custom') {
      this.isCustom      = true;
      this.selectedType  = this.customTypeName.trim() || 'custom';
      this.selectedColor = CUSTOM_COLOR;
    } else if (value) {
      this.isCustom       = false;
      this.customTypeName = '';
      this.selectedType   = value;
      this.selectedColor  = getActivityColor(value);
    } else {
      /* placeholder re-selected — keep current type, just clear dropdown indicator */
      this.isCustom       = false;
      this.customTypeName = '';
    }
  }

  onCustomNameChange(value: string): void {
    this.selectedType = value.trim() || 'custom';
  }

  save(): void {
    if (!this.canSave) return;

    const type  = this.isCustom ? (this.customTypeName.trim() || 'custom') : this.selectedType;
    const color = this.isCustom ? CUSTOM_COLOR : this.selectedColor;

    const entry: CreateLogEntry = {
      startTime: this.startTime,
      endTime:   this.endTime,
      type,
      label: this.labelValue.trim(),
      color
    };

    if (this.editMode && this.editEntry) {
      this.updated.emit({ id: this.editEntry.id, entry });
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

  private toMins(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
