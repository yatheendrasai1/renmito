import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useDeleteLog, useUpdateLog } from '@/hooks/useLogs';
import { useLogTypes }                from '@/hooks/useLogTypes';
import LogFormModal                   from './LogFormModal';
import { Input }    from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge }    from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LogEntry, LogType }     from '@/types';
import './LogList.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "4:30 PM" — 12h display for the log row */
function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

/** "HH:MM" in 24h — for <input type="time"> */
function isoToHHMM24(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

function isoToDateStr(iso: string): string {
  return iso.slice(0, 10);
}

function isoCrossesDay(startISO: string, endISO: string | null): boolean {
  if (!endISO) return false;
  return isoToDateStr(startISO) !== isoToDateStr(endISO);
}

function isoSpanDays(startISO: string, endISO: string): number {
  const s = new Date(isoToDateStr(startISO) + 'T00:00:00Z');
  const e = new Date(isoToDateStr(endISO)   + 'T00:00:00Z');
  return Math.round((e.getTime() - s.getTime()) / 86400000);
}

/** "29 May '26" */
function isoToDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
}

/** Full label: "29 May '26 4:30 PM" */
function isoToFullLabel(iso: string): string {
  return `${isoToDayLabel(iso)} ${isoToHHMM(iso)}`;
}

function fmtMins(m: number): string {
  const h = Math.floor(m / 60), min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
}

function formatDuration(mins: number | null): string {
  if (!mins) return '';
  return fmtMins(mins);
}

/** Returns duration chip label — cross-day logs get "Xh+Yh*" or "Nh*" format. */
function formatDurationChip(log: LogEntry): string {
  if (!log.durationMins) return '';
  if (!log.endAt || !isoCrossesDay(log.startAt, log.endAt)) {
    return formatDuration(log.durationMins);
  }
  const spanDays = isoSpanDays(log.startAt, log.endAt);
  if (spanDays > 1) {
    return `${Math.floor(log.durationMins / 60)}h*`;
  }
  const midnight = new Date(isoToDateStr(log.endAt) + 'T00:00:00Z');
  const day1Mins = Math.round((midnight.getTime() - new Date(log.startAt).getTime()) / 60000);
  const day2Mins = Math.round((new Date(log.endAt).getTime() - midnight.getTime()) / 60000);
  return `${fmtMins(day1Mins)}+${fmtMins(day2Mins)}*`;
}

/** Plain text range string — used only in the inline-edit header */
function timeRangeText(log: LogEntry): string {
  const crossDay = isoCrossesDay(log.startAt, log.endAt);
  const startLabel = crossDay ? isoToFullLabel(log.startAt) : isoToHHMM(log.startAt);
  if (log.entryType === 'point' || !log.endAt) return startLabel;
  const endLabel = crossDay ? isoToFullLabel(log.endAt) : isoToHHMM(log.endAt);
  return `${startLabel} – ${endLabel}`;
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

function InlineEditForm({ log, logType, allTypes, date: _date, onClose }: InlineEditProps) {
  // Always use the log's own date so the PUT /logs/:date/:id URL is correct
  const logDate = log.date ?? _date;
  const updateMutation = useUpdateLog(logDate);

  const [title,  setTitle]  = useState(log.title);
  // Prefer the resolved logType (handles DefaultLogType), fall back to log.logType
  const resolveId = (lt: { _id?: string; id?: string } | null | undefined) => lt?._id ?? (lt as { id?: string } | null | undefined)?.id ?? '';
  const [typeId, setTypeId] = useState(resolveId(logType) || resolveId(log.logType));
  const [start,  setStart]  = useState(isoToHHMM(log.startAt));
  const [end,    setEnd]    = useState(isoToHHMM(log.endAt ?? log.startAt));

  const isPoint = log.entryType === 'point';

  function save() {
    const entry: Parameters<typeof updateMutation.mutate>[0]['entry'] = {
      title,
      startTime: start,
      endTime:   isPoint ? start : end,
    };
    if (typeId) entry.logTypeId = typeId;   // omit when empty to avoid 400
    updateMutation.mutate({ id: log.id, entry }, {
      onSuccess: () => { toast('Log updated'); onClose(); },
      onError:   () => toast('Failed to update log'),
    });
  }

  return (
    <div className="tl-edit-form" onClick={e => e.stopPropagation()}>

      <Textarea
        className="tl-edit-title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        autoFocus
      />

      <Select value={typeId} onValueChange={setTypeId}>
        <SelectTrigger className="tl-edit-type-select">
          <SelectValue placeholder="Select type…" />
        </SelectTrigger>
        <SelectContent>
          {allTypes.map(lt => (
            <SelectItem key={lt._id} value={lt._id}>
              {lt.name} ({lt.domain})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="tl-edit-time-row">
        <span className="tl-edit-time-lbl">{isPoint ? 'Time' : 'Start'}</span>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, -15))}>−15</button>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, -5))}>−5</button>
        <Input  className="tl-edit-time-input" value={start} onChange={e => setStart(e.target.value)} maxLength={5}/>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, +5))}>+5</button>
        <button className="tl-edit-step" onClick={() => setStart(addMins(start, +15))}>+15</button>
      </div>

      {!isPoint && (
        <div className="tl-edit-time-row">
          <span className="tl-edit-time-lbl">End</span>
          <button className="tl-edit-step" onClick={() => setEnd(addMins(end, -15))}>−15</button>
          <button className="tl-edit-step" onClick={() => setEnd(addMins(end, -5))}>−5</button>
          <Input  className="tl-edit-time-input" value={end} onChange={e => setEnd(e.target.value)} maxLength={5}/>
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
  const updateMutation = useUpdateLog(log.date);

  const [rowState,      setRowState]      = useState<RowState>('collapsed');
  const [confirming,    setConfirming]    = useState(false);
  const [pickerField,   setPickerField]   = useState<'start' | 'end' | null>(null);
  const [pickerDate,    setPickerDate]    = useState('');
  const [pickerTime,    setPickerTime]    = useState('');
  const [pickerSaving,  setPickerSaving]  = useState(false);
  const cardRef    = useRef<HTMLDivElement>(null);
  const pickerDateRef = useRef<HTMLInputElement>(null);
  const pickerTimeRef = useRef<HTMLInputElement>(null);

  const color    = logType?.color ?? '#6b7280';
  const name     = logType?.name  ?? 'Unknown';
  const hasTitle = !!log.title;
  const isRange  = log.entryType === 'range' && !!log.endAt;

  // Close on outside click
  useEffect(() => {
    const active = rowState !== 'collapsed' || pickerField !== null;
    if (!active) return;
    function handler(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setRowState('collapsed');
        setPickerField(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rowState, pickerField]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCardClick() {
    if (rowState === 'inline-editing' || pickerField) return;
    setRowState('inline-editing');
  }

  function handleChipClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (rowState === 'inline-editing' || pickerField) return;
    setRowState(s => s === 'expanded' ? 'collapsed' : 'expanded');
  }

  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setRowState('inline-editing');
  }

  function handleEditIcon(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit(log);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    deleteMutation.mutate(log.id, {
      onSuccess: () => toast(`Deleted "${name}" log`),
      onError:   () => toast('Failed to delete log'),
    });
    setConfirming(false);
  }

  function openPicker(field: 'start' | 'end', e: React.MouseEvent) {
    e.stopPropagation();
    const iso = field === 'start' ? log.startAt : log.endAt!;
    setPickerDate(isoToDateStr(iso));
    setPickerTime(isoToHHMM24(iso));
    setPickerField(field);
  }

  function closePicker() { setPickerField(null); }

  function savePicker() {
    if (!pickerDate || !pickerTime || pickerSaving) return;
    setPickerSaving(true);
    const entry = pickerField === 'start'
      ? { startTime: pickerTime, date: pickerDate }
      : { endTime: pickerTime, endDate: pickerDate };
    updateMutation.mutate({ id: log.id, entry }, {
      onSuccess: () => { setPickerSaving(false); setPickerField(null); toast('Log updated'); },
      onError:   () => { setPickerSaving(false); toast('Failed to update log'); },
    });
  }

  // ── Inline editing state ───────────────────────────────────────────────────
  if (rowState === 'inline-editing') {
    return (
      // onMouseDown stopPropagation prevents the document outside-click handler
      // from firing when the user interacts with native <select> dropdowns
      <div ref={cardRef} className="tl-item tl-item--editing"
           onMouseDown={e => e.stopPropagation()}>
        <div className="tl-card tl-card--editing">
          <div className="tl-edit-header">
            <span className="log-list-type-chip" style={{ background: color + '28', color }}>
              {name}
            </span>
            <span className="tl-edit-header-time">{timeRangeText(log)}</span>
            <button className="tl-edit-close-btn" onClick={() => setRowState('collapsed')} aria-label="Close">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <InlineEditForm log={log} logType={logType} allTypes={allTypes} date={date}
                          onClose={() => setRowState('collapsed')} />
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

          {/* Top row */}
          <div className="tl-card-top-row">

            <div className="tl-card-chip-time">
              {/* Type chip — click to toggle title expansion */}
              <span
                className="log-list-type-chip"
                style={{ background: color + '28', color }}
                onClick={handleChipClick}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleChipClick(e as unknown as React.MouseEvent); }}
              >
                {name}
              </span>

              {/* Time range — start and end are separately clickable */}
              <div className="tl-timerange" onClick={e => e.stopPropagation()}>
                <button
                  className={`tl-tr-part${pickerField === 'start' ? ' tl-tr-part--active' : ''}`}
                  onClick={e => openPicker('start', e)}
                  title="Edit start time"
                >
                  {isoCrossesDay(log.startAt, log.endAt) ? isoToFullLabel(log.startAt) : isoToHHMM(log.startAt)}
                </button>

                {isRange && (
                  <>
                    <span className="tl-tr-sep">–</span>
                    <button
                      className={`tl-tr-part${pickerField === 'end' ? ' tl-tr-part--active' : ''}`}
                      onClick={e => openPicker('end', e)}
                      title="Edit end time"
                    >
                      {isoCrossesDay(log.startAt, log.endAt) ? isoToFullLabel(log.endAt!) : isoToHHMM(log.endAt!)}
                    </button>
                  </>
                )}
              </div>

              {hasTitle && (
                <span
                  className={`tl-title-chevron${rowState === 'expanded' ? ' tl-title-chevron--open' : ''}`}
                  onClick={handleChipClick}
                  role="button"
                  tabIndex={-1}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </div>

            {log.durationMins != null && (
              <span className="log-list-duration log-list-duration--pinned">
                {formatDurationChip(log)}
              </span>
            )}

            <div className="tl-card-actions">
              <button className="log-list-edit-btn" onClick={handleEditIcon} title="Full edit form">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>

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

          {/* Inline datetime picker — combined button */}
          {pickerField && (
            <div className="tl-dt-picker" onClick={e => e.stopPropagation()}>
              <span className="tl-dt-picker-lbl">{pickerField === 'start' ? 'Start' : 'End'}</span>

              {/* Combined date·time button with hidden inputs */}
              <div className="tl-dt-combined" style={{ position: 'relative', display: 'inline-flex' }}>
                <div className="tl-dt-combined-btn">
                  <button type="button" className="tl-dt-seg tl-dt-seg--date"
                          onClick={() => pickerDateRef.current?.showPicker?.()}>
                    {isoToDayLabel(pickerDate || new Date().toISOString().slice(0,10))}
                  </button>
                  <span className="tl-dt-dot">·</span>
                  <button type="button" className="tl-dt-seg tl-dt-seg--time"
                          onClick={() => pickerTimeRef.current?.showPicker?.()}>
                    {(() => {
                      if (!pickerTime) return '—';
                      const [h, m] = pickerTime.split(':').map(Number);
                      const p = h < 12 ? 'AM' : 'PM';
                      const h12 = h % 12 === 0 ? 12 : h % 12;
                      return `${h12}:${String(m).padStart(2,'0')} ${p}`;
                    })()}
                  </button>
                </div>
                <input ref={pickerDateRef} type="date"
                       style={{ position:'absolute', inset:0, opacity:0, width:'1px', height:'1px', pointerEvents:'none' }}
                       value={pickerDate} onChange={e => setPickerDate(e.target.value)} tabIndex={-1} />
                <input ref={pickerTimeRef} type="time"
                       style={{ position:'absolute', inset:0, opacity:0, width:'1px', height:'1px', pointerEvents:'none' }}
                       value={pickerTime} onChange={e => setPickerTime(e.target.value)} tabIndex={-1} />
              </div>

              <button className="tl-dt-save" onClick={savePicker} disabled={pickerSaving}>
                {pickerSaving ? '…' : 'Save'}
              </button>
              <button className="tl-dt-cancel" onClick={closePicker}>✕</button>
            </div>
          )}

          {/* Title reveal */}
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
  const h = new Date(startAt).getUTCHours();
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
      <Badge variant="secondary" className="log-group-count">{count}</Badge>
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

  const safeTypes = Array.isArray(logTypes) ? logTypes : [];
  const typeMap = new Map(safeTypes.map(lt => [lt._id, lt]));

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
