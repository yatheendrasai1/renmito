import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCreateLog, useUpdateLog, useDeleteLog } from '@/hooks/useLogs';
import {
  useLogTypes,
  useRenameLogType,
  useDeleteLogType,
} from '@/hooks/useLogTypes';
import { useSetActiveLog } from '@/hooks/usePreferences';
import type { LogEntry, LogType } from '@/types';
import { jiraApi, type JiraTicket, type TicketQuery } from '@/lib/jiraApi';
import './LogFormModal.css';

const PLAN_OPTS: { v: number | null; l: string }[] = [
  { v: null, l: 'None' },
  { v: 15,   l: '15 m' },
  { v: 30,   l: '30 m' },
  { v: 60,   l: '1 h'  },
  { v: 90,   l: '1.5 h'},
  { v: 120,  l: '2 h'  },
];

// ── Constants ─────────────────────────────────────────────────────────────────


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

/** Extract HH:MM from an ISO datetime string (UTC). Falls back to the raw value if not ISO. */
function isoToHHMM(iso: string): string {
  if (!iso) return '';
  // If already HH:MM (legacy), return as-is
  if (/^\d{2}:\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

/** Extract YYYY-MM-DD from an ISO datetime string. Falls back to raw value if already a date. */
function isoToDateStr(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format "YYYY-MM-DD" → "02 Jun '26" */
function formatDateLabel(ymd: string): string {
  if (!ymd || ymd.length < 10) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  return `${String(d).padStart(2,'0')} ${SHORT_MONTHS[m - 1]} '${String(y).slice(2)}`;
}


/** Parse "HH:MM" (24h) into { h12, mm, period } for large display */
function parseTime(hhmm: string): { h12: string; mm: string; period: string } {
  if (!hhmm || !hhmm.includes(':')) return { h12: '--', mm: '--', period: '' };
  const [h, m] = hhmm.split(':').map(Number);
  return {
    h12: String(h % 12 === 0 ? 12 : h % 12),
    mm: String(m).padStart(2, '0'),
    period: h < 12 ? 'am' : 'pm',
  };
}

/** Large time + date side — clicking time opens time picker, clicking date opens date picker */
function BigTimeSide({
  date, time, onDateChange, onTimeChange,
}: {
  date: string; time: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
}) {
  const dateRef = React.useRef<HTMLInputElement>(null);
  const timeRef = React.useRef<HTMLInputElement>(null);
  const { h12, mm, period } = parseTime(time);
  return (
    <div className="lfm-tc-side">
      <button type="button" className="lfm-tc-time-btn"
              onClick={() => timeRef.current?.showPicker?.()}>
        <span className="lfm-tc-hhmm">{h12}:{mm}</span>
        <span className="lfm-tc-period">{period}</span>
      </button>
      <button type="button" className="lfm-tc-date-btn"
              onClick={() => dateRef.current?.showPicker?.()}>
        {formatDateLabel(date)}
      </button>
      <input ref={dateRef} type="date" className="lfm-dtt-hidden" value={date}
             onChange={e => onDateChange(e.target.value)} tabIndex={-1} aria-hidden="true" />
      <input ref={timeRef} type="time" className="lfm-dtt-hidden" value={time}
             onChange={e => onTimeChange(e.target.value)} tabIndex={-1} aria-hidden="true" />
    </div>
  );
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
  startTime?: string;   // defaults to now−30 min
  endTime?:   string;   // defaults to now+30 min
  onClose:    () => void;
  onSaved?:   () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

function nowOffsetHHMM(offsetMins: number): string {
  const d = new Date(Date.now() + offsetMins * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LogFormModal({
  mode, date, editEntry, startTime, endTime,
  onClose, onSaved,
}: Props) {
  const isEdit     = mode === 'edit';
  const defaultStart = startTime ?? nowOffsetHHMM(-30);
  const defaultEnd   = endTime   ?? nowOffsetHHMM(+30);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createLog    = useCreateLog(date);
  const updateLog    = useUpdateLog(isEdit ? (editEntry?.date ?? date) : date);
  const deleteLog    = useDeleteLog(isEdit ? (editEntry?.date ?? date) : date);
  const setActiveLog = useSetActiveLog();
  const renameType   = useRenameLogType();
  const deleteType   = useDeleteLogType();

  // ── Log types ──────────────────────────────────────────────────────────────
  const { data: rawTypes = [], isLoading: typesLoading, isError: typesError, refetch: refetchTypes } = useLogTypes();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [entryType,    setEntryType]    = useState<'range' | 'point' | 'timer'>(
    isEdit ? (editEntry?.entryType ?? 'range') : 'range',
  );
  const [plannedMins,  setPlannedMins]  = useState<number | null>(null);
  const [formStart,    setFormStart]    = useState(
    isEdit ? (isoToHHMM(editEntry?.startAt ?? '') || defaultStart) : defaultStart,
  );
  const [formEnd,      setFormEnd]      = useState(
    isEdit ? (isoToHHMM(editEntry?.endAt ?? '') || defaultEnd) : defaultEnd,
  );
  const [formDate,     setFormDate]     = useState(
    isEdit ? (isoToDateStr(editEntry?.startAt ?? '') || editEntry?.date || date) : date,
  );
  const [formEndDate,  setFormEndDate]  = useState(
    isEdit ? (isoToDateStr(editEntry?.endAt ?? '') || editEntry?.endDate || editEntry?.date || date) : date,
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
  // Save / delete states
  const [saving,       setSaving]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,     setDeleting]     = useState(false);


  // Context menu (long-press / right-click on user chips)
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; logType: LogType | null }>({
    visible: false, x: 0, y: 0, logType: null,
  });
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
  const [jiraOpen,          setJiraOpen]          = useState(false);
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
  const canSave = !!selectedType && (entryType === 'point' || entryType === 'timer' || (!endInvalid && !!durationStr));
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
    if (isEdit && editEntry?.logType && rawTypes.length > 0) {
      const logTypeId = (editEntry.logType as { _id?: string; id?: string })?._id
                     ?? (editEntry.logType as { _id?: string; id?: string })?.id;
      const match = rawTypes.find(lt => lt._id === logTypeId)
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
    setPlaceholderValues({});
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
    // Only auto-adjust end date when dates are currently the same (user hasn't manually set a cross-day end date)
    if (formEndDate === formDate) {
      if (toMins(val) < toMins(formStart)) {
        setFormEndDate(addDaysToISO(formDate, 1));
      }
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
  function toggleJiraAccordion() {
    const opening = !jiraOpen;
    setJiraOpen(opening);
    if (opening && jiraConfigured === null) {
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

    if (entryType === 'timer') {
      setActiveLog.mutate({
        logTypeId:   selectedType!._id,
        title:       title.trim() || selectedType!.name,
        startedAt:   new Date().toISOString(),
        plannedMins: plannedMins,
      }, {
        onSuccess: () => { setSaving(false); toast('Timer started'); onSaved?.(); onClose(); },
        onError:   () => { setSaving(false); toast('Failed to start timer'); },
      });
      return;
    }

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
        onSuccess: () => { setSaving(false); toast('Log updated'); onSaved?.(); onClose(); },
        onError:   () => { setSaving(false); toast('Failed to update log'); },
      });
    } else {
      createLog.mutate(entry, {
        onSuccess: () => { setSaving(false); toast('Log saved'); onSaved?.(); onClose(); },
        onError:   () => { setSaving(false); toast('Failed to save log'); },
      });
    }
  }

  // ── Delete log ─────────────────────────────────────────────────────────────
  function confirmDeleteLog() {
    if (!editEntry || deleting) return;
    setDeleting(true);
    deleteLog.mutate(editEntry.id, {
      onSuccess: () => { setDeleting(false); toast('Log deleted'); onSaved?.(); onClose(); },
      onError:   () => { setDeleting(false); toast('Failed to delete log'); setDeleteConfirm(false); },
    });
  }


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
      <Dialog open={true} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="lfm-panel" showCloseButton={false} aria-label="Log entry form">

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
            <ToggleGroup
              type="single"
              value={entryType}
              onValueChange={v => { if (v) setEntryType(v as typeof entryType); }}
              className="lfm-type-toggle"
            >
              <ToggleGroupItem value="range">Period</ToggleGroupItem>
              <ToggleGroupItem value="point">Point</ToggleGroupItem>
              {!isEdit && <ToggleGroupItem value="timer">Timer</ToggleGroupItem>}
            </ToggleGroup>

            {/* ── Time + Date card ── */}
            <div className="lfm-time-card">
              {entryType === 'range' ? (
                <div className="lfm-tc-range">
                  <BigTimeSide date={formDate} time={formStart}
                    onDateChange={handleDateChange} onTimeChange={handleStartChange} />
                  <div className="lfm-tc-center">
                    <span className="lfm-tc-arrow">→</span>
                    {durationStr && <span className="lfm-tc-dur-badge">{durationStr}</span>}
                    {endInvalid && <span className="lfm-tc-dur-badge lfm-tc-dur-badge--error">!</span>}
                  </div>
                  <BigTimeSide date={formEndDate} time={formEnd}
                    onDateChange={setFormEndDate} onTimeChange={handleEndChange} />
                </div>
              ) : entryType === 'timer' ? (
                <div className="lfm-tc-timer">
                  <div className="lfm-tc-timer-now">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Starts now
                  </div>
                  <div className="lfm-tc-plan-row">
                    <span className="lfm-tc-plan-label">Plan for</span>
                    <div className="lfm-tc-plan-chips">
                      {PLAN_OPTS.map(opt => (
                        <button
                          key={String(opt.v)}
                          type="button"
                          className={`lfm-plan-chip${plannedMins === opt.v ? ' lfm-plan-chip--active' : ''}`}
                          onClick={() => setPlannedMins(opt.v)}
                        >{opt.l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lfm-tc-point">
                  <BigTimeSide date={formDate} time={formStart}
                    onDateChange={handleDateChange} onTimeChange={setFormStart} />
                </div>
              )}
            </div>

            {/* ── Description ── */}
            <textarea
              id="lfm-desc"
              className="lfm-description-textarea"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Description"
              maxLength={300}
              rows={3}
            />

            {/* ── Domain + Log Type ── */}
            <div className="lfm-domain-row">
              <div className="lfm-domain-field">
                <select
                  className="lfm-select lfm-select--pill"
                  value={selectedDomain}
                  onChange={e => handleDomainChange(e.target.value as 'work' | 'personal')}
                >
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div className="lfm-logtype-field">
                {typesLoading ? (
                  <div className="lfm-select-skeleton" />
                ) : typesError ? (
                  <div className="lfm-type-error" style={{ fontSize: 11, padding: '6px 8px' }}>
                    Failed to load.
                    <button className="lfm-retry-btn" onClick={() => refetchTypes()}>Retry</button>
                  </div>
                ) : (
                  <select
                    className={`lfm-select lfm-select--pill${selectedType ? ' lfm-select--has-color' : ''}`}
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


            {/* ── Work chip: Ticket ID ── */}
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


            {/* ── JIRA accordion (work logs only, not break/transit) ── */}
            {showTicketChips && (
              <div className="lfm-optional-section">
                <button
                  type="button"
                  className={`lfm-optional-hdr${jiraOpen ? ' lfm-optional-hdr--open' : ''}`}
                  onClick={toggleJiraAccordion}
                >
                  <svg
                    className="lfm-accordion-chevron"
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <svg width="13" height="13" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
                    <path d="M16 2.67L2.67 16 9.33 22.67 22.67 9.33 16 2.67Z" fill="currentColor"/>
                    <path d="M16 29.33L29.33 16 22.67 9.33 9.33 22.67 16 29.33Z" fill="currentColor" opacity="0.5"/>
                  </svg>
                  <span className="lfm-optional-label">JIRA</span>
                  {linkedTicket && (
                    <span className="lfm-optional-badge">{linkedTicket.key}</span>
                  )}
                </button>

                {jiraOpen && (
                  <div className="lfm-optional-body lfm-jira-body">

                    {/* Linked ticket */}
                    {linkedTicket && (
                      <div className="lfm-jira-linked-chip">
                        <a className="lfm-jira-linked-key" href={linkedTicket.url}
                           target="_blank" rel="noopener noreferrer">
                          {linkedTicket.key}
                        </a>
                        <span className="lfm-jira-linked-summary">{linkedTicket.summary}</span>
                        <button type="button" className="lfm-jira-linked-remove"
                          onClick={() => { setLinkedTicket(null); setJiraResults([]); setTicketId(''); }}
                          title="Remove linked ticket">×</button>
                      </div>
                    )}

                    {jiraConfigured === false && (
                      <div className="lfm-jira-not-configured">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                        </svg>
                        <span>JIRA is not connected.{' '}
                          <a className="lfm-jira-config-link" href="/external-configs/jira"
                             target="_blank" rel="noopener noreferrer">Configure it here</a>
                        </span>
                      </div>
                    )}

                    {jiraConfigured === null && (
                      <div className="lfm-jira-checking"><span className="lfm-spinner" /> Checking JIRA connection…</div>
                    )}

                    {jiraConfigured === true && (
                      <>
                        {queriesLoading && (
                          <div className="lfm-jira-checking"><span className="lfm-spinner" /> Loading saved queries…</div>
                        )}

                        {!queriesLoading && savedQueries.length === 0 && (
                          <div className="lfm-jira-not-configured">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <span>No saved queries yet.{' '}
                              <a className="lfm-jira-config-link" href="/external-configs/jira"
                                 target="_blank" rel="noopener noreferrer">Create one in JIRA settings</a>
                            </span>
                          </div>
                        )}

                        {!queriesLoading && savedQueries.length > 0 && (
                          <div className="lfm-jira-form">
                            <div className="lfm-jira-query-row">
                              <select className="lfm-jira-query-select" value={selectedQueryId}
                                      onChange={e => setSelectedQueryId(e.target.value)}>
                                {savedQueries.map(q => (
                                  <option key={q._id} value={q._id}>{q.name}</option>
                                ))}
                              </select>
                            </div>

                            {jqlEditorOpen ? (
                              <div className="lfm-jira-jql-editor">
                                <textarea className="lfm-jira-jql-textarea" value={editJql}
                                          onChange={e => setEditJql(e.target.value)} rows={3} spellCheck={false} />
                                <button type="button" className="lfm-jira-cancel-edit-btn"
                                        onClick={() => { setJqlEditorOpen(false); setEditJql(selectedQueryJql); }}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              activePlaceholders.length > 0 && (
                                <div className="lfm-jira-placeholders">
                                  {activePlaceholders.map(key => (
                                    <div key={key} className="lfm-jira-placeholder-row">
                                      <label className="lfm-jira-placeholder-label">{`{{${key}}}`}</label>
                                      <input type="text" className="lfm-jira-placeholder-input"
                                             value={placeholderValues[key] ?? ''}
                                             onChange={e => setPlaceholderValues(prev => ({ ...prev, [key]: e.target.value }))}
                                             placeholder={`Enter ${key}`} />
                                    </div>
                                  ))}
                                </div>
                              )
                            )}

                            <div className="lfm-jira-actions-row">
                              <button type="button" className="lfm-jira-fetch-btn"
                                      onClick={() => runSelectedQuery(selectedQueryId)}
                                      disabled={jiraSearching || !selectedQueryId || (!jqlEditorOpen && !allPlaceholdersFilled)}
                                      title={!allPlaceholdersFilled ? 'Fill in all placeholder fields first' : undefined}>
                                {jiraSearching
                                  ? <><span className="lfm-spinner lfm-spinner--dark" />Searching…</>
                                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                     </svg> Search</>
                                }
                              </button>
                              {!jqlEditorOpen && (
                                <button type="button" className="lfm-jira-pencil-btn lfm-jira-pencil-btn--right"
                                        title="Edit JQL"
                                        onClick={() => { setEditJql(selectedQueryJql); setJqlEditorOpen(true); }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {jiraSearchError && <div className="lfm-jira-error">{jiraSearchError}</div>}

                        {jiraResults.length > 0 && (
                          <div className="lfm-jira-results">
                            {jiraResults.map(ticket => {
                              const isLinked = linkedTicket?.id === ticket.id;
                              return (
                                <button key={ticket.id} type="button"
                                        className={`lfm-jira-result-card${isLinked ? ' lfm-jira-result-card--selected' : ''}`}
                                        onClick={() => { setLinkedTicket(ticket); setTicketId(ticket.key); setJiraOpen(false); }}>
                                  <div className="lfm-jira-result-top">
                                    <a className="lfm-jira-result-key" href={ticket.url}
                                       target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                      {ticket.key}
                                    </a>
                                    <span className="lfm-jira-result-status">{ticket.status}</span>
                                    {ticket.storyPoints !== null && (
                                      <span className="lfm-jira-result-sp" title="Story Points">{ticket.storyPoints} SP</span>
                                    )}
                                    {isLinked && (
                                      <svg className="lfm-jira-result-check" width="13" height="13" viewBox="0 0 24 24" fill="none"
                                           stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    )}
                                  </div>
                                  <p className="lfm-jira-result-summary">{ticket.summary}</p>
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
                )}
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
                <span className="lfm-optional-label">optionals</span>
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

          </div>{/* /lfm-body */}

          {/* ── Footer (sticky) ── */}
          <div className="lfm-footer">
            {isEdit && deleteConfirm ? (
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
            ) : (
              <div className="lfm-actions">
                <button type="button" className="lfm-btn-save" disabled={!canSave || saving} onClick={save}>
                  {saving
                    ? (entryType === 'timer' ? 'Starting…' : 'Saving…')
                    : isEdit ? 'Update Log'
                    : entryType === 'timer' ? 'Start Timer'
                    : 'Save'}
                </button>
                {isEdit && (
                  <button type="button" className="lfm-btn-delete lfm-btn-delete--inline" onClick={() => setDeleteConfirm(true)} disabled={saving}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9H3z"
                            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>{/* /lfm-footer */}

        </DialogContent>
      </Dialog>

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
