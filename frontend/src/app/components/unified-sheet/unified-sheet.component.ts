import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { LogService } from '../../services/log.service';
import { LogTypeService } from '../../services/log-type.service';
import { PreferenceService, ActiveLog } from '../../services/preference.service';
import { LogType } from '../../models/log-type.model';
import { LogEntry } from '../../models/log.model';

@Component({
  selector: 'app-unified-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- backdrop -->
    <div class="log-now-backdrop" (click)="closeSheet()"></div>

    <!-- sheet -->
    <div class="log-now-sheet uni-sheet"
         (touchstart)="onSwipeStart($event)"
         (touchend)="onSwipeEnd($event)">

      <!-- Tab pills -->
      <div class="uni-tabs">
        <button class="uni-tab" [class.uni-tab--active]="tab === 1" (click)="switchTab(1)">Add log</button>
        <button class="uni-tab" [class.uni-tab--active]="tab === 2" (click)="switchTab(2)">Add point</button>
        <button class="uni-tab" [class.uni-tab--active]="tab === 3" (click)="switchTab(3)">Start timer</button>
      </div>

      <!-- ── Tab 1: Add log ── -->
      <ng-container *ngIf="tab === 1">
        <div class="log-now-fields">

          <!-- 1. Domain + Type carousel -->
          <div class="ln-type-section">
            <div class="ln-domain-tabs">
              <button class="ln-domain-tab" [class.ln-domain-tab--active]="logNowDomain === 'work'"
                      (click)="setLogNowDomain('work')">Work</button>
              <button class="ln-domain-tab" [class.ln-domain-tab--active]="logNowDomain === 'personal'"
                      (click)="setLogNowDomain('personal')">Personal</button>
            </div>
            <div class="ln-type-carousel" (touchstart)="$event.stopPropagation()">
              <button type="button" class="ln-type-chip"
                      *ngFor="let lt of logNowFilteredTypes; trackBy: trackByLogTypeId"
                      [class.ln-type-chip--active]="lt._id === logNowTypeId"
                      [style.border-color]="lt._id === logNowTypeId ? lt.color : null"
                      [style.background-color]="lt._id === logNowTypeId ? lt.color + '22' : null"
                      [style.color]="lt._id === logNowTypeId ? lt.color : null"
                      (click)="logNowTypeId = lt._id">
                <span class="ln-type-dot" [style.background]="lt.color"></span>
                {{ lt.name }}
              </button>
            </div>
          </div>

          <!-- 2. Title -->
          <textarea class="log-now-input"
                    placeholder="Title (optional — defaults to type name)"
                    [(ngModel)]="logNowTitle"></textarea>

          <!-- 3. Time pickers — split From / To cards -->
          <div class="ln-time-row">
            <!-- FROM card -->
            <div class="ln-time-card">
              <div class="ln-drum-group">
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-start-h" (scroll)="onLogNowStartHourScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let h of logNowHours; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="h === logNowStartHour">{{ h | number:'2.0-0' }}</div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                </div>
                <div class="ln-drum-colon">:</div>
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-start-m" (scroll)="onLogNowStartMinuteScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let m of logNowMinutes; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="m === logNowStartMinute">{{ m | number:'2.0-0' }}</div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Middle: duration + arrow -->
            <div class="ln-time-middle">
              <span class="ln-time-duration">{{ logNowDuration }}</span>
              <span class="ln-time-mid-arrow">→</span>
            </div>

            <!-- TO card -->
            <div class="ln-time-card">
              <div class="ln-drum-group">
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-end-h" (scroll)="onLogNowEndHourScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let h of logNowHours; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="h === logNowEndHour">{{ h | number:'2.0-0' }}</div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                </div>
                <div class="ln-drum-colon">:</div>
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-end-m" (scroll)="onLogNowEndMinuteScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let m of logNowMinutes; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="m === logNowEndMinute">{{ m | number:'2.0-0' }}</div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div><!-- /TO card -->
          </div><!-- /ln-time-row -->

          <!-- 4. Priority carousel (work only) -->
          <div class="ln-field-group" *ngIf="logNowDomain === 'work'">
            <span class="ln-field-label">Priority</span>
            <div class="ln-priority-carousel">
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

          <!-- 5. Collaborators (work only) -->
          <div class="ln-field-group" *ngIf="logNowDomain === 'work'">
            <span class="ln-field-label">Collaborators</span>
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

          <!-- 6. Ticket ID (work only) -->
          <div class="ln-field-group" *ngIf="logNowDomain === 'work'">
            <span class="ln-field-label">Ticket ID</span>
            <input type="text" class="ln-text-input" [(ngModel)]="logNowTicketId"
                   placeholder="e.g. JIRA-1234 (optional)" maxlength="100" autocomplete="off"/>
          </div>

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

          <!-- 1. Domain + Type carousel -->
          <div class="ln-type-section">
            <div class="ln-domain-tabs">
              <button class="ln-domain-tab" [class.ln-domain-tab--active]="addPointDomain === 'work'"
                      (click)="setAddPointDomain('work')">Work</button>
              <button class="ln-domain-tab" [class.ln-domain-tab--active]="addPointDomain === 'personal'"
                      (click)="setAddPointDomain('personal')">Personal</button>
            </div>
            <div class="ln-type-carousel" (touchstart)="$event.stopPropagation()">
              <button type="button" class="ln-type-chip"
                      *ngFor="let lt of addPointFilteredTypes; trackBy: trackByLogTypeId"
                      [class.ln-type-chip--active]="lt._id === addPointTypeId"
                      [style.border-color]="lt._id === addPointTypeId ? lt.color : null"
                      [style.background-color]="lt._id === addPointTypeId ? lt.color + '22' : null"
                      [style.color]="lt._id === addPointTypeId ? lt.color : null"
                      (click)="addPointTypeId = lt._id">
                <span class="ln-type-dot" [style.background]="lt.color"></span>
                {{ lt.name }}
              </button>
            </div>
          </div>

          <!-- 2. Title -->
          <textarea class="log-now-input" placeholder="Title (optional)" [(ngModel)]="addPointTitle"></textarea>

          <!-- 3. Time picker (single) -->
          <div class="ln-time-pickers ln-time-pickers--single">
            <div class="ln-time-block">
              <span class="ln-time-block-label">Time</span>
              <div class="ln-drum-group">
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-ap-h" (scroll)="onAddPointHourScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let h of logNowHours; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="h === addPointHour">
                        {{ h | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">h</span>
                </div>
                <div class="ln-drum-colon">:</div>
                <div class="ln-drum-col">
                  <div class="ln-drum-wrapper">
                    <div class="ln-drum-center-band"></div>
                    <div class="ln-drum ln-drum-ap-m" (scroll)="onAddPointMinuteScroll($event)">
                      <div class="ln-drum-spacer"></div>
                      <div class="ln-drum-item" *ngFor="let m of addPointMinutes; trackBy: trackByIndex"
                           [class.ln-drum-item--sel]="m === addPointMinute">
                        {{ m | number:'2.0-0' }}
                      </div>
                      <div class="ln-drum-spacer"></div>
                    </div>
                  </div>
                  <span class="ln-drum-unit">m</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Priority carousel (work only) -->
          <div class="ln-field-group" *ngIf="addPointDomain === 'work'">
            <span class="ln-field-label">Priority</span>
            <div class="ln-priority-carousel">
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

          <!-- 5. Collaborators (work only) -->
          <div class="ln-field-group" *ngIf="addPointDomain === 'work'">
            <span class="ln-field-label">Collaborators</span>
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

          <!-- 6. Ticket ID (work only) -->
          <div class="ln-field-group" *ngIf="addPointDomain === 'work'">
            <span class="ln-field-label">Ticket ID</span>
            <input type="text" class="ln-text-input" [(ngModel)]="addPointTicketId"
                   placeholder="e.g. JIRA-1234 (optional)" maxlength="100" autocomplete="off"/>
          </div>

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

          <!-- 1. Domain + Type carousel -->
          <div class="ln-type-section">
            <div class="ln-domain-tabs">
              <button class="ln-domain-tab" [class.ln-domain-tab--active]="startLogDomain === 'work'"
                      (click)="setStartLogDomain('work')">Work</button>
              <button class="ln-domain-tab" [class.ln-domain-tab--active]="startLogDomain === 'personal'"
                      (click)="setStartLogDomain('personal')">Personal</button>
            </div>
            <div class="ln-type-carousel" (touchstart)="$event.stopPropagation()">
              <button type="button" class="ln-type-chip"
                      *ngFor="let lt of startLogFilteredTypes; trackBy: trackByLogTypeId"
                      [class.ln-type-chip--active]="lt._id === startLogTypeId"
                      [style.border-color]="lt._id === startLogTypeId ? lt.color : null"
                      [style.background-color]="lt._id === startLogTypeId ? lt.color + '22' : null"
                      [style.color]="lt._id === startLogTypeId ? lt.color : null"
                      (click)="startLogTypeId = lt._id">
                <span class="ln-type-dot" [style.background]="lt.color"></span>
                {{ lt.name }}
              </button>
            </div>
          </div>

          <!-- 2. Title -->
          <textarea class="log-now-input"
                    placeholder="Title (optional — defaults to type name)"
                    [(ngModel)]="startLogTitle"></textarea>

          <!-- 3. Plan for (replaces time picker for timer) -->
          <div class="ln-field-group">
            <span class="ln-field-label">Plan for</span>
            <div class="ln-plan-chips">
              <button *ngFor="let opt of plannedOpts; trackBy: trackByIndex"
                      type="button" class="ln-plan-chip"
                      [class.ln-plan-chip--active]="startLogPlanned === opt.v"
                      (click)="startLogPlanned = opt.v">
                {{ opt.l }}
              </button>
            </div>
          </div>

          <!-- 4. Ticket ID (work only) -->
          <div class="ln-field-group" *ngIf="startLogDomain === 'work'">
            <span class="ln-field-label">Ticket ID</span>
            <input type="text" class="ln-text-input" [(ngModel)]="startLogTicketId"
                   placeholder="e.g. JIRA-1234 (optional)" maxlength="100" autocomplete="off"/>
          </div>

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
      height: 78dvh; max-height: 78dvh;
      padding: 12px 20px 28px; overflow: hidden;
    }
    .uni-sheet .uni-tabs { flex-shrink: 0; }
    .uni-sheet ng-container { display: contents; }
    .uni-sheet .log-now-fields {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding-top: 8px; min-height: 0;
      display: flex; flex-direction: column; gap: 12px;
    }
    .uni-sheet .log-now-actions { flex-shrink: 0; padding-top: 10px; }
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100%); }
      to   { transform: translateX(-50%) translateY(0); }
    }

    /* Tab pills */
    .uni-tabs {
      display: flex; gap: 6px; padding: 0 0 12px;
      border-bottom: 1px solid var(--border); margin-bottom: 4px;
      flex-shrink: 0;
    }
    .uni-tab {
      flex: 1; padding: 7px 6px; border: 1px solid var(--border); border-radius: 8px;
      background: transparent; color: var(--text-secondary); font-size: 13px;
      font-weight: 500; cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .uni-tab--active { background: var(--nav-bg); color: var(--nav-text); border-color: var(--nav-bg); }

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

    /* ── Domain tabs ────────────────────────────────────── */
    .ln-domain-tabs {
      display: flex; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-sm); overflow: hidden;
    }
    .ln-domain-tab {
      flex: 1; padding: 7px; background: transparent; border: none;
      color: var(--text-muted); font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .ln-domain-tab--active { background: var(--highlight-selected); color: #fff; }

    /* ── Type carousel ──────────────────────────────────── */
    .ln-type-section { display: flex; flex-direction: column; gap: 8px; }
    .ln-type-carousel {
      display: flex; gap: 7px;
      overflow-x: auto; padding: 3px 2px 6px;
      scrollbar-width: none; -webkit-overflow-scrolling: touch;
    }
    .ln-type-carousel::-webkit-scrollbar { display: none; }
    .ln-type-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 20px;
      border: 1.5px solid var(--border);
      background: var(--bg-card); color: var(--text-secondary);
      font-size: 12px; font-weight: 500; white-space: nowrap;
      cursor: pointer; flex-shrink: 0;
      transition: border-color 0.15s, background-color 0.15s, color 0.15s;
    }
    .ln-type-chip--active { font-weight: 700; border-width: 2px; }
    .ln-type-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }

    /* ── Title textarea ─────────────────────────────────── */
    .log-now-input {
      width: 100%; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 14px;
      box-sizing: border-box; font-family: inherit; resize: none;
      line-height: 1.5; height: calc(1.5em * 3 + 20px);
    }
    .log-now-input:focus { border-color: var(--highlight-selected); outline: none; }
    .log-now-input::placeholder { color: var(--text-muted); }

    /* ── Split time row (Tab 1 From/To) ───────────────── */
    .ln-time-row {
      display: flex; align-items: stretch; gap: 8px;
    }
    .ln-time-card {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      padding: 6px 4px;
    }
    .ln-time-card-label {
      font-size: 10px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.8px;
    }
    .ln-time-middle {
      flex: 0 0 48px; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 3px;
    }
    .ln-time-duration {
      font-size: 11px; color: var(--text-muted); font-weight: 500;
      white-space: nowrap; text-align: center;
    }
    .ln-time-mid-arrow { font-size: 16px; color: var(--text-muted); }

    /* ── Time pickers / drums ───────────────────────────── */
    .ln-time-pickers {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 8px;
    }
    .ln-time-pickers--single { justify-content: flex-start; }
    .ln-time-block { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
    .ln-time-block-label {
      font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px;
    }
    .ln-time-arrow { font-size: 18px; color: var(--text-muted); flex-shrink: 0; padding-top: 20px; }
    .ln-drum-group { display: flex; align-items: center; gap: 4px; }
    .ln-drum-colon {
      font-size: 18px; font-weight: 700; color: var(--text-primary); line-height: 1; padding-bottom: 10px; flex-shrink: 0;
    }
    .ln-drum-col { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .ln-drum-wrapper { position: relative; width: 56px; height: 75px; overflow: hidden; }
    .ln-drum-wrapper::before, .ln-drum-wrapper::after {
      content: ''; position: absolute; left: 0; right: 0; height: 25px; z-index: 2; pointer-events: none;
    }
    .ln-drum-wrapper::before { top: 0; background: linear-gradient(to bottom, var(--bg-card) 10%, transparent); }
    .ln-drum-wrapper::after  { bottom: 0; background: linear-gradient(to top, var(--bg-card) 10%, transparent); }
    .ln-drum-center-band {
      position: absolute; top: 50%; left: 3px; right: 3px; height: 25px; transform: translateY(-50%);
      border-top: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light);
      background: rgba(74,144,226,0.06); border-radius: 4px; pointer-events: none; z-index: 1;
    }
    .ln-drum {
      position: relative; z-index: 3; width: 100%; height: 100%;
      overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .ln-drum::-webkit-scrollbar { display: none; }
    .ln-drum-spacer { height: 25px; flex-shrink: 0; display: block; }
    .ln-drum-item {
      height: 25px; scroll-snap-align: center; display: flex; align-items: center;
      justify-content: center; font-size: 11px; font-weight: 500; color: var(--text-muted);
      font-variant-numeric: tabular-nums; user-select: none; transition: color 0.1s, font-size 0.1s, font-weight 0.1s;
    }
    .ln-drum-item--sel { color: var(--text-primary); font-size: 14px; font-weight: 700; }
    .ln-drum-unit {
      font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.7px;
    }

    /* ── Priority carousel ──────────────────────────────── */
    .ln-priority-carousel {
      display: flex; gap: 8px;
    }
    .ln-priority-chip {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 10px; border-radius: 10px;
      border: 1.5px solid var(--border);
      font-size: 13px; font-weight: 600;
      background: var(--bg-card); color: var(--text-muted);
      cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .ln-priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .ln-priority-chip--high   .ln-priority-dot { background: #e94560; }
    .ln-priority-chip--medium .ln-priority-dot { background: #f5a623; }
    .ln-priority-chip--low    .ln-priority-dot { background: #4caf7d; }
    .ln-priority-chip--high.ln-priority-chip--active   { border-color: #e94560; color: #e94560; background: rgba(233,69,96,0.1); }
    .ln-priority-chip--medium.ln-priority-chip--active { border-color: #f5a623; color: #f5a623; background: rgba(245,166,35,0.1); }
    .ln-priority-chip--low.ln-priority-chip--active    { border-color: #4caf7d; color: #4caf7d; background: rgba(76,175,125,0.1); }

    /* ── Shared field group ─────────────────────────────── */
    .ln-field-group { display: flex; flex-direction: column; gap: 6px; }
    .ln-field-label {
      font-size: 10px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.8px;
    }

    /* ── Text inputs (ticket ID) ────────────────────────── */
    .ln-text-input {
      width: 100%; padding: 8px 11px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 13px;
      font-family: inherit; box-sizing: border-box;
    }
    .ln-text-input:focus { border-color: var(--highlight-selected); outline: none; }
    .ln-text-input::placeholder { color: var(--text-muted); }

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
      flex: 1; min-width: 0; padding: 8px 10px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 13px;
      font-family: inherit; box-sizing: border-box;
    }
    .ln-collab-input:focus { border-color: var(--highlight-selected); outline: none; }
    .ln-collab-input::placeholder { color: var(--text-muted); }
    .ln-collab-add {
      padding: 8px 12px; font-size: 12px; font-weight: 600;
      background: var(--bg-card); color: var(--text-secondary);
      border: 1px solid var(--border); border-radius: 8px;
      cursor: pointer; white-space: nowrap; flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .ln-collab-add:hover:not(:disabled) { color: var(--text-primary); }
    .ln-collab-add:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Plan for chips (tab 3) ─────────────────────────── */
    .ln-plan-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .ln-plan-chip {
      padding: 6px 13px; border-radius: 14px; border: 1px solid var(--border-light);
      background: var(--bg-card); color: var(--text-secondary); font-size: 12px; cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .ln-plan-chip:hover { color: var(--text-primary); }
    .ln-plan-chip--active {
      border-color: var(--highlight-selected); background: var(--highlight-selected);
      color: #fff; font-weight: 600;
    }
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

  // ── Drum constants ────────────────────────────────────────────────
  readonly logNowHours     = Array.from({ length: 24 }, (_, i) => i);
  readonly logNowMinutes   = [15, 30, 45, 0];
  readonly addPointMinutes = [0, 15, 30, 45];
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

  // ── Initialisation ────────────────────────────────────────────────
  private _initAllTabs(): void {
    this._initLogNow();
    this._initAddPoint();
    this._initStartLog();
    setTimeout(() => this._scrollTimeDrums(), 40);
  }

  private _initLogNow(): void {
    const now      = this._snapToQuarter(this._currentTimeStr());
    const startStr = this._snapToQuarter(this._smartDefaultStart());
    this.logNowStart             = startStr;
    this.logNowEnd               = now;
    this.logNowDomain            = 'work';
    this.logNowTitle             = '';
    this.logNowTicketId          = '';
    this.logNowPriority          = null;
    this.logNowCollaborators     = [];
    this.logNowCollaboratorInput = '';
    const workTypes = this.logTypes.filter(lt => lt.domain === 'work');
    this.logNowTypeId = workTypes[0]?._id ?? this.logTypes[0]?._id ?? '';
  }

  private _initAddPoint(): void {
    this.addPointDomain            = 'work';
    this.addPointTitle             = '';
    this.addPointTicketId          = '';
    this.addPointPriority          = null;
    this.addPointCollaborators     = [];
    this.addPointCollaboratorInput = '';
    const n = new Date();
    this.addPointTime = this._snapToQuarter(
      `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
    );
    this.addPointTypeId = this.addPointFilteredTypes[0]?._id ?? '';
  }

  private _initStartLog(): void {
    this.startLogDomain   = 'work';
    this.startLogTitle    = '';
    this.startLogPlanned  = '';
    this.startLogTicketId = '';
    this.startLogTypeId   = this.startLogFilteredTypes[0]?._id ?? this.logTypes[0]?._id ?? '';
  }

  private _scrollTimeDrums(): void {
    if (this.tab === 1) this._scrollLogNowDrums();
    if (this.tab === 2) this._scrollAddPointTimeDrums();
  }

  // ── Tab management ────────────────────────────────────────────────
  switchTab(t: 1|2|3): void {
    this.tab = t;
    setTimeout(() => this._scrollTimeDrums(), 40);
  }

  onSwipeStart(e: TouchEvent): void {
    this.uniTouchStartX = e.changedTouches[0].clientX;
    this.uniTouchStartY = e.changedTouches[0].clientY;
  }
  onSwipeEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.uniTouchStartX;
    const dy = e.changedTouches[0].clientY - this.uniTouchStartY;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    if (dx > 60 && this.tab > 1) { this.tab = (this.tab - 1) as 1|2|3; setTimeout(() => this._scrollTimeDrums(), 40); }
    else if (dx < -60 && this.tab < 3) { this.tab = (this.tab + 1) as 1|2|3; setTimeout(() => this._scrollTimeDrums(), 40); }
  }

  closeSheet(): void { this.closed.emit(); }

  // ── Filtered type lists ───────────────────────────────────────────
  get logNowFilteredTypes():   LogType[] { return this.logTypes.filter(lt => lt.domain === this.logNowDomain); }
  get addPointFilteredTypes(): LogType[] { return this.logTypes.filter(lt => lt.domain === this.addPointDomain); }
  get startLogFilteredTypes(): LogType[] { return this.logTypes.filter(lt => lt.domain === this.startLogDomain); }

  // ── Domain switching ──────────────────────────────────────────────
  setLogNowDomain(domain: 'work' | 'personal'): void {
    this.logNowDomain = domain;
    const filtered    = this.logNowFilteredTypes;
    if (!filtered.find(lt => lt._id === this.logNowTypeId)) {
      this.logNowTypeId = filtered[0]?._id ?? '';
    }
  }
  setAddPointDomain(domain: 'work' | 'personal'): void {
    this.addPointDomain = domain;
    const filtered      = this.addPointFilteredTypes;
    if (!filtered.find(lt => lt._id === this.addPointTypeId)) {
      this.addPointTypeId = filtered[0]?._id ?? '';
    }
  }
  setStartLogDomain(domain: 'work' | 'personal'): void {
    this.startLogDomain = domain;
    const filtered      = this.startLogFilteredTypes;
    if (!filtered.find(lt => lt._id === this.startLogTypeId)) {
      this.startLogTypeId = filtered[0]?._id ?? '';
    }
  }

  // ── Duration getter (Tab 1) ───────────────────────────────────────
  get logNowDuration(): string {
    const startMins = this._timeToMinutes(this.logNowStart);
    const endMins   = this._timeToMinutes(this.logNowEnd);
    const diff      = endMins - startMins;
    if (diff <= 0) return '--';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  // ── Time drum getters ─────────────────────────────────────────────
  get logNowStartHour():   number { return +this.logNowStart.split(':')[0]; }
  get logNowStartMinute(): number { return +this.logNowStart.split(':')[1]; }
  get logNowEndHour():     number { return +this.logNowEnd.split(':')[0]; }
  get logNowEndMinute():   number { return +this.logNowEnd.split(':')[1]; }
  get addPointHour():      number { return +this.addPointTime.split(':')[0]; }
  get addPointMinute():    number { return +this.addPointTime.split(':')[1]; }

  // ── Time drum scroll handlers ─────────────────────────────────────
  onLogNowStartHourScroll(event: Event): void {
    const h = Math.max(0, Math.min(23, Math.round((event.target as HTMLElement).scrollTop / 25)));
    if (h !== this.logNowStartHour) this.logNowStart = `${String(h).padStart(2,'0')}:${this.logNowStart.split(':')[1]}`;
  }
  onLogNowStartMinuteScroll(event: Event): void {
    const idx = Math.max(0, Math.min(this.logNowMinutes.length - 1, Math.round((event.target as HTMLElement).scrollTop / 25)));
    const m   = this.logNowMinutes[idx];
    if (m !== this.logNowStartMinute) this.logNowStart = `${this.logNowStart.split(':')[0]}:${String(m).padStart(2,'0')}`;
  }
  onLogNowEndHourScroll(event: Event): void {
    const h = Math.max(0, Math.min(23, Math.round((event.target as HTMLElement).scrollTop / 25)));
    if (h !== this.logNowEndHour) this.logNowEnd = `${String(h).padStart(2,'0')}:${this.logNowEnd.split(':')[1]}`;
  }
  onLogNowEndMinuteScroll(event: Event): void {
    const idx = Math.max(0, Math.min(this.logNowMinutes.length - 1, Math.round((event.target as HTMLElement).scrollTop / 25)));
    const m   = this.logNowMinutes[idx];
    if (m !== this.logNowEndMinute) this.logNowEnd = `${this.logNowEnd.split(':')[0]}:${String(m).padStart(2,'0')}`;
  }
  onAddPointHourScroll(event: Event): void {
    const h = Math.max(0, Math.min(23, Math.round((event.target as HTMLElement).scrollTop / 25)));
    if (h !== this.addPointHour) this.addPointTime = `${String(h).padStart(2,'0')}:${this.addPointTime.split(':')[1]}`;
  }
  onAddPointMinuteScroll(event: Event): void {
    const idx = Math.max(0, Math.min(this.addPointMinutes.length - 1, Math.round((event.target as HTMLElement).scrollTop / 25)));
    const m   = this.addPointMinutes[idx];
    if (m !== this.addPointMinute) this.addPointTime = `${this.addPointTime.split(':')[0]}:${String(m).padStart(2,'0')}`;
  }

  // ── Save handlers ─────────────────────────────────────────────────
  saveLogNow(): void {
    if (this.logNowSaving || !this.logNowTypeId) return;
    const lt    = this.logTypes.find(t => t._id === this.logNowTypeId);
    const title = this.logNowTitle.trim() || (lt?.name ?? 'Log');
    this.logNowSaving = true;
    this.logService.createLog(this.selectedDate, {
      title, logTypeId: this.logNowTypeId, startTime: this.logNowStart, endTime: this.logNowEnd,
      ticketId:      this.logNowDomain === 'work' ? (this.logNowTicketId.trim() || undefined) : undefined,
      priority:      this.logNowPriority ?? undefined,
      collaborators: this.logNowCollaborators.length > 0 ? [...this.logNowCollaborators] : undefined,
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
      ticketId:      this.addPointDomain === 'work' ? (this.addPointTicketId.trim() || undefined) : undefined,
      priority:      this.addPointPriority ?? undefined,
      collaborators: this.addPointCollaborators.length > 0 ? [...this.addPointCollaborators] : undefined,
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
  trackByLogTypeId(_i: number, lt: LogType): string { return lt._id; }
  trackByIndex(i: number): number { return i; }

  // ── Private scroll helpers (time drums only) ──────────────────────
  private _scrollLogNowDrums(): void {
    const item = 25;
    const sh = document.querySelector('.ln-drum-start-h') as HTMLElement | null;
    const sm = document.querySelector('.ln-drum-start-m') as HTMLElement | null;
    const eh = document.querySelector('.ln-drum-end-h')   as HTMLElement | null;
    const em = document.querySelector('.ln-drum-end-m')   as HTMLElement | null;
    if (sh) sh.scrollTop = this.logNowStartHour                           * item;
    if (sm) sm.scrollTop = this._minuteToQtrIndex(this.logNowStartMinute) * item;
    if (eh) eh.scrollTop = this.logNowEndHour                             * item;
    if (em) em.scrollTop = this._minuteToQtrIndex(this.logNowEndMinute)   * item;
  }
  private _scrollAddPointTimeDrums(): void {
    const ah = document.querySelector('.ln-drum-ap-h') as HTMLElement | null;
    const am = document.querySelector('.ln-drum-ap-m') as HTMLElement | null;
    if (ah) ah.scrollTop = this.addPointHour * 25;
    if (am) am.scrollTop = this._addPointMinuteToIdx(this.addPointMinute) * 25;
  }

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
  private _minuteToQtrIndex(m: number): number {
    const snapped = Math.round(m / 15) * 15 % 60;
    const idx = this.logNowMinutes.indexOf(snapped);
    return idx >= 0 ? idx : 0;
  }
  private _addPointMinuteToIdx(m: number): number {
    const snapped = Math.round(m / 15) * 15 % 60;
    const idx = this.addPointMinutes.indexOf(snapped);
    return idx >= 0 ? idx : 0;
  }
  private _smartDefaultStart(): string {
    const last    = this.logs[this.logs.length - 1];
    const nowMins = this._timeToMinutes(this._currentTimeStr());
    if (!last) return this._minsToTimeStr(Math.max(0, nowMins - 30));
    const lastEndMins = this._timeToMinutes(last.endAt ?? last.startAt);
    return this._minsToTimeStr(nowMins - lastEndMins > 30 ? Math.max(0, nowMins - 30) : lastEndMins);
  }

  // ── Public opener helper ──────────────────────────────────────────
  prepForAddPoint(domain: 'work' | 'personal', typeId: string, time: string): void {
    if (this.logTypes.length) {
      this.addPointDomain = domain;
      this.addPointTypeId = typeId;
      this.addPointTime   = time;
      this.addPointTitle  = '';
      this.tab = 2;
      setTimeout(() => this._scrollAddPointTimeDrums(), 40);
    }
  }
}
