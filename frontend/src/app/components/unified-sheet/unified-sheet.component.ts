import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { LogService } from '../../services/log.service';
import { LogTypeService } from '../../services/log-type.service';
import { PreferenceService, ActiveLog } from '../../services/preference.service';
import { LogType } from '../../models/log-type.model';
import { LogEntry } from '../../models/log.model';
import { TimeRangeSliderComponent, TimeRange } from '../time-range-slider/time-range-slider.component';
import { TypeSelectorComponent, TypeOption, TypeChangeEvent } from '../type-selector/type-selector.component';
import { LogTabSwitcherComponent } from '../log-tab-switcher/log-tab-switcher.component';

@Component({
  selector: 'app-unified-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeRangeSliderComponent, TypeSelectorComponent, LogTabSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- backdrop -->
    <div class="log-now-backdrop" (click)="closeSheet()"></div>

    <!-- sheet -->
    <div class="log-now-sheet uni-sheet"
         (touchstart)="onSwipeStart($event)"
         (touchend)="onSwipeEnd($event)">

      <!-- Tab switcher -->
      <app-log-tab-switcher
        [activeTab]="tab"
        [dateLabel]="targetDateLabel"
        (tabChange)="onTabSwitcherChange($event)"
        (backClick)="closeSheet()">
      </app-log-tab-switcher>


<!-- ── Tab 1: Add log ── -->
      <ng-container *ngIf="tab === 1">
        <div class="log-now-fields">

          <!-- 1. Title -->
          <textarea class="ln-title-input"
                    placeholder="Title (optional — defaults to type name)"
                    [(ngModel)]="logNowTitle"
                    rows="3"
                    (focus)="scrollInputIntoView($event)"></textarea>

          <!-- 2. Log type card -->
          <app-type-selector
            [workTypes]="workTypeOptions"
            [personalTypes]="personalTypeOptions"
            [category]="logNowDomain"
            [selectedId]="logNowTypeId"
            (typeChange)="onLogNowTypeChange($event)">
          </app-type-selector>

          <!-- 3. Time range slider -->
          <app-time-range-slider
            [initialFrom]="logNowStart"
            [initialTo]="logNowEnd"
            mode="range"
            (timeRangeChange)="onLogNowRangeChange($event)">
          </app-time-range-slider>

          <!-- 4. Details card (optional fields) -->
          <div class="ln-details-card">
            <div class="ln-details-header">Details</div>

            <!-- Priority (work only) -->
            <div class="ln-detail-row" *ngIf="logNowDomain === 'work'">
              <span class="ln-detail-label">Priority</span>
              <div class="ln-detail-ctrl">
                <button type="button" class="ln-priority-chip ln-priority-chip--high"
                        [class.ln-priority-chip--active]="logNowPriority === 'High'"
                        (click)="toggleLogNowPriority('High')">
                  <span class="ln-priority-dot"></span>High
                </button>
                <button type="button" class="ln-priority-chip ln-priority-chip--medium"
                        [class.ln-priority-chip--active]="logNowPriority === 'Medium'"
                        (click)="toggleLogNowPriority('Medium')">
                  <span class="ln-priority-dot"></span>Medium
                </button>
                <button type="button" class="ln-priority-chip ln-priority-chip--low"
                        [class.ln-priority-chip--active]="logNowPriority === 'Low'"
                        (click)="toggleLogNowPriority('Low')">
                  <span class="ln-priority-dot"></span>Low
                </button>
              </div>
            </div>

            <!-- Ticket ID (work only) -->
            <div class="ln-detail-row" *ngIf="logNowDomain === 'work'">
              <span class="ln-detail-label">Ticket ID</span>
              <div class="ln-detail-ctrl">
                <input type="text" class="ln-detail-input" [(ngModel)]="logNowTicketId"
                       placeholder="e.g. JIRA-1234" maxlength="100" autocomplete="off"/>
              </div>
            </div>

            <!-- Crucial (work only) -->
            <div class="ln-detail-row" *ngIf="logNowDomain === 'work'">
              <span class="ln-detail-label">Crucial</span>
              <div class="ln-detail-ctrl">
                <button type="button" class="ln-crucial-btn ln-crucial-btn--yes"
                        [class.ln-crucial-btn--active]="logNowCrucialPerson === 'Yes'"
                        (click)="toggleLogNowCrucialPerson('Yes')">Yes</button>
                <button type="button" class="ln-crucial-btn ln-crucial-btn--shared"
                        [class.ln-crucial-btn--active]="logNowCrucialPerson === 'Shared'"
                        (click)="toggleLogNowCrucialPerson('Shared')">Shared</button>
                <button type="button" class="ln-crucial-btn ln-crucial-btn--no"
                        [class.ln-crucial-btn--active]="logNowCrucialPerson === 'No'"
                        (click)="toggleLogNowCrucialPerson('No')">No</button>
              </div>
            </div>

            <!-- Collaborators (work only) -->
            <div class="ln-detail-row ln-detail-row--collab" *ngIf="logNowDomain === 'work'">
              <span class="ln-detail-label">Collaborators</span>
              <div class="ln-detail-ctrl--collab">
                <div class="ln-collab-chips" *ngIf="logNowCollaborators.length > 0">
                  <span class="ln-collab-chip"
                        *ngFor="let c of logNowCollaborators; let i = index; trackBy: trackByIndex">
                    {{ c }}<button type="button" class="ln-collab-remove" (click)="removeLogNowCollaborator(i)">×</button>
                  </span>
                </div>
                <div class="ln-collab-row">
                  <input type="text" class="ln-collab-input" [(ngModel)]="logNowCollaboratorInput"
                         placeholder="Name or team…" maxlength="60" autocomplete="off"
                         (keydown.enter)="$event.preventDefault(); addLogNowCollaborator()"/>
                  <button type="button" class="ln-collab-add"
                          (click)="addLogNowCollaborator()" [disabled]="!logNowCollaboratorInput.trim()">Add</button>
                </div>
              </div>
            </div>

            <!-- Score -->
            <div class="ln-detail-row ln-detail-row--score">
              <span class="ln-detail-label">Score</span>
              <div class="ln-detail-ctrl ln-detail-ctrl--score">
                <div class="ln-score-track">
                  <button *ngFor="let n of scoreRange; trackBy: trackByIndex" type="button"
                          class="ln-score-btn"
                          [class.ln-score-btn--filled]="logNowSatisfactoryScore !== null && n <= logNowSatisfactoryScore"
                          (click)="setLogNowScore(n)">{{ n }}</button>
                </div>
                <div class="ln-score-bar-wrap" style="margin-top:4px">
                  <div class="ln-score-bar-fill"
                       [style.width.%]="logNowSatisfactoryScore ? (logNowSatisfactoryScore / 10) * 100 : 0"></div>
                </div>
              </div>
            </div>

          </div><!-- /ln-details-card -->

        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeSheet()">Cancel</button>
          <button class="log-now-save" (click)="saveLogNow()"
                  [disabled]="logNowSaving || !logNowTypeId">
            {{ logNowSaving ? 'Saving…' : 'Save Log' }}
          </button>
        </div>
      </ng-container>

      <!-- ── Tab 2: Add point ── -->
      <ng-container *ngIf="tab === 2">
        <div class="log-now-fields">

          <!-- 1. Title -->
          <textarea class="ln-title-input" placeholder="Title (optional)"
                    [(ngModel)]="addPointTitle"
                    rows="3"
                    (focus)="scrollInputIntoView($event)"></textarea>

          <!-- 2. Log type card -->
          <app-type-selector
            [workTypes]="workTypeOptions"
            [personalTypes]="personalTypeOptions"
            [category]="addPointDomain"
            [selectedId]="addPointTypeId"
            (typeChange)="onAddPointTypeChange($event)">
          </app-type-selector>

          <!-- 3. Time picker (single) -->
          <app-time-range-slider
            [initialFrom]="addPointTime"
            mode="point"
            (timeRangeChange)="onAddPointTimeChange($event)">
          </app-time-range-slider>

          <!-- 4. Details card (optional fields) -->
          <div class="ln-details-card">
            <div class="ln-details-header">Details</div>

            <!-- Priority (work only) -->
            <div class="ln-detail-row" *ngIf="addPointDomain === 'work'">
              <span class="ln-detail-label">Priority</span>
              <div class="ln-detail-ctrl">
                <button type="button" class="ln-priority-chip ln-priority-chip--high"
                        [class.ln-priority-chip--active]="addPointPriority === 'High'"
                        (click)="toggleAddPointPriority('High')">
                  <span class="ln-priority-dot"></span>High
                </button>
                <button type="button" class="ln-priority-chip ln-priority-chip--medium"
                        [class.ln-priority-chip--active]="addPointPriority === 'Medium'"
                        (click)="toggleAddPointPriority('Medium')">
                  <span class="ln-priority-dot"></span>Medium
                </button>
                <button type="button" class="ln-priority-chip ln-priority-chip--low"
                        [class.ln-priority-chip--active]="addPointPriority === 'Low'"
                        (click)="toggleAddPointPriority('Low')">
                  <span class="ln-priority-dot"></span>Low
                </button>
              </div>
            </div>

            <!-- Ticket ID (work only) -->
            <div class="ln-detail-row" *ngIf="addPointDomain === 'work'">
              <span class="ln-detail-label">Ticket ID</span>
              <div class="ln-detail-ctrl">
                <input type="text" class="ln-detail-input" [(ngModel)]="addPointTicketId"
                       placeholder="e.g. JIRA-1234" maxlength="100" autocomplete="off"/>
              </div>
            </div>

            <!-- Crucial (work only) -->
            <div class="ln-detail-row" *ngIf="addPointDomain === 'work'">
              <span class="ln-detail-label">Crucial</span>
              <div class="ln-detail-ctrl">
                <button type="button" class="ln-crucial-btn ln-crucial-btn--yes"
                        [class.ln-crucial-btn--active]="addPointCrucialPerson === 'Yes'"
                        (click)="toggleAddPointCrucialPerson('Yes')">Yes</button>
                <button type="button" class="ln-crucial-btn ln-crucial-btn--shared"
                        [class.ln-crucial-btn--active]="addPointCrucialPerson === 'Shared'"
                        (click)="toggleAddPointCrucialPerson('Shared')">Shared</button>
                <button type="button" class="ln-crucial-btn ln-crucial-btn--no"
                        [class.ln-crucial-btn--active]="addPointCrucialPerson === 'No'"
                        (click)="toggleAddPointCrucialPerson('No')">No</button>
              </div>
            </div>

            <!-- Collaborators (work only) -->
            <div class="ln-detail-row ln-detail-row--collab" *ngIf="addPointDomain === 'work'">
              <span class="ln-detail-label">Collaborators</span>
              <div class="ln-detail-ctrl--collab">
                <div class="ln-collab-chips" *ngIf="addPointCollaborators.length > 0">
                  <span class="ln-collab-chip"
                        *ngFor="let c of addPointCollaborators; let i = index; trackBy: trackByIndex">
                    {{ c }}<button type="button" class="ln-collab-remove" (click)="removeAddPointCollaborator(i)">×</button>
                  </span>
                </div>
                <div class="ln-collab-row">
                  <input type="text" class="ln-collab-input" [(ngModel)]="addPointCollaboratorInput"
                         placeholder="Name or team…" maxlength="60" autocomplete="off"
                         (keydown.enter)="$event.preventDefault(); addAddPointCollaborator()"/>
                  <button type="button" class="ln-collab-add"
                          (click)="addAddPointCollaborator()" [disabled]="!addPointCollaboratorInput.trim()">Add</button>
                </div>
              </div>
            </div>

            <!-- Score -->
            <div class="ln-detail-row ln-detail-row--score">
              <span class="ln-detail-label">Score</span>
              <div class="ln-detail-ctrl ln-detail-ctrl--score">
                <div class="ln-score-track">
                  <button *ngFor="let n of scoreRange; trackBy: trackByIndex" type="button"
                          class="ln-score-btn"
                          [class.ln-score-btn--filled]="addPointSatisfactoryScore !== null && n <= addPointSatisfactoryScore"
                          (click)="setAddPointScore(n)">{{ n }}</button>
                </div>
                <div class="ln-score-bar-wrap" style="margin-top:4px">
                  <div class="ln-score-bar-fill"
                       [style.width.%]="addPointSatisfactoryScore ? (addPointSatisfactoryScore / 10) * 100 : 0"></div>
                </div>
              </div>
            </div>

          </div><!-- /ln-details-card -->

        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeSheet()">Cancel</button>
          <button class="log-now-save" (click)="saveAddPoint()"
                  [disabled]="addPointSaving || !addPointTypeId">
            {{ addPointSaving ? 'Saving…' : 'Add Point' }}
          </button>
        </div>
      </ng-container>

      <!-- ── Tab 3: Start timer ── -->
      <ng-container *ngIf="tab === 3">
        <div class="log-now-fields">

          <!-- 1. Title -->
          <textarea class="ln-title-input"
                    placeholder="Title (optional — defaults to type name)"
                    [(ngModel)]="startLogTitle"
                    rows="3"
                    (focus)="scrollInputIntoView($event)"></textarea>

          <!-- 2. Log type card -->
          <app-type-selector
            [workTypes]="workTypeOptions"
            [personalTypes]="personalTypeOptions"
            [category]="startLogDomain"
            [selectedId]="startLogTypeId"
            (typeChange)="onStartLogTypeChange($event)">
          </app-type-selector>

          <!-- 3. Details card -->
          <div class="ln-details-card">
            <div class="ln-details-header">Details</div>

            <!-- Plan for -->
            <div class="ln-detail-row ln-detail-row--plan">
              <span class="ln-detail-label">Plan for</span>
              <div class="ln-detail-ctrl ln-detail-ctrl--plan">
                <button *ngFor="let opt of plannedOpts; trackBy: trackByIndex"
                        type="button" class="ln-plan-chip"
                        [class.ln-plan-chip--active]="startLogPlanned === opt.v"
                        (click)="startLogPlanned = opt.v">
                  {{ opt.l }}
                </button>
              </div>
            </div>

            <!-- Ticket ID (work only) -->
            <div class="ln-detail-row" *ngIf="startLogDomain === 'work'">
              <span class="ln-detail-label">Ticket ID</span>
              <div class="ln-detail-ctrl">
                <input type="text" class="ln-detail-input" [(ngModel)]="startLogTicketId"
                       placeholder="e.g. JIRA-1234" maxlength="100" autocomplete="off"/>
              </div>
            </div>

          </div><!-- /ln-details-card -->

        </div>
        <div class="log-now-actions">
          <button class="log-now-cancel" (click)="closeSheet()">Cancel</button>
          <button class="log-now-save log-now-save--start" (click)="saveStartLog()"
                  [disabled]="startLogSaving || !startLogTypeId">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {{ startLogSaving ? 'Starting…' : 'Start Timer' }}
          </button>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .log-now-backdrop {
      position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.45);
    }
    .log-now-sheet {
      position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
      z-index: 301; width: 100%; max-width: 480px;
      background: var(--bg-surface); border-top: 1px solid var(--border);
      border-radius: 16px 16px 0 0; padding: 20px 20px 36px;
      animation: slideUp 0.22s ease;
    }
    .uni-sheet {
      display: flex; flex-direction: column;
      max-height: 95dvh;
      padding: 12px 20px 24px;
    }
    .uni-sheet app-log-tab-switcher { flex-shrink: 0; display: block; }
    .uni-sheet ng-container { display: contents; }
    .uni-sheet .log-now-fields {
      padding-top: 8px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .uni-sheet .log-now-actions { padding-top: 12px; }
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100%); }
      to   { transform: translateX(-50%) translateY(0); }
    }

    /* Date context */
    .uni-date-context {
      display: flex; align-items: center; gap: 5px;
      padding: 8px 0 0;
      font-size: 11px; font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.2px;
      flex-shrink: 0;
    }

    /* Actions */
    .log-now-actions { display: flex; gap: 10px; }
    .log-now-cancel {
      flex: 1; padding: 11px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-secondary); font-size: 14px; cursor: pointer;
    }
    .log-now-save {
      flex: 2; padding: 11px; background: var(--highlight-selected); border: none;
      border-radius: 8px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .log-now-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .log-now-save--start { display: flex; align-items: center; justify-content: center; gap: 6px; }

    /* ── Title textarea (3 lines, internal scroll) ──────── */
    .ln-title-input {
      width: 100%; padding: 10px 12px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 14px;
      box-sizing: border-box; font-family: inherit; resize: none;
      line-height: 21px;
      min-height: 83px; height: 83px;
      overflow-y: auto;
    }
    .ln-title-input:focus { border-color: var(--highlight-selected); outline: none; }
    .ln-title-input::placeholder { color: var(--text-muted); }

    /* ── Priority chips ─────────────────────────────────── */
    .ln-priority-chip {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
      padding: 7px 6px; border-radius: 10px;
      border: 1.5px solid var(--border);
      font-size: 12px; font-weight: 600;
      background: var(--bg-card); color: var(--text-muted);
      cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
      min-width: 0;
    }
    .ln-priority-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .ln-priority-chip--high   .ln-priority-dot { background: #e94560; }
    .ln-priority-chip--medium .ln-priority-dot { background: #f5a623; }
    .ln-priority-chip--low    .ln-priority-dot { background: #4caf7d; }
    .ln-priority-chip--high.ln-priority-chip--active   { border-color: #e94560; color: #e94560; background: rgba(233,69,96,0.1); }
    .ln-priority-chip--medium.ln-priority-chip--active { border-color: #f5a623; color: #f5a623; background: rgba(245,166,35,0.1); }
    .ln-priority-chip--low.ln-priority-chip--active    { border-color: #4caf7d; color: #4caf7d; background: rgba(76,175,125,0.1); }

    /* ── Crucial Person buttons ─────────────────────────── */
    .ln-crucial-btn {
      flex: 1; padding: 7px 8px; border-radius: 10px;
      border: 1.5px solid var(--border-light);
      font-size: 12px; font-weight: 600;
      background: var(--bg-card); color: var(--text-muted);
      cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
      min-width: 0;
    }
    .ln-crucial-btn:hover { color: var(--text-primary); }
    .ln-crucial-btn--yes.ln-crucial-btn--active    { border-color: #4caf7d; color: #4caf7d; background: rgba(76,175,125,0.12); }
    .ln-crucial-btn--shared.ln-crucial-btn--active { border-color: #f5a623; color: #f5a623; background: rgba(245,166,35,0.12); }
    .ln-crucial-btn--no.ln-crucial-btn--active     { border-color: #9b9b9b; color: var(--text-secondary); background: var(--bg-surface); }

    /* ── Collaborators ──────────────────────────────────── */
    .ln-collab-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .ln-collab-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 12px;
      background: color-mix(in srgb, var(--highlight-selected) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--highlight-selected) 30%, transparent);
      color: var(--highlight-selected); font-size: 12px; font-weight: 500;
    }
    .ln-collab-remove {
      background: none; color: var(--highlight-selected);
      font-size: 14px; line-height: 1; padding: 0 1px;
      opacity: 0.7; cursor: pointer; transition: opacity 0.15s;
    }
    .ln-collab-remove:hover { opacity: 1; }
    .ln-collab-row { display: flex; gap: 6px; }
    .ln-collab-input {
      flex: 1; min-width: 0; padding: 7px 10px;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 12px;
      font-family: inherit; box-sizing: border-box;
    }
    .ln-collab-input:focus { border-color: var(--highlight-selected); outline: none; }
    .ln-collab-input::placeholder { color: var(--text-muted); }
    .ln-collab-add {
      padding: 7px 12px; font-size: 12px; font-weight: 600;
      background: var(--bg-card); color: var(--text-secondary);
      border: 1px solid var(--border); border-radius: 8px;
      cursor: pointer; white-space: nowrap; flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .ln-collab-add:hover:not(:disabled) { color: var(--text-primary); }
    .ln-collab-add:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Score ────────────────────────────────────────────── */
    .ln-score-track { display: flex; gap: 3px; }
    .ln-score-btn {
      flex: 1; padding: 5px 0; border-radius: 6px;
      border: 1.5px solid var(--border-light);
      font-size: 10px; font-weight: 700;
      background: var(--bg-card); color: var(--text-muted);
      cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s; min-width: 0;
    }
    .ln-score-btn:hover { border-color: var(--highlight-selected); color: var(--text-primary); }
    .ln-score-btn--filled {
      background: color-mix(in srgb, var(--highlight-selected) 18%, transparent);
      border-color: var(--highlight-selected); color: var(--highlight-selected);
    }
    .ln-score-bar-wrap { height: 3px; border-radius: 2px; background: var(--border-light); overflow: hidden; }
    .ln-score-bar-fill { height: 100%; border-radius: 2px; background: var(--highlight-selected); transition: width 0.2s ease; }

    /* ── Plan for chips (tab 3) ─────────────────────────── */
    .ln-plan-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .ln-plan-chip {
      padding: 5px 11px; border-radius: 14px; border: 1px solid var(--border-light);
      background: var(--bg-card); color: var(--text-secondary); font-size: 12px; cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .ln-plan-chip:hover { color: var(--text-primary); }
    .ln-plan-chip--active {
      border-color: var(--highlight-selected); background: var(--highlight-selected);
      color: #fff; font-weight: 600;
    }

    /* ── Details card ─────────────────────────────────────── */
    .ln-details-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden;
      flex-shrink: 0;
    }
    .ln-details-header {
      font-size: 10px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.8px;
      padding: 10px 14px 8px;
    }
    .ln-detail-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; border-top: 1px solid var(--border);
    }
    .ln-detail-row--collab { flex-direction: column; align-items: flex-start; gap: 7px; }
    .ln-detail-row--score  { align-items: flex-start; }
    .ln-detail-row--plan   { align-items: flex-start; flex-wrap: wrap; }
    .ln-detail-label {
      font-size: 12px; font-weight: 600; color: var(--text-secondary);
      min-width: 90px; flex-shrink: 0;
    }
    .ln-detail-ctrl {
      flex: 1; display: flex; align-items: center; gap: 5px;
      justify-content: flex-end; flex-wrap: wrap;
    }
    .ln-detail-ctrl--collab {
      width: 100%; display: flex; flex-direction: column; gap: 6px;
    }
    .ln-detail-ctrl--score {
      flex: 1; display: flex; flex-direction: column; align-items: stretch;
    }
    .ln-detail-ctrl--plan {
      flex: 1; display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end;
    }
    .ln-detail-input {
      flex: 1; min-width: 60px; padding: 5px 9px;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 7px; color: var(--text-primary); font-size: 12px;
      font-family: inherit; box-sizing: border-box; text-align: right;
    }
    .ln-detail-input:focus { border-color: var(--highlight-selected); outline: none; }
    .ln-detail-input::placeholder { color: var(--text-muted); }
  `],
})
export class UnifiedSheetComponent implements OnInit, OnDestroy {
  @Input() initialTab: 1|2|3 = 1;
  @Input() selectedDate: Date = new Date();
  @Input() logs: LogEntry[] = [];

  @Output() closed         = new EventEmitter<void>();
  @Output() logCreated     = new EventEmitter<void>();
  @Output() timerStarted   = new EventEmitter<ActiveLog>();
  @Output() showToast      = new EventEmitter<{ message: string; logId: string }>();

  private readonly destroy$ = new Subject<void>();

  readonly scoreRange = [1,2,3,4,5,6,7,8,9,10];
  readonly plannedOpts = [
    {v:'',l:'no time bound'},{v:'15',l:'15m'},{v:'30',l:'30m'},
    {v:'60',l:'1h'},{v:'90',l:'1.5h'},{v:'120',l:'2h'},
  ];

  // ── Internal state ────────────────────────────────────────────────
  tab: 1|2|3 = 1;
  private logTypes: LogType[] = [];
  private uniTouchStartX = 0;
  private uniTouchStartY = 0;

  // Log Now (tab 1)
  logNowDomain: 'work' | 'personal' = 'work';
  logNowTypeId    = '';
  logNowTitle     = '';
  logNowStart     = '09:00';
  logNowEnd       = '09:00';
  logNowSaving    = false;
  logNowTicketId  = '';
  logNowPriority: 'High' | 'Medium' | 'Low' | null = null;
  logNowCollaborators: string[] = [];
  logNowCollaboratorInput = '';
  logNowSatisfactoryScore: number | null = null;
  logNowCrucialPerson: 'Yes' | 'No' | 'Shared' | null = null;
  logNowActiveField: string | null = null;

  // Add Point (tab 2)
  addPointDomain: 'work' | 'personal' = 'work';
  addPointTypeId    = '';
  addPointTitle     = '';
  addPointTime      = '09:00';
  addPointSaving    = false;
  addPointTicketId  = '';
  addPointPriority: 'High' | 'Medium' | 'Low' | null = null;
  addPointCollaborators: string[] = [];
  addPointCollaboratorInput = '';
  addPointSatisfactoryScore: number | null = null;
  addPointCrucialPerson: 'Yes' | 'No' | 'Shared' | null = null;
  addPointActiveField: string | null = null;

  // Start Timer (tab 3)
  startLogDomain: 'work' | 'personal' = 'work';
  startLogTypeId    = '';
  startLogTitle     = '';
  startLogPlanned   = '';
  startLogSaving    = false;
  startLogTicketId  = '';

  constructor(
    private logService:     LogService,
    private logTypeService: LogTypeService,
    private prefService:    PreferenceService,
    private cd:             ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.tab = this.initialTab;
    this.logTypeService.getLogTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe(types => {
        this.logTypes = types;
        this._initAllTabs();
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private get selectedDateStr(): string {
    const d = this.selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  get targetDateLabel(): string {
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  scrollInputIntoView(event: FocusEvent): void {
    const el = event.target as HTMLElement;
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
  }

  // ── Initialisation ────────────────────────────────────────────────
  private _initAllTabs(): void {
    this._initLogNow();
    this._initAddPoint();
    this._initStartLog();
  }

  private _initLogNow(): void {
    const now      = this._snapToQuarter(this._currentTimeStr());
    const startStr = this._snapToQuarter(this._smartDefaultStart());
    this.logNowStart             = startStr;
    this.logNowEnd               = now;
    this.logNowDomain            = 'work';
    this.logNowTitle             = '';
    this.logNowTicketId          = '';
    this.logNowPriority            = null;
    this.logNowCollaborators       = [];
    this.logNowCollaboratorInput   = '';
    this.logNowSatisfactoryScore   = null;
    this.logNowCrucialPerson       = null;
    this.logNowActiveField         = null;
    this.logNowTypeId = this.workTypeOptions[0]?.id ?? this.logTypes[0]?._id ?? '';
  }

  private _initAddPoint(): void {
    this.addPointDomain            = 'work';
    this.addPointTitle             = '';
    this.addPointTicketId          = '';
    this.addPointPriority            = null;
    this.addPointCollaborators       = [];
    this.addPointCollaboratorInput   = '';
    this.addPointSatisfactoryScore   = null;
    this.addPointCrucialPerson       = null;
    this.addPointActiveField         = null;
    const n = new Date();
    this.addPointTime = this._snapToQuarter(
      `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
    );
    this.addPointTypeId = this.workTypeOptions[0]?.id ?? '';
  }

  private _initStartLog(): void {
    this.startLogDomain   = 'work';
    this.startLogTitle    = '';
    this.startLogPlanned  = '';
    this.startLogTicketId = '';
    this.startLogTypeId   = this.workTypeOptions[0]?.id ?? this.logTypes[0]?._id ?? '';
  }

  // ── Tab management ────────────────────────────────────────────────
  switchTab(t: 1|2|3): void {
    this.tab = t;
  }

  onSwipeStart(e: TouchEvent): void {
    // Ignore swipes that begin inside the time-range-slider so dragging
    // the handle doesn't accidentally switch tabs.
    if ((e.target as HTMLElement).closest('app-time-range-slider')) {
      this.uniTouchStartX = -1;
      return;
    }
    this.uniTouchStartX = e.changedTouches[0].clientX;
    this.uniTouchStartY = e.changedTouches[0].clientY;
  }
  onSwipeEnd(e: TouchEvent): void {
    if (this.uniTouchStartX < 0) return;
    const dx = e.changedTouches[0].clientX - this.uniTouchStartX;
    const dy = e.changedTouches[0].clientY - this.uniTouchStartY;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    if (dx > 60 && this.tab > 1)  this.tab = (this.tab - 1) as 1|2|3;
    else if (dx < -60 && this.tab < 3) this.tab = (this.tab + 1) as 1|2|3;
  }

  closeSheet(): void { this.closed.emit(); }

  // ── Type option lists for TypeSelectorComponent ──────────────────
  get workTypeOptions(): TypeOption[] {
    return this.logTypes
      .filter(lt => lt.domain === 'work')
      .map(lt => ({ id: lt._id, label: lt.name, color: lt.color }));
  }
  get personalTypeOptions(): TypeOption[] {
    return this.logTypes
      .filter(lt => lt.domain === 'personal')
      .map(lt => ({ id: lt._id, label: lt.name, color: lt.color }));
  }

  // ── Tab switcher handler ──────────────────────────────────────────
  onTabSwitcherChange(label: string): void {
    const map: Record<string, 1|2|3> = { 'Add log': 1, 'Add point': 2, 'Start timer': 3 };
    const t = map[label];
    if (t) this.switchTab(t);
  }

  // ── Type-selector change handlers ─────────────────────────────────
  onLogNowTypeChange(event: TypeChangeEvent): void {
    this.logNowDomain = event.category;
    this.logNowTypeId = event.id;
  }
  onAddPointTypeChange(event: TypeChangeEvent): void {
    this.addPointDomain = event.category;
    this.addPointTypeId = event.id;
  }
  onStartLogTypeChange(event: TypeChangeEvent): void {
    this.startLogDomain = event.category;
    this.startLogTypeId = event.id;
  }

  // ── Slider change handlers ────────────────────────────────────────
  onLogNowRangeChange(range: TimeRange): void {
    this.logNowStart = range.from;
    this.logNowEnd   = range.to;
  }

  onAddPointTimeChange(range: TimeRange): void {
    this.addPointTime = range.from;
  }

  // ── Save handlers ─────────────────────────────────────────────────
  saveLogNow(): void {
    if (this.logNowSaving || !this.logNowTypeId) return;
    const lt    = this.logTypes.find(t => t._id === this.logNowTypeId);
    const title = this.logNowTitle.trim() || (lt?.name ?? 'Log');
    this.logNowSaving = true;
    this.logService.createLog(this.selectedDate, {
      title, logTypeId: this.logNowTypeId, startTime: this.logNowStart, endTime: this.logNowEnd,
      ticketId:          this.logNowDomain === 'work' ? (this.logNowTicketId.trim() || undefined) : undefined,
      priority:          this.logNowPriority ?? undefined,
      collaborators:     this.logNowCollaborators.length > 0 ? [...this.logNowCollaborators] : undefined,
      satisfactoryScore: this.logNowSatisfactoryScore ?? undefined,
      crucialPerson:     this.logNowDomain === 'work' ? (this.logNowCrucialPerson ?? undefined) : undefined,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => { this.logNowSaving = false; this.closed.emit(); this.logCreated.emit(); this.cd.markForCheck(); },
      error: () => { this.logNowSaving = false; this.cd.markForCheck(); },
    });
  }

  saveAddPoint(): void {
    if (this.addPointSaving || !this.addPointTypeId) return;
    const lt    = this.logTypes.find(t => t._id === this.addPointTypeId);
    const title = this.addPointTitle.trim() || (lt?.name ?? 'Point');
    this.addPointSaving = true;
    this.logService.createLog(this.selectedDate, {
      title, logTypeId: this.addPointTypeId, entryType: 'point',
      pointTime: this.addPointTime, startTime: this.addPointTime, endTime: this.addPointTime,
      ticketId:          this.addPointDomain === 'work' ? (this.addPointTicketId.trim() || undefined) : undefined,
      priority:          this.addPointPriority ?? undefined,
      collaborators:     this.addPointCollaborators.length > 0 ? [...this.addPointCollaborators] : undefined,
      satisfactoryScore: this.addPointSatisfactoryScore ?? undefined,
      crucialPerson:     this.addPointDomain === 'work' ? (this.addPointCrucialPerson ?? undefined) : undefined,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next:  () => { this.addPointSaving = false; this.closed.emit(); this.logCreated.emit(); this.cd.markForCheck(); },
      error: () => { this.addPointSaving = false; this.cd.markForCheck(); },
    });
  }

  saveStartLog(): void {
    if (this.startLogSaving || !this.startLogTypeId) return;
    const lt          = this.logTypes.find(t => t._id === this.startLogTypeId);
    const title       = this.startLogTitle.trim() || (lt?.name ?? 'Log');
    const plannedMins = this.startLogPlanned ? parseInt(this.startLogPlanned, 10) : null;
    this.startLogSaving = true;
    this.prefService.startActiveLog({ logTypeId: this.startLogTypeId, title, plannedMins })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activeLog) => {
          this.startLogSaving = false;
          this.closed.emit();
          if (activeLog) this.timerStarted.emit(activeLog);
          this.cd.markForCheck();
        },
        error: () => { this.startLogSaving = false; this.cd.markForCheck(); },
      });
  }

  // ── Priority ──────────────────────────────────────────────────────
  toggleLogNowPriority(v: 'High' | 'Medium' | 'Low'): void {
    this.logNowPriority = this.logNowPriority === v ? null : v;
  }
  toggleAddPointPriority(v: 'High' | 'Medium' | 'Low'): void {
    this.addPointPriority = this.addPointPriority === v ? null : v;
  }

  setLogNowScore(n: number): void {
    this.logNowSatisfactoryScore = this.logNowSatisfactoryScore === n ? null : n;
  }
  setAddPointScore(n: number): void {
    this.addPointSatisfactoryScore = this.addPointSatisfactoryScore === n ? null : n;
  }
  toggleLogNowCrucialPerson(v: 'Yes' | 'No' | 'Shared'): void {
    this.logNowCrucialPerson = this.logNowCrucialPerson === v ? null : v;
  }
  toggleAddPointCrucialPerson(v: 'Yes' | 'No' | 'Shared'): void {
    this.addPointCrucialPerson = this.addPointCrucialPerson === v ? null : v;
  }

  priorityColor(p: string): string {
    return p === 'High' ? '#e94560' : p === 'Medium' ? '#f5a623' : '#4caf7d';
  }

  // ── Collaborators ─────────────────────────────────────────────────
  addLogNowCollaborator(): void {
    const name = this.logNowCollaboratorInput.trim();
    if (!name || this.logNowCollaborators.includes(name)) return;
    this.logNowCollaborators = [...this.logNowCollaborators, name];
    this.logNowCollaboratorInput = '';
  }
  removeLogNowCollaborator(i: number): void {
    this.logNowCollaborators = this.logNowCollaborators.filter((_, idx) => idx !== i);
  }
  addAddPointCollaborator(): void {
    const name = this.addPointCollaboratorInput.trim();
    if (!name || this.addPointCollaborators.includes(name)) return;
    this.addPointCollaborators = [...this.addPointCollaborators, name];
    this.addPointCollaboratorInput = '';
  }
  removeAddPointCollaborator(i: number): void {
    this.addPointCollaborators = this.addPointCollaborators.filter((_, idx) => idx !== i);
  }

  // ── TrackBy ───────────────────────────────────────────────────────
  trackByIndex(i: number): number { return i; }

  // ── Time utilities ────────────────────────────────────────────────
  private _currentTimeStr(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }
  private _minsToTimeStr(mins: number): string {
    return `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`;
  }
  private _timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
  private _snapToQuarter(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const snapped = Math.round(m / 15) * 15;
    if (snapped === 60) return `${String(Math.min(23, h+1)).padStart(2,'0')}:00`;
    return `${String(h).padStart(2,'0')}:${String(snapped).padStart(2,'0')}`;
  }
  private _smartDefaultStart(): string {
    const last    = this.logs[this.logs.length - 1];
    const nowMins = this._timeToMinutes(this._currentTimeStr());
    if (!last) return this._minsToTimeStr(Math.max(0, nowMins - 30));
    const lastEndMins = this._timeToMinutes(last.endAt ?? last.startAt);
    return this._minsToTimeStr(nowMins - lastEndMins > 30 ? Math.max(0, nowMins - 30) : lastEndMins);
  }

  // ── Public opener helpers ─────────────────────────────────────────
  prepForAddPoint(domain: 'work' | 'personal', typeId: string, time: string, title?: string): void {
    if (this.logTypes.length) {
      this.addPointDomain = domain;
      this.addPointTypeId = typeId;
      this.addPointTime   = time;
      this.addPointTitle  = title ?? '';
      this.tab = 2;
    }
  }

  setAddPointTime(time: string, domain?: 'work' | 'personal', typeId?: string, title?: string): void {
    this.addPointTime = time;
    if (domain) this.addPointDomain = domain;
    if (typeId) {
      const exists = this.logTypes.find(t => t._id === typeId);
      if (exists) this.addPointTypeId = typeId;
    }
    if (title !== undefined) this.addPointTitle = title;
    this.tab = 2;
  }
}
