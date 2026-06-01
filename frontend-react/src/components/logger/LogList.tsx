import { useState, useRef, useEffect } from 'react';
import { useDeleteLog, useUpdateLog } from '@/hooks/useLogs';
import { useLogTypes }                from '@/hooks/useLogTypes';
import { useAppStore }                from '@/store/appStore';
import LogFormModal                   from './LogFormModal';
import type { LogEntry, LogType }     from '@/types';
import './LogList.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(mins: number | null): string {
  if (!mins) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function timeRange(log: LogEntry): string {
  if (log.entryType === 'point') return log.startAt;
  if (!log.endAt) return log.startAt;
  return `${log.startAt} – ${log.endAt}`;
}

function addMins(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total  = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + delta));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ── Row state ─────────────────────────────────────────────────────────────────
// collapsed      → default view
// expanded       → title text revealed; clicking outside collapses
// inline-editing → quick-edit form in place

type RowState = 'collapsed' | 'expanded' | 'inline-editing';

// ── Inline Edit Form (quick-edit, in-place) ────────────────────────────────────

interface InlineEditProps {
  log:         LogEntry;
  logType:     LogType | undefined;
  allTypes:    LogType[];
  date:        string;
  onClose:     () => void;
}

function InlineEditForm({ log, logType, allTypes, date, onClose }: InlineEditProps) {
  const updateMutation = useUpdateLog(date);
  const showToast      = useAppStore(s => s.showToast);

  const [title,  setTitle]  = useState(log.title);
  // Prefer the resolved logType (handles DefaultLogType), fall back to log.logType
  const [typeId, setTypeId] = useState(logType?._id ?? log.logType?._id ?? '');
  const [start,  setStart]  = useState(log.startAt);
  const [end,    setEnd]    = useState(log.endAt ?? log.startAt);

  const isPoint = log.entryType === 'point';

  function save() {
    updateMutation.mutate({
      id: log.id,
      entry: {
        title,
        logTypeId: typeId,
        startTime: start,
        endTime:   isPoint ? start : end,
      },
    }, {
      onSuccess: () => { showToast('Log updated'); onClose(); },
      onError:   () => showToast('Failed to update log'),
    });
  }

  return (
    <div className="tl-edit-form" onClick={e => e.stopPropagation()}>

      <textarea
        className="tl-edit-title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        autoFocus
      />

      <select
        className="tl-edit-type-select"
        value={typeId}
        onChange={e => setTypeId(e.target.value)}
      >
        <option value="" disabled>Select type…</option>
        {allTypes.map(lt => (
          <option key={lt._id} value={lt._id}>{lt.name} ({lt.domain})</option>
        ))}
      </select>

      <div className="tl-edit-time-row">
        <span className="tl-edit-time-lbl">{isPoint ? 'Time' : 'Start'}</span>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, -15))}>−15</button>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, -5))}>−5</button>
        <input  className="tl-edit-time-input" value={start} onChange={e => setStart(e.target.value)} maxLength={5}/>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, +5))}>+5</button>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, +15))}>+15</button>
      </div>

      {!isPoint && (
        <div className="tl-edit-time-row">
          <span className="tl-edit-time-lbl">End</span>
          <button className="tl-edit-step" onClick={() => setEnd(addMins(end, -15))}>−15</button>
          <button className="tl-edit-step" onClick={() => setEnd(addMins(end, -5))}>−5</button>
          <input  className="tl-edit-time-input" value={end} onChange={e => setEnd(e.target.value)} maxLength={5}/>
          <button className="tl-edit-step" onClick={() => setEnd(addMins(end, +5))}>+5</button>
          <button className="tl-edit-step" onClick={() => setEnd(addMins(end, +15))}>+15</button>
        </div>
      )}

      <div className="tl-edit-actions">
        <button className="tl-edit-cancel" onClick={onClose}>Cancel</button>
        <button className="tl-edit-save" onClick={save} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ── Log Row ───────────────────────────────────────────────────────────────────

interface RowProps {
  log:      LogEntry;
  logType:  LogType | undefined;
  allTypes: LogType[];
  date:     string;
  onEdit:   (log: LogEntry) => void;   // opens full LogFormModal
}

function LogRow({ log, logType, allTypes, date, onEdit }: RowProps) {
  const deleteMutation = useDeleteLog(date);
  const showToast      = useAppStore(s => s.showToast);

  const [rowState,   setRowState]   = useState<RowState>('collapsed');
  const [confirming, setConfirming] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const color    = logType?.color ?? '#6b7280';
  const name     = logType?.name  ?? 'Unknown';
  const hasTitle = !!log.title;

  // Collapse / close when clicking outside the card (expanded or inline-editing)
  useEffect(() => {
    if (rowState !== 'expanded' && rowState !== 'inline-editing') return;
    function handler(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setRowState('collapsed');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rowState]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Card background / empty-space click → open inline edit */
  function handleCardClick() {
    if (rowState === 'inline-editing') return;
    setRowState('inline-editing');
  }

  /** Chip + time area click → toggle expanded / collapsed */
  function handleChipTimeClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (rowState === 'inline-editing') return;
    setRowState(s => s === 'expanded' ? 'collapsed' : 'expanded');
  }

  /** Clicking the revealed title while expanded → open inline edit */
  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setRowState('inline-editing');
  }

  /** Edit icon → full LogFormModal */
  function handleEditIcon(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit(log);
  }

  /** Delete icon */
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    deleteMutation.mutate(log.id, {
      onSuccess: () => showToast(`Deleted "${name}" log`),
      onError:   () => showToast('Failed to delete log'),
    });
    setConfirming(false);
  }

  // ── Inline editing state ───────────────────────────────────────────────────
  if (rowState === 'inline-editing') {
    return (
      <div ref={cardRef} className="tl-item tl-item--editing">
        <div className="tl-card tl-card--editing">
          {/* Mini header: type chip + time, close button */}
          <div className="tl-edit-header">
            <span className="log-list-type-chip" style={{ background: color + '28', color }}>
              {name}
            </span>
            <span className="tl-edit-header-time">{timeRange(log)}</span>
            <button
              className="tl-edit-close-btn"
              onClick={() => setRowState('collapsed')}
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <InlineEditForm
            log={log}
            logType={logType}
            allTypes={allTypes}
            date={date}
            onClose={() => setRowState('collapsed')}
          />
        </div>
      </div>
    );
  }

  // ── Normal (collapsed / expanded) ─────────────────────────────────────────
  return (
    <div
      ref={cardRef}
      className={`tl-item${rowState === 'expanded' ? ' tl-item--expanded' : ''}`}
      onClick={handleCardClick}
    >
      <div className="tl-card">
        <div className="tl-card-body">

          {/* Top row ─ chip+time (expansion toggle) │ action buttons */}
          <div className="tl-card-top-row">

            {/* Clicking here toggles title expansion */}
            <div
              className="tl-card-chip-time"
              onClick={handleChipTimeClick}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setRowState(s => s === 'expanded' ? 'collapsed' : 'expanded'); } }}
            >
              <span className="log-list-type-chip" style={{ background: color + '28', color }}>
                {name}
              </span>
              <span className="log-list-time">{timeRange(log)}</span>
              {hasTitle && (
                <span className={`tl-title-chevron${rowState === 'expanded' ? ' tl-title-chevron--open' : ''}`}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </div>

            {/* Duration — pinned right, left of action buttons */}
            {log.durationMins != null && (
              <span className="log-list-duration log-list-duration--pinned">
                {formatDuration(log.durationMins)}
              </span>
            )}

            {/* Action buttons */}
            <div className="tl-card-actions">
              {/* Edit → full LogFormModal */}
              <button
                className="log-list-edit-btn"
                onClick={handleEditIcon}
                title="Full edit form"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>

              {/* Delete */}
              <button
                className={`log-list-delete-btn${confirming ? ' log-list-delete-btn--confirm' : ''}`}
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                title={confirming ? 'Tap again to confirm' : 'Delete'}
              >
                {confirming ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Title text — revealed when expanded; clicking it opens inline edit */}
          {rowState === 'expanded' && hasTitle && (
            <p className="log-list-title-reveal" onClick={handleTitleClick}>
              {log.title}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Period grouping ───────────────────────────────────────────────────────────

const PERIOD_ORDER_DESC = ['Night', 'Evening', 'Afternoon', 'Morning', 'Late Night'];

function periodOf(startAt: string): string {
  const h = parseInt(startAt.split(':')[0], 10);
  if (h < 6)             return 'Late Night';
  if (h >= 6  && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}

function groupByPeriod(logs: LogEntry[]): { period: string; logs: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const p = periodOf(log.startAt);
    if (!map.has(p)) map.set(p, []);
    map.get(p)!.push(log);
  }
  return PERIOD_ORDER_DESC.filter(p => map.has(p)).map(p => ({ period: p, logs: map.get(p)! }));
}

// ── Group header ──────────────────────────────────────────────────────────────

function GroupHeader({ period, count, collapsed, onToggle }: {
  period: string; count: number; collapsed: boolean; onToggle: () => void;
}) {
  return (
    <div className="log-group-header" onClick={onToggle}>
      <button className="log-group-collapse-btn" tabIndex={-1}>
        <svg
          className={`log-group-chevron${collapsed ? ' log-group-chevron--collapsed' : ''}`}
          width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <span className="log-group-label">{period.toUpperCase()}</span>
      <span className="log-group-count">{count}</span>
      <div className="log-group-line" />
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="log-list-skeleton">
      {[1, 2, 3].map(i => (
        <div key={i} className="tl-skeleton-row">
          <div className="tl-sk-card" />
        </div>
      ))}
    </div>
  );
}

// ── LogList ───────────────────────────────────────────────────────────────────

interface Props {
  logs:      LogEntry[];
  logTypes:  LogType[];
  isLoading: boolean;
  date:      string;
}

export default function LogList({ logs, logTypes, isLoading, date }: Props) {
  const { data: allTypes = [] } = useLogTypes();

  const [editLog,        setEditLog]        = useState<LogEntry | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const typeMap = new Map(logTypes.map(lt => [lt._id, lt]));

  function toggleGroup(period: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(period) ? next.delete(period) : next.add(period);
      return next;
    });
  }

  if (isLoading) return <Skeleton />;

  if (!logs.length) {
    return (
      <div className="log-list-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
             style={{ opacity: 0.35 }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8"  x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>No logs for this day</p>
        <span>Tap the + button to add one</span>
      </div>
    );
  }

  const sorted = [...logs].sort((a, b) => b.startAt.localeCompare(a.startAt));
  const groups = groupByPeriod(sorted);

  return (
    <>
      <div className="log-list">
        {groups.map(({ period, logs: groupLogs }) => {
          const collapsed = collapsedGroups.has(period);
          return (
            <div key={period} className="log-group">
              <GroupHeader
                period={period}
                count={groupLogs.length}
                collapsed={collapsed}
                onToggle={() => toggleGroup(period)}
              />
              {!collapsed && groupLogs.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  logType={log.logType ?? typeMap.get((log.logType as import('@/types').LogType | null)?._id ?? '') ?? undefined}
                  allTypes={allTypes}
                  date={date}
                  onEdit={setEditLog}
                />
              ))}
            </div>
          );
        })}
      </div>

      {editLog && (
        <LogFormModal
          mode="edit"
          date={editLog.date ?? date}
          editEntry={editLog}
          onClose={() => setEditLog(null)}
        />
      )}
    </>
  );
}
