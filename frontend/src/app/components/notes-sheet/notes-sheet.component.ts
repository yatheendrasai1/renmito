import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, OnDestroy, SimpleChanges, ViewChildren, QueryList, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NotesService, NoteItem } from '../../services/notes.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

interface LocalNote {
  _id: string;
  content: string;
  savedContent: string;
  saving: boolean;
  isNew: boolean;
  copied: boolean;
  deleting: boolean;
}

@Component({
  selector: 'app-notes-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
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

        <!-- Loading -->
        <div class="ns-loading" *ngIf="loading">Loading…</div>

        <!-- Notes list -->
        <div class="ns-list" *ngIf="!loading">

          <div class="ns-note-wrap"
               *ngFor="let note of notes; let i = index; trackBy: trackById"
               [class.ns-note-wrap--new]="note.isNew">
            <button class="ns-delete-btn" (click)="pendingDeleteNote = note" [disabled]="note.deleting" title="Delete note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
            <button class="ns-copy-btn" (click)="copyNote(note)" [title]="note.copied ? 'Copied!' : 'Copy'">
              <svg *ngIf="!note.copied" width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <svg *ngIf="note.copied" width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <textarea
              #noteTA
              class="ns-note-ta"
              rows="6"
              [(ngModel)]="note.content"
              placeholder="Note…"
              maxlength="500"
              (blur)="onBlur(note)"
            ></textarea>
            <div class="ns-note-footer">
              <span class="ns-saving-badge" *ngIf="note.saving">saving…</span>
              <span class="ns-char-count" [class.ns-char-count--near]="note.content.length >= 450">
                {{ note.content.length }}/500
              </span>
            </div>
          </div>

          <!-- Add note button -->
          <button class="ns-add-btn" (click)="addNote()" [disabled]="adding">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <line x1="8" y1="2" x2="8" y2="14"/>
              <line x1="2" y1="8" x2="14" y2="8"/>
            </svg>
            Note
          </button>

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

    .ns-note-wrap {
      position: relative;
    }

    .ns-delete-btn {
      position: absolute; top: 8px; right: 38px;
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s, border-color 0.15s;
      z-index: 1;
    }
    .ns-note-wrap:hover .ns-delete-btn { opacity: 1; }
    .ns-delete-btn:hover:not(:disabled) { color: #e05252; border-color: #e05252; }
    .ns-delete-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .ns-copy-btn {
      position: absolute; top: 8px; right: 8px;
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px;
      background: var(--bg-surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s, border-color 0.15s;
      z-index: 1;
    }
    .ns-note-wrap:hover .ns-copy-btn { opacity: 1; }
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
      align-self: flex-start;
    }
    .ns-add-btn:hover:not(:disabled) { border-color: var(--highlight-selected); color: var(--text-primary); }
    .ns-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  `]
})
export class NotesSheetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() date!: Date;
  @Output() close = new EventEmitter<void>();

  @ViewChildren('noteTA') noteTAs!: QueryList<ElementRef<HTMLTextAreaElement>>;

  private readonly destroy$ = new Subject<void>();
  notes:             LocalNote[] = [];
  loading            = false;
  adding             = false;
  pendingDeleteNote: LocalNote | null = null;

  get dateLabel(): string {
    if (!this.date) return '';
    return this.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private get dateStr(): string {
    const d = this.date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  constructor(private notesService: NotesService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void { this.loadNotes(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['date'] && !changes['date'].firstChange) this.loadNotes();
  }

  private loadNotes(): void {
    this.loading = true;
    this.notesService.getNotes(this.dateStr).pipe(takeUntil(this.destroy$)).subscribe({
      next: (d) => {
        this.notes = d.notes.map(n => ({
          _id: n._id, content: n.content, savedContent: n.content,
          saving: false, isNew: false, copied: false, deleting: false
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onBlur(note: LocalNote): void {
    if (note.content === note.savedContent) return;
    note.saving = true;
    this.notesService.updateNote(this.dateStr, note._id, note.content).pipe(takeUntil(this.destroy$)).subscribe({
      next: (n) => { note.savedContent = n.content; note.saving = false; },
      error: ()  => { note.saving = false; }
    });
  }

  confirmDelete(): void {
    const note = this.pendingDeleteNote;
    this.pendingDeleteNote = null;
    if (!note) return;
    note.deleting = true;
    this.notesService.deleteNote(this.dateStr, note._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.notes = this.notes.filter(n => n._id !== note._id); },
      error: () => { note.deleting = false; }
    });
  }

  copyNote(note: LocalNote): void {
    if (!note.content) return;
    navigator.clipboard.writeText(note.content).then(() => {
      note.copied = true;
      setTimeout(() => { note.copied = false; }, 1500);
    });
  }

  addNote(): void {
    if (this.adding) return;
    this.adding = true;
    this.notesService.addNote(this.dateStr).pipe(takeUntil(this.destroy$)).subscribe({
      next: (n) => {
        this.notes.push({ _id: n._id, content: '', savedContent: '', saving: false, isNew: true, copied: false, deleting: false });
        this.adding = false;
        // Focus the new textarea after Angular renders it
        setTimeout(() => {
          const tas = this.noteTAs.toArray();
          tas[tas.length - 1]?.nativeElement.focus();
        }, 50);
      },
      error: () => { this.adding = false; }
    });
  }

  trackById(_i: number, note: LocalNote): string { return note._id; }
}
