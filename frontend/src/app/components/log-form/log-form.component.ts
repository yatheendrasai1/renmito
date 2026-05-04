import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, OnDestroy, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LogService } from '../../services/log.service';
import { LogTypeService } from '../../services/log-type.service';
import { LogType } from '../../models/log-type.model';
import { LogEntry, CreateLogEntry } from '../../models/log.model';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

const DOMAIN_ORDER: Array<'work' | 'personal' | 'family'> = ['work', 'personal', 'family'];
const DOMAIN_LABELS: Record<string, string> = { work: 'Work', personal: 'Personal', family: 'Family' };

@Component({
  selector: 'app-log-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

        <!-- Entry type toggle -->
        <div class="entry-type-toggle">
          <button type="button"
                  class="toggle-btn"
                  [class.toggle-btn--active]="entryType === 'range'"
                  (click)="entryType = 'range'">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="5" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
              <circle cx="11" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
            </svg>
            Time Range
          </button>
          <button type="button"
                  class="toggle-btn"
                  [class.toggle-btn--active]="entryType === 'point'"
                  (click)="entryType = 'point'">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
              <line x1="8" y1="2" x2="8" y2="4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <line x1="8" y1="11.5" x2="8" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <line x1="2" y1="8" x2="4.5" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <line x1="11.5" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            Point in Time
          </button>
        </div>

        <!-- Time + Date card -->
        <div class="time-range-card">

          <!-- RANGE mode: start → end -->
          <ng-container *ngIf="entryType === 'range'">
            <div class="time-range-row">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--highlight-selected)">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="time-field">
                <span class="time-field-label">Start</span>
                <input type="time" name="formStartTime" [(ngModel)]="formStartTime" class="time-input" (ngModelChange)="onStartTimeChange()"/>
              </div>
              <span class="time-arrow">→</span>
              <div class="time-field">
                <span class="time-field-label">End</span>
                <input type="time" name="formEndTime" [(ngModel)]="formEndTime" class="time-input" (ngModelChange)="onEndTimeChange()"/>
                <span class="next-day-badge" *ngIf="isNextDay" (click)="resetEndToSameDay()" title="Ends next day — click to reset to same day">+1 day ×</span>
              </div>
              <span class="duration-label" *ngIf="durationLabel">{{ durationLabel }}</span>
              <span class="duration-label duration-label--error" *ngIf="!durationLabel && !isNextDay && formStartTime && formEndTime">end ≤ start</span>
            </div>
          </ng-container>

          <!-- POINT mode: single time -->
          <ng-container *ngIf="entryType === 'point'">
            <div class="time-range-row">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--highlight-selected)">
                <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
                <line x1="8" y1="1" x2="8" y2="4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="8" y1="12" x2="8" y2="15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="1" y1="8" x2="4" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="12" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <div class="time-field">
                <span class="time-field-label">Time</span>
                <input type="time" name="formStartTime" [(ngModel)]="formStartTime" class="time-input"/>
              </div>
              <span class="point-hint">Exact moment — no duration</span>
            </div>
          </ng-container>

          <!-- Divider -->
          <div class="time-card-divider"></div>

          <!-- Row 2: Date (always shown) -->
          <div class="date-row">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--text-muted)">
              <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <span class="time-field-label" style="align-self:center">{{ entryType === 'range' ? 'Start Date' : 'Date' }}</span>
            <input type="date" name="formDate" [(ngModel)]="formDate" class="date-input" (ngModelChange)="onStartDateChange()"/>
          </div>

        </div>

        <form (ngSubmit)="save()" #logForm="ngForm">

          <!-- ── Activity Type ────────────────────────────── -->
          <div class="form-group">
            <label>Activity Type</label>

            <!-- Loading skeleton -->
            <div class="type-loading" *ngIf="loadingTypes">
              <div class="skeleton-accordion" *ngFor="let i of [1,2,3]; trackBy: trackByIndex"></div>
            </div>

            <!-- Error -->
            <div class="type-error" *ngIf="typeLoadError">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Could not load log types.
              <button type="button" class="retry-btn" (click)="loadLogTypes()">Retry</button>
            </div>

            <!-- Accordion list -->
            <div class="accordion-list" *ngIf="!loadingTypes && !typeLoadError">

              <!-- Domain accordions -->
              <div *ngFor="let group of groupedTypes; trackBy: trackByDomain" class="accordion-item"
                   (click)="toggleAccordion(group.domain)">
                <button type="button" class="accordion-header"
                        [class.accordion-header--open]="isAccordionOpen(group.domain)"
                        tabindex="-1">
                  <svg class="accordion-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="accordion-label">{{ domainLabel(group.domain) }}</span>
                  <span class="accordion-count">{{ group.types.length }}</span>
                  <!-- Active type hint — shown when accordion is closed -->
                  <span class="accordion-active-hint"
                        *ngIf="hasActiveInGroup(group) && !isAccordionOpen(group.domain)">
                    <span class="accordion-active-dot" [style.background]="activeColorInGroup(group)"></span>
                    <span class="accordion-active-name">{{ activeNameInGroup(group) }}</span>
                  </span>
                </button>
                <div class="accordion-body" *ngIf="isAccordionOpen(group.domain)"
                     (click)="$event.stopPropagation()">
                  <div class="chip-row">
                    <button
                      type="button"
                      class="activity-chip"
                      *ngFor="let lt of group.types; trackBy: trackByLogTypeId"
                      [class.activity-chip--active]="isActive(lt)"
                      [style.border-color]="lt.color"
                      [style.background-color]="isActive(lt) ? lt.color + '28' : 'transparent'"
                      [style.color]="isActive(lt) ? lt.color : ''"
                      (click)="onChipClick(lt)"
                      (pointerdown)="onChipPointerDown($event, lt)"
                      (pointerup)="onChipPointerUp()"
                      (pointermove)="onChipPointerMove()"
                      (contextmenu)="onChipContextMenu($event, lt)"
                    >
                      <span class="chip-dot" [style.background]="lt.color"></span>
                      {{ lt.name }}
                      <span class="chip-source-badge" *ngIf="lt.source === 'user'" title="Long-press or right-click to edit">★</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- New Log Type accordion -->
              <div class="accordion-item accordion-item--new"
                   (click)="toggleAccordion('__new__')">
                <button type="button" class="accordion-header accordion-header--new"
                        [class.accordion-header--open]="isAccordionOpen('__new__')"
                        tabindex="-1">
                  <svg class="accordion-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="accordion-label accordion-label--new">New Log Type</span>
                </button>
                <div class="accordion-body" *ngIf="isAccordionOpen('__new__')"
                     (click)="$event.stopPropagation()">

                  <div class="create-type-error" *ngIf="createTypeError">{{ createTypeError }}</div>

                  <div class="create-fields">
                    <div class="create-top-row">
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
                        </select>
                      </div>
                    </div>
                    <div class="create-field create-field--color">
                      <label class="create-label">Color</label>
                      <div class="swatch-grid">
                        <button *ngFor="let c of paletteColors; trackBy: trackByColor" type="button"
                          class="swatch-btn"
                          [class.swatch-btn--active]="newTypeColor === c"
                          [style.background]="c"
                          [disabled]="creatingType"
                          (click)="newTypeColor = c"
                          [attr.aria-label]="c">
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="create-actions">
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

            </div><!-- /accordion-list -->
          </div>

          <!-- ── Priority ──────────────────────────────────── -->
          <div class="form-group">
            <label>Priority</label>
            <div class="priority-row">
              <button type="button" class="priority-btn priority-btn--high"
                      [class.priority-btn--active]="priority === 'High'"
                      (click)="togglePriority('High')">
                <span class="priority-dot"></span>High
              </button>
              <button type="button" class="priority-btn priority-btn--medium"
                      [class.priority-btn--active]="priority === 'Medium'"
                      (click)="togglePriority('Medium')">
                <span class="priority-dot"></span>Medium
              </button>
              <button type="button" class="priority-btn priority-btn--low"
                      [class.priority-btn--active]="priority === 'Low'"
                      (click)="togglePriority('Low')">
                <span class="priority-dot"></span>Low
              </button>
            </div>
          </div>

          <!-- ── Collaborators ──────────────────────────────── -->
          <div class="form-group">
            <label>Collaborators</label>
            <div class="collab-chips" *ngIf="collaborators.length > 0">
              <span class="collab-chip" *ngFor="let c of collaborators; let i = index; trackBy: trackByIndex">
                {{ c }}
                <button type="button" class="collab-chip-remove" (click)="removeCollaborator(i)" aria-label="Remove">×</button>
              </span>
            </div>
            <div class="collab-input-row">
              <input
                type="text"
                name="collaboratorInput"
                [(ngModel)]="collaboratorInput"
                placeholder="Name or team…"
                maxlength="60"
                autocomplete="off"
                class="collab-input"
                (keydown.enter)="$event.preventDefault(); addCollaborator()"
              />
              <button type="button" class="collab-add-btn" (click)="addCollaborator()" [disabled]="!collaboratorInput.trim()">Add</button>
            </div>
          </div>

          <!-- ── Description ────────────────────────────────── -->
          <div class="form-group">
            <label for="labelInput">Description</label>
            <textarea
              id="labelInput"
              name="labelInput"
              [(ngModel)]="labelValue"
              placeholder="What were you doing? (optional)"
              maxlength="300"
              rows="3"
              autocomplete="off"
              class="description-textarea"
            ></textarea>
          </div>

          <!-- ── Ticket ID (work domain, non-transit/break only) ── -->
          <div class="form-group" *ngIf="showTicketId">
            <label for="ticketIdInput">Ticket ID</label>
            <input
              id="ticketIdInput"
              name="ticketIdInput"
              type="text"
              [(ngModel)]="ticketId"
              placeholder="e.g. JIRA-1234 (optional)"
              maxlength="100"
              autocomplete="off"
              class="ticket-id-input"
            />
          </div>

          <!-- ── Actions ─────────────────────────────────────── -->
          <div class="form-actions">
            <button type="button" class="btn-cancel" (click)="cancel()" [disabled]="saving">Cancel</button>
            <button type="submit" class="btn-save" [disabled]="!canSave || saving">
              {{ saving ? 'Saving…' : editMode ? 'Update Log' : 'Save Log' }}
            </button>
          </div>
        </form>

        <!-- Delete (edit mode only) -->
        <div *ngIf="editMode" class="delete-section">
          <button class="btn-delete" (click)="deleteEntry()" [disabled]="saving">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="margin-right:4px;vertical-align:middle;">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9H3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Delete Entry
          </button>
        </div>

      </div>

      <!-- Delete entry confirmation dialog -->
      <app-confirm-dialog
        [visible]="deleteConfirmVisible"
        title="Delete Entry"
        [message]="deleteConfirmMessage"
        okLabel="Delete"
        (confirmed)="onDeleteConfirmed()"
        (cancelled)="onDeleteCancelled()"
      ></app-confirm-dialog>

    </div><!-- /form-panel -->

    <!-- ── Custom log type context menu (right-click / long-press) ── -->
    <div class="chip-ctx-backdrop" *ngIf="ctxMenu.visible" (click)="closeCtxMenu()"></div>
    <div class="chip-ctx-menu" *ngIf="ctxMenu.visible"
         [style.left.px]="ctxMenu.x" [style.top.px]="ctxMenu.y"
         (click)="$event.stopPropagation()">
      <button type="button" class="ctx-item" (click)="startEditType()">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        Rename
      </button>
      <div class="ctx-divider"></div>
      <button type="button" class="ctx-item ctx-item--danger" (click)="startDeleteType()">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Delete
      </button>
    </div>

    <!-- ── Rename log type overlay ── -->
    <div class="edit-type-overlay" *ngIf="editTypeId !== null" (click)="cancelEditType()">
      <div class="edit-type-panel" (click)="$event.stopPropagation()">
        <p class="edit-type-title">Rename Log Type</p>
        <input
          class="edit-type-input"
          type="text"
          name="editTypeName"
          [(ngModel)]="editTypeName"
          maxlength="40"
          autocomplete="off"
          placeholder="New name"
          (keydown)="onEditTypeKeydown($event)"
        />
        <div class="edit-type-error" *ngIf="editTypeError">{{ editTypeError }}</div>
        <div class="edit-type-actions">
          <button type="button" class="btn-edit-cancel" (click)="cancelEditType()">Cancel</button>
          <button type="button" class="btn-edit-save"
                  (click)="saveEditType()"
                  [disabled]="editTypeSaving || !editTypeName.trim()">
            {{ editTypeSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Delete log type confirmation ── -->
    <app-confirm-dialog
      [visible]="deleteConfirmType !== null"
      title="Delete Log Type"
      [message]="deleteTypeConfirmMessage"
      detail="Existing logs using this type are not affected."
      okLabel="Delete"
      (confirmed)="onDeleteTypeConfirmed()"
      (cancelled)="deleteConfirmType = null"
    ></app-confirm-dialog>

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
      padding: 16px;
      width: 500px; max-width: 96vw;
      height: 90vh; height: 90dvh; overflow-y: auto;
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
    .time-range-card { background: var(--bg-card); border-radius: var(--radius-sm); margin-bottom: 14px; overflow: hidden; }
    .time-range-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; flex-wrap: wrap; }
    .time-card-divider { height: 1px; background: var(--border-light); margin: 0 14px; }
    .date-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; }
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
    .next-day-badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 700; color: var(--highlight-selected); background: color-mix(in srgb, var(--highlight-selected) 14%, transparent); border: 1px solid color-mix(in srgb, var(--highlight-selected) 30%, transparent); border-radius: 10px; padding: 2px 7px; margin-top: 4px; cursor: pointer; white-space: nowrap; letter-spacing: 0.3px; transition: background 0.15s; }
    .next-day-badge:hover { background: color-mix(in srgb, var(--highlight-selected) 22%, transparent); }

    /* Form group */
    .form-group { margin-bottom: 12px; }
    .form-group > label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.7px; }

    /* Skeleton */
    .type-loading { display: flex; flex-direction: column; gap: 6px; }
    .skeleton-accordion { width: 100%; height: 38px; border-radius: var(--radius-sm); background: linear-gradient(90deg, var(--bg-card) 25%, var(--accent-hover) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Error */
    .type-error { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #ef5350; padding: 8px 10px; background: rgba(239,83,80,0.08); border-radius: var(--radius-sm); }
    .retry-btn { background: none; color: var(--highlight-selected); font-size: 12px; font-weight: 600; text-decoration: underline; margin-left: 4px; }

    /* ── Accordion ──────────────────────────────────────── */
    .accordion-list { display: flex; flex-direction: column; gap: 4px; }

    .accordion-item {
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      overflow: hidden;
      cursor: pointer;
    }

    .accordion-header {
      width: 100%; display: flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 13px; font-weight: 600;
      cursor: pointer; text-align: left;
      transition: background 0.15s, color 0.15s;
    }
    .accordion-header:hover { background: var(--accent-hover); color: var(--text-primary); }
    .accordion-header--open { background: var(--accent-hover); color: var(--text-primary); }

    .accordion-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
      transform: rotate(-90deg);
      transition: transform 0.2s ease;
    }
    .accordion-header--open .accordion-chevron { transform: rotate(0deg); }

    .accordion-label { flex: 1; }
    .accordion-label--new { color: var(--highlight-selected); }

    .accordion-count {
      font-size: 10px; font-weight: 700;
      color: var(--text-muted);
      background: var(--bg-surface);
      padding: 1px 6px; border-radius: 8px;
    }

    .accordion-active-hint {
      display: flex; align-items: center; gap: 5px;
      margin-left: 4px;
    }
    .accordion-active-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .accordion-active-name {
      font-size: 11px; color: var(--text-muted);
      max-width: 90px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
      font-weight: 500;
    }

    .accordion-body {
      padding: 8px 10px;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-light);
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    .accordion-item--new .accordion-header--new svg path { stroke: var(--highlight-selected); }

    /* Chips */
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .activity-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 20px; border: 1.5px solid transparent; background: var(--bg-card); color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s; }
    .activity-chip:hover { transform: translateY(-1px); color: var(--text-primary); }
    .activity-chip--active { font-weight: 700; border-width: 2px; }
    .chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .chip-source-badge { font-size: 9px; opacity: 0.7; margin-left: 1px; }

    /* ── Create new log type (inside accordion) ─────────── */
    .create-type-error {
      font-size: 12px; color: #ef5350;
      padding: 7px 10px; margin-bottom: 10px;
      background: rgba(239,83,80,0.1);
      border-radius: var(--radius-sm);
    }

    .create-fields { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
    .create-top-row { display: flex; gap: 8px; align-items: flex-end; }
    .create-field { display: flex; flex-direction: column; gap: 5px; }
    .create-field--name { flex: 1; min-width: 0; }
    .create-field--domain { width: 110px; flex-shrink: 0; }
    .create-field--color { /* full width below name+domain row */ }

    .create-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; }

    .create-input, .create-select {
      padding: 7px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
    }
    .create-input:focus, .create-select:focus { outline: none; border-color: var(--highlight-selected); }
    .create-input::placeholder { color: var(--text-muted); }
    .create-input:disabled, .create-select:disabled { opacity: 0.5; }

    .swatch-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .swatch-btn {
      width: 24px; height: 24px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      transition: transform 0.1s, border-color 0.1s;
      flex-shrink: 0;
    }
    .swatch-btn:hover { transform: scale(1.15); }
    .swatch-btn--active { border-color: var(--text-primary); transform: scale(1.15); }
    .swatch-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .create-actions { display: flex; justify-content: flex-end; }

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

    /* ── Custom log type context menu ───────────────────── */
    .chip-ctx-backdrop {
      position: fixed; inset: 0; z-index: 1199;
    }
    .chip-ctx-menu {
      position: fixed; z-index: 1200;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 4px 0;
      min-width: 130px;
      animation: fadeIn 0.1s ease;
    }
    .ctx-item {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 9px 14px;
      background: none; color: var(--text-secondary);
      font-size: 13px; font-weight: 500;
      text-align: left; cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .ctx-item:hover { background: var(--accent-hover); color: var(--text-primary); }
    .ctx-item--danger { color: #e94560; }
    .ctx-item--danger:hover { background: rgba(233,69,96,0.1); color: #e94560; }
    .ctx-divider { height: 1px; background: var(--border); margin: 3px 0; }

    /* ── Rename log type overlay ─────────────────────────── */
    .edit-type-overlay {
      position: fixed; inset: 0; z-index: 1200;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.15s ease;
    }
    .edit-type-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      padding: 22px 22px 18px;
      width: 320px; max-width: 92vw;
      box-shadow: var(--shadow);
      animation: slideUp 0.18s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .edit-type-title {
      font-size: 14px; font-weight: 700; color: var(--text-primary);
      margin-bottom: 12px;
    }
    .edit-type-input {
      width: 100%; box-sizing: border-box;
      padding: 9px 11px;
      background: var(--bg-card); border: 1px solid var(--border-light);
      border-radius: var(--radius-sm); color: var(--text-primary);
      font-size: 14px; font-family: inherit; outline: none;
    }
    .edit-type-input:focus { border-color: var(--highlight-selected); }
    .edit-type-error {
      font-size: 12px; color: #ef5350; margin-top: 6px;
    }
    .edit-type-actions {
      display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px;
    }
    .btn-edit-cancel {
      padding: 7px 16px; font-size: 13px; font-weight: 600;
      background: var(--bg-card); color: var(--text-secondary);
      border: 1px solid var(--border-light); border-radius: var(--radius-sm);
      cursor: pointer; transition: background 0.15s;
    }
    .btn-edit-cancel:hover { background: var(--accent-hover); color: var(--text-primary); }
    .btn-edit-save {
      padding: 7px 16px; font-size: 13px; font-weight: 600;
      background: var(--highlight-selected); color: #fff; border: none;
      border-radius: var(--radius-sm); cursor: pointer; transition: opacity 0.15s;
    }
    .btn-edit-save:hover:not(:disabled) { opacity: 0.85; }
    .btn-edit-save:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Description textarea ───────────────────────────── */
    .description-textarea {
      width: 100%;
      resize: none;
      padding: 8px 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
      line-height: 1.5;
      overflow-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
    }
    .description-textarea:focus { border-color: var(--highlight-selected); outline: none; }
    .description-textarea::placeholder { color: var(--text-muted); }

    /* ── Ticket ID input ─────────────────────────────────── */
    .ticket-id-input {
      width: 100%;
      padding: 8px 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
    }
    .ticket-id-input:focus { border-color: var(--highlight-selected); outline: none; }
    .ticket-id-input::placeholder { color: var(--text-muted); }

    /* ── Priority ───────────────────────────────────────── */
    .priority-row { display: flex; gap: 6px; }
    .priority-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 20px;
      border: 1.5px solid transparent;
      font-size: 12px; font-weight: 600;
      background: var(--bg-card); color: var(--text-muted);
      cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .priority-btn:hover { color: var(--text-primary); }
    .priority-btn .priority-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: currentColor; }
    .priority-btn--high  { --p-color: #e94560; }
    .priority-btn--medium { --p-color: #f5a623; }
    .priority-btn--low   { --p-color: #4caf7d; }
    .priority-btn--high  .priority-dot  { background: #e94560; }
    .priority-btn--medium .priority-dot { background: #f5a623; }
    .priority-btn--low   .priority-dot  { background: #4caf7d; }
    .priority-btn--high.priority-btn--active  { border-color: #e94560; color: #e94560; background: rgba(233,69,96,0.1); }
    .priority-btn--medium.priority-btn--active { border-color: #f5a623; color: #f5a623; background: rgba(245,166,35,0.1); }
    .priority-btn--low.priority-btn--active   { border-color: #4caf7d; color: #4caf7d; background: rgba(76,175,125,0.1); }

    /* ── Collaborators ───────────────────────────────────── */
    .collab-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .collab-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 14px;
      background: color-mix(in srgb, var(--highlight-selected) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--highlight-selected) 30%, transparent);
      color: var(--highlight-selected); font-size: 12px; font-weight: 500;
    }
    .collab-chip-remove {
      background: none; color: var(--highlight-selected);
      font-size: 15px; line-height: 1; padding: 0 2px;
      opacity: 0.7; cursor: pointer; border-radius: 50%;
      transition: opacity 0.15s;
    }
    .collab-chip-remove:hover { opacity: 1; }
    .collab-input-row { display: flex; gap: 6px; }
    .collab-input {
      flex: 1; min-width: 0;
      padding: 7px 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary); font-size: 13px; font-family: inherit;
      box-sizing: border-box;
    }
    .collab-input:focus { border-color: var(--highlight-selected); outline: none; }
    .collab-input::placeholder { color: var(--text-muted); }
    .collab-add-btn {
      padding: 7px 14px; font-size: 12px; font-weight: 600;
      background: var(--bg-card); color: var(--text-secondary);
      border: 1px solid var(--border-light); border-radius: var(--radius-sm);
      cursor: pointer; white-space: nowrap; flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .collab-add-btn:hover:not(:disabled) { background: var(--accent-hover); color: var(--text-primary); }
    .collab-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Actions */
    .form-actions { display: flex; gap: 10px; margin-top: 12px; }
    .btn-cancel { flex: 1; padding: 10px; background: var(--bg-card); color: var(--text-secondary); }
    .btn-cancel:hover { background: var(--accent-hover); color: var(--text-primary); }
    .btn-save { flex: 2; padding: 10px; background: var(--highlight-selected); color: #fff; font-weight: 700; }
    .btn-save:hover:not(:disabled) { opacity: 0.88; }
    .btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Delete */
    .delete-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: center; }
    .btn-delete { background: none; color: #e94560; font-size: 12px; padding: 6px 12px; border-radius: var(--radius-sm); }
    .btn-delete:hover { background: rgba(233,69,96,0.1); }

    /* Entry type toggle */
    .entry-type-toggle {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
      background: var(--bg-card);
      border-radius: var(--radius-sm);
      padding: 4px;
    }
    .toggle-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      background: transparent;
      border-radius: var(--radius-sm);
      transition: background 0.15s, color 0.15s;
    }
    .toggle-btn:hover { color: var(--text-primary); }
    .toggle-btn--active {
      background: var(--bg-surface);
      color: var(--highlight-selected);
      box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    }
    .point-hint {
      font-size: 11px;
      color: var(--text-muted);
      font-style: italic;
      margin-top: 14px;
    }
  `]
})
export class LogFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() startTime            = '00:00';
  @Input() endTime              = '01:00';
  @Input() editEntry:            LogEntry | null = null;
  @Input() currentDate          = '';
  @Input() preselectedLogTypeId: string | null = null;
  @Input() mergeSourceIds:       [string, string] | null = null;

  @Output() logChanged = new EventEmitter<void>();
  @Output() cancelled  = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();

  // ── log types ─────────────────────────────────────────
  logTypes:     LogType[] = [];
  groupedTypes: { domain: string; types: LogType[] }[] = [];
  loadingTypes  = true;
  typeLoadError = false;

  // ── time ──────────────────────────────────────────────
  formStartTime = '00:00';
  formEndTime   = '01:00';
  formDate      = '';
  formEndDate   = '';  // same as formDate unless cross-midnight

  // ── type selection ─────────────────────────────────────
  selectedLogType: LogType | null = null;

  // ── description ────────────────────────────────────────
  labelValue = '';
  ticketId   = '';
  editMode   = false;
  entryType: 'range' | 'point' = 'point';

  // ── priority & collaborators ───────────────────────────
  priority: 'High' | 'Medium' | 'Low' | null = null;
  collaborators: string[] = [];
  collaboratorInput = '';

  // ── save state ────────────────────────────────────────
  saving = false;

  // ── accordion state ────────────────────────────────────
  openAccordions = new Set<string>();

  // ── 15 pastel log-type colours (1.50) ─────────────────
  readonly paletteColors = [
    '#F2A65A', '#D97D55', '#C4844A', '#9E3B3B', '#703B3B',
    '#6F8F72', '#4D7A60', '#5A9CB5', '#3E6480', '#213C51',
    '#7898A8', '#574964', '#7A5A74', '#BFC6C4', '#8C8C8C'
  ];

  // ── create new type inline form ────────────────────────
  newTypeName     = '';
  newTypeDomain:  'work' | 'personal' = 'work';
  newTypeColor    = '#F2A65A';
  creatingType    = false;
  createTypeError = '';

  // ── context menu (right-click / long-press on user chips) ─
  ctxMenu: { visible: boolean; x: number; y: number; logType: LogType | null } =
    { visible: false, x: 0, y: 0, logType: null };
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressActivated = false;

  // ── rename log type ────────────────────────────────────
  editTypeId:    string | null = null;
  editTypeName:  string = '';
  editTypeSaving = false;
  editTypeError  = '';

  // ── delete log type ────────────────────────────────────
  deleteConfirmType: LogType | null = null;

  get deleteTypeConfirmMessage(): string {
    return `Delete "${this.deleteConfirmType?.name ?? ''}"?`;
  }

  constructor(
    private logService:     LogService,
    private logTypeService: LogTypeService,
    private cdr:            ChangeDetectorRef,
  ) {}

  // ── computed ───────────────────────────────────────────

  get isNextDay(): boolean {
    return !!(this.formEndDate && this.formDate && this.formEndDate !== this.formDate);
  }

  get durationLabel(): string {
    const dayDiff = this.isNextDay ? 1440 : 0;
    const diff = this.toMins(this.formEndTime) - this.toMins(this.formStartTime) + dayDiff;
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60), m = diff % 60;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  }

  get showTicketId(): boolean {
    return this.selectedLogType?.domain === 'work';
  }

  get canSave(): boolean {
    if (!this.selectedLogType) return false;
    if (this.entryType === 'point') return true;
    const dayDiff = this.isNextDay ? 1440 : 0;
    return this.toMins(this.formEndTime) - this.toMins(this.formStartTime) + dayDiff > 0;
  }

  isActive(lt: LogType): boolean {
    return this.selectedLogType?._id === lt._id;
  }

  domainLabel(domain: string): string {
    return DOMAIN_LABELS[domain] ?? domain;
  }

  isAccordionOpen(key: string): boolean {
    return this.openAccordions.has(key);
  }

  toggleAccordion(key: string): void {
    if (this.openAccordions.has(key)) {
      this.openAccordions.delete(key);
    } else {
      this.openAccordions.clear();   // close any other open accordion
      this.openAccordions.add(key);
      if (key === '__new__') {
        this.newTypeName     = '';
        this.newTypeDomain   = 'work';
        this.newTypeColor    = '#F2A65A';
        this.createTypeError = '';
      }
    }
  }

  hasActiveInGroup(group: { domain: string; types: LogType[] }): boolean {
    return group.types.some(lt => this.isActive(lt));
  }

  activeColorInGroup(group: { domain: string; types: LogType[] }): string {
    return group.types.find(lt => this.isActive(lt))?.color ?? '';
  }

  activeNameInGroup(group: { domain: string; types: LogType[] }): string {
    return group.types.find(lt => this.isActive(lt))?.name ?? '';
  }

  // ── lifecycle ──────────────────────────────────────────

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void { this.loadLogTypes(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editEntry'] || changes['startTime'] || changes['endTime']) {
      this.initForm();
    }
  }

  loadLogTypes(): void {
    this.loadingTypes  = true;
    this.typeLoadError = false;

    this.logTypeService.getLogTypes().pipe(takeUntil(this.destroy$)).subscribe({
      next: (types) => {
        this.logTypes     = types;
        this.groupedTypes = this.buildGroups(types);
        this.loadingTypes = false;
        this.initForm();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingTypes  = false;
        this.typeLoadError = true;
        this.cdr.markForCheck();
      }
    });
  }

  initForm(): void {
    this.openAccordions.clear();
    if (this.editEntry) {
      this.editMode      = true;
      this.formStartTime = this.editEntry.startAt;
      this.formEndTime   = this.editEntry.endAt ?? '01:00';
      this.formDate      = this.editEntry.date;
      this.formEndDate   = this.editEntry.endDate ?? this.editEntry.date;
      this.labelValue    = this.editEntry.title;
      this.ticketId      = this.editEntry.ticketId ?? '';
      this.priority      = this.editEntry.priority ?? null;
      this.collaborators = [...(this.editEntry.collaborators ?? [])];
      this.collaboratorInput = '';

      // Restore log type — match by id first, then by name
      this.selectedLogType =
        this.logTypes.find(lt => lt._id === this.editEntry!.logType?.id) ??
        this.logTypes.find(lt => lt.name.toLowerCase() === this.editEntry!.logType?.name?.toLowerCase()) ??
        null;

      // Restore entry type
      if (this.editEntry.entryType === 'point') {
        this.entryType     = 'point';
        this.formStartTime = this.editEntry.startAt; // reuse startAt as pointTime field
      } else {
        this.entryType = 'range';
      }
    } else {
      this.editMode          = false;
      this.formStartTime     = this.startTime;
      this.formEndTime       = this.endTime;
      this.formDate          = this.currentDate;
      this.formEndDate       = this.currentDate;
      this.labelValue        = '';
      this.ticketId          = '';
      this.priority          = null;
      this.collaborators     = [];
      this.collaboratorInput = '';
      this.selectedLogType =
        (this.preselectedLogTypeId
          ? this.logTypes.find(lt => lt._id === this.preselectedLogTypeId)
          : undefined)
        ?? this.logTypes.find(lt => lt.name === 'Meeting')
        ?? this.logTypes.find(lt => lt.domain === 'work')
        ?? this.logTypes[0]
        ?? null;

      // Default to point mode; auto-switch to range only if a pre-filled time range was dragged
      this.entryType = (this.startTime && this.endTime && this.startTime !== this.endTime)
        ? 'range'
        : 'point';
    }
  }

  // ── chip selection ─────────────────────────────────────

  selectLogType(lt: LogType): void {
    this.selectedLogType = lt;
    if (lt.category === 'food') { this.entryType = 'point'; }
  }

  onChipClick(lt: LogType): void {
    if (this.longPressActivated) { this.longPressActivated = false; return; }
    this.selectLogType(lt);
  }

  // ── context menu (long-press / right-click) ────────────

  onChipPointerDown(event: PointerEvent, lt: LogType): void {
    if (lt.source !== 'user' || event.button !== 0) return;
    this.longPressActivated = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressActivated = true;
      this.openCtxMenu(event.clientX, event.clientY, lt);
      this.cdr.markForCheck();
    }, 500);
  }

  onChipPointerUp(): void {
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
  }

  onChipPointerMove(): void {
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
  }

  onChipContextMenu(event: MouseEvent, lt: LogType): void {
    if (lt.source !== 'user') return;
    event.preventDefault();
    this.openCtxMenu(event.clientX, event.clientY, lt);
  }

  private openCtxMenu(x: number, y: number, lt: LogType): void {
    const cx = Math.min(x, window.innerWidth  - 145);
    const cy = Math.min(y, window.innerHeight - 90);
    this.ctxMenu = { visible: true, x: cx, y: cy, logType: lt };
  }

  closeCtxMenu(): void {
    this.ctxMenu = { visible: false, x: 0, y: 0, logType: null };
  }

  // ── rename log type ────────────────────────────────────

  startEditType(): void {
    if (!this.ctxMenu.logType) return;
    this.editTypeId    = this.ctxMenu.logType._id;
    this.editTypeName  = this.ctxMenu.logType.name;
    this.editTypeError = '';
    this.closeCtxMenu();
  }

  cancelEditType(): void {
    this.editTypeId = null; this.editTypeName = ''; this.editTypeError = '';
  }

  onEditTypeKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter')  { event.preventDefault(); this.saveEditType(); }
    if (event.key === 'Escape') { this.cancelEditType(); }
  }

  saveEditType(): void {
    if (!this.editTypeId || !this.editTypeName.trim() || this.editTypeSaving) return;
    this.editTypeSaving = true;
    this.editTypeError  = '';
    this.logTypeService.updateLogTypeName(this.editTypeId, this.editTypeName.trim()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.editTypeSaving = false;
        this.logTypes     = this.logTypes.map(lt => lt._id === updated._id ? updated : lt);
        this.groupedTypes = this.buildGroups(this.logTypes);
        if (this.selectedLogType?._id === updated._id) this.selectedLogType = updated;
        this.cancelEditType();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.editTypeSaving = false;
        this.editTypeError  = err?.error?.error ?? 'Failed to rename. Try again.';
        this.cdr.markForCheck();
      }
    });
  }

  // ── delete log type ────────────────────────────────────

  startDeleteType(): void {
    if (!this.ctxMenu.logType) return;
    this.deleteConfirmType = this.ctxMenu.logType;
    this.closeCtxMenu();
  }

  onDeleteTypeConfirmed(): void {
    if (!this.deleteConfirmType) return;
    const id = this.deleteConfirmType._id;
    this.deleteConfirmType = null;
    this.logTypeService.deleteLogType(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.logTypes     = this.logTypes.filter(lt => lt._id !== id);
        this.groupedTypes = this.buildGroups(this.logTypes);
        if (this.selectedLogType?._id === id) {
          this.selectedLogType =
            this.logTypes.find(lt => lt.name === 'Meeting') ??
            this.logTypes.find(lt => lt.domain === 'work')  ??
            this.logTypes[0] ?? null;
        }
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  // ── create new type ────────────────────────────────────

  submitCreateType(): void {
    if (!this.newTypeName.trim() || this.creatingType) return;

    this.creatingType    = true;
    this.createTypeError = '';

    this.logTypeService.createLogType({
      name:   this.newTypeName.trim(),
      domain: this.newTypeDomain,
      color:  this.newTypeColor
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (created) => {
        this.creatingType = false;

        // Add the new type to local list and rebuild groups
        this.logTypes     = [...this.logTypes, created];
        this.groupedTypes = this.buildGroups(this.logTypes);

        // Auto-select it
        this.selectedLogType = created;

        // Close create accordion, open the domain accordion so user sees the new type
        this.openAccordions.delete('__new__');
        this.openAccordions.add(created.domain);

        // Reset create form
        this.newTypeName  = '';
        this.newTypeColor = '#4A90E2';
        this.newTypeDomain = 'work';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creatingType    = false;
        this.createTypeError = err?.error?.error ?? 'Failed to create log type. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  // ── priority & collaborators ───────────────────────────

  togglePriority(value: 'High' | 'Medium' | 'Low'): void {
    this.priority = this.priority === value ? null : value;
  }

  addCollaborator(): void {
    const name = this.collaboratorInput.trim();
    if (!name || this.collaborators.includes(name)) return;
    this.collaborators = [...this.collaborators, name];
    this.collaboratorInput = '';
  }

  removeCollaborator(index: number): void {
    this.collaborators = this.collaborators.filter((_, i) => i !== index);
  }

  // ── form submit ────────────────────────────────────────

  save(): void {
    if (!this.canSave || this.saving) return;

    const entry: CreateLogEntry = {
      startTime:     this.formStartTime,
      endTime:       this.formEndTime,
      title:         this.labelValue.trim() || this.selectedLogType?.name || '',
      logTypeId:     this.selectedLogType!._id,
      date:          this.formDate || undefined,
      endDate:       this.entryType === 'range' && this.isNextDay ? this.formEndDate : undefined,
      entryType:     this.entryType,
      pointTime:     this.entryType === 'point' ? this.formStartTime : undefined,
      ticketId:      this.showTicketId ? (this.ticketId.trim() || undefined) : undefined,
      priority:      this.priority ?? undefined,
      collaborators: this.collaborators.length > 0 ? [...this.collaborators] : undefined,
    };

    this.saving = true;
    this.cdr.markForCheck();

    if (this.editMode && this.editEntry) {
      const targetDate = this._dateFromStr(this.formDate);
      this.logService.updateLog(targetDate, this.editEntry.id, entry)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next:  () => { this.saving = false; this.logChanged.emit(); this.cancel(); },
          error: () => { this.saving = false; this.cdr.markForCheck(); alert('Failed to update log. Please try again.'); },
        });
    } else {
      const targetDate = this._dateFromStr(this.formDate);
      this.logService.createLog(targetDate, entry)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            const idsToDelete = this.mergeSourceIds;
            this.saving = false;
            if (idsToDelete) {
              forkJoin([
                this.logService.deleteLog(targetDate, idsToDelete[0]),
                this.logService.deleteLog(targetDate, idsToDelete[1]),
              ]).pipe(takeUntil(this.destroy$)).subscribe({
                next:  () => { this.logChanged.emit(); this.cancel(); },
                error: () => { this.logChanged.emit(); this.cancel(); },
              });
            } else {
              this.logChanged.emit();
              this.cancel();
            }
          },
          error: () => { this.saving = false; this.cdr.markForCheck(); alert('Failed to save log. Please try again.'); },
        });
    }
  }

  private _dateFromStr(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  deleteConfirmVisible = false;

  get deleteConfirmMessage(): string {
    return `Delete "${this.editEntry?.title ?? ''}"? This cannot be undone.`;
  }

  deleteEntry(): void {
    if (!this.editEntry) return;
    this.deleteConfirmVisible = true;
  }

  onDeleteConfirmed(): void {
    this.deleteConfirmVisible = false;
    if (!this.editEntry) return;
    const date = this._dateFromStr(this.editEntry.date);
    this.logService.deleteLog(date, this.editEntry.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  () => { this.logChanged.emit(); this.cancel(); },
        error: () => alert('Failed to delete log. Please try again.'),
      });
  }

  onDeleteCancelled(): void {
    this.deleteConfirmVisible = false;
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

  onEndTimeChange(): void {
    if (this.entryType !== 'range') return;
    if (this.toMins(this.formEndTime) < this.toMins(this.formStartTime)) {
      this.formEndDate = this.addDays(this.formDate, 1);
    } else {
      this.formEndDate = this.formDate;
    }
  }

  onStartTimeChange(): void {
    if (this.entryType !== 'range') return;
    if (this.isNextDay && this.toMins(this.formEndTime) >= this.toMins(this.formStartTime)) {
      this.formEndDate = this.formDate;
    }
  }

  onStartDateChange(): void {
    if (this.isNextDay) {
      this.formEndDate = this.addDays(this.formDate, 1);
    } else {
      this.formEndDate = this.formDate;
    }
  }

  resetEndToSameDay(): void {
    this.formEndDate = this.formDate;
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private toMins(time: string): number {
    if (!time?.includes(':')) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  trackByIndex(index: number): number { return index; }
  trackByDomain(_i: number, g: { domain: string }): string { return g.domain; }
  trackByLogTypeId(_i: number, lt: LogType): string { return lt._id; }
  trackByColor(_i: number, c: string): string { return c; }
}
