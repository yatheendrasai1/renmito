import {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  useNotes, useAddNote, useUpdateNote,
  useUpdateTapperLogType, useDeleteNote,
  type NoteItem,
} from '@/hooks/useNotes';
import { useLogTypes }  from '@/hooks/useLogTypes';
import LogFormModal     from './LogFormModal';
import RenniChat        from '@/components/chat/RenniChat';
import type { LogType } from '@/types';
import './NotesSheet.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DOMAIN_ORDER  = ['work', 'personal', 'family'] as const;
const DOMAIN_LABELS: Record<string, string> = { work: 'Work', personal: 'Personal', family: 'Family' };
const DOMAIN_COLORS: Record<string, string> = { work: '#60a5fa', personal: '#34d399', family: '#f472b6' };

// ── Local note state ──────────────────────────────────────────────────────────

interface LocalNote extends NoteItem {
  localContent:  string;   // live textarea value
  savedContent:  string;   // last-persisted value
  saving:        boolean;
  copied:        boolean;
  pendingDelete: boolean;
}

function toLocal(n: NoteItem): LocalNote {
  return {
    ...n,
    localContent:  n.content,
    savedContent:  n.content,
    saving:        false,
    copied:        false,
    pendingDelete: false,
  };
}

// ── Log type picker ───────────────────────────────────────────────────────────

interface LogTypeGroup {
  domain: string;
  label:  string;
  color:  string;
  types:  LogType[];
}

function buildGroups(types: LogType[]): LogTypeGroup[] {
  return DOMAIN_ORDER
    .map(domain => ({
      domain,
      label:  DOMAIN_LABELS[domain],
      color:  DOMAIN_COLORS[domain],
      types:  types.filter(lt => lt.domain === domain),
    }))
    .filter(g => g.types.length > 0);
}

// ── TypePicker sub-component ──────────────────────────────────────────────────

interface TypePickerProps {
  note:     LocalNote;
  groups:   LogTypeGroup[];
  onSelect: (lt: LogType) => void;
}

function TypePicker({ note, groups, onSelect }: TypePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ns-lt-trigger" title={note.logTypeName ?? 'Associate a log type'}>
          <span className="ns-lt-dot" style={{ background: note.logTypeColor ?? 'var(--border)' }} />
          <span className="ns-lt-label">{note.logTypeName ?? 'Pick category…'}</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="ns-lt-chevron">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="ns-lt-panel" align="start">
        {groups.length === 0 && <div className="ns-lt-empty">Loading…</div>}
        {groups.map((grp, i) => (
          <div key={grp.domain}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="ns-lt-group-header">
              <span className="ns-lt-group-dot" style={{ background: grp.color }} />
              {grp.label}
            </DropdownMenuLabel>
            {grp.types.map(lt => (
              <DropdownMenuItem
                key={lt._id}
                className={`ns-lt-option${note.logTypeId === lt._id ? ' ns-lt-option--active' : ''}`}
                onClick={() => onSelect(lt)}
              >
                <span className="ns-lt-option-dot" style={{ background: lt.color }} />
                <span className="ns-lt-option-name">{lt.name}</span>
                {note.logTypeId === lt._id && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="ml-auto">
                    <path d="M2 6l3 3 5-5" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── NotesSheet ────────────────────────────────────────────────────────────────

interface Props {
  date:    string;
  onClose: () => void;
}

export default function NotesSheet({ date, onClose }: Props) {


  // ── Server data ────────────────────────────────────────────────────────────
  const { data, isLoading } = useNotes(date);
  const { data: allTypes = [] } = useLogTypes();

  const addMutation         = useAddNote(date);
  const updateMutation      = useUpdateNote(date);
  const updateTypeMutation  = useUpdateTapperLogType(date);
  const deleteMutation      = useDeleteNote(date);

  // ── Local note state ───────────────────────────────────────────────────────
  const [notes, setNotes] = useState<LocalNote[]>([]);

  useEffect(() => {
    if (data) setNotes(data.notes.map(toLocal));
  }, [data]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [pendingDeleteId,  setPendingDeleteId]  = useState<string | null>(null);
  const [renniOpen,        setRenniOpen]        = useState(false);
  const [renniInitialMsg,  setRenniInitialMsg]  = useState('');

  // Point logger modal opened from a tapper note
  const [pointLoggerNote, setPointLoggerNote] = useState<LocalNote | null>(null);

  const lastNoteRef  = useRef<HTMLTextAreaElement | null>(null);
  const lastTapRef   = useRef<HTMLInputElement | null>(null);

  // ── Escape closes sheet ───────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const logTypeGroups = buildGroups(allTypes);

  function patchNote(id: string, patch: Partial<LocalNote>) {
    setNotes(prev => prev.map(n => n._id === id ? { ...n, ...patch } : n));
  }

  // ── Auto-save on blur ──────────────────────────────────────────────────────
  const handleBlur = useCallback((note: LocalNote) => {
    if (note.localContent === note.savedContent) return;
    patchNote(note._id, { saving: true });
    updateMutation.mutate(
      { noteId: note._id, content: note.localContent },
      {
        onSuccess: (updated) => patchNote(note._id, { savedContent: updated.content, saving: false }),
        onError:   ()        => patchNote(note._id, { saving: false }),
      },
    );
  }, [updateMutation]);

  // ── Copy ───────────────────────────────────────────────────────────────────
  function handleCopy(note: LocalNote) {
    if (!note.localContent) return;
    navigator.clipboard.writeText(note.localContent).then(() => {
      patchNote(note._id, { copied: true });
      setTimeout(() => patchNote(note._id, { copied: false }), 1500);
    });
  }

  // ── Log to Renni ──────────────────────────────────────────────────────────
  function handleLogToRenni(note: LocalNote) {
    if (!note.localContent) return;
    if (note.localContent !== note.savedContent) {
      updateMutation.mutate({ noteId: note._id, content: note.localContent });
    }
    setRenniInitialMsg(note.localContent);
    setRenniOpen(true);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    patchNote(id, { pendingDelete: true });
    deleteMutation.mutate(id, {
      onSuccess: () => setNotes(prev => prev.filter(n => n._id !== id)),
      onError:   () => { patchNote(id, { pendingDelete: false }); toast('Failed to delete note'); },
    });
  }

  // ── Add note ───────────────────────────────────────────────────────────────
  function handleAddNote() {
    addMutation.mutate(
      { type: 'regular', content: '' },
      {
        onSuccess: (n) => {
          setNotes(prev => [...prev, toLocal(n)]);
          setTimeout(() => lastNoteRef.current?.focus(), 50);
        },
        onError: () => toast('Failed to add note'),
      },
    );
  }

  // ── Add tapper ─────────────────────────────────────────────────────────────
  function handleAddTapper() {
    addMutation.mutate(
      { type: 'tapper', content: '' },
      {
        onSuccess: (n) => {
          setNotes(prev => [...prev, toLocal(n)]);
          setTimeout(() => lastTapRef.current?.focus(), 50);
        },
        onError: () => toast('Failed to add time tap'),
      },
    );
  }

  // ── Log type for tapper ────────────────────────────────────────────────────
  function handleSelectLogType(note: LocalNote, lt: LogType) {
    patchNote(note._id, {
      logTypeId:    lt._id,
      logTypeName:  lt.name,
      domain:       lt.domain,
      logTypeColor: lt.color,
    });
    updateTypeMutation.mutate({
      noteId:       note._id,
      logTypeId:    lt._id,
      logTypeName:  lt.name,
      domain:       lt.domain,
      logTypeColor: lt.color,
    });
  }

  // ── Open point logger from tapper ──────────────────────────────────────────
  function handleOpenPointLogger(note: LocalNote) {
    setPointLoggerNote(note);
  }

  // ── Date label ─────────────────────────────────────────────────────────────
  const dateLabel = (() => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Sheet open={true} onOpenChange={v => { if (!v) onClose(); }}>
        <SheetContent
          side="bottom"
          className="ns-sheet md:!w-[720px] md:!left-[calc(50%-360px)] md:!right-auto"
          showCloseButton={false}
        >
        {/* Header */}
        <div className="ns-header">
          <div className="ns-title-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span className="ns-title">Notes — {dateLabel}</span>
          </div>
          <button className="ns-close-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="ns-body">
          {isLoading ? (
            <div className="ns-loading">Loading…</div>
          ) : (
            <div className="ns-list">
              {notes.length === 0 && (
                <div className="ns-empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span>No notes yet. Tap "Note" or "Time Tap" to add one.</span>
                </div>
              )}

              {notes.map((note, idx) => {
                const isLastNote   = note.type !== 'tapper' && idx === notes.filter(n => n.type !== 'tapper').length - 1;
                const isLastTapper = note.type === 'tapper' && idx === notes.filter(n => n.type === 'tapper').length - 1;

                if (note.type !== 'tapper') {
                  /* ── Regular note ─────────────────────────────────────── */
                  return (
                    <div key={note._id} className="ns-note-wrap">
                      <div className="ns-note-actions">
                        <button
                          className="ns-delete-btn"
                          onClick={() => setPendingDeleteId(note._id)}
                          disabled={note.pendingDelete}
                          title="Delete note"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                        <button
                          className="ns-log-btn"
                          onClick={() => handleLogToRenni(note)}
                          title="Send to Renni chat"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                        <button
                          className={`ns-copy-btn${note.copied ? ' ns-copy-btn--copied' : ''}`}
                          onClick={() => handleCopy(note)}
                          title={note.copied ? 'Copied!' : 'Copy'}
                        >
                          {note.copied ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          )}
                        </button>
                      </div>

                      <textarea
                        ref={isLastNote ? (el => { lastNoteRef.current = el; }) : undefined}
                        className="ns-note-ta"
                        rows={5}
                        value={note.localContent}
                        onChange={e => patchNote(note._id, { localContent: e.target.value })}
                        onBlur={() => handleBlur(note)}
                        placeholder="Note…"
                        maxLength={1000}
                      />

                      <div className="ns-note-footer">
                        {note.saving && <span className="ns-saving-badge">saving…</span>}
                        <span className={`ns-char-count${note.localContent.length >= 450 ? ' ns-char-count--near' : ''}`}>
                          {note.localContent.length}/1000
                        </span>
                      </div>
                    </div>
                  );
                }

                /* ── Tapper note ──────────────────────────────────────── */
                return (
                  <div key={note._id} className="ns-tapper-wrap">
                    <div className="ns-tapper-header">
                      <span className="ns-tapper-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {note.timestamp ? formatTimestamp(note.timestamp) : '—'}
                      </span>

                      <div className="ns-tapper-actions">
                        <button
                          className="ns-tapper-log-btn"
                          onClick={() => handleOpenPointLogger(note)}
                          title="Log at this time"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </button>
                        <button
                          className="ns-tapper-delete-btn"
                          onClick={() => setPendingDeleteId(note._id)}
                          disabled={note.pendingDelete}
                          title="Delete tap"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <TypePicker
                      note={note}
                      groups={logTypeGroups}
                      onSelect={lt => handleSelectLogType(note, lt)}
                    />

                    <input
                      ref={isLastTapper ? (el => { lastTapRef.current = el; }) : undefined}
                      className="ns-tapper-input"
                      type="text"
                      value={note.localContent}
                      onChange={e => patchNote(note._id, { localContent: e.target.value })}
                      onBlur={() => handleBlur(note)}
                      placeholder="Add a note… (optional)"
                      maxLength={30}
                    />

                    {note.saving && <span className="ns-saving-badge ns-saving-badge--tapper">saving…</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ns-footer">
          <button
            className="ns-add-btn ns-add-btn--note"
            onClick={handleAddNote}
            disabled={addMutation.isPending}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Note
          </button>
          <button
            className="ns-add-btn ns-add-btn--tapper"
            onClick={handleAddTapper}
            disabled={addMutation.isPending}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Time Tap
          </button>
        </div>

        {/* Delete confirm — inside SheetContent so it shares the Radix portal
            stacking context and can receive pointer events above the sheet */}
        {pendingDeleteId && (
          <div className="ns-delete-confirm-overlay" onClick={() => setPendingDeleteId(null)}>
            <div className="ns-delete-confirm-panel" onClick={e => e.stopPropagation()}>
              <p>Delete this note?</p>
              <div className="ns-delete-confirm-actions">
                <button className="ns-delete-confirm-cancel" onClick={() => setPendingDeleteId(null)}>
                  Cancel
                </button>
                <button className="ns-delete-confirm-ok" onClick={handleDeleteConfirm}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        </SheetContent>
      </Sheet>

      {/* Renni chat pre-filled with note content */}
      {renniOpen && (
        <RenniChat
          initialMessage={renniInitialMsg}
          onClose={() => setRenniOpen(false)}
        />
      )}

      {/* Point logger modal from tapper */}
      {pointLoggerNote && (
        <LogFormModal
          mode="create"
          date={date}
          startTime={pointLoggerNote.timestamp ? isoToHHMM(pointLoggerNote.timestamp) : undefined}
          endTime={pointLoggerNote.timestamp ? isoToHHMM(pointLoggerNote.timestamp) : undefined}
          onClose={() => setPointLoggerNote(null)}
          onSaved={() => { setPointLoggerNote(null); toast('Log created'); }}
        />
      )}
    </>
  );
}
