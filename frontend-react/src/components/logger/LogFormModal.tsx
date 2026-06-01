import { useState, useEffect, useRef, useCallback } from 'react';
import { useCreateLog, useUpdateLog, useDeleteLog } from '@/hooks/useLogs';
import {
  useLogTypes,
  useCreateLogType,
  useRenameLogType,
  useDeleteLogType,
} from '@/hooks/useLogTypes';
import { useAppStore } from '@/store/appStore';
import type { LogEntry, LogType } from '@/types';
import { jiraApi, type JiraTicket, type TicketQuery } from '@/lib/jiraApi';
import './LogFormModal.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const PALETTE_COLORS = [
  '#F2A65A', '#D97D55', '#C4844A', '#9E3B3B', '#703B3B',
  '#6F8F72', '#4D7A60', '#5A9CB5', '#3E6480', '#213C51',
  '#7898A8', '#574964', '#7A5A74', '#BFC6C4', '#8C8C8C',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  if (!hhmm?.includes(':')) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function addDaysToISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDuration(start: string, end: string, nextDay: boolean): string {
  const diff = toMins(end) - toMins(start) + (nextDay ? 1440 : 0);
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60), m = diff % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

function priorityColor(p: string): string {
  return p === 'High' ? '#e94560' : p === 'Medium' ? '#f5a623' : '#4caf7d';
}

function extractPlaceholders(jql: string): string[] {
  const matches = jql.match(/\{\{([^}]+)\}\}/g) ?? [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

function formatDueIn(dueDate: string | null): string {
  if (!dueDate) return 'No Due Date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Due today';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `Due in ${diff}d`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  mode:       'create' | 'edit';
  date:       string;
  editEntry?: LogEntry;
  startTime?: string;
  endTime?:   string;
  onClose:    () => void;
  onSaved?:   () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LogFormModal({
  mode, date, editEntry, startTime = '09:00', endTime = '10:00',
  onClose, onSaved,
}: Props) {
  const showToast  = useAppStore(s => s.showToast);
  const isEdit     = mode === 'edit';

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createLog    = useCreateLog(date);
  const updateLog    = useUpdateLog(isEdit ? (editEntry?.date ?? date) : date);
  const deleteLog    = useDeleteLog(isEdit ? (editEntry?.date ?? date) : date);
  const createType   = useCreateLogType();
  const renameType   = useRenameLogType();
  const deleteType   = useDeleteLogType();

  // ── Log types ──────────────────────────────────────────────────────────────
  const { data: rawTypes = [], isLoading: typesLoading, isError: typesError, refetch: refetchTypes } = useLogTypes();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [entryType,    setEntryType]    = useState<'range' | 'point'>(
    isEdit ? (editEntry?.entryType ?? 'range') : 'point',
  );
  const [formStart,    setFormStart]    = useState(
    isEdit ? (editEntry?.startAt ?? startTime) : startTime,
  );
  const [formEnd,      setFormEnd]      = useState(
    isEdit ? (editEntry?.endAt ?? endTime) : endTime,
  );
  const [formDate,     setFormDate]     = useState(
    isEdit ? (editEntry?.date ?? date) : date,
  );
  const [formEndDate,  setFormEndDate]  = useState(
    isEdit ? (editEntry?.endDate ?? editEntry?.date ?? date) : date,
  );
  const [selectedType, setSelectedType] = useState<LogType | null>(
    isEdit ? (editEntry?.logType ?? null) : null,
  );
  const [selectedDomain, setSelectedDomain] = useState<'work' | 'personal'>(
    isEdit ? ((editEntry?.logType?.domain ?? 'work') as 'work' | 'personal') : 'work',
  );
  const [title,        setTitle]        = useState(isEdit ? (editEntry?.title ?? '') : '');
  const [priority,     setPriority]     = useState<'High' | 'Medium' | 'Low' | null>(
    isEdit ? (editEntry?.priority ?? null) : null,
  );
  const [ticketId,     setTicketId]     = useState(isEdit ? (editEntry?.ticketId ?? '') : '');
  const [crucialPerson, setCrucialPerson] = useState<'Yes' | 'No' | 'Shared' | null>(
    isEdit ? (editEntry?.crucialPerson ?? null) : null,
  );
  const [collaborators,    setCollaborators]    = useState<string[]>(
    isEdit ? [...(editEntry?.collaborators ?? [])] : [],
  );
  const [collaboratorInput, setCollaboratorInput] = useState('');
  const [score,        setScore]        = useState<number | null>(
    isEdit ? (editEntry?.satisfactoryScore ?? null) : null,
  );
  const [activeField,  setActiveField]  = useState<string | null>(null);

  // UI state
  const [optionalOpen,    setOptionalOpen]    = useState(false);
  const [showCreateType,  setShowCreateType]  = useState(false);

  // Save / delete states
  const [saving,       setSaving]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  // Create type inline
  const [newTypeName,   setNewTypeName]   = useState('');
  const [newTypeDomain, setNewTypeDomain] = useState<'work' | 'personal'>('work');
  const [newTypeColor,  setNewTypeColor]  = useState('#F2A65A');
  const [createTypeErr, setCreateTypeErr] = useState('');

  // Context menu (long-press / right-click on user chips)
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; logType: LogType | null }>({
    visible: false, x: 0, y: 0, logType: null,
  });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivated = useRef(false);

  // Rename overlay
  const [renameId,    setRenameId]    = useState<string | null>(null);
  const [renameName,  setRenameName]  = useState('');
  const [renameError, setRenameError] = useState('');

  // Delete type confirm
  const [deleteTypeTarget, setDeleteTypeTarget] = useState<LogType | null>(null);

  // ── JIRA state ─────────────────────────────────────────────────────────────
  const [jiraConfigured,    setJiraConfigured]    = useState<boolean | null>(null);
  const [savedQueries,      setSavedQueries]      = useState<TicketQuery[]>([]);
  const [queriesLoading,    setQueriesLoading]    = useState(false);
  const [selectedQueryId,   setSelectedQueryId]   = useState<string>('');
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [jqlEditorOpen,     setJqlEditorOpen]     = useState(false);
  const [editJql,           setEditJql]           = useState('');
  const [jiraSearching,     setJiraSearching]     = useState(false);
  const [jiraResults,       setJiraResults]       = useState<JiraTicket[]>([]);
  const [jiraSearchError,   setJiraSearchError]   = useState('');
  const [linkedTicket,      setLinkedTicket]      = useState<JiraTicket | null>(
    isEdit && editEntry?.jiraTicketId
      ? { id: editEntry.jiraTicketId!, key: editEntry.jiraTicketKey!, summary: editEntry.jiraTicketSummary ?? '', status: '', url: '', assignee: null, dueDate: null, storyPoints: null, customer: null }
      : null,
  );

  // ── Derived ────────────────────────────────────────────────────────────────
  const isNextDay    = !!(formEndDate && formDate && formEndDate !== formDate);
  const durationStr  = entryType === 'range' ? fmtDuration(formStart, formEnd, isNextDay) : '';
  const endInvalid   = entryType === 'range' && !isNextDay &&
                       formStart && formEnd &&
                       toMins(formEnd) <= toMins(formStart);
  const showWorkFields   = selectedType?.domain === 'work';
  const isBreakOrTransit = ['break', 'transit'].includes(selectedType?.name?.toLowerCase() ?? '');
  const showTicketChips  = showWorkFields && !isBreakOrTransit;
  const canSave = !!selectedType && (entryType === 'point' || (!endInvalid && !!durationStr));
  const domainTypes = rawTypes.filter(lt => lt.domain === selectedDomain);
  const optionalCount = [
    priority,
    showWorkFields ? crucialPerson : null,
    collaborators.length > 0 ? 'x' : null,
    score !== null ? 'x' : null,
  ].filter(Boolean).length;

  // ── Auto-select type on load ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit && !selectedType && rawTypes.length > 0) {
      const fallback =
        rawTypes.find(lt => lt.name === 'Meeting') ??
        rawTypes.find(lt => lt.domain === 'work') ??
        rawTypes[0];
      setSelectedType(fallback ?? null);
      if (fallback) setSelectedDomain(fallback.domain as 'work' | 'personal');
    }
    if (isEdit && !selectedType && editEntry?.logType && rawTypes.length > 0) {
      const match = rawTypes.find(lt => lt._id === editEntry.logType?._id)
                 ?? rawTypes.find(lt => lt.name.toLowerCase() === editEntry.logType?.name?.toLowerCase());
      if (match) {
        setSelectedType(match);
        setSelectedDomain(match.domain as 'work' | 'personal');
      }
    }
  }, [rawTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset placeholder inputs when selected query changes
  useEffect(() => {
    const q = savedQueries.find(x => x._id === selectedQueryId);
    if (!q) return;
    const keys = extractPlaceholders(q.jql);
    const initial: Record<string, string> = {};
    keys.forEach(k => {
      initial[k] = k === 'log-title' ? title : '';
    });
    setPlaceholderValues(initial);
    setJqlEditorOpen(false);
    setEditJql(q.jql);
    setJiraResults([]);
    setJiraSearchError('');
  }, [selectedQueryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate ticketId when a JIRA ticket is linked
  useEffect(() => {
    if (linkedTicket) setTicketId(linkedTicket.key);
  }, [linkedTicket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Time helpers ───────────────────────────────────────────────────────────
  function handleEndChange(val: string) {
    setFormEnd(val);
    if (toMins(val) < toMins(formStart)) {
      setFormEndDate(addDaysToISO(formDate, 1));
    } else {
      setFormEndDate(formDate);
    }
  }

  function handleStartChange(val: string) {
    setFormStart(val);
    if (isNextDay && toMins(formEnd) >= toMins(val)) {
      setFormEndDate(formDate);
    }
  }

  function handleDateChange(val: string) {
    setFormDate(val);
    setFormEndDate(isNextDay ? addDaysToISO(val, 1) : val);
  }

  // ── Domain / type helpers ─────────────────────────────────────────────────
  function handleDomainChange(domain: 'work' | 'personal') {
    setSelectedDomain(domain);
    const types = rawTypes.filter(lt => lt.domain === domain);
    const preferred = types.find(lt => lt.name === 'Meeting') ?? types[0] ?? null;
    setSelectedType(preferred);
  }

  // ── JIRA helpers ──────────────────────────────────────────────────────────
  function openJiraPanel() {
    const next = activeField === 'jira' ? null : 'jira';
    setActiveField(next);
    if (next === 'jira' && jiraConfigured === null) {
      jiraApi.getConfig()
        .then(cfg => {
          setJiraConfigured(!!cfg);
          if (cfg) loadSavedQueries();
        })
        .catch(() => setJiraConfigured(false));
    }
  }

  async function loadSavedQueries() {
    setQueriesLoading(true);
    try {
      const qs = await jiraApi.listQueries();
      const valid = qs.filter(q => q.isValid);
      setSavedQueries(valid);
      if (valid.length > 0 && !selectedQueryId) setSelectedQueryId(valid[0]._id);
    } catch {
      // non-critical
    } finally {
      setQueriesLoading(false);
    }
  }

  async function runSelectedQuery(queryId: string) {
    const q = savedQueries.find(x => x._id === queryId);
    if (!q || jiraSearching) return;

    let resolvedJql = jqlEditorOpen ? editJql : q.jql;
    // Substitute all {{key}} placeholders
    Object.entries(placeholderValues).forEach(([k, v]) => {
      resolvedJql = resolvedJql.split(`{{${k}}}`).join(v);
    });

    setJiraSearchError('');
    setJiraResults([]);
    setJiraSearching(true);
    try {
      const results = await jiraApi.searchTickets(resolvedJql);
      setJiraResults(results);
      if (results.length === 0) setJiraSearchError('No tickets matched this query.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Search failed.';
      setJiraSearchError(msg);
    } finally {
      setJiraSearching(false);
    }
  }

  const selectedQueryJql = savedQueries.find(x => x._id === selectedQueryId)?.jql ?? '';
  const activePlaceholders = extractPlaceholders(jqlEditorOpen ? editJql : selectedQueryJql);
  const allPlaceholdersFilled = activePlaceholders.every(k => (placeholderValues[k] ?? '').trim() !== '');

  // ── Create log type ────────────────────────────────────────────────────────
  function submitCreateType() {
    if (!newTypeName.trim() || createType.isPending) return;
    setCreateTypeErr('');
    createType.mutate(
      { name: newTypeName.trim(), domain: newTypeDomain, color: newTypeColor },
      {
        onSuccess: (created) => {
          setSelectedType(created);
          setSelectedDomain(created.domain as 'work' | 'personal');
          setShowCreateType(false);
          setNewTypeName(''); setNewTypeColor('#F2A65A'); setNewTypeDomain('work');
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          setCreateTypeErr(msg ?? 'Failed to create log type.');
        },
      },
    );
  }

  // ── Rename log type ────────────────────────────────────────────────────────
  function startRename() {
    if (!ctxMenu.logType) return;
    setRenameId(ctxMenu.logType._id);
    setRenameName(ctxMenu.logType.name);
    setRenameError('');
    setCtxMenu(m => ({ ...m, visible: false }));
  }
  function submitRename() {
    if (!renameId || !renameName.trim() || renameType.isPending) return;
    renameType.mutate({ id: renameId, name: renameName.trim() }, {
      onSuccess: (updated) => {
        if (selectedType?._id === updated._id) setSelectedType(updated);
        setRenameId(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setRenameError(msg ?? 'Failed to rename.');
      },
    });
  }

  // ── Delete log type ────────────────────────────────────────────────────────
  function startDeleteType() {
    if (!ctxMenu.logType) return;
    setDeleteTypeTarget(ctxMenu.logType);
    setCtxMenu(m => ({ ...m, visible: false }));
  }
  function confirmDeleteType() {
    if (!deleteTypeTarget) return;
    const id = deleteTypeTarget._id;
    setDeleteTypeTarget(null);
    deleteType.mutate(id, {
      onSuccess: () => {
        if (selectedType?._id === id) setSelectedType(rawTypes.find(lt => lt._id !== id) ?? null);
      },
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  function save() {
    if (!canSave || saving) return;
    setSaving(true);
    const entry = {
      startTime:         formStart,
      endTime:           entryType === 'point' ? formStart : formEnd,
      title:             title.trim() || selectedType!.name,
      logTypeId:         selectedType!._id,
      date:              formDate,
      endDate:           entryType === 'range' && isNextDay ? formEndDate : undefined,
      entryType,
      pointTime:         entryType === 'point' ? formStart : undefined,
      ticketId:          showWorkFields && ticketId.trim() ? ticketId.trim() : undefined,
      jiraTicketId:      linkedTicket?.id      ?? undefined,
      jiraTicketKey:     linkedTicket?.key     ?? undefined,
      jiraTicketSummary: linkedTicket?.summary ?? undefined,
      priority:          priority ?? undefined,
      collaborators:     collaborators.length > 0 ? [...collaborators] : undefined,
      satisfactoryScore: score ?? undefined,
      crucialPerson:     showWorkFields ? (crucialPerson ?? undefined) : undefined,
    };

    if (isEdit && editEntry) {
      updateLog.mutate({ id: editEntry.id, entry }, {
        onSuccess: () => { setSaving(false); showToast('Log updated'); onSaved?.(); onClose(); },
        onError:   () => { setSaving(false); showToast('Failed to update log'); },
      });
    } else {
      createLog.mutate(entry, {
        onSuccess: () => { setSaving(false); showToast('Log saved'); onSaved?.(); onClose(); },
        onError:   () => { setSaving(false); showToast('Failed to save log'); },
      });
    }
  }

  // ── Delete log ─────────────────────────────────────────────────────────────
  function confirmDeleteLog() {
    if (!editEntry || deleting) return;
    setDeleting(true);
    deleteLog.mutate(editEntry.id, {
      onSuccess: () => { setDeleting(false); showToast('Log deleted'); onSaved?.(); onClose(); },
      onError:   () => { setDeleting(false); showToast('Failed to delete log'); setDeleteConfirm(false); },
    });
  }

  const stopProp = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  // ── Collaborator helpers ───────────────────────────────────────────────────
  function addCollaborator() {
    const n = collaboratorInput.trim();
    if (!n || collaborators.includes(n)) return;
    setCollaborators(c => [...c, n]);
    setCollaboratorInput('');
  }

  // Open an optional field chip and ensure the optional section is open
  function openOptionalField(field: string) {
    setOptionalOpen(true);
    setActiveField(f => f === field ? null : field);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      <div className="lfm-overlay" onClick={onClose}>

        {/* Panel */}
        <div className="lfm-panel" onClick={stopProp} role="dialog" aria-modal="true" aria-label="Log entry form">

          {/* ── Header ── */}
          <div className="lfm-header">
            <span className="lfm-title">{isEdit ? 'Edit Log Entry' : 'New Log Entry'}</span>
            <button className="lfm-close-btn" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* ── Body ── */}
          <div className="lfm-body">

            {/* ── Entry type toggle ── */}
            <div className="lfm-type-toggle">
              <button
                type="button"
                className={`lfm-toggle-btn${entryType === 'range' ? ' lfm-toggle-btn--active' : ''}`}
                onClick={() => setEntryType('range')}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="5" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="11" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                Time Range
              </button>
              <button
                type="button"
                className={`lfm-toggle-btn${entryType === 'point' ? ' lfm-toggle-btn--active' : ''}`}
                onClick={() => setEntryType('point')}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="8" y1="2" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <line x1="8" y1="11.5" x2="8" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <line x1="2" y1="8" x2="4.5" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <line x1="11.5" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Point in Time
              </button>
            </div>

            {/* ── Time + Date card ── */}
            <div className="lfm-time-card">
              <div className="lfm-time-row">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--highlight-selected)' }}>
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>

                {entryType === 'range' ? (
                  <>
                    <div className="lfm-time-field">
                      <span className="lfm-time-lbl">Start</span>
                      <input type="time" className="lfm-time-input" value={formStart}
                             onChange={e => handleStartChange(e.target.value)} />
                    </div>
                    <span className="lfm-time-arrow">→</span>
                    <div className="lfm-time-field">
                      <span className="lfm-time-lbl">End</span>
                      <input type="time" className="lfm-time-input" value={formEnd}
                             onChange={e => handleEndChange(e.target.value)} />
                      {isNextDay && (
                        <span className="lfm-next-day-badge"
                              onClick={() => setFormEndDate(formDate)}
                              title="Ends next day — click to reset">
                          +1 day ×
                        </span>
                      )}
                    </div>
                    {durationStr && <span className="lfm-duration-lbl">{durationStr}</span>}
                    {endInvalid && <span className="lfm-duration-lbl lfm-duration-lbl--error">end ≤ start</span>}
                  </>
                ) : (
                  <>
                    <div className="lfm-time-field">
                      <span className="lfm-time-lbl">Time</span>
                      <input type="time" className="lfm-time-input" value={formStart}
                             onChange={e => setFormStart(e.target.value)} />
                    </div>
                    <span className="lfm-point-hint">Exact moment — no duration</span>
                  </>
                )}
              </div>

              <div className="lfm-time-card-divider" />

              <div className="lfm-date-row">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                  <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span className="lfm-time-lbl" style={{ alignSelf: 'center' }}>
                  {entryType === 'range' ? 'Start Date' : 'Date'}
                </span>
                <input type="date" className="lfm-date-input" value={formDate}
                       onChange={e => handleDateChange(e.target.value)} />
              </div>
            </div>

            {/* ── Description ── */}
            <div>
              <label className="lfm-section-lbl" htmlFor="lfm-desc">Description</label>
              <textarea
                id="lfm-desc"
                className="lfm-description-textarea"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What were you doing? (optional)"
                maxLength={300}
                rows={2}
              />
            </div>

            {/* ── Domain + Log Type ── */}
            <div className="lfm-domain-row">
              <div className="lfm-domain-field">
                <label className="lfm-field-lbl">Domain</label>
                <select
                  className="lfm-select"
                  value={selectedDomain}
                  onChange={e => handleDomainChange(e.target.value as 'work' | 'personal')}
                >
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div className="lfm-logtype-field">
                <label className="lfm-field-lbl">Log Type</label>
                {typesLoading ? (
                  <div className="lfm-select-skeleton" />
                ) : typesError ? (
                  <div className="lfm-type-error" style={{ fontSize: 11, padding: '6px 8px' }}>
                    Failed to load.
                    <button className="lfm-retry-btn" onClick={() => refetchTypes()}>Retry</button>
                  </div>
                ) : (
                  <select
                    className={`lfm-select${selectedType ? ' lfm-select--has-color' : ''}`}
                    value={selectedType?._id ?? ''}
                    onChange={e => {
                      const lt = domainTypes.find(t => t._id === e.target.value);
                      if (lt) { setSelectedType(lt); }
                    }}
                    style={selectedType ? { borderColor: selectedType.color + '88', color: selectedType.color } as React.CSSProperties : {}}
                  >
                    {domainTypes.length === 0 && (
                      <option value="" disabled>No types — create one below</option>
                    )}
                    {domainTypes.map(lt => (
                      <option key={lt._id} value={lt._id}>{lt.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* ── Create new log type ── */}
            <button
              type="button"
              className="lfm-create-type-link"
              onClick={() => setShowCreateType(v => !v)}
            >
              {showCreateType ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Create new type
                </>
              )}
            </button>

            {showCreateType && (
              <div className="lfm-create-type-panel">
                {createTypeErr && <div className="lfm-create-error">{createTypeErr}</div>}
                <div className="lfm-create-fields">
                  <div className="lfm-create-top-row">
                    <div className="lfm-create-field lfm-create-field--name">
                      <label className="lfm-create-lbl">Name</label>
                      <input
                        type="text"
                        className="lfm-create-input"
                        value={newTypeName}
                        onChange={e => setNewTypeName(e.target.value)}
                        placeholder="e.g. Deep Work, Therapy…"
                        maxLength={40}
                        disabled={createType.isPending}
                      />
                    </div>
                    <div className="lfm-create-field lfm-create-field--domain">
                      <label className="lfm-create-lbl">Domain</label>
                      <select
                        className="lfm-create-select"
                        value={newTypeDomain}
                        onChange={e => setNewTypeDomain(e.target.value as 'work' | 'personal')}
                        disabled={createType.isPending}
                      >
                        <option value="work">Work</option>
                        <option value="personal">Personal</option>
                      </select>
                    </div>
                  </div>
                  <div className="lfm-create-field">
                    <label className="lfm-create-lbl">Color</label>
                    <div className="lfm-swatch-grid">
                      {PALETTE_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          className={`lfm-swatch-btn${newTypeColor === c ? ' lfm-swatch-btn--active' : ''}`}
                          style={{ background: c }}
                          disabled={createType.isPending}
                          onClick={() => setNewTypeColor(c)}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="lfm-create-actions">
                  <button
                    type="button"
                    className="lfm-btn-create-submit"
                    onClick={submitCreateType}
                    disabled={createType.isPending || !newTypeName.trim()}
                  >
                    {createType.isPending && <span className="lfm-spinner" />}
                    {createType.isPending ? 'Creating…' : 'Create & Select'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Work chips: Ticket ID + JIRA ── */}
            {showTicketChips && (
              <div className="lfm-work-chips">
                <button
                  type="button"
                  className={`lfm-field-chip${ticketId ? ' lfm-field-chip--filled' : ''}${activeField === 'ticketId' ? ' lfm-field-chip--active' : ''}`}
                  onClick={() => setActiveField(f => f === 'ticketId' ? null : 'ticketId')}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  {ticketId || '+ Ticket ID'}
                </button>

                <button
                  type="button"
                  className={`lfm-field-chip lfm-field-chip--jira${linkedTicket ? ' lfm-field-chip--filled' : ''}${activeField === 'jira' ? ' lfm-field-chip--active' : ''}`}
                  onClick={openJiraPanel}
                  title={linkedTicket ? linkedTicket.key : 'Link JIRA ticket'}
                >
                  {/* JIRA logo */}
                  <svg width="13" height="13" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M16 2.67L2.67 16 9.33 22.67 22.67 9.33 16 2.67Z" fill="currentColor"/>
                    <path d="M16 29.33L29.33 16 22.67 9.33 9.33 22.67 16 29.33Z" fill="currentColor" opacity="0.5"/>
                  </svg>
                  {linkedTicket ? linkedTicket.key : 'JIRA'}
                </button>
              </div>
            )}

            {/* ── Ticket ID expand ── */}
            {activeField === 'ticketId' && showTicketChips && (
              <div className="lfm-field-expand">
                <input
                  type="text"
                  className="lfm-ticket-input"
                  value={ticketId}
                  onChange={e => setTicketId(e.target.value)}
                  placeholder="e.g. PROJ-1234"
                  maxLength={100}
                  autoFocus
                />
              </div>
            )}

            {/* ── JIRA expand — query picker ── */}
            {activeField === 'jira' && showTicketChips && (
              <div className="lfm-field-expand">
                <div className="lfm-fe-jira">

                  {/* Not connected */}
                  {jiraConfigured === false && (
                    <div className="lfm-jira-not-configured">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                      </svg>
                      <span>
                        JIRA is not connected.{' '}
                        <a className="lfm-jira-config-link" href="/external-configs/jira" target="_blank" rel="noopener noreferrer">
                          Configure it here
                        </a>
                      </span>
                    </div>
                  )}

                  {/* Checking */}
                  {jiraConfigured === null && (
                    <div className="lfm-jira-checking">
                      <span className="lfm-spinner" />
                      Checking JIRA connection…
                    </div>
                  )}

                  {jiraConfigured === true && (
                    <>
                      {/* Linked ticket display */}
                      {linkedTicket && (
                        <div className="lfm-jira-linked-chip">
                          <a className="lfm-jira-linked-key" href={linkedTicket.url}
                             target="_blank" rel="noopener noreferrer"
                             onClick={e => e.stopPropagation()}>
                            {linkedTicket.key}
                          </a>
                          <span className="lfm-jira-linked-summary">{linkedTicket.summary}</span>
                          <button type="button" className="lfm-jira-linked-remove"
                            onClick={() => { setLinkedTicket(null); setJiraResults([]); setTicketId(''); }}
                            title="Remove linked ticket">×</button>
                        </div>
                      )}

                      {/* Loading queries */}
                      {queriesLoading && (
                        <div className="lfm-jira-checking">
                          <span className="lfm-spinner" /> Loading saved queries…
                        </div>
                      )}

                      {/* No saved queries */}
                      {!queriesLoading && savedQueries.length === 0 && (
                        <div className="lfm-jira-not-configured">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          </svg>
                          <span>
                            No saved queries yet.{' '}
                            <a className="lfm-jira-config-link" href="/external-configs/jira" target="_blank" rel="noopener noreferrer">
                              Create one in JIRA settings
                            </a>
                          </span>
                        </div>
                      )}

                      {/* Query picker */}
                      {!queriesLoading && savedQueries.length > 0 && (
                        <>
                          {/* Form: query select + placeholder fields + search — always visible */}
                          <div className="lfm-jira-form">
                              {/* Query selector row */}
                              <div className="lfm-jira-query-row">
                                <select
                                  className="lfm-jira-query-select"
                                  value={selectedQueryId}
                                  onChange={e => setSelectedQueryId(e.target.value)}
                                >
                                  {savedQueries.map(q => (
                                    <option key={q._id} value={q._id}>{q.name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* JQL editor (when open) */}
                              {jqlEditorOpen ? (
                                <div className="lfm-jira-jql-editor">
                                  <textarea
                                    className="lfm-jira-jql-textarea"
                                    value={editJql}
                                    onChange={e => setEditJql(e.target.value)}
                                    rows={3}
                                    spellCheck={false}
                                  />
                                  <button
                                    type="button"
                                    className="lfm-jira-cancel-edit-btn"
                                    onClick={() => {
                                      setJqlEditorOpen(false);
                                      setEditJql(selectedQueryJql);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                /* Placeholder inputs */
                                activePlaceholders.length > 0 && (
                                  <div className="lfm-jira-placeholders">
                                    {activePlaceholders.map(key => (
                                      <div key={key} className="lfm-jira-placeholder-row">
                                        <label className="lfm-jira-placeholder-label">{`{{${key}}}`}</label>
                                        <input
                                          type="text"
                                          className="lfm-jira-placeholder-input"
                                          value={placeholderValues[key] ?? ''}
                                          onChange={e => setPlaceholderValues(prev => ({ ...prev, [key]: e.target.value }))}
                                          placeholder={`Enter ${key}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )
                              )}

                              {/* Edit pencil + Search row */}
                              <div className="lfm-jira-actions-row">
                                {!jqlEditorOpen && (
                                  <button
                                    type="button"
                                    className="lfm-jira-pencil-btn"
                                    title="Edit JQL"
                                    onClick={() => {
                                      setEditJql(selectedQueryJql);
                                      setJqlEditorOpen(true);
                                    }}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                    Edit JQL
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="lfm-jira-fetch-btn"
                                  onClick={() => runSelectedQuery(selectedQueryId)}
                                  disabled={jiraSearching || !selectedQueryId || (!jqlEditorOpen && !allPlaceholdersFilled)}
                                  title={!allPlaceholdersFilled ? 'Fill in all placeholder fields first' : undefined}
                                >
                                  {jiraSearching
                                    ? <><span className="lfm-spinner lfm-spinner--dark" />Searching…</>
                                    : <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                        </svg>
                                        Search
                                      </>
                                  }
                                </button>
                              </div>
                            </div>
                        </>
                      )}

                      {jiraSearchError && <div className="lfm-jira-error">{jiraSearchError}</div>}

                      {jiraResults.length > 0 && (
                        <div className="lfm-jira-results">
                          {jiraResults.map(ticket => {
                            const selected = linkedTicket?.id === ticket.id;
                            return (
                              <button
                                key={ticket.id}
                                type="button"
                                className={`lfm-jira-result-card${selected ? ' lfm-jira-result-card--selected' : ''}`}
                                onClick={() => {
                                  const picking = selected ? null : ticket;
                                  setLinkedTicket(picking);
                                  if (!picking) setTicketId('');
                                }}
                              >
                                {/* Row 1 — key · status · sp · check */}
                                <div className="lfm-jira-result-top">
                                  <a className="lfm-jira-result-key"
                                     href={ticket.url} target="_blank" rel="noopener noreferrer"
                                     onClick={e => e.stopPropagation()}>
                                    {ticket.key}
                                  </a>
                                  <span className="lfm-jira-result-status">{ticket.status}</span>
                                  {ticket.storyPoints !== null && (
                                    <span className="lfm-jira-result-sp" title="Story Points">
                                      {ticket.storyPoints} SP
                                    </span>
                                  )}
                                  {selected && (
                                    <svg className="lfm-jira-result-check" width="13" height="13" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  )}
                                </div>

                                {/* Row 2 — summary */}
                                <p className="lfm-jira-result-summary">{ticket.summary}</p>

                                {/* Row 3 — meta: assignee · customer · due-in */}
                                <div className="lfm-jira-result-meta">
                                  {ticket.assignee && (
                                    <span className="lfm-jira-result-assignee">
                                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                                        <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
                                        <path d="M2 13.5c0-3 2.686-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                                      </svg>
                                      {ticket.assignee}
                                    </span>
                                  )}
                                  {ticket.customer && (
                                    <span className="lfm-jira-result-customer">
                                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                                        <rect x="2" y="2" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                                        <path d="M5 14h6M8 11v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                      </svg>
                                      {ticket.customer}
                                    </span>
                                  )}
                                  <span className={`lfm-jira-result-due${
                                    !ticket.dueDate ? ' lfm-jira-result-due--none' :
                                    formatDueIn(ticket.dueDate) === 'Due today' ? ' lfm-jira-result-due--today' :
                                    formatDueIn(ticket.dueDate).includes('overdue') ? ' lfm-jira-result-due--over' : ''
                                  }`}>
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                                      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                                      <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                    </svg>
                                    {formatDueIn(ticket.dueDate)}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Optional fields accordion ── */}
            <div className="lfm-optional-section">
              <button
                type="button"
                className={`lfm-optional-hdr${optionalOpen ? ' lfm-optional-hdr--open' : ''}`}
                onClick={() => setOptionalOpen(v => !v)}
              >
                <svg
                  className="lfm-accordion-chevron"
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="lfm-optional-label">Optional Fields</span>
                {optionalCount > 0 && (
                  <span className="lfm-optional-badge">{optionalCount}</span>
                )}
              </button>

              {optionalOpen && (
                <div className="lfm-optional-body">
                  <div className="lfm-field-chip-grid">
                    <button
                      type="button"
                      className={`lfm-field-chip${priority ? ' lfm-field-chip--filled' : ''}${activeField === 'priority' ? ' lfm-field-chip--active' : ''}`}
                      onClick={() => openOptionalField('priority')}
                    >
                      {priority ? (
                        <><span className="lfm-fc-dot" style={{ background: priorityColor(priority) }} />{priority}</>
                      ) : '+ Priority'}
                    </button>

                    {showWorkFields && (
                      <button
                        type="button"
                        className={`lfm-field-chip${crucialPerson ? ' lfm-field-chip--filled' : ''}${activeField === 'crucialPerson' ? ' lfm-field-chip--active' : ''}`}
                        onClick={() => openOptionalField('crucialPerson')}
                      >
                        {crucialPerson || '+ Crucial'}
                      </button>
                    )}

                    <button
                      type="button"
                      className={`lfm-field-chip${collaborators.length > 0 ? ' lfm-field-chip--filled' : ''}${activeField === 'collaborators' ? ' lfm-field-chip--active' : ''}`}
                      onClick={() => openOptionalField('collaborators')}
                    >
                      {collaborators.length === 0
                        ? '+ Collaborators'
                        : collaborators.length === 1 ? collaborators[0]
                        : `${collaborators[0]} +${collaborators.length - 1}`}
                    </button>

                    <button
                      type="button"
                      className={`lfm-field-chip${score !== null ? ' lfm-field-chip--filled' : ''}${activeField === 'score' ? ' lfm-field-chip--active' : ''}`}
                      onClick={() => openOptionalField('score')}
                    >
                      {score !== null ? `★ ${score}/10` : '+ Score'}
                    </button>
                  </div>

                  {/* Expand panel for optional fields */}
                  {activeField && ['priority', 'crucialPerson', 'collaborators', 'score'].includes(activeField) && (
                    <div className="lfm-field-expand" style={{ marginTop: 8 }}>

                      {activeField === 'priority' && (
                        <div className="lfm-fe-priority">
                          {(['High', 'Medium', 'Low'] as const).map(p => (
                            <button
                              key={p}
                              type="button"
                              className={`lfm-priority-btn lfm-priority-btn--${p.toLowerCase()}${priority === p ? ` lfm-priority-btn--active` : ''}`}
                              onClick={() => setPriority(v => v === p ? null : p)}
                            >
                              <span className="lfm-priority-dot" style={{ background: priorityColor(p) }} />
                              {p}
                            </button>
                          ))}
                        </div>
                      )}

                      {activeField === 'crucialPerson' && (
                        <div className="lfm-fe-crucial">
                          {(['Yes', 'Shared', 'No'] as const).map(v => (
                            <button
                              key={v}
                              type="button"
                              className={`lfm-crucial-btn lfm-crucial-btn--${v.toLowerCase()}${crucialPerson === v ? ` lfm-crucial-btn--active` : ''}`}
                              onClick={() => setCrucialPerson(c => c === v ? null : v)}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}

                      {activeField === 'collaborators' && (
                        <div className="lfm-fe-collab">
                          {collaborators.length > 0 && (
                            <div className="lfm-collab-chips">
                              {collaborators.map((c, i) => (
                                <span key={i} className="lfm-collab-chip">
                                  {c}
                                  <button
                                    type="button"
                                    className="lfm-collab-remove"
                                    onClick={() => setCollaborators(arr => arr.filter((_, idx) => idx !== i))}
                                  >×</button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="lfm-collab-input-row">
                            <input
                              type="text"
                              className="lfm-collab-input"
                              value={collaboratorInput}
                              onChange={e => setCollaboratorInput(e.target.value)}
                              placeholder="Name or team…"
                              maxLength={60}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCollaborator(); } }}
                            />
                            <button
                              type="button"
                              className="lfm-collab-add-btn"
                              onClick={addCollaborator}
                              disabled={!collaboratorInput.trim()}
                            >Add</button>
                          </div>
                        </div>
                      )}

                      {activeField === 'score' && (
                        <div className="lfm-fe-score">
                          <div className="lfm-score-track">
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <button
                                key={n}
                                type="button"
                                className={`lfm-score-btn${score !== null && n <= score ? ' lfm-score-btn--filled' : ''}`}
                                onClick={() => setScore(s => s === n ? null : n)}
                              >{n}</button>
                            ))}
                          </div>
                          <div className="lfm-score-bar-wrap">
                            <div className="lfm-score-bar-fill" style={{ width: `${score ? (score / 10) * 100 : 0}%` }} />
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div className="lfm-actions">
              <button type="button" className="lfm-btn-cancel" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="lfm-btn-save" disabled={!canSave || saving} onClick={save}>
                {saving ? 'Saving…' : isEdit ? 'Update Log' : 'Save Log'}
              </button>
            </div>

            {/* ── Delete (edit mode) ── */}
            {isEdit && !deleteConfirm && (
              <div className="lfm-delete-section">
                <button type="button" className="lfm-btn-delete" onClick={() => setDeleteConfirm(true)} disabled={saving}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9H3z"
                          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Delete Entry
                </button>
              </div>
            )}

            {isEdit && deleteConfirm && (
              <div className="lfm-delete-confirm">
                <p className="lfm-delete-confirm-msg">
                  Delete <strong>"{editEntry?.title || selectedType?.name || 'this entry'}"</strong>? This cannot be undone.
                </p>
                <div className="lfm-delete-confirm-btns">
                  <button type="button" className="lfm-btn-confirm-cancel" onClick={() => setDeleteConfirm(false)}>
                    Keep it
                  </button>
                  <button type="button" className="lfm-btn-confirm-delete" onClick={confirmDeleteLog} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}

          </div>{/* /lfm-body */}
        </div>{/* /lfm-panel */}
      </div>{/* /lfm-overlay */}

      {/* ── Context menu ── */}
      {ctxMenu.visible && (
        <>
          <div className="lfm-ctx-backdrop" onClick={() => setCtxMenu(m => ({ ...m, visible: false }))} />
          <div className="lfm-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}
               onClick={e => e.stopPropagation()}>
            <button type="button" className="lfm-ctx-item" onClick={startRename}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              Rename
            </button>
            <div className="lfm-ctx-divider" />
            <button type="button" className="lfm-ctx-item lfm-ctx-item--danger" onClick={startDeleteType}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Delete
            </button>
          </div>
        </>
      )}

      {/* ── Rename overlay ── */}
      {renameId && (
        <div className="lfm-rename-overlay" onClick={() => setRenameId(null)}>
          <div className="lfm-rename-panel" onClick={e => e.stopPropagation()}>
            <p className="lfm-rename-title">Rename Log Type</p>
            <input
              className="lfm-rename-input"
              type="text"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              maxLength={40}
              placeholder="New name"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter')  submitRename();
                if (e.key === 'Escape') setRenameId(null);
              }}
            />
            {renameError && <div className="lfm-rename-error">{renameError}</div>}
            <div className="lfm-rename-actions">
              <button type="button" className="lfm-rename-cancel" onClick={() => setRenameId(null)}>Cancel</button>
              <button
                type="button"
                className="lfm-rename-save"
                onClick={submitRename}
                disabled={renameType.isPending || !renameName.trim()}
              >
                {renameType.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete log type confirm ── */}
      {deleteTypeTarget && (
        <div className="lfm-rename-overlay" onClick={() => setDeleteTypeTarget(null)}>
          <div className="lfm-rename-panel" onClick={e => e.stopPropagation()}>
            <p className="lfm-rename-title">Delete Log Type</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Delete "{deleteTypeTarget.name}"? Existing logs are not affected.
            </p>
            <div className="lfm-rename-actions">
              <button type="button" className="lfm-rename-cancel" onClick={() => setDeleteTypeTarget(null)}>Cancel</button>
              <button
                type="button"
                className="lfm-btn-confirm-delete"
                onClick={confirmDeleteType}
                disabled={deleteType.isPending}
              >
                {deleteType.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
