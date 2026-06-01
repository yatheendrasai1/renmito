import { useState, useMemo } from 'react';
import api from '@/lib/api';
import './ReportPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateBtn(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function isoToDisplay(iso: string): string {
  const d = new Date(iso);
  const dd  = String(d.getUTCDate()).padStart(2,'0');
  const mmm = MONTHS[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  const hh  = String(d.getUTCHours()).padStart(2,'0');
  const mi  = String(d.getUTCMinutes()).padStart(2,'0');
  const ss  = String(d.getUTCSeconds()).padStart(2,'0');
  return `${dd}-${mmm}-${yyyy} ${hh}:${mi}:${ss}`;
}

function displayToISO(display: string): string | null {
  const m = display.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mon, yyyy, hh, mi, ss] = m;
  const idx = MONTHS.findIndex(x => x.toLowerCase() === mon.toLowerCase());
  if (idx === -1) return null;
  return `${yyyy}-${String(idx+1).padStart(2,'0')}-${dd}T${hh}:${mi}:${ss}.000Z`;
}

function parseTimeSpentToMins(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/[wdhm]/i.test(s)) {
    let mins = 0;
    const wm = s.match(/(\d+)\s*w/i); if (wm) mins += parseInt(wm[1]) * 2400;
    const dm = s.match(/(\d+)\s*d/i); if (dm) mins += parseInt(dm[1]) * 480;
    const hm = s.match(/(\d+)\s*h/i); if (hm) mins += parseInt(hm[1]) * 60;
    const mm = s.match(/(\d+)\s*m(?!o)/i); if (mm) mins += parseInt(mm[1]);
    return mins > 0 ? mins : null;
  }
  if (/^\d{1,3}:\d{1,2}$/.test(s)) {
    const [h, mi] = s.split(':').map(Number);
    if (isNaN(h) || isNaN(mi) || mi > 59) return null;
    return h * 60 + mi;
  }
  if (/^\d+(\.\d+)?$/.test(s)) {
    const val = parseFloat(s);
    return val > 0 ? Math.round(val * 60) : null;
  }
  return null;
}

function minsToJira(totalMins: number): string {
  if (totalMins <= 0) return '0m';
  let rem = totalMins;
  const w = Math.floor(rem / 2400); rem %= 2400;
  const d = Math.floor(rem / 480);  rem %= 480;
  const h = Math.floor(rem / 60);   rem %= 60;
  const parts: string[] = [];
  if (w) parts.push(`${w}w`);
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (rem) parts.push(`${rem}m`);
  return parts.join(' ');
}

function formatDayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[d.getUTCDay()]}, ${String(day).padStart(2,'0')} ${MONTHS[month-1]} ${year}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportEntry {
  id: string;
  date: string;
  startAtISO: string;
  durationMins: number | null;
  title: string;
  ticketId: string;
  logType: { id: string; name: string; color: string; category: string | null } | null;
}

interface DayGroup {
  dateStr: string;
  dateLabel: string;
  totalMins: number;
  logs: ReportEntry[];
}

type Preset = 'last10' | 'thisWeek' | 'currentMonth' | 'lastMonth';

// ── Inline mini calendar ──────────────────────────────────────────────────────

interface MiniCalProps {
  rangeFrom: Date | null;
  rangeTo:   Date | null;
  onDateClick: (d: Date) => void;
}

function MiniCal({ rangeFrom, rangeTo, onDateClick }: MiniCalProps) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  return (
    <div className="rpt-mini-cal">
      <div className="rpt-mini-cal-nav">
        <button className="rpt-mini-nav-btn" onClick={prevMonth}>‹</button>
        <span className="rpt-mini-cal-label">{MONTHS[viewMonth]} {viewYear}</span>
        <button className="rpt-mini-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="rpt-mini-cal-grid">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <span key={d} className="rpt-mini-cal-dow">{d}</span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e-${i}`} />;
          const str     = dateToStr(date);
          const fromStr = rangeFrom ? dateToStr(rangeFrom) : null;
          const toStr   = rangeTo   ? dateToStr(rangeTo)   : null;
          const isSel   = str === fromStr || str === toStr;
          const inRange = !!(fromStr && toStr && str > fromStr && str < toStr);
          return (
            <button key={str}
              className={`rpt-mini-cal-day${isSel ? ' rpt-mini-cal-day--sel' : ''}${inRange ? ' rpt-mini-cal-day--range' : ''}`}
              onClick={() => onDateClick(date)}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const [fromDate, setFromDate] = useState<Date>(() => { const d = new Date(today); d.setDate(today.getDate()-6); return d; });
  const [toDate,   setToDate]   = useState<Date>(new Date(today));
  const [startTimeStr, setStartTimeStr] = useState('00:00');
  const [endTimeStr,   setEndTimeStr]   = useState('23:59');

  const [showCal,      setShowCal]      = useState(false);
  const [pendingFrom,  setPendingFrom]  = useState<Date | null>(null);
  const [pendingTo,    setPendingTo]    = useState<Date | null>(null);
  const [pendingStart, setPendingStart] = useState('00:00');
  const [pendingEnd,   setPendingEnd]   = useState('23:59');

  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const [logs,       setLogs]       = useState<ReportEntry[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ticketId: '', startDate: '', timeSpent: '', comment: '' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSaving,   setIsSaving]   = useState(false);
  const [saveError,  setSaveError]  = useState('');

  const [dayTickets,   setDayTickets]   = useState<Record<string, string>>({});
  const [applyingDay,  setApplyingDay]  = useState<string | null>(null);
  const [weekTicket,   setWeekTicket]   = useState('');
  const [applyingWeek, setApplyingWeek] = useState(false);

  // ── Computed ────────────────────────────────────────────────────────────────

  const startDateStr = dateToStr(fromDate);
  const endDateStr   = dateToStr(toDate);
  const rangeLabel   = `${fmtDateBtn(fromDate)} → ${fmtDateBtn(toDate)}`;

  const groupedLogs = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const log of logs) {
      const ds = log.startAtISO.slice(0, 10);
      if (!map.has(ds)) map.set(ds, { dateStr: ds, dateLabel: formatDayLabel(ds), totalMins: 0, logs: [] });
      const g = map.get(ds)!;
      g.logs.push(log);
      g.totalMins += log.durationMins ?? 0;
    }
    return Array.from(map.values());
  }, [logs]);

  const totalMins  = useMemo(() => logs.reduce((s, l) => s + (l.durationMins ?? 0), 0), [logs]);
  const totalJira  = minsToJira(totalMins);
  const activeDays = groupedLogs.filter(g => g.totalMins > 0).length;
  const avgJira    = activeDays > 0 ? minsToJira(Math.round(totalMins / activeDays)) : '—';

  const breakdown = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; totalMins: number }>();
    for (const log of logs) {
      if (!log.logType || !log.durationMins) continue;
      const k = log.logType.id;
      if (!map.has(k)) map.set(k, { id: k, name: log.logType.name, color: log.logType.color, totalMins: 0 });
      map.get(k)!.totalMins += log.durationMins;
    }
    return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
  }, [logs]);

  const pct = (mins: number) => totalMins > 0 ? Math.round(mins / totalMins * 100) : 0;

  const normalizedTimeSpent = useMemo(() => {
    const m = parseTimeSpentToMins(editForm.timeSpent);
    return m !== null ? minsToJira(m) : '';
  }, [editForm.timeSpent]);

  const hasErrors = Object.values(editErrors).some(Boolean);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCal() {
    setPendingFrom(new Date(fromDate));
    setPendingTo(new Date(toDate));
    setPendingStart(startTimeStr);
    setPendingEnd(endTimeStr);
    setShowCal(true);
  }

  function onRangeDateClick(date: Date) {
    if (pendingTo) { setPendingFrom(date); setPendingTo(null); }
    else if (!pendingFrom) setPendingFrom(date);
    else if (date >= pendingFrom) setPendingTo(date);
    else setPendingFrom(date);
  }

  function applyRange() {
    if (!pendingFrom || !pendingTo) return;
    setFromDate(new Date(pendingFrom));
    setToDate(new Date(pendingTo));
    setStartTimeStr(pendingStart);
    setEndTimeStr(pendingEnd);
    setActivePreset(null);
    setShowCal(false);
    doFetch(pendingFrom, pendingTo, pendingStart, pendingEnd);
  }

  function applyPreset(preset: Preset) {
    const t = new Date(today);
    let from!: Date, to = new Date(t);
    switch (preset) {
      case 'last10':       from = new Date(t); from.setDate(t.getDate()-9); break;
      case 'thisWeek':     { const dow = t.getDay()===0?6:t.getDay()-1; from=new Date(t); from.setDate(t.getDate()-dow); break; }
      case 'currentMonth': from = new Date(t.getFullYear(), t.getMonth(), 1); break;
      case 'lastMonth':    from = new Date(t.getFullYear(), t.getMonth()-1, 1); to = new Date(t.getFullYear(), t.getMonth(), 0); break;
    }
    setFromDate(from); setToDate(to);
    setStartTimeStr('00:00'); setEndTimeStr('23:59');
    setActivePreset(preset);
    doFetch(from, to, '00:00', '23:59');
  }

  async function doFetch(from=fromDate, to=toDate, sTime=startTimeStr, eTime=endTimeStr) {
    const sDs = dateToStr(from), eDs = dateToStr(to);
    if (sDs > eDs) { setFetchError('"From" date must be on or before "To" date.'); return; }
    setIsFetching(true); setFetchError(''); setExpandedId(null);
    try {
      const res = await api.get<ReportEntry[]>(`/logs/range?startDate=${sDs}&endDate=${eDs}`);
      const sf = `${sDs}T${sTime}:00.000Z`, ef = `${eDs}T${eTime}:59.999Z`;
      setLogs(res.data.filter(l => l.startAtISO >= sf && l.startAtISO <= ef));
      setHasFetched(true);
    } catch (err: any) {
      setFetchError(err?.response?.data?.error ?? 'Failed to fetch logs.');
    } finally {
      setIsFetching(false);
    }
  }

  function toggleExpand(log: ReportEntry) {
    if (expandedId === log.id) { cancelEdit(); return; }
    setExpandedId(log.id); setEditErrors({}); setSaveError('');
    setEditForm({
      ticketId:  log.ticketId ?? '',
      startDate: isoToDisplay(log.startAtISO),
      timeSpent: log.durationMins ? minsToJira(log.durationMins) : '',
      comment:   log.title ?? '',
    });
  }

  function cancelEdit() { setExpandedId(null); setEditErrors({}); setSaveError(''); }

  function validateFields() {
    const errs: Record<string, string> = {};
    if (!displayToISO(editForm.startDate)) errs.startDate = 'Format must be DD-MMM-YYYY HH:mm:ss';
    const m = parseTimeSpentToMins(editForm.timeSpent);
    if (m === null || m <= 0) errs.timeSpent = 'Enter valid time (e.g. 1h 30m, 1.5, 1:30, 8)';
    setEditErrors(errs);
    return errs;
  }

  async function saveEdit(log: ReportEntry) {
    const errs = validateFields();
    if (Object.values(errs).some(Boolean)) return;
    setIsSaving(true); setSaveError('');
    try {
      const { data: u } = await api.patch<any>(`/logs/${log.id}/report`, {
        title: editForm.comment, ticketId: editForm.ticketId || null,
        startAtISO: displayToISO(editForm.startDate)!,
        durationMins: parseTimeSpentToMins(editForm.timeSpent)!,
      });
      setLogs(prev => prev.map(l => l.id !== log.id ? l : {
        ...l, title: u.title, ticketId: u.ticketId ?? '',
        startAtISO: u.startAtISO, durationMins: u.durationMins,
      }));
      setExpandedId(null); setEditErrors({});
    } catch (err: any) {
      setSaveError(err?.response?.data?.error ?? 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function applyTicketToWeek() {
    const ticketId = weekTicket.trim();
    if (!ticketId || applyingWeek) return;
    setApplyingWeek(true);
    await Promise.allSettled(logs.map(log =>
      api.patch(`/logs/${log.id}/report`, { ticketId }).then(({ data: u }: any) =>
        setLogs(prev => prev.map(l => l.id !== log.id ? l : { ...l, ticketId: u.ticketId ?? ticketId }))
      )
    ));
    setApplyingWeek(false);
  }

  async function applyTicketToDay(group: DayGroup) {
    const ticketId = (dayTickets[group.dateStr] ?? '').trim();
    if (!ticketId || applyingDay) return;
    setApplyingDay(group.dateStr);
    await Promise.allSettled(group.logs.map(log =>
      api.patch(`/logs/${log.id}/report`, { ticketId }).then(({ data: u }: any) =>
        setLogs(prev => prev.map(l => l.id !== log.id ? l : { ...l, ticketId: u.ticketId ?? ticketId }))
      )
    ));
    setApplyingDay(null);
  }

  function exportCSV() {
    const rows = logs.map(log =>
      `"${log.ticketId || 'NA'}","${isoToDisplay(log.startAtISO)}","${log.durationMins ? minsToJira(log.durationMins) : ''}","${(log.title||'').replace(/"/g,'""')}"`
    );
    const csv = ['Ticket No,Start Date,Timespent,Comment', ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a   = document.createElement('a');
    a.href = url; a.download = `work-logs-${startDateStr}-to-${endDateStr}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rpt-wrap">

      {/* ── Range picker overlay ── */}
      {showCal && (
        <div className="rpt-cal-overlay"
             onClick={e => { if ((e.target as HTMLElement).classList.contains('rpt-cal-overlay')) setShowCal(false); }}>
          <div className="rpt-cal-popup">
            <div className="rpt-popup-drag-handle" />
            <div className="rpt-range-hint">
              {!pendingFrom && 'Tap start date'}
              {pendingFrom && !pendingTo && 'Now tap the end date'}
              {pendingFrom && pendingTo && (
                <><strong>{fmtDateBtn(pendingFrom)}</strong> → <strong>{fmtDateBtn(pendingTo)}</strong></>
              )}
            </div>
            <MiniCal rangeFrom={pendingFrom} rangeTo={pendingTo} onDateClick={onRangeDateClick} />
            <div className="rpt-time-row">
              <div className="rpt-time-group">
                <label className="rpt-time-lbl">From time (UTC)</label>
                <input type="time" className="rpt-time-input" value={pendingStart} onChange={e => setPendingStart(e.target.value)} />
              </div>
              <div className="rpt-time-group">
                <label className="rpt-time-lbl">To time (UTC)</label>
                <input type="time" className="rpt-time-input" value={pendingEnd} onChange={e => setPendingEnd(e.target.value)} />
              </div>
            </div>
            <div className="rpt-cal-actions">
              <button className="rpt-cal-cancel" onClick={() => setShowCal(false)}>Cancel</button>
              <button className="rpt-cal-apply"  onClick={applyRange} disabled={!pendingTo}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="rpt-header">
        <span className="rpt-title">Work Log Report</span>
        <button className="rpt-export-btn" disabled={logs.length === 0} onClick={exportCSV}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* ── Range bar ── */}
      <div className="rpt-range-bar">
        <button className="rpt-dt-btn" onClick={openCal}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {rangeLabel}
        </button>
        <button className="rpt-fetch-btn" onClick={() => doFetch()} disabled={isFetching}>
          {isFetching ? 'Loading…' : 'Fetch Logs'}
        </button>
      </div>

      {/* ── Quick presets ── */}
      <div className="rpt-presets">
        {(['last10','thisWeek','currentMonth','lastMonth'] as Preset[]).map(p => (
          <button key={p} className={`rpt-preset-btn${activePreset===p?' rpt-preset-btn--active':''}`} onClick={() => applyPreset(p)}>
            {{'last10':'Last 10 days','thisWeek':'This week','currentMonth':'Current month','lastMonth':'Last month'}[p]}
          </button>
        ))}
      </div>

      {fetchError && <div className="rpt-fetch-error">{fetchError}</div>}

      {/* ── Metrics ── */}
      {hasFetched && logs.length > 0 && !isFetching && (
        <div className="rpt-metrics">
          <div className="rpt-metric-cards">
            {[
              { val: logs.length, lbl: 'Total work logs' },
              { val: totalJira,   lbl: 'Total time logged' },
              { val: avgJira,     lbl: 'Avg. per working day' },
            ].map(c => (
              <div className="rpt-metric-card" key={c.lbl}>
                <span className="rpt-metric-val">{c.val}</span>
                <span className="rpt-metric-lbl">{c.lbl}</span>
              </div>
            ))}
          </div>
          {breakdown.length > 0 && (
            <div className="rpt-breakdown">
              <div className="rpt-breakdown-title">Time by log type</div>
              <div className="rpt-breakdown-list">
                {breakdown.map(bt => (
                  <div className="rpt-breakdown-item" key={bt.id}>
                    <div className="rpt-breakdown-row">
                      <span className="rpt-breakdown-dot" style={{ background: bt.color || '#9B9B9B' }} />
                      <span className="rpt-breakdown-name">{bt.name}</span>
                      <span className="rpt-breakdown-time">{minsToJira(bt.totalMins)}</span>
                      <span className="rpt-breakdown-pct">{pct(bt.totalMins)}%</span>
                    </div>
                    <div className="rpt-breakdown-track">
                      <div className="rpt-breakdown-fill" style={{ width: `${pct(bt.totalMins)}%`, background: bt.color || '#9B9B9B' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bulk apply to range ── */}
      {logs.length > 0 && (
        <div className="rpt-week-apply">
          <input className="rpt-week-ticket-inp" type="text" placeholder="Ticket No (e.g. JA-1001)"
                 value={weekTicket} autoComplete="off" spellCheck={false}
                 onChange={e => setWeekTicket(e.target.value)} />
          <button className="rpt-week-apply-btn" onClick={applyTicketToWeek}
                  disabled={applyingWeek || !weekTicket.trim()}>
            {applyingWeek ? 'Applying…' : 'Apply for the selected date range'}
          </button>
        </div>
      )}

      {/* ── Day-grouped log list ── */}
      {logs.length > 0 && (
        <div className="rpt-list">
          {groupedLogs.map(group => (
            <div className="rpt-day-group" key={group.dateStr}>
              <div className="rpt-day-hdr">
                <div className="rpt-day-hdr-top">
                  <span className="rpt-day-label">{group.dateLabel}</span>
                  {group.totalMins > 0 && <span className="rpt-day-total">{minsToJira(group.totalMins)}</span>}
                </div>
                <div className="rpt-day-apply">
                  <input className="rpt-day-ticket-inp" type="text" placeholder="Ticket No"
                         value={dayTickets[group.dateStr] ?? ''} autoComplete="off" spellCheck={false}
                         onChange={e => setDayTickets(p => ({ ...p, [group.dateStr]: e.target.value }))} />
                  <button className="rpt-day-apply-btn" onClick={() => applyTicketToDay(group)}
                          disabled={applyingDay === group.dateStr || !(dayTickets[group.dateStr] ?? '').trim()}>
                    {applyingDay === group.dateStr ? 'Applying…' : 'Apply to day'}
                  </button>
                </div>
              </div>

              <div className="rpt-day-items">
                {group.logs.map(log => (
                  <div className={`rpt-item${expandedId === log.id ? ' rpt-item--expanded' : ''}`} key={log.id}>
                    <button className="rpt-item-hdr" onClick={() => toggleExpand(log)} aria-expanded={expandedId === log.id}>
                      <svg className="rpt-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d={expandedId === log.id ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}
                              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div className="rpt-item-meta">
                        <div className="rpt-item-meta-row">
                          <span className={`rpt-ticket${!log.ticketId ? ' rpt-ticket--na' : ''}`}>{log.ticketId || 'NA'}</span>
                          {log.durationMins && <span className="rpt-dur">{minsToJira(log.durationMins)}</span>}
                          <span className="rpt-start">{isoToDisplay(log.startAtISO)}</span>
                        </div>
                        <span className="rpt-comment">{log.title}</span>
                      </div>
                      {log.logType && (
                        <span className="rpt-type-badge"
                              style={{ background: `${log.logType.color||'#9B9B9B'}22`, color: log.logType.color||'#9B9B9B' }}>
                          {log.logType.name}
                        </span>
                      )}
                    </button>

                    {expandedId === log.id && (
                      <div className="rpt-item-body">
                        <div className="rpt-edit-grid">
                          <div className="rpt-field">
                            <label className="rpt-field-lbl">Ticket No</label>
                            <input className="rpt-field-inp" type="text" placeholder="e.g. JA-1001 (optional)"
                                   value={editForm.ticketId} autoComplete="off" spellCheck={false}
                                   onChange={e => setEditForm(f => ({ ...f, ticketId: e.target.value }))} />
                          </div>
                          <div className="rpt-field">
                            <label className="rpt-field-lbl">Start Date</label>
                            <input className={`rpt-field-inp${editErrors.startDate ? ' rpt-field-inp--err' : ''}`}
                                   type="text" placeholder="DD-MMM-YYYY HH:mm:ss"
                                   value={editForm.startDate}
                                   onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                                   onBlur={validateFields} />
                            {editErrors.startDate && <span className="rpt-field-err">{editErrors.startDate}</span>}
                          </div>
                          <div className="rpt-field">
                            <label className="rpt-field-lbl">Time Spent</label>
                            <input className={`rpt-field-inp${editErrors.timeSpent ? ' rpt-field-inp--err' : ''}`}
                                   type="text" placeholder="1h 30m · 1.5 · 1:30 · 8"
                                   value={editForm.timeSpent}
                                   onChange={e => setEditForm(f => ({ ...f, timeSpent: e.target.value }))}
                                   onBlur={validateFields} />
                            {!editErrors.timeSpent && normalizedTimeSpent && <span className="rpt-field-hint">→ {normalizedTimeSpent}</span>}
                            {editErrors.timeSpent && <span className="rpt-field-err">{editErrors.timeSpent}</span>}
                          </div>
                          <div className="rpt-field rpt-field--full">
                            <label className="rpt-field-lbl">Comment</label>
                            <textarea className="rpt-field-inp rpt-field-ta" rows={2} placeholder="Activity description"
                                      value={editForm.comment}
                                      onChange={e => setEditForm(f => ({ ...f, comment: e.target.value }))} />
                          </div>
                        </div>
                        <div className="rpt-actions">
                          <button className="rpt-save-btn" onClick={() => saveEdit(log)} disabled={isSaving || hasErrors}>
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="rpt-cancel-btn" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
                          {saveError && <span className="rpt-save-err">{saveError}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {hasFetched && logs.length === 0 && !isFetching && (
        <div className="rpt-empty">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="15" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 3"/>
            <path d="M18 11v7l4 3" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p>No work logs found for this date range.</p>
          <span>Break and transit logs are excluded.</span>
        </div>
      )}
    </div>
  );
}
