import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { JourneyService } from '../../services/journey.service';
import {
  Journey, CreateJourney, JourneyEntry, CreateJourneyEntry,
  JourneySpan, ValueType, JourneyConfig, ValueMetric
} from '../../models/journey.model';

type SubView = 'list' | 'detail';

@Component({
  selector: 'app-journeys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jrn-root">

      <!-- ════════════════════════════════════════════════════
           LIST VIEW
      ════════════════════════════════════════════════════ -->
      <ng-container *ngIf="subView === 'list'">

        <div class="jrn-page-header">
          <div>
            <h2 class="jrn-page-title">Journey Logs</h2>
            <p class="jrn-page-sub">Track anything that matters over time</p>
          </div>
          <button class="jrn-pill-btn jrn-pill-btn--primary" (click)="openCreate()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New
          </button>
        </div>

        <!-- Empty state -->
        <div class="jrn-empty" *ngIf="journeys.length === 0 && !loading">
          <div class="jrn-empty-orb">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <p class="jrn-empty-title">Start your first journey</p>
          <p class="jrn-empty-sub">Track weight, mood, steps — anything with a date and a value.</p>
          <button class="jrn-pill-btn jrn-pill-btn--primary" (click)="openCreate()">Create Journey</button>
        </div>

        <!-- Journey cards -->
        <div class="jrn-card-list" *ngIf="journeys.length > 0">
          <div class="jrn-journey-card" *ngFor="let j of journeys; trackBy: trackByJourneyId" (click)="openDetail(j)">
            <div class="jrn-journey-card-body">
              <div class="jrn-journey-card-top">
                <span class="jrn-journey-name">{{ j.name }}</span>
                <span class="jrn-status-pill" [class]="'jrn-status--' + j.status">{{ j.status }}</span>
              </div>
              <div class="jrn-journey-card-chips">
                <span class="jrn-chip">{{ j.config.metricName || 'Metric' }}</span>
                <span class="jrn-chip jrn-chip--dim">{{ j.config.valueType }}</span>
                <span class="jrn-chip jrn-chip--dim">
                  {{ j.startDate | date:'MMM d, y' }}
                  <ng-container *ngIf="j.span === 'indefinite'"> · ongoing</ng-container>
                  <ng-container *ngIf="j.span === 'definite' && j.endDate"> → {{ j.endDate | date:'MMM d, y' }}</ng-container>
                </span>
              </div>
            </div>
            <svg class="jrn-journey-card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        <div class="jrn-loading" *ngIf="loading">
          <span class="jrn-loading-dot"></span>Loading journeys…
        </div>

      </ng-container>

      <!-- ════════════════════════════════════════════════════
           DETAIL VIEW
      ════════════════════════════════════════════════════ -->
      <ng-container *ngIf="subView === 'detail' && selectedJourney">

        <div class="jrn-nav-row">
          <button class="jrn-back-btn" (click)="backToList()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            All Journeys
          </button>
        </div>

        <!-- Hero card: VIEW mode -->
        <div class="jrn-hero-card" *ngIf="!editingJourney">
          <div class="jrn-hero-top">
            <h2 class="jrn-hero-name">{{ selectedJourney.name }}</h2>
            <span class="jrn-status-pill" [class]="'jrn-status--' + selectedJourney.status">
              {{ selectedJourney.status }}
            </span>
          </div>
          <div class="jrn-hero-chips">
            <span class="jrn-chip" *ngIf="selectedJourney.trackerType !== 'derived'">
              {{ selectedJourney.config.metricName || 'Metric' }}
            </span>
            <span class="jrn-chip" *ngIf="selectedJourney.trackerType === 'derived' && selectedJourney.derivedFrom">
              {{ selectedJourney.derivedFrom.logTypeName || 'Logger' }}
            </span>
            <span class="jrn-chip jrn-chip--dim" *ngIf="selectedJourney.trackerType !== 'derived'">
              {{ selectedJourney.config.valueType }}
            </span>
            <span class="jrn-chip jrn-chip--dim" *ngIf="selectedJourney.trackerType === 'derived' && selectedJourney.derivedFrom">
              {{ valueMetricLabel(selectedJourney.derivedFrom.valueMetric) }}
            </span>
            <span class="jrn-chip jrn-chip--dim">
              {{ selectedJourney.startDate | date:'MMM d, y' }}
              <ng-container *ngIf="selectedJourney.span === 'indefinite'"> · ongoing</ng-container>
              <ng-container *ngIf="selectedJourney.span === 'definite' && selectedJourney.endDate">
                → {{ selectedJourney.endDate | date:'MMM d, y' }}
              </ng-container>
            </span>
          </div>
          <!-- Derived source badge -->
          <div class="jrn-derived-banner" *ngIf="selectedJourney.trackerType === 'derived' && selectedJourney.derivedFrom">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Auto-synced from <strong>{{ selectedJourney.derivedFrom.logTypeName || 'Logger' }}</strong>
            · tracks {{ valueMetricLabel(selectedJourney.derivedFrom.valueMetric) }}
          </div>
          <div class="jrn-hero-footer">
            <button class="jrn-text-danger-btn" (click)="confirmDelete()">Delete journey</button>
            <button class="jrn-hero-edit-btn" (click)="openEditJourney()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          </div>
        </div>

        <!-- Hero card: EDIT mode -->
        <div class="jrn-hero-card jrn-hero-card--edit" *ngIf="editingJourney">
          <p class="jrn-edit-heading">Edit Journey</p>

          <div class="jrn-field">
            <label class="jrn-label">Name</label>
            <input class="jrn-input" type="text" [(ngModel)]="editForm.name" name="editName" autocomplete="off">
          </div>

          <div class="jrn-field">
            <label class="jrn-label">Status</label>
            <div class="jrn-seg">
              <button type="button" class="jrn-seg-opt" *ngFor="let s of statusOptions; trackBy: trackByValue"
                      [class.jrn-seg-opt--active]="editForm.status === s.value"
                      (click)="editForm.status = s.value">{{ s.label }}</button>
            </div>
          </div>

          <div class="jrn-field">
            <label class="jrn-label">Span</label>
            <div class="jrn-seg">
              <button type="button" class="jrn-seg-opt"
                      [class.jrn-seg-opt--active]="editForm.span === 'indefinite'"
                      (click)="editForm.span = 'indefinite'">Indefinite</button>
              <button type="button" class="jrn-seg-opt"
                      [class.jrn-seg-opt--active]="editForm.span === 'definite'"
                      (click)="editForm.span = 'definite'">Fixed End</button>
            </div>
          </div>
          <div class="jrn-field" *ngIf="editForm.span === 'definite'">
            <label class="jrn-label">End Date</label>
            <input class="jrn-input" type="date" [(ngModel)]="editForm.endDate" name="editEndDate">
          </div>

          <!-- Point-log config -->
          <ng-container *ngIf="selectedJourney.trackerType === 'point-log'">
            <div class="jrn-field">
              <label class="jrn-label">Metric Name</label>
              <input class="jrn-input" type="text" [(ngModel)]="editForm.config.metricName"
                     name="editMetricName" autocomplete="off">
            </div>
            <div class="jrn-field">
              <label class="jrn-label">Value Type</label>
              <div class="jrn-seg">
                <button type="button" class="jrn-seg-opt"
                        [class.jrn-seg-opt--active]="editForm.config.valueType === 'numeric'"
                        (click)="editForm.config.valueType = 'numeric'">Numeric</button>
                <button type="button" class="jrn-seg-opt"
                        [class.jrn-seg-opt--active]="editForm.config.valueType === 'categorical'"
                        (click)="editForm.config.valueType = 'categorical'">Categorical</button>
              </div>
            </div>
          </ng-container>

          <!-- Derived config -->
          <ng-container *ngIf="selectedJourney.trackerType === 'derived'">
            <div class="jrn-field">
              <label class="jrn-label">Log Type to track</label>
              <select class="jrn-input" [(ngModel)]="editForm.derivedLogTypeId" name="editDerivedLogType">
                <option value="" disabled>Select a log type…</option>
                <optgroup label="Work" *ngIf="workLogTypes.length > 0">
                  <option *ngFor="let lt of workLogTypes; trackBy: trackByLogTypeId" [value]="lt._id">{{ lt.name }}</option>
                </optgroup>
                <optgroup label="Personal" *ngIf="personalLogTypes.length > 0">
                  <option *ngFor="let lt of personalLogTypes; trackBy: trackByLogTypeId" [value]="lt._id">{{ lt.name }}</option>
                </optgroup>
                <optgroup label="Family" *ngIf="familyLogTypes.length > 0">
                  <option *ngFor="let lt of familyLogTypes; trackBy: trackByLogTypeId" [value]="lt._id">{{ lt.name }}</option>
                </optgroup>
              </select>
            </div>
            <div class="jrn-field">
              <label class="jrn-label">Value to track</label>
              <div class="jrn-metric-grid">
                <button type="button" class="jrn-metric-opt"
                        *ngFor="let m of valueMetricOptions; trackBy: trackByValue"
                        [class.jrn-metric-opt--active]="editForm.derivedValueMetric === m.value"
                        (click)="editForm.derivedValueMetric = m.value">
                  <span class="jrn-metric-icon">{{ m.icon }}</span>
                  <span class="jrn-metric-label">{{ m.label }}</span>
                  <span class="jrn-metric-hint">{{ m.hint }}</span>
                </button>
              </div>
            </div>
          </ng-container>

          <div class="jrn-error-banner" *ngIf="editError">{{ editError }}</div>

          <div class="jrn-form-actions">
            <button type="button" class="jrn-pill-btn jrn-pill-btn--ghost"
                    (click)="cancelEditJourney()">Cancel</button>
            <button type="button" class="jrn-pill-btn jrn-pill-btn--primary"
                    [disabled]="savingEdit" (click)="saveEditJourney()">
              {{ savingEdit ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </div>

        <!-- Metrics card -->
        <div class="jrn-metrics-card" *ngIf="avgValue !== null">
          <p class="jrn-metrics-heading">Metrics</p>
          <div class="jrn-metrics-row">
            <div class="jrn-metric-tile">
              <span class="jrn-metric-tile-label">Average Value</span>
              <span class="jrn-metric-tile-value">{{ avgValue }}</span>
              <span class="jrn-metric-tile-sub" *ngIf="selectedJourney.trackerType === 'point-log'">{{ selectedJourney.config.metricName }}</span>
              <span class="jrn-metric-tile-sub" *ngIf="selectedJourney.trackerType === 'derived'">per log · {{ entries.length }} total</span>
            </div>
          </div>
        </div>

        <!-- Entries section -->
        <div class="jrn-section-header">
          <span class="jrn-section-title">Entries</span>
          <div class="jrn-section-actions">
            <!-- Derived: resync button -->
            <button class="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--sm"
                    *ngIf="selectedJourney.trackerType === 'derived'"
                    [disabled]="resyncing"
                    (click)="resyncJourney()"
                    title="Re-sync all entries from Logger history">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {{ resyncing ? 'Syncing…' : 'Re-sync' }}
            </button>
            <!-- Manual: add entry button -->
            <button class="jrn-pill-btn jrn-pill-btn--primary jrn-pill-btn--sm"
                    *ngIf="selectedJourney.trackerType !== 'derived'"
                    (click)="addingEntry ? closeAddEntry() : openAddEntry()">
              {{ addingEntry ? '✕ Cancel' : '+ Add Entry' }}
            </button>
          </div>
        </div>

        <!-- Add entry form -->
        <div class="jrn-entry-form-card" *ngIf="addingEntry">
          <div class="jrn-entry-fields">
            <div class="jrn-field">
              <label class="jrn-label">Date</label>
              <input class="jrn-input" type="date" [(ngModel)]="entryFormDate" name="entryDate">
            </div>
            <div class="jrn-field">
              <label class="jrn-label">Time</label>
              <div class="jrn-drum-time-row">
                <div class="jrn-drum-col">
                  <div class="jrn-drum-wrapper">
                    <div class="jrn-drum-center-band"></div>
                    <div class="jrn-drum jrn-drum-h" (scroll)="onEntryHourScroll($event)">
                      <div class="jrn-drum-spacer"></div>
                      <div class="jrn-drum-item" *ngFor="let h of entryHours; trackBy: trackByIndex"
                           [class.jrn-drum-item--sel]="h === entryFormHour">
                        {{ h | number:'2.0-0' }}
                      </div>
                      <div class="jrn-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="jrn-drum-unit">h</span>
                </div>
                <div class="jrn-drum-colon">:</div>
                <div class="jrn-drum-col">
                  <div class="jrn-drum-wrapper">
                    <div class="jrn-drum-center-band"></div>
                    <div class="jrn-drum jrn-drum-m" (scroll)="onEntryMinuteScroll($event)">
                      <div class="jrn-drum-spacer"></div>
                      <div class="jrn-drum-item" *ngFor="let m of entryMinutes; trackBy: trackByIndex"
                           [class.jrn-drum-item--sel]="m === entryFormMinute">
                        {{ m | number:'2.0-0' }}
                      </div>
                      <div class="jrn-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="jrn-drum-unit">m</span>
                </div>
              </div>
            </div>
            <div class="jrn-field" *ngIf="selectedJourney.config.valueType === 'numeric'">
              <label class="jrn-label">{{ selectedJourney.config.metricName || 'Value' }}</label>
              <input class="jrn-input" type="number" step="any"
                     [(ngModel)]="entryForm.numericValue" name="entryNumeric" placeholder="0.0">
            </div>
            <div class="jrn-field" *ngIf="selectedJourney.config.valueType === 'categorical'">
              <label class="jrn-label">{{ selectedJourney.config.metricName || 'Value' }}</label>
              <select class="jrn-input" [(ngModel)]="entryForm.categoricalValue" name="entryCategorical">
                <option value="" disabled>Select…</option>
                <option *ngFor="let v of selectedJourney.config.allowedValues; trackBy: trackByIndex" [value]="v">{{ v }}</option>
              </select>
            </div>
          </div>
          <div class="jrn-error-banner" *ngIf="entryError">{{ entryError }}</div>
          <button class="jrn-pill-btn jrn-pill-btn--primary jrn-entry-save-btn"
                  [disabled]="savingEntry" (click)="submitEntry()">
            {{ savingEntry ? 'Saving…' : 'Save Entry' }}
          </button>
        </div>

        <!-- Empty entries -->
        <div class="jrn-empty jrn-empty--sm" *ngIf="entries.length === 0 && !loadingEntries && !addingEntry">
          <div class="jrn-empty-orb jrn-empty-orb--sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <p class="jrn-empty-title">No entries yet</p>
          <ng-container *ngIf="selectedJourney.trackerType === 'derived'; else manualEmptyAction">
            <p class="jrn-empty-sub">Log something under <strong>{{ selectedJourney.derivedFrom?.logTypeName }}</strong> and entries will appear here automatically.</p>
            <button class="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--sm"
                    [disabled]="resyncing" (click)="resyncJourney()">
              {{ resyncing ? 'Syncing…' : 'Re-sync from history' }}
            </button>
          </ng-container>
          <ng-template #manualEmptyAction>
            <button class="jrn-pill-btn jrn-pill-btn--primary jrn-pill-btn--sm"
                    (click)="openAddEntry()">Add first entry</button>
          </ng-template>
        </div>

        <!-- Entries list -->
        <div class="jrn-entries" *ngIf="entries.length > 0">

          <!-- Derived: grouped by day -->
          <ng-container *ngIf="selectedJourney.trackerType === 'derived'">
            <div class="jrn-day-group" *ngFor="let group of dayGroups; trackBy: trackByDateStr">
              <div class="jrn-day-row" (click)="toggleDay(group.date)">
                <div class="jrn-entry-left">
                  <span class="jrn-entry-date">{{ group.displayDate }}</span>
                </div>
                <span class="jrn-day-count-chip">{{ group.count }} log{{ group.count !== 1 ? 's' : '' }}</span>
                <span class="jrn-entry-value">{{ group.consolidated }}</span>
                <svg class="jrn-expand-chevron" [class.jrn-expand-chevron--open]="group.expanded"
                     width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div class="jrn-day-sub-entries" *ngIf="group.expanded">
                <div class="jrn-sub-entry" *ngFor="let e of group.entries; trackBy: trackByEntryId">
                  <span class="jrn-sub-time">{{ e.timestamp | date:'h:mm a' }}</span>
                  <span class="jrn-entry-value jrn-sub-value">
                    <ng-container *ngIf="selectedJourney.derivedFrom?.valueMetric === 'duration'">{{ e.numericValue }}m</ng-container>
                    <ng-container *ngIf="selectedJourney.derivedFrom?.valueMetric === 'count'">1</ng-container>
                    <ng-container *ngIf="selectedJourney.derivedFrom?.valueMetric === 'start-time' || selectedJourney.derivedFrom?.valueMetric === 'end-time'">{{ minsToTimeStr(e.numericValue!) }}</ng-container>
                  </span>
                  <span class="jrn-sync-dot" title="Auto-synced from Logger">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- Point-log: flat list -->
          <ng-container *ngIf="selectedJourney.trackerType !== 'derived'">
            <div class="jrn-entry-card" *ngFor="let e of entries; trackBy: trackByEntryId">
              <div class="jrn-entry-left">
                <span class="jrn-entry-date">{{ e.timestamp | date:'MMM d, y' }}</span>
                <span class="jrn-entry-time">{{ e.timestamp | date:'h:mm a' }}</span>
              </div>
              <span class="jrn-entry-value" *ngIf="e.valueType === 'numeric'">{{ e.numericValue }}</span>
              <span class="jrn-entry-pill" *ngIf="e.valueType === 'categorical'">{{ e.categoricalValue }}</span>
              <button class="jrn-entry-del-btn" title="Delete" (click)="deleteEntry(e)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
          </ng-container>

        </div>

        <div class="jrn-loading" *ngIf="loadingEntries">
          <span class="jrn-loading-dot"></span>Loading entries…
        </div>

        <!-- Delete confirmation sheet -->
        <div class="jrn-sheet-backdrop" *ngIf="showDeleteConfirm" (click)="showDeleteConfirm = false">
          <div class="jrn-sheet" (click)="$event.stopPropagation()">
            <div class="jrn-sheet-handle"></div>
            <p class="jrn-sheet-title">Delete journey?</p>
            <p class="jrn-sheet-body">
              <strong>{{ selectedJourney.name }}</strong> and all its entries will be permanently removed.
            </p>
            <div class="jrn-sheet-actions">
              <button class="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--full"
                      (click)="showDeleteConfirm = false">Cancel</button>
              <button class="jrn-pill-btn jrn-pill-btn--danger jrn-pill-btn--full"
                      [disabled]="deleting" (click)="executeDelete()">
                {{ deleting ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>

      </ng-container>

      <!-- ════════════════════════════════════════════════════
           CREATE MODAL
      ════════════════════════════════════════════════════ -->
      <div class="jrn-modal-bd" *ngIf="showCreateModal" (click)="closeCreateModal()">
        <div class="jrn-modal" (click)="$event.stopPropagation()">
          <div class="jrn-modal-hdr">
            <h2 class="jrn-form-title" style="margin:0">New Journey</h2>
            <button class="jrn-modal-x" type="button" (click)="closeCreateModal()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <form (ngSubmit)="submitCreate()" #createForm="ngForm" class="jrn-modal-form">

            <div class="jrn-field">
              <label class="jrn-label">Journey Name <span class="jrn-req">*</span></label>
              <input class="jrn-input" type="text" [(ngModel)]="form.name" name="name"
                     placeholder="e.g. Weight Tracker, Daily Mood" required autocomplete="off">
            </div>

            <div class="jrn-field">
              <label class="jrn-label">Start Date <span class="jrn-req">*</span></label>
              <input class="jrn-input" type="date" [(ngModel)]="form.startDate" name="startDate" required>
            </div>

            <!-- Span toggle -->
            <div class="jrn-field">
              <label class="jrn-label">Journey Span <span class="jrn-req">*</span></label>
              <div class="jrn-seg">
                <button type="button" class="jrn-seg-opt"
                        [class.jrn-seg-opt--active]="form.span === 'indefinite'"
                        (click)="form.span = 'indefinite'">Indefinite</button>
                <button type="button" class="jrn-seg-opt"
                        [class.jrn-seg-opt--active]="form.span === 'definite'"
                        (click)="form.span = 'definite'">Fixed End Date</button>
              </div>
            </div>

            <div class="jrn-field" *ngIf="form.span === 'definite'">
              <label class="jrn-label">End Date <span class="jrn-req">*</span></label>
              <input class="jrn-input" type="date" [(ngModel)]="form.endDate" name="endDate"
                     [required]="form.span === 'definite'">
            </div>

            <!-- Tracker type tiles -->
            <div class="jrn-field">
              <label class="jrn-label">Tracker Type <span class="jrn-req">*</span></label>
              <div class="jrn-tracker-grid">
                <button type="button" class="jrn-tracker-tile"
                        [class.jrn-tracker-tile--active]="form.trackerType === 'point-log'"
                        (click)="form.trackerType = 'point-log'">
                  <span class="jrn-tracker-icon">📍</span>
                  <span class="jrn-tracker-name">Point Log</span>
                  <span class="jrn-tracker-badge">v1</span>
                </button>
                <button type="button" class="jrn-tracker-tile"
                        [class.jrn-tracker-tile--active]="form.trackerType === 'derived'"
                        (click)="form.trackerType = 'derived'">
                  <span class="jrn-tracker-icon">🔗</span>
                  <span class="jrn-tracker-name">Derived</span>
                  <span class="jrn-tracker-badge">v1</span>
                </button>
                <button type="button" class="jrn-tracker-tile jrn-tracker-tile--soon" disabled title="Coming soon">
                  <span class="jrn-tracker-icon">⏱</span>
                  <span class="jrn-tracker-name">Time Period</span>
                  <span class="jrn-tracker-badge jrn-tracker-badge--soon">soon</span>
                </button>
                <button type="button" class="jrn-tracker-tile jrn-tracker-tile--soon" disabled title="Coming soon">
                  <span class="jrn-tracker-icon">📝</span>
                  <span class="jrn-tracker-name">Journal</span>
                  <span class="jrn-tracker-badge jrn-tracker-badge--soon">soon</span>
                </button>
              </div>
            </div>

            <!-- Point Log config -->
            <div class="jrn-config-block" *ngIf="form.trackerType === 'point-log'">
              <p class="jrn-config-label">Point Log Setup</p>

              <div class="jrn-field">
                <label class="jrn-label">Metric Name</label>
                <input class="jrn-input" type="text" [(ngModel)]="form.config.metricName" name="metricName"
                       placeholder="Weight, Mood, Steps, Score…" autocomplete="off">
              </div>

              <div class="jrn-field">
                <label class="jrn-label">Value Type <span class="jrn-req">*</span></label>
                <div class="jrn-seg">
                  <button type="button" class="jrn-seg-opt"
                          [class.jrn-seg-opt--active]="form.config.valueType === 'numeric'"
                          (click)="form.config.valueType = 'numeric'">Numeric</button>
                  <button type="button" class="jrn-seg-opt"
                          [class.jrn-seg-opt--active]="form.config.valueType === 'categorical'"
                          (click)="form.config.valueType = 'categorical'">Categorical</button>
                </div>
              </div>

              <div class="jrn-field" *ngIf="form.config.valueType === 'categorical'">
                <label class="jrn-label">Allowed Values</label>
                <div class="jrn-tags" *ngIf="form.config.allowedValues.length > 0">
                  <span class="jrn-tag" *ngFor="let v of form.config.allowedValues; let i = index; trackBy: trackByIndex">
                    {{ v }}
                    <button type="button" class="jrn-tag-remove" (click)="removeAllowedValue(i)">×</button>
                  </span>
                </div>
                <div class="jrn-tag-input-row">
                  <input class="jrn-input" type="text"
                         [(ngModel)]="newAllowedValue" name="newAllowedValue"
                         placeholder="e.g. Happy, Neutral, Sad"
                         (keydown.enter)="$event.preventDefault(); addAllowedValue()">
                  <button type="button" class="jrn-pill-btn jrn-pill-btn--ghost jrn-pill-btn--sm"
                          (click)="addAllowedValue()">Add</button>
                </div>
              </div>
            </div>

            <!-- Derived config -->
            <div class="jrn-config-block" *ngIf="form.trackerType === 'derived'">
              <p class="jrn-config-label">Derived Setup</p>

              <div class="jrn-field">
                <label class="jrn-label">Log Type to track <span class="jrn-req">*</span></label>
                <select class="jrn-input" [(ngModel)]="form.derivedLogTypeId" name="derivedLogTypeId">
                  <option value="" disabled>Select a log type…</option>
                  <optgroup label="Work" *ngIf="workLogTypes.length > 0">
                    <option *ngFor="let lt of workLogTypes; trackBy: trackByLogTypeId" [value]="lt._id">{{ lt.name }}</option>
                  </optgroup>
                  <optgroup label="Personal" *ngIf="personalLogTypes.length > 0">
                    <option *ngFor="let lt of personalLogTypes; trackBy: trackByLogTypeId" [value]="lt._id">{{ lt.name }}</option>
                  </optgroup>
                  <optgroup label="Family" *ngIf="familyLogTypes.length > 0">
                    <option *ngFor="let lt of familyLogTypes; trackBy: trackByLogTypeId" [value]="lt._id">{{ lt.name }}</option>
                  </optgroup>
                </select>
              </div>

              <div class="jrn-field">
                <label class="jrn-label">Value to track</label>
                <div class="jrn-metric-grid">
                  <button type="button" class="jrn-metric-opt"
                          *ngFor="let m of valueMetricOptions; trackBy: trackByValue"
                          [class.jrn-metric-opt--active]="form.derivedValueMetric === m.value"
                          (click)="form.derivedValueMetric = m.value">
                    <span class="jrn-metric-icon">{{ m.icon }}</span>
                    <span class="jrn-metric-label">{{ m.label }}</span>
                    <span class="jrn-metric-hint">{{ m.hint }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="jrn-error-banner" *ngIf="createError">{{ createError }}</div>

            <div class="jrn-form-actions">
              <button type="button" class="jrn-pill-btn jrn-pill-btn--ghost"
                      (click)="closeCreateModal()">Cancel</button>
              <button type="submit" class="jrn-pill-btn jrn-pill-btn--primary" [disabled]="saving">
                {{ saving ? 'Creating…' : 'Create Journey' }}
              </button>
            </div>

          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ══════════════════════════════════════════
       ROOT
    ══════════════════════════════════════════ */
    .jrn-root {
      padding: 20px 16px 80px;
      max-width: 600px;
      margin: 0 auto;
    }
    @media (min-width: 480px) {
      .jrn-root { padding: 28px 24px 80px; }
    }

    /* ══════════════════════════════════════════
       PAGE HEADER
    ══════════════════════════════════════════ */
    .jrn-page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 24px;
    }
    .jrn-page-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }
    .jrn-page-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 3px;
    }

    /* ══════════════════════════════════════════
       PILL BUTTONS
    ══════════════════════════════════════════ */
    .jrn-pill-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: 999px;
      border: none;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.15s, opacity 0.15s, background 0.15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .jrn-pill-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .jrn-pill-btn--primary {
      background: var(--accent-bright);
      color: #fff;
    }
    .jrn-pill-btn--primary:not(:disabled):hover { filter: brightness(1.1); }
    .jrn-pill-btn--ghost {
      background: var(--bg-card);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .jrn-pill-btn--ghost:hover { color: var(--text-primary); border-color: var(--border-light); }
    .jrn-pill-btn--danger {
      background: #c0392b;
      color: #fff;
    }
    .jrn-pill-btn--danger:hover { filter: brightness(1.1); }
    .jrn-pill-btn--sm { padding: 7px 16px; font-size: 0.8rem; }
    .jrn-pill-btn--full { width: 100%; }

    /* ══════════════════════════════════════════
       BACK / NAV
    ══════════════════════════════════════════ */
    .jrn-nav-row { margin-bottom: 16px; }
    .jrn-back-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 500;
      padding: 6px 10px 6px 4px;
      border-radius: 999px;
      transition: color 0.15s;
    }
    .jrn-back-btn:hover { color: var(--text-primary); }

    /* ══════════════════════════════════════════
       EMPTY STATE
    ══════════════════════════════════════════ */
    .jrn-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      padding: 56px 16px;
    }
    .jrn-empty--sm { padding: 32px 16px; }
    .jrn-empty-orb {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .jrn-empty-orb--sm { width: 52px; height: 52px; }
    .jrn-empty-title { font-size: 1rem; font-weight: 600; color: var(--text-primary); }
    .jrn-empty-sub { font-size: 0.82rem; color: var(--text-muted); max-width: 280px; line-height: 1.5; }

    /* ══════════════════════════════════════════
       JOURNEY CARDS (list)
    ══════════════════════════════════════════ */
    .jrn-card-list { display: flex; flex-direction: column; gap: 10px; }

    .jrn-journey-card {
      display: flex;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      cursor: pointer;
      overflow: hidden;
      transition: box-shadow 0.18s, transform 0.12s;
      -webkit-tap-highlight-color: transparent;
    }
    .jrn-journey-card:hover {
      box-shadow: 0 3px 10px rgba(0,0,0,0.12);
      transform: translateY(-1px);
    }
    .jrn-journey-card:active { transform: scale(0.985); }

    .jrn-journey-card-body {
      flex: 1;
      padding: 14px 12px 14px 16px;
      min-width: 0;
    }

    .jrn-journey-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }

    .jrn-journey-name {
      font-size: 0.97rem;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .jrn-journey-card-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .jrn-journey-card-arrow {
      color: var(--text-muted);
      flex-shrink: 0;
      margin-right: 14px;
    }

    /* ══════════════════════════════════════════
       CHIPS
    ══════════════════════════════════════════ */
    .jrn-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: var(--accent);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 0.72rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
    }
    .jrn-chip--dim { color: var(--text-secondary); background: transparent; }

    /* ══════════════════════════════════════════
       STATUS PILL
    ══════════════════════════════════════════ */
    .jrn-status-pill {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .jrn-status--active    { background: #1a4a2e; color: #4ade80; }
    .jrn-status--paused    { background: #3a3010; color: #fbbf24; }
    .jrn-status--completed { background: #1e2a4a; color: #93c5fd; }

    /* ══════════════════════════════════════════
       FORM CARD
    ══════════════════════════════════════════ */
    .jrn-form-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .jrn-form-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    /* Fields */
    .jrn-field { display: flex; flex-direction: column; gap: 7px; }
    .jrn-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); letter-spacing: 0.02em; }
    .jrn-req { color: var(--accent-bright); }
    .jrn-input {
      background: var(--bg-primary);
      border: 1.5px solid var(--border);
      border-radius: 12px;
      color: var(--text-primary);
      padding: 11px 14px;
      font-size: 0.9rem;
      outline: none;
      width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
      -webkit-appearance: none;
    }
    .jrn-input:focus {
      border-color: var(--accent-bright);
      box-shadow: 0 0 0 3px rgba(233,79,55,0.15);
    }

    /* Segmented control */
    .jrn-seg {
      display: flex;
      background: var(--bg-primary);
      border: 1.5px solid var(--border);
      border-radius: 999px;
      padding: 3px;
      gap: 2px;
    }
    .jrn-seg-opt {
      flex: 1;
      padding: 8px 12px;
      border-radius: 999px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .jrn-seg-opt--active {
      background: var(--accent-bright);
      color: #fff;
    }

    /* Tracker type grid */
    .jrn-tracker-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .jrn-tracker-tile {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      background: var(--bg-primary);
      border: 1.5px solid var(--border);
      border-radius: 14px;
      padding: 14px 12px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      text-align: left;
    }
    .jrn-tracker-tile--active {
      border-color: var(--accent-bright);
      box-shadow: 0 0 0 3px rgba(233,79,55,0.18);
      background: rgba(233,79,55,0.06);
    }
    .jrn-tracker-tile--soon { opacity: 0.45; cursor: not-allowed; }
    .jrn-tracker-icon { font-size: 1.3rem; }
    .jrn-tracker-name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }
    .jrn-tracker-badge {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--accent-bright);
      color: #fff;
    }
    .jrn-tracker-badge--soon { background: var(--text-muted); }

    /* Config block */
    .jrn-config-block {
      background: var(--bg-primary);
      border-radius: 14px;
      border: 1.5px solid var(--border);
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .jrn-config-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
    }

    /* Tags */
    .jrn-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .jrn-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--accent);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 0.8rem;
      color: var(--text-primary);
    }
    .jrn-tag-remove {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
      padding: 0;
    }
    .jrn-tag-remove:hover { color: var(--accent-bright); }
    .jrn-tag-input-row { display: flex; gap: 8px; align-items: center; }

    /* Error */
    .jrn-error-banner {
      background: rgba(233,79,55,0.12);
      border: 1px solid rgba(233,79,55,0.3);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 0.82rem;
      color: var(--accent-bright);
    }

    /* Form actions */
    .jrn-form-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }
    @media (min-width: 400px) {
      .jrn-form-actions { flex-direction: row; justify-content: flex-end; }
    }

    /* ══════════════════════════════════════════
       DETAIL — HERO CARD
    ══════════════════════════════════════════ */
    .jrn-hero-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      padding: 20px 20px 16px;
      margin-bottom: 20px;
    }
    .jrn-hero-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .jrn-hero-name {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.25;
    }
    .jrn-hero-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    }
    .jrn-hero-footer {
      border-top: 1px solid var(--border);
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .jrn-hero-edit-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .jrn-hero-edit-btn:hover { color: var(--text-primary); border-color: var(--border-light); }

    .jrn-hero-card--edit { gap: 16px; display: flex; flex-direction: column; }
    .jrn-edit-heading {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    /* Metric option grid */
    .jrn-metric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .jrn-metric-opt {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      background: var(--bg-primary);
      border: 1.5px solid var(--border);
      border-radius: 12px;
      padding: 12px 10px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      text-align: left;
    }
    .jrn-metric-opt--active {
      border-color: var(--accent-bright);
      box-shadow: 0 0 0 3px rgba(233,79,55,0.18);
      background: rgba(233,79,55,0.06);
    }
    .jrn-metric-icon { font-size: 1.1rem; }
    .jrn-metric-label { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); }
    .jrn-metric-hint  { font-size: 0.68rem; color: var(--text-muted); }

    .jrn-text-danger-btn {
      background: none;
      border: none;
      color: #c0392b;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      padding: 4px 0;
      opacity: 0.75;
      transition: opacity 0.15s;
    }
    .jrn-text-danger-btn:hover { opacity: 1; }

    /* ══════════════════════════════════════════
       METRICS CARD
    ══════════════════════════════════════════ */
    .jrn-metrics-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07);
      padding: 16px 18px;
      margin-bottom: 20px;
    }
    .jrn-metrics-heading {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .jrn-metrics-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .jrn-metric-tile {
      flex: 1;
      min-width: 120px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .jrn-metric-tile-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .jrn-metric-tile-value {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .jrn-metric-tile-sub {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* ══════════════════════════════════════════
       DETAIL — SECTION HEADER
    ══════════════════════════════════════════ */
    .jrn-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .jrn-section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
    }

    /* ══════════════════════════════════════════
       ENTRY FORM CARD
    ══════════════════════════════════════════ */
    .jrn-entry-form-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07);
      padding: 16px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .jrn-entry-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    @media (min-width: 440px) {
      .jrn-entry-fields { flex-direction: row; flex-wrap: wrap; }
      .jrn-entry-fields .jrn-field { flex: 1; min-width: 140px; }
    }
    .jrn-entry-save-btn { align-self: flex-end; }

    /* ══════════════════════════════════════════
       ENTRY CARDS (list)
    ══════════════════════════════════════════ */
    .jrn-entries { display: flex; flex-direction: column; gap: 6px; }

    .jrn-entry-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
      padding: 10px 12px;
      transition: background 0.15s;
    }
    .jrn-entry-card:hover {
      background: var(--accent-hover);
    }

    .jrn-entry-left {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .jrn-entry-date {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .jrn-entry-time {
      font-size: 11px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    .jrn-entry-value {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
      min-width: 44px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .jrn-entry-pill {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
    }
    .jrn-entry-del-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 5px;
      border-radius: 50%;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .jrn-entry-del-btn:hover { color: var(--accent-bright); background: rgba(233,79,55,0.1); }

    /* ══════════════════════════════════════════
       DRUM TIME PICKER
    ══════════════════════════════════════════ */
    .jrn-drum-time-row {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 10px;
    }
    .jrn-drum-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    .jrn-drum-colon {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      padding-bottom: 10px;
      flex-shrink: 0;
    }
    .jrn-drum-wrapper {
      position: relative;
      width: 52px;
      height: 75px;
      overflow: hidden;
    }
    .jrn-drum-wrapper::before,
    .jrn-drum-wrapper::after {
      content: '';
      position: absolute;
      left: 0; right: 0;
      height: 25px;
      z-index: 2;
      pointer-events: none;
    }
    .jrn-drum-wrapper::before {
      top: 0;
      background: linear-gradient(to bottom, var(--bg-card) 10%, transparent);
    }
    .jrn-drum-wrapper::after {
      bottom: 0;
      background: linear-gradient(to top, var(--bg-card) 10%, transparent);
    }
    .jrn-drum-center-band {
      position: absolute;
      top: 50%; left: 3px; right: 3px;
      height: 25px;
      transform: translateY(-50%);
      border-top: 1px solid var(--border-light);
      border-bottom: 1px solid var(--border-light);
      background: rgba(74,144,226,0.06);
      border-radius: 4px;
      pointer-events: none;
      z-index: 1;
    }
    .jrn-drum {
      position: relative;
      z-index: 3;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .jrn-drum::-webkit-scrollbar { display: none; }
    .jrn-drum-spacer { height: 25px; flex-shrink: 0; display: block; }
    .jrn-drum-item {
      height: 25px;
      scroll-snap-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      user-select: none;
      transition: color 0.1s, font-size 0.1s, font-weight 0.1s;
    }
    .jrn-drum-item--sel {
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 700;
    }
    .jrn-drum-unit {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ══════════════════════════════════════════
       BOTTOM SHEET (delete confirm)
    ══════════════════════════════════════════ */
    .jrn-sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 200;
      padding: 0 0 env(safe-area-inset-bottom, 0);
    }
    @media (min-width: 480px) {
      .jrn-sheet-backdrop { align-items: center; }
      .jrn-sheet { border-radius: 20px !important; max-width: 380px; width: 90%; }
    }
    .jrn-sheet {
      background: var(--bg-surface);
      border-radius: 20px 20px 0 0;
      padding: 16px 20px 32px;
      width: 100%;
      box-shadow: 0 -8px 40px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .jrn-sheet-handle {
      width: 36px;
      height: 4px;
      border-radius: 999px;
      background: var(--border-light);
      margin: 0 auto 8px;
    }
    .jrn-sheet-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .jrn-sheet-body {
      font-size: 0.88rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .jrn-sheet-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    /* ══════════════════════════════════════════
       LOADING
    ══════════════════════════════════════════ */
    .jrn-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 0.83rem;
      padding: 20px 4px;
    }
    .jrn-loading-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);
      animation: jrn-pulse 1.2s ease-in-out infinite;
    }
    @keyframes jrn-pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50%       { opacity: 1;   transform: scale(1.2); }
    }

    /* ══════════════════════════════════════════
       DERIVED JOURNEY
    ══════════════════════════════════════════ */
    .jrn-derived-banner {
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(74,144,226,0.08);
      border: 1px solid rgba(74,144,226,0.2);
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 0.78rem;
      color: var(--text-secondary);
      line-height: 1.4;
      margin-bottom: 4px;
    }
    .jrn-derived-banner svg { flex-shrink: 0; color: rgba(74,144,226,0.8); }
    .jrn-derived-banner strong { color: var(--text-primary); font-weight: 600; }

    .jrn-section-actions { display: flex; gap: 8px; align-items: center; }

    .jrn-sync-dot {
      color: rgba(74,144,226,0.55);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      margin-left: auto;
    }

    .jrn-entry-unit {
      font-size: 0.7em;
      font-weight: 500;
      color: var(--text-muted);
      margin-left: 2px;
    }

    /* ══════════════════════════════════════════
       DERIVED: DAY GROUPS
    ══════════════════════════════════════════ */
    .jrn-day-group {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
      overflow: hidden;
    }

    .jrn-day-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      transition: background 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .jrn-day-row:hover { background: var(--accent-hover); }

    .jrn-day-count-chip {
      font-size: 0.68rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(74,144,226,0.12);
      color: rgba(74,144,226,0.85);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .jrn-expand-chevron {
      color: var(--text-muted);
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }
    .jrn-expand-chevron--open { transform: rotate(180deg); }

    .jrn-day-sub-entries {
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .jrn-sub-entry {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px 8px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.12s;
    }
    .jrn-sub-entry:last-child { border-bottom: none; }
    .jrn-sub-entry:hover { background: var(--accent-hover); }

    .jrn-sub-time {
      flex: 1;
      font-size: 11px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    .jrn-sub-value {
      font-size: 0.88rem;
      min-width: 44px;
    }

    /* ══════════════════════════════════════════
       CREATE MODAL
    ══════════════════════════════════════════ */
    .jrn-modal-bd {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 400;
    }
    @media (min-width: 480px) {
      .jrn-modal-bd { align-items: center; padding: 16px; }
    }
    .jrn-modal {
      background: var(--bg-surface);
      border-radius: 20px 20px 0 0;
      width: 100%;
      max-width: 520px;
      max-height: 90dvh;
      overflow-y: auto;
      scrollbar-width: none;
      animation: jrn-modal-in 0.22s ease;
    }
    .jrn-modal::-webkit-scrollbar { display: none; }
    @media (min-width: 480px) {
      .jrn-modal { border-radius: 20px; }
    }
    @keyframes jrn-modal-in {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    .jrn-modal-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 20px 16px;
      position: sticky;
      top: 0;
      background: var(--bg-surface);
      z-index: 1;
      border-bottom: 1px solid var(--border);
    }
    .jrn-modal-x {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .jrn-modal-x:hover { color: var(--text-primary); background: var(--accent-hover); }
    .jrn-modal-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 20px 20px 28px;
    }
  `]
})
export class JourneysComponent implements OnInit, OnDestroy {
  @Input() availableLogTypes: any[] = [];

  private readonly destroy$ = new Subject<void>();
  subView: SubView = 'list';

  journeys: Journey[] = [];
  loading = false;

  selectedJourney: Journey | null = null;
  entries: JourneyEntry[] = [];
  loadingEntries = false;

  addingEntry = false;
  savingEntry = false;
  entryError = '';

  showDeleteConfirm = false;
  deleting = false;
  resyncing = false;

  expandedDays: Record<string, boolean> = {};

  saving = false;
  createError = '';
  showCreateModal = false;

  editingJourney = false;
  savingEdit = false;
  editError = '';
  editForm: {
    name: string;
    status: string;
    span: JourneySpan;
    endDate: string;
    config: { metricName: string; valueType: ValueType };
    derivedLogTypeId: string;
    derivedValueMetric: ValueMetric;
  } = this.blankEditForm();

  readonly valueMetricOptions = [
    { value: 'duration'   as ValueMetric, icon: '⏱', label: 'Duration',    hint: 'mins per log' },
    { value: 'count'      as ValueMetric, icon: '🔢', label: 'Count',       hint: '1 per log' },
    { value: 'start-time' as ValueMetric, icon: '▶',  label: 'Start Time',  hint: 'time of day' },
    { value: 'end-time'   as ValueMetric, icon: '⏹',  label: 'End Time',    hint: 'time of day' }
  ];

  readonly statusOptions = [
    { value: 'active',    label: 'Active' },
    { value: 'paused',    label: 'Paused' },
    { value: 'completed', label: 'Completed' }
  ];

  newAllowedValue = '';

  // ── Entry date/time (drum picker) ───────────────────────
  entryFormDate = '';
  entryFormHour = 12;
  entryFormMinute = 0;
  readonly entryHours   = Array.from({ length: 24 }, (_, i) => i);
  readonly entryMinutes = Array.from({ length: 60 }, (_, i) => i);

  form: {
    name: string;
    startDate: string;
    span: JourneySpan;
    endDate: string;
    trackerType: 'point-log' | 'derived';
    config: { metricName: string; valueType: ValueType; allowedValues: string[] };
    derivedLogTypeId: string;
    derivedValueMetric: ValueMetric;
  } = this.blankForm();

  entryForm: { numericValue: number | null; categoricalValue: string } = { numericValue: null, categoricalValue: '' };

  get workLogTypes():     any[] { return this.availableLogTypes.filter(lt => lt.domain === 'work'); }
  get personalLogTypes(): any[] { return this.availableLogTypes.filter(lt => lt.domain === 'personal'); }
  get familyLogTypes():   any[] { return this.availableLogTypes.filter(lt => lt.domain === 'family'); }

  constructor(private journeyService: JourneyService, private cdr: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit() {
    this.loadJourneys();
  }

  private blankForm() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      name:               '',
      startDate:          today,
      span:               'indefinite' as JourneySpan,
      endDate:            '',
      trackerType:        'point-log' as 'point-log' | 'derived',
      config:             { metricName: '', valueType: 'numeric' as ValueType, allowedValues: [] as string[] },
      derivedLogTypeId:   '',
      derivedValueMetric: 'duration' as ValueMetric
    };
  }

  private blankEditForm() {
    return {
      name:               '',
      status:             'active',
      span:               'indefinite' as JourneySpan,
      endDate:            '',
      config:             { metricName: '', valueType: 'numeric' as ValueType },
      derivedLogTypeId:   '',
      derivedValueMetric: 'duration' as ValueMetric
    };
  }

  valueMetricLabel(vm: ValueMetric): string {
    switch (vm) {
      case 'duration':   return 'Duration (mins)';
      case 'count':      return 'Count';
      case 'start-time': return 'Start Time';
      case 'end-time':   return 'End Time';
    }
  }

  minsToTimeStr(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  openEditJourney(): void {
    if (!this.selectedJourney) return;
    const j = this.selectedJourney;
    this.editForm = {
      name:               j.name,
      status:             j.status,
      span:               j.span,
      endDate:            j.endDate ?? '',
      config:             { metricName: j.config.metricName, valueType: j.config.valueType },
      derivedLogTypeId:   j.derivedFrom?.logTypeId ?? '',
      derivedValueMetric: j.derivedFrom?.valueMetric ?? 'duration'
    };
    this.editError = '';
    this.editingJourney = true;
  }

  cancelEditJourney(): void {
    this.editingJourney = false;
    this.editError = '';
  }

  saveEditJourney(): void {
    if (!this.selectedJourney) return;
    this.editError = '';
    if (!this.editForm.name.trim()) { this.editError = 'Name is required.'; return; }

    const isDerived = this.selectedJourney.trackerType === 'derived';
    const lt = isDerived ? this.availableLogTypes.find(t => t._id === this.editForm.derivedLogTypeId) : null;

    const patch: any = {
      name:   this.editForm.name.trim(),
      status: this.editForm.status,
      span:   this.editForm.span,
      endDate: this.editForm.span === 'definite' ? this.editForm.endDate : null
    };
    if (!isDerived) {
      patch.config = this.editForm.config;
    }
    if (isDerived && this.editForm.derivedLogTypeId) {
      patch.derivedFrom = {
        logTypeId:   this.editForm.derivedLogTypeId,
        logTypeName: lt?.name ?? this.selectedJourney.derivedFrom?.logTypeName ?? '',
        valueMetric: this.editForm.derivedValueMetric
      };
    }

    const prevValueMetric = this.selectedJourney.derivedFrom?.valueMetric;
    const metricChanged = isDerived && (
      patch.derivedFrom?.logTypeId   !== this.selectedJourney.derivedFrom?.logTypeId ||
      patch.derivedFrom?.valueMetric !== prevValueMetric
    );

    this.savingEdit = true;
    this.journeyService.updateJourney(this.selectedJourney.id, patch).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.selectedJourney = updated;
        this.journeys = this.journeys.map(j => j.id === updated.id ? updated : j);
        this.editingJourney = false;
        this.savingEdit = false;
        this.cdr.markForCheck();
        if (metricChanged) {
          this.resyncing = true;
          this.journeyService.resyncJourney(updated.id).pipe(takeUntil(this.destroy$)).subscribe({
            next: (synced) => { this.entries = synced; this.resyncing = false; this.cdr.markForCheck(); },
            error: () => { this.resyncing = false; this.cdr.markForCheck(); }
          });
        }
      },
      error: (err) => {
        this.savingEdit = false;
        this.editError = err?.error?.error ?? 'Failed to save changes.';
        this.cdr.markForCheck();
      }
    });
  }

  private initEntryDatetime(): void {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    this.entryFormDate   = `${yyyy}-${mm}-${dd}`;
    this.entryFormHour   = now.getHours();
    this.entryFormMinute = now.getMinutes();
  }

  private scrollEntryDrums(): void {
    const dh = document.querySelector('.jrn-drum-h') as HTMLElement | null;
    const dm = document.querySelector('.jrn-drum-m') as HTMLElement | null;
    if (dh) dh.scrollTop = this.entryFormHour * 25;
    if (dm) dm.scrollTop = this.entryFormMinute * 25;
  }

  loadJourneys() {
    this.loading = true;
    this.journeyService.listJourneys().pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.journeys = list;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  openCreate() {
    this.form = this.blankForm();
    this.createError = '';
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.createError = '';
  }

  addAllowedValue() {
    const v = this.newAllowedValue.trim();
    if (v && !this.form.config.allowedValues.includes(v)) {
      this.form.config.allowedValues = [...this.form.config.allowedValues, v];
    }
    this.newAllowedValue = '';
  }

  removeAllowedValue(index: number) {
    this.form.config.allowedValues = this.form.config.allowedValues.filter((_, i) => i !== index);
  }

  submitCreate() {
    this.createError = '';
    if (!this.form.name.trim()) { this.createError = 'Journey name is required.'; return; }
    if (!this.form.startDate)   { this.createError = 'Start date is required.'; return; }
    if (this.form.span === 'definite' && !this.form.endDate) {
      this.createError = 'End date is required for a definite journey.'; return;
    }
    if (this.form.trackerType === 'derived' && !this.form.derivedLogTypeId) {
      this.createError = 'Please select a log type to track.'; return;
    }

    const lt = this.availableLogTypes.find(t => t._id === this.form.derivedLogTypeId);

    const payload: CreateJourney = {
      name:        this.form.name.trim(),
      startDate:   this.form.startDate,
      span:        this.form.span,
      trackerType: this.form.trackerType
    };
    if (this.form.span === 'definite') payload.endDate = this.form.endDate;

    if (this.form.trackerType === 'derived') {
      payload.derivedFrom = {
        logTypeId:   this.form.derivedLogTypeId,
        logTypeName: lt?.name ?? '',
        valueMetric: this.form.derivedValueMetric
      };
    } else {
      payload.config = this.form.config;
    }

    this.saving = true;
    this.journeyService.createJourney(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (created) => {
        this.saving = false;
        this.journeys = [created, ...this.journeys];
        this.showCreateModal = false;
        this.openDetail(created);
        this.cdr.markForCheck();
        // Auto-resync derived journeys from history
        if (created.trackerType === 'derived') {
          this.resyncing = true;
          this.journeyService.resyncJourney(created.id).pipe(takeUntil(this.destroy$)).subscribe({
            next: (synced) => { this.entries = synced; this.resyncing = false; this.cdr.markForCheck(); },
            error: () => { this.resyncing = false; this.cdr.markForCheck(); }
          });
        }
      },
      error: (err) => {
        this.saving = false;
        this.createError = err?.error?.error ?? 'Failed to create journey.';
        this.cdr.markForCheck();
      }
    });
  }

  get avgValue(): string | null {
    if (!this.selectedJourney || this.entries.length === 0) return null;
    const j = this.selectedJourney;

    if (j.trackerType === 'derived' && j.derivedFrom) {
      const vm = j.derivedFrom.valueMetric;
      const nums = this.entries.map(e => e.numericValue ?? 0);
      if (vm === 'duration') {
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        const h = Math.floor(avg / 60);
        const m = Math.round(avg % 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
      if (vm === 'start-time' || vm === 'end-time') {
        const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
        return this.minsToTimeStr(avg);
      }
      return null;
    }

    if (j.trackerType === 'point-log' && j.config.valueType === 'numeric') {
      const byDate = new Map<string, number[]>();
      for (const e of this.entries) {
        if (e.numericValue === null) continue;
        const d = new Date(e.timestamp).toLocaleDateString('en-CA');
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push(e.numericValue);
      }
      const dailyAvgs = Array.from(byDate.values()).map(vals => vals.reduce((a, b) => a + b, 0) / vals.length);
      if (dailyAvgs.length === 0) return null;
      const avg = dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length;
      return Number.isInteger(avg) ? `${avg}` : avg.toFixed(2);
    }

    return null;
  }

  get dayGroups(): { date: string; displayDate: string; entries: JourneyEntry[]; consolidated: string; count: number; expanded: boolean }[] {
    const byDate = new Map<string, JourneyEntry[]>();
    for (const e of this.entries) {
      const d = new Date(e.timestamp).toLocaleDateString('en-CA');
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }
    const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, entries]) => ({
        date,
        displayDate: fmt.format(new Date(date + 'T12:00:00')),
        entries,
        count: entries.length,
        consolidated: this.consolidatedValue(entries),
        expanded: !!this.expandedDays[date]
      }));
  }

  private consolidatedValue(entries: JourneyEntry[]): string {
    const vm = this.selectedJourney?.derivedFrom?.valueMetric;
    const nums = entries.map(e => e.numericValue ?? 0);
    switch (vm) {
      case 'duration': {
        const total = nums.reduce((a, b) => a + b, 0);
        const h = Math.floor(total / 60);
        const m = total % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
      case 'count':    return `${nums.reduce((a, b) => a + b, 0)}`;
      case 'start-time': return this.minsToTimeStr(Math.min(...nums));
      case 'end-time':   return this.minsToTimeStr(Math.max(...nums));
      default:           return `${nums.reduce((a, b) => a + b, 0)}`;
    }
  }

  toggleDay(date: string): void {
    this.expandedDays = { ...this.expandedDays, [date]: !this.expandedDays[date] };
  }

  openDetail(journey: Journey) {
    this.selectedJourney = journey;
    this.entries = [];
    this.addingEntry = false;
    this.entryError = '';
    this.entryForm = { numericValue: null, categoricalValue: '' };
    this.expandedDays = {};
    this.subView = 'detail';
    this.loadEntries(journey.id);
  }

  openAddEntry(): void {
    this.addingEntry = true;
    this.entryError = '';
    this.entryForm = { numericValue: null, categoricalValue: '' };
    this.initEntryDatetime();
    setTimeout(() => this.scrollEntryDrums(), 0);
  }

  closeAddEntry(): void {
    this.addingEntry = false;
    this.entryError = '';
  }

  onEntryHourScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.entryFormHour = Math.max(0, Math.min(23, Math.round(el.scrollTop / 25)));
  }

  onEntryMinuteScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.entryFormMinute = Math.max(0, Math.min(59, Math.round(el.scrollTop / 25)));
  }

  backToList() {
    this.subView = 'list';
    this.selectedJourney = null;
    this.entries = [];
    this.showDeleteConfirm = false;
  }

  loadEntries(journeyId: string) {
    this.loadingEntries = true;
    this.journeyService.listEntries(journeyId).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.entries = list;
      this.loadingEntries = false;
      this.cdr.markForCheck();
    });
  }

  submitEntry() {
    if (!this.selectedJourney) return;
    this.entryError = '';
    const vt = this.selectedJourney.config.valueType;

    if (!this.entryFormDate) { this.entryError = 'Date is required.'; return; }
    if (vt === 'numeric' && this.entryForm.numericValue === null) {
      this.entryError = 'Value is required.'; return;
    }
    if (vt === 'categorical' && !this.entryForm.categoricalValue) {
      this.entryError = 'Please select a value.'; return;
    }

    const h = String(this.entryFormHour).padStart(2, '0');
    const m = String(this.entryFormMinute).padStart(2, '0');
    const payload: CreateJourneyEntry = {
      timestamp: new Date(`${this.entryFormDate}T${h}:${m}:00`).toISOString(),
      valueType: vt,
      ...(vt === 'numeric'     ? { numericValue: this.entryForm.numericValue! } : {}),
      ...(vt === 'categorical' ? { categoricalValue: this.entryForm.categoricalValue } : {})
    };

    this.savingEntry = true;
    this.journeyService.addEntry(this.selectedJourney.id, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (entry) => {
        this.entries = [entry, ...this.entries];
        this.savingEntry = false;
        this.addingEntry = false;
        this.entryForm = { numericValue: null, categoricalValue: '' };
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingEntry = false;
        this.entryError = err?.error?.error ?? 'Failed to save entry.';
        this.cdr.markForCheck();
      }
    });
  }

  deleteEntry(entry: JourneyEntry) {
    if (!this.selectedJourney) return;
    this.journeyService.deleteEntry(this.selectedJourney.id, entry.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.entries = this.entries.filter(e => e.id !== entry.id); this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  confirmDelete() { this.showDeleteConfirm = true; }

  executeDelete() {
    if (!this.selectedJourney) return;
    this.deleting = true;
    this.journeyService.deleteJourney(this.selectedJourney.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.journeys = this.journeys.filter(j => j.id !== this.selectedJourney!.id);
        this.deleting = false;
        this.showDeleteConfirm = false;
        this.backToList();
        this.cdr.markForCheck();
      },
      error: () => { this.deleting = false; this.cdr.markForCheck(); }
    });
  }

  resyncJourney(): void {
    if (!this.selectedJourney || this.resyncing) return;
    this.resyncing = true;
    this.journeyService.resyncJourney(this.selectedJourney.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (synced) => { this.entries = synced; this.resyncing = false; this.cdr.markForCheck(); },
      error: () => { this.resyncing = false; this.cdr.markForCheck(); }
    });
  }

  trackByJourneyId(_i: number, j: Journey): string { return j.id; }
  trackByEntryId(_i: number, e: JourneyEntry): string { return e.id; }
  trackByDateStr(_i: number, g: { date: string }): string { return g.date; }
  trackByIndex(index: number): number { return index; }
  trackByLogTypeId(_i: number, lt: { _id: string }): string { return lt._id; }
  trackByValue(_i: number, item: { value: string }): string { return item.value; }
}
