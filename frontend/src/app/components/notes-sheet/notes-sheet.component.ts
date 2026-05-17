import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, OnDestroy, SimpleChanges, ViewChildren, QueryList, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { retry, takeUntil } from 'rxjs/operators';
import { NotesService, NoteItem } from '../../services/notes.service';
import { AppStateService } from '../../services/app-state.service';
import { LogType } from '../../models/log-type.model';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

interface LocalNote {
  _id: string;
  content: string;
  savedContent: string;
  saving: boolean;
  isNew: boolean;
  copied: boolean;
  deleting: boolean;
  type: 'regular' | 'tapper';
  timestamp?: string;
  logTypeId?:    string | null;
  logTypeName?:  string | null;
  domain?:       string | null;
  logTypeColor?: string | null;
}

const DOMAIN_ORDER  = ['work', 'personal', 'family'] as const;
const DOMAIN_LABELS: Record<string, string> = { work: 'Work', personal: 'Personal', family: 'Family' };

@Component({
  selector: 'app-notes-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ns-backdrop" (click)="close.emit()"></div>
    <div class="ns-sheet" (click)="$event.stopPropagation()">

      <!-- Header -->
      <div class="ns-header">
        <div class="ns-title-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="ns-title">Notes — {{ dateLabel }}</span>
        </div>
        <button class="ns-close-btn" (click)="close.emit()" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="ns-body">

        <div class="ns-loading" *ngIf="loading">Loading…</div>

        <div class="ns-list" *ngIf="!loading">

          <!-- Regular note -->
          <ng-container *ngFor="let note of notes; trackBy: trackById">
            <div *ngIf="note.type !== 'tapper'"
                 class="ns-note-wrap"
                 [class.ns-note-wrap--new]="note.isNew">
              <div class="ns-note-actions">
                <button class="ns-delete-btn" (click)="pendingDeleteNote = note" [disabled]="note.deleting" title="Delete note">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
                <button class="ns-log-btn" (click)="logToRenni(note)" title="Send to Renni chat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
                <button class="ns-copy-btn" (click)="copyNote(note)" [title]="note.copied ? 'Copied!' : 'Copy'">
                  <svg *ngIf="!note.copied" width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <svg *ngIf="note.copied" width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </div>
              <textarea
                #noteTA
                class="ns-note-ta"
                rows="6"
                [(ngModel)]="note.content"
                placeholder="Note…"
                maxlength="1000"
                (blur)="onBlur(note)"
              ></textarea>
              <div class="ns-note-footer">
                <span class="ns-saving-badge" *ngIf="note.saving">saving…</span>
                <span class="ns-char-count" [class.ns-char-count--near]="note.content.length >= 900">
                  {{ note.content.length }}/1000
                </span>
              </div>
            </div>

            <!-- Tapper note -->
            <div *ngIf="note.type === 'tapper'"
                 class="ns-tapper-wrap"
                 [class.ns-note-wrap--new]="note.isNew">
              <div class="ns-tapper-header">
                <span class="ns-tapper-badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {{ note.timestamp | date:'h:mm a' }}
                </span>
                <div class="ns-tapper-actions">
                  <button class="ns-tapper-log-btn" (click)="openPointLogger(note)" title="Log at this time">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </button>
                  <button class="ns-tapper-delete-btn" (click)="pendingDeleteNote = note"
                          [disabled]="note.deleting" title="Delete tap">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Log type picker -->
              <div class="ns-lt-picker" [class.ns-lt-picker--open]="openTypePickerNoteId === note._id">
                <button class="ns-lt-trigger"
                        (click)="toggleTypePicker(note, $event)"
                        [title]="note.logTypeName || 'Associate a log type'">
                  <span class="ns-lt-dot"
                        [style.background]="note.logTypeColor || 'var(--border)'"></span>
                  <span class="ns-lt-label">{{ note.logTypeName || 'Pick category…' }}</span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" class="ns-lt-chevron">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>

                <div class="ns-lt-panel" *ngIf="openTypePickerNoteId === note._id"
                     (click)="$event.stopPropagation()">
                  <ng-container *ngFor="let grp of logTypeGroups">
                    <div class="ns-lt-group-header">
                      <span class="ns-lt-group-dot" [style.background]="grp.color"></span>
                      {{ grp.label }}
                    </div>
                    <button *ngFor="let lt of grp.types"
                            class="ns-lt-option"
                            [class.ns-lt-option--active]="note.logTypeId === lt._id"
                            (click)="selectLogType(note, lt)">
                      <span class="ns-lt-option-dot" [style.background]="lt.color"></span>
                      <span class="ns-lt-option-name">{{ lt.name }}</span>
                      <svg *ngIf="note.logTypeId === lt._id" width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor"
                              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </ng-container>
                  <div *ngIf="logTypeGroups.length === 0" class="ns-lt-empty">Loading…</div>
                </div>
              </div>

              <input
                #tapperInput
                class="ns-tapper-input"
                type="text"
                [(ngModel)]="note.content"
                placeholder="Add a note… (optional)"
                maxlength="30"
                (blur)="onBlur(note)"
              />
              <div class="ns-note-footer">
                <span class="ns-saving-badge" *ngIf="note.saving">saving…</span>
                <span class="ns-char-count" [class.ns-char-count--near]="note.content.length >= 25">
                  {{ note.content.length }}/30
                </span>
              </div>
            </div>
          </ng-container>

          <!-- Action buttons row -->
          <div class="ns-actions-row">
            <button class="ns-add-btn" (click)="addNote()" [disabled]="adding">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="8" y1="2" x2="8" y2="14"/>
                <line x1="2" y1="8" x2="14" y2="8"/>
              </svg>
              Note
            </button>

            <button class="ns-tap-btn" (click)="addTapper()" [disabled]="addingTapper">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Time Tap
            </button>
          </div>

        </div>

      </div>
    </div>

    <app-confirm-dialog
      [visible]="!!pendingDeleteNote"
      title="Delete note?"
      message="This note will be permanently deleted."
      okLabel="Delete"
      (confirmed)="confirmDelete()"
      (cancelled)="pendingDeleteNote = null"
    ></app-confirm-dialog>
  `,
  styles: [`
    :host {
      position: fixed; inset: 0;
      z-index: 950;
      display: flex; flex-direction: column;
      justify-content: flex-end;
    }

    .ns-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(2px);
      z-index: 0;
    }

    .ns-sheet {
      position: relative; z-index: 1;
      background: var(--bg-surface);
      border-radius: 14px 14px 0 0;
      box-shadow: 0 -4px 32px rgba(0,0,0,0.22);
      height: 78vh;
      display: flex; flex-direction: column;
      animation: ns-slide-up 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes ns-slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    .ns-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 18px 12px;
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    }

    .ns-title-row {
      display: flex; align-items: center; gap: 8px;
      color: var(--text-secondary);
    }

    .ns-title {
      font-size: 13px; font-weight: 600;
      color: var(--text-primary);
    }

    .ns-close-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .ns-close-btn:hover { background: var(--accent-hover); color: var(--text-primary); }

    .ns-body {
      flex: 1; overflow-y: auto;
      padding: 14px 18px 24px;
    }

    .ns-loading {
      display: flex; align-items: center; justify-content: center;
      height: 100%;
      color: var(--text-muted); font-size: 13px;
    }

    .ns-list {
      display: flex; flex-direction: column;
      gap: 12px;
    }

    /* ── Regular note ── */

    .ns-note-wrap {
      position: relative;
    }

    /* Icon bar always visible above the textarea */
    .ns-note-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 2px 6px;
      min-height: 34px;
    }

    .ns-delete-btn,
    .ns-log-btn,
    .ns-copy-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .ns-delete-btn:hover:not(:disabled) { color: #e05252; border-color: #e05252; }
    .ns-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ns-log-btn:hover { color: #9D8FDE; border-color: #7C6FCD; }
    .ns-copy-btn:hover { color: var(--text-primary); border-color: var(--highlight-selected); }

    @keyframes ns-note-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ns-note-wrap--new {
      animation: ns-note-in 0.18s ease;
    }

    .ns-note-ta {
      display: block;
      width: 100%;
      rows: 6;
      resize: none;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      padding: 12px 14px;
      color: var(--text-primary);
      font-size: 13.5px; line-height: 1.6;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
      box-sizing: border-box;
    }
    .ns-note-ta:focus { border-color: var(--highlight-selected); }
    .ns-note-ta::placeholder { color: var(--text-muted); }

    .ns-note-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 3px 2px 0;
      min-height: 16px;
    }

    .ns-saving-badge {
      font-size: 10px; color: var(--text-muted);
      pointer-events: none;
    }

    .ns-char-count {
      font-size: 10px; color: var(--text-muted);
      pointer-events: none; margin-left: auto;
    }
    .ns-char-count--near { color: var(--warn, #e07b39); }

    /* ── Tapper note ── */

    .ns-tapper-wrap {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-left: 3px solid #7C6FCD;
      border-radius: var(--radius);
      padding: 10px 12px 8px;
    }

    .ns-tapper-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }

    .ns-tapper-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; font-weight: 600;
      color: #9D8FDE;
      letter-spacing: 0.02em;
    }

    .ns-tapper-actions {
      display: flex; align-items: center; gap: 4px;
    }

    .ns-tapper-log-btn {
      display: flex; align-items: center; justify-content: center;
      width: 22px; height: 22px;
      background: none;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: #9D8FDE;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s, border-color 0.15s, background 0.15s;
    }
    .ns-tapper-wrap:hover .ns-tapper-log-btn { opacity: 1; }
    .ns-tapper-log-btn:hover { color: #B8ADFF; border-color: #7C6FCD; background: rgba(124,111,205,0.12); }

    .ns-tapper-delete-btn {
      display: flex; align-items: center; justify-content: center;
      width: 22px; height: 22px;
      background: none;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s, border-color 0.15s;
    }
    .ns-tapper-wrap:hover .ns-tapper-delete-btn { opacity: 1; }
    .ns-tapper-delete-btn:hover:not(:disabled) { color: #e05252; border-color: #e05252; }
    .ns-tapper-delete-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    /* ── Log type picker ── */

    .ns-lt-picker {
      position: relative;
      margin-bottom: 8px;
    }

    .ns-lt-trigger {
      display: flex; align-items: center; gap: 6px;
      width: 100%;
      padding: 5px 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12px; font-family: inherit;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s;
    }
    .ns-lt-trigger:hover, .ns-lt-picker--open .ns-lt-trigger { border-color: #7C6FCD; }

    .ns-lt-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .ns-lt-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .ns-lt-chevron {
      flex-shrink: 0; color: var(--text-muted);
      transition: transform 0.15s;
    }
    .ns-lt-picker--open .ns-lt-chevron { transform: rotate(180deg); }

    .ns-lt-panel {
      position: absolute;
      top: calc(100% + 3px);
      left: 0; right: 0;
      z-index: 600;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 24px rgba(0,0,0,0.28);
      max-height: 220px;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 4px 0;
    }

    .ns-lt-group-header {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 10px 3px;
      font-size: 9.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--text-muted);
    }
    .ns-lt-group-dot { width: 6px; height: 6px; border-radius: 50%; opacity: 0.7; }

    .ns-lt-option {
      width: 100%;
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px 7px 18px;
      background: none; border: none;
      color: var(--text-primary);
      font-size: 12.5px; font-family: inherit;
      text-align: left; cursor: pointer;
      transition: background 0.1s;
    }
    .ns-lt-option:hover { background: var(--nav-item-hover); }
    .ns-lt-option--active { background: color-mix(in srgb, #7C6FCD 10%, var(--bg-card)); }
    .ns-lt-option-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .ns-lt-option-name { flex: 1; }
    .ns-lt-empty { padding: 10px 14px; font-size: 12px; color: var(--text-muted); }

    .ns-tapper-input {
      width: 100%;
      background: none;
      border: none;
      border-bottom: 1px solid var(--border-light);
      border-radius: 0;
      padding: 4px 0 6px;
      color: var(--text-primary);
      font-size: 13px;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .ns-tapper-input:focus { border-bottom-color: #7C6FCD; }
    .ns-tapper-input::placeholder { color: var(--text-muted); font-style: italic; }

    /* ── Action buttons row ── */

    .ns-actions-row {
      display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap;
    }

    .ns-add-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px;
      background: none;
      border: 1px dashed var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .ns-add-btn:hover:not(:disabled) { border-color: var(--highlight-selected); color: var(--text-primary); }
    .ns-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    .ns-tap-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px;
      background: none;
      border: 1px dashed #4A4080;
      border-radius: var(--radius-sm);
      color: #9D8FDE;
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .ns-tap-btn:hover:not(:disabled) { border-color: #7C6FCD; color: #B8ADFF; background: rgba(124,111,205,0.08); }
    .ns-tap-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  `]
})
export class NotesSheetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() date!: Date;
  @Input() focusNoteId: string | undefined = undefined;
  @Output() close = new EventEmitter<void>();

  @ViewChildren('noteTA') noteTAs!: QueryList<ElementRef<HTMLTextAreaElement>>;
  @ViewChildren('tapperInput') tapperInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private readonly destroy$ = new Subject<void>();
  notes:             LocalNote[] = [];
  loading            = false;
  adding             = false;
  addingTapper       = false;
  pendingDeleteNote: LocalNote | null = null;

  logTypes:           LogType[] = [];
  openTypePickerNoteId: string | null = null;

  get logTypeGroups(): Array<{ domain: string; label: string; color: string; types: LogType[] }> {
    const buckets: Record<string, LogType[]> = {};
    for (const lt of this.logTypes) {
      const d = lt.domain ?? 'personal';
      (buckets[d] ??= []).push(lt);
    }
    return DOMAIN_ORDER
      .filter(d => buckets[d]?.length)
      .map(d => ({ domain: d, label: DOMAIN_LABELS[d] ?? d, color: buckets[d][0]?.color ?? '#9B9B9B', types: buckets[d] }));
  }

  get dateLabel(): string {
    if (!this.date) return '';
    return this.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private get dateStr(): string {
    const d = this.date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  constructor(
    private notesService: NotesService,
    private appState: AppStateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.loadNotes();
    if (!this.appState.inlineLogTypes$.value.length) this.appState.loadLogTypes();
    this.appState.inlineLogTypes$.pipe(takeUntil(this.destroy$)).subscribe(types => {
      this.logTypes = types;
      this.cdr.markForCheck();
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openTypePickerNoteId !== null) {
      this.openTypePickerNoteId = null;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.openTypePickerNoteId !== null) {
      this.openTypePickerNoteId = null;
      this.cdr.markForCheck();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['date'] && !changes['date'].firstChange) this.loadNotes();
  }

  private loadNotes(): void {
    this.loading = true;
    this.notesService.invalidateCache(this.dateStr);
    this.notesService.getNotes(this.dateStr).pipe(
      retry(2),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (d) => {
        this.notes = d.notes.map(n => ({
          _id: n._id, content: n.content, savedContent: n.content,
          saving: false, isNew: false, copied: false, deleting: false,
          type: n.type ?? 'regular',
          timestamp: n.timestamp,
          logTypeId:    n.logTypeId    ?? null,
          logTypeName:  n.logTypeName  ?? null,
          domain:       n.domain       ?? null,
          logTypeColor: n.logTypeColor ?? null,
        }));
        this.loading = false;
        this.cdr.markForCheck();
        if (this.focusNoteId) {
          setTimeout(() => this.focusNote(this.focusNoteId!), 80);
        }
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  toggleTypePicker(note: LocalNote, e: Event): void {
    e.stopPropagation();
    this.openTypePickerNoteId = this.openTypePickerNoteId === note._id ? null : note._id;
    this.cdr.markForCheck();
  }

  selectLogType(note: LocalNote, lt: LogType): void {
    note.logTypeId    = lt._id;
    note.logTypeName  = lt.name;
    note.domain       = lt.domain;
    note.logTypeColor = lt.color;
    this.openTypePickerNoteId = null;
    this.cdr.markForCheck();
    this.notesService.updateTapperLogType(this.dateStr, note._id, {
      logTypeId: lt._id, logTypeName: lt.name, domain: lt.domain, logTypeColor: lt.color,
    }).pipe(takeUntil(this.destroy$)).subscribe();
  }

  onBlur(note: LocalNote): void {
    if (note.content === note.savedContent) return;
    note.saving = true;
    this.notesService.updateNote(this.dateStr, note._id, note.content).pipe(takeUntil(this.destroy$)).subscribe({
      next: (n) => { note.savedContent = n.content; note.saving = false; this.cdr.markForCheck(); },
      error: ()  => { note.saving = false; this.cdr.markForCheck(); }
    });
  }

  confirmDelete(): void {
    const note = this.pendingDeleteNote;
    this.pendingDeleteNote = null;
    if (!note) return;
    note.deleting = true;
    this.notesService.deleteNote(this.dateStr, note._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.notes = this.notes.filter(n => n._id !== note._id); this.cdr.markForCheck(); },
      error: () => { note.deleting = false; this.cdr.markForCheck(); }
    });
  }

  copyNote(note: LocalNote): void {
    if (!note.content) return;
    navigator.clipboard.writeText(note.content).then(() => {
      note.copied = true;
      this.cdr.markForCheck();
      setTimeout(() => { note.copied = false; this.cdr.markForCheck(); }, 1500);
    });
  }

  logToRenni(note: LocalNote): void {
    if (!note.content) return;
    const contentSnapshot = note.content;
    this.onBlur(note); // persist any unsaved edits before closing
    this.close.emit();
    this.appState.openRenniWithTextRequested$.next(contentSnapshot);
  }

  addNote(): void {
    if (this.adding) return;
    this.adding = true;
    this.notesService.addNote(this.dateStr).pipe(takeUntil(this.destroy$)).subscribe({
      next: (n) => {
        this.notes.push({
          _id: n._id, content: '', savedContent: '',
          saving: false, isNew: true, copied: false, deleting: false,
          type: 'regular',
        });
        this.adding = false;
        this.cdr.markForCheck();
        setTimeout(() => {
          const tas = this.noteTAs.toArray();
          tas[tas.length - 1]?.nativeElement.focus();
        }, 50);
      },
      error: () => { this.adding = false; this.cdr.markForCheck(); }
    });
  }

  addTapper(): void {
    if (this.addingTapper) return;
    this.addingTapper = true;
    const now = new Date();
    this.notesService.addNote(this.dateStr, 'tapper', '').pipe(takeUntil(this.destroy$)).subscribe({
      next: (n) => {
        this.notes.push({
          _id: n._id, content: '', savedContent: '',
          saving: false, isNew: true, copied: false, deleting: false,
          type: 'tapper',
          timestamp: n.timestamp ?? now.toISOString(),
          logTypeId: null, logTypeName: null, domain: null, logTypeColor: null,
        });
        this.addingTapper = false;
        this.cdr.markForCheck();
        setTimeout(() => {
          const inputs = this.tapperInputs.toArray();
          inputs[inputs.length - 1]?.nativeElement.focus();
        }, 50);
      },
      error: () => { this.addingTapper = false; this.cdr.markForCheck(); }
    });
  }

  openPointLogger(note: LocalNote): void {
    const ts = note.timestamp ? new Date(note.timestamp) : new Date();
    const hh = String(ts.getHours()).padStart(2, '0');
    const mm = String(ts.getMinutes()).padStart(2, '0');
    const prepTime = `${hh}:${mm}`;
    // Map domain: 'family' collapses to 'personal' (unified sheet only has work/personal tabs)
    const prepDomain = note.domain === 'work' ? 'work' : note.domain ? 'personal' : undefined;
    this.close.emit();
    this.appState.openUnifiedSheetRequested$.next({
      tab:        2,
      prepTime,
      prepDomain:  prepDomain as 'work' | 'personal' | undefined,
      prepTypeId:  note.logTypeId  ?? undefined,
      prepTitle:   note.content    || undefined,
    });
  }

  focusNote(noteId: string): void {
    const regularNotes = this.notes.filter(n => n.type !== 'tapper');
    const idx = regularNotes.findIndex(n => n._id === noteId);
    if (idx === -1) return;
    const tas = this.noteTAs.toArray();
    const el = tas[idx]?.nativeElement;
    if (!el) return;
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  trackById(_i: number, note: LocalNote): string { return note._id; }
}
