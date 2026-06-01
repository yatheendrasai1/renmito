import { useState, useEffect } from 'react';
import { useLogTypes } from '@/hooks/useLogTypes';
import type { LogEntry, DayType } from '@/types';
import './MetricsCards.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fmtMins(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const BREAK_DAYS: DayType[] = ['holiday', 'paid_leave', 'sick_leave'];
const TARGET_MINS = 480; // 8 h

interface Breakdown {
  id:        string;
  name:      string;
  color:     string;
  domain:    string;
  totalMins: number;
}

// ── Breakdown popup ───────────────────────────────────────────────────────────

interface PopupProps {
  logs:     LogEntry[];
  typeMap:  Map<string, import('@/types').LogType>;
  date:     string;          // YYYY-MM-DD
  dayType:  DayType;
  onClose:  () => void;
}

function BreakdownPopup({ logs, typeMap, date, dayType, onClose }: PopupProps) {
  const [profExpanded, setProfExpanded] = useState(false);
  const [persExpanded, setPersExpanded] = useState(false);

  // Close on outside click
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler, { passive: true });
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  // Resolve log type — prefer populated field, fall back to typeMap lookup
  function resolveType(log: LogEntry) {
    if (log.logType) return log.logType;
    const id = (log as unknown as { logTypeId?: string }).logTypeId ?? '';
    return typeMap.get(id) ?? null;
  }

  // Total tracked work mins
  const totalWorkMins = logs
    .filter(l => {
      const lt = resolveType(l);
      return l.entryType !== 'point' && l.endAt &&
        lt?.domain === 'work' && lt?.category !== 'transit' && lt?.category !== 'break';
    })
    .reduce((s, l) => s + Math.max(0, toMins(l.endAt!) - toMins(l.startAt)), 0);

  // All-log breakdown (by type)
  const breakdownMap = new Map<string, Breakdown>();
  for (const log of logs) {
    if (log.entryType === 'point' || !log.endAt) continue;
    const lt = resolveType(log);
    if (!lt) continue;
    const mins = Math.max(0, toMins(log.endAt) - toMins(log.startAt));
    if (!mins) continue;
    const key = lt._id;
    if (!breakdownMap.has(key)) {
      breakdownMap.set(key, {
        id: key, name: lt.name,
        color: lt.color, domain: lt.domain,
        totalMins: 0,
      });
    }
    breakdownMap.get(key)!.totalMins += mins;
  }
  const breakdown  = [...breakdownMap.values()].sort((a, b) => b.totalMins - a.totalMins);
  const profItems  = breakdown.filter(b => b.domain === 'work');
  const persItems  = breakdown.filter(b => b.domain !== 'work');

  const summaryFill    = totalWorkMins <= TARGET_MINS
    ? totalWorkMins / TARGET_MINS * 100
    : TARGET_MINS    / totalWorkMins * 100;
  const overflowFill   = totalWorkMins > TARGET_MINS
    ? (totalWorkMins - TARGET_MINS) / totalWorkMins * 100
    : 0;

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const DAY_TYPE_LABELS: Record<DayType, { label: string; color: string }> = {
    working:    { label: 'Working Day', color: '#4ade80' },
    wfh:        { label: 'WFH',         color: '#60a5fa' },
    holiday:    { label: 'Holiday',     color: '#f87171' },
    paid_leave: { label: 'Paid Leave',  color: '#facc15' },
    sick_leave: { label: 'Sick Leave',  color: '#fb923c' },
  };
  const dtInfo = DAY_TYPE_LABELS[dayType] ?? DAY_TYPE_LABELS.working;

  return (
    <>
      <div className="metrics-popup-overlay" onClick={e => { e.stopPropagation(); onClose(); }} />
      <div className="metrics-popup" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="metrics-popup-header">
          <div className="metrics-popup-meta">
            <span className="metrics-popup-date">{formattedDate}</span>
            <div className="metrics-popup-daytype">
              <span className="mp-daytype-dot" style={{ background: dtInfo.color }} />
              {dtInfo.label}
            </div>
          </div>
          <button className="metrics-popup-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {breakdown.length > 0 ? (
          <>
            {/* Summary bar */}
            <div className="breakdown-summary-hdr">
              <div className="bsh-row">
                <span className="bsh-label">Total Logged</span>
                <span className="bsh-logged">{fmtMins(totalWorkMins)}</span>
                <span className="bsh-sep">/</span>
                <span className="bsh-target">8h target</span>
                {totalWorkMins > TARGET_MINS && (
                  <span className="bsh-overflow-lbl">
                    ↑ {(Math.round(totalWorkMins / TARGET_MINS * 10) / 10).toFixed(1)}x
                  </span>
                )}
              </div>
              <div className="bsh-track">
                <div className="bsh-fill"
                     style={{ width: `${summaryFill}%`, background: totalWorkMins >= TARGET_MINS ? '#a3d4ac' : '#93b8de' }} />
                {overflowFill > 0 && (
                  <div className="bsh-fill bsh-fill--overflow" style={{ width: `${overflowFill}%` }} />
                )}
              </div>
            </div>

            {/* Professional */}
            {profItems.length > 0 && (
              <BreakdownSection
                title="Professional"
                items={profItems}
                expanded={profExpanded}
                onToggleExpand={() => setProfExpanded(v => !v)}
                bordered={false}
              />
            )}

            {/* Personal */}
            {persItems.length > 0 && (
              <BreakdownSection
                title="Personal"
                items={persItems}
                expanded={persExpanded}
                onToggleExpand={() => setPersExpanded(v => !v)}
                bordered={profItems.length > 0}
              />
            )}
          </>
        ) : (
          <div className="breakdown-empty">No logs recorded for this day.</div>
        )}

      </div>
    </>
  );
}

interface SectionProps {
  title:           string;
  items:           Breakdown[];
  expanded:        boolean;
  onToggleExpand:  () => void;
  bordered:        boolean;
}

function BreakdownSection({ title, items, expanded, onToggleExpand, bordered }: SectionProps) {
  const visible   = expanded ? items : items.slice(0, 4);
  const sectionTotal = items.reduce((s, b) => s + b.totalMins, 0);

  return (
    <>
      <div className={`breakdown-section-header${bordered ? ' breakdown-section-header--bordered' : ''}`}>
        <span className="breakdown-section-label">{title}</span>
        <span className="breakdown-section-total">{fmtMins(sectionTotal)}</span>
      </div>
      <div className="breakdown-list">
        {visible.map(bt => (
          <div key={bt.id} className="breakdown-item">
            <div className="breakdown-row">
              <span className="breakdown-dot" style={{ background: bt.color || '#9B9B9B' }} />
              <span className="breakdown-name">{bt.name}</span>
              <span className="breakdown-time">{fmtMins(bt.totalMins)}</span>
              <span className="breakdown-pct" style={{ color: bt.color || '#9B9B9B' }}>
                {Math.round(bt.totalMins / 1440 * 100)}%
              </span>
            </div>
            <div className="breakdown-track">
              <div className="breakdown-fill"
                   style={{ width: `${Math.min(100, bt.totalMins / 1440 * 100)}%`, background: bt.color || '#9B9B9B' }} />
            </div>
          </div>
        ))}
      </div>
      {items.length > 4 && (
        <button className="breakdown-expand-btn" onClick={e => { e.stopPropagation(); onToggleExpand(); }}>
          {expanded
            ? <>Show less <ChevronUp /></>
            : <>Show {items.length - 4} more <ChevronDown /></>
          }
        </button>
      )}
      <div className="breakdown-footnote">% of 24h day</div>
    </>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ChevronUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── MetricsCards ──────────────────────────────────────────────────────────────

interface Props {
  logs:     LogEntry[];
  dayType:  DayType | undefined;
  date:     string;   // YYYY-MM-DD
}

export default function MetricsCards({ logs, dayType, date }: Props) {
  const [popupOpen, setPopupOpen] = useState(false);
  const { data: allTypes = [] } = useLogTypes();

  const typeMap = new Map(allTypes.map(lt => [lt._id, lt]));

  const resolvedDayType = dayType ?? 'working';
  const isBreakDay = BREAK_DAYS.includes(resolvedDayType);

  // Work hours: range logs, domain=work, not transit/break
  const totalWorkMins = logs
    .filter(l => {
      const lt = l.logType
        ? l.logType
        : typeMap.get((l as unknown as { logTypeId?: string }).logTypeId ?? '') ?? null;
      return l.entryType !== 'point' && l.endAt &&
        lt?.domain === 'work' && lt?.category !== 'transit' && lt?.category !== 'break';
    })
    .reduce((s, l) => s + Math.max(0, toMins(l.endAt!) - toMins(l.startAt)), 0);

  const totalWorkHours = totalWorkMins / 60;
  const coveragePct    = Math.round((totalWorkHours / 8) * 100);
  const coverageBarPct = Math.min(100, coveragePct);
  const remainingMins  = Math.max(0, TARGET_MINS - totalWorkMins);

  // ── Break-day layout ──────────────────────────────────────────────────────
  if (isBreakDay) {
    if (totalWorkMins > 0) {
      return (
        <div className="summary-cards">
          <div className="summary-card summary-card--break-logged">
            <span className="summary-label">Logged</span>
            <span className="summary-val">{fmtMins(totalWorkMins)}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="summary-cards">
        <div className="summary-card summary-card--break-msg">
          <span className="break-msg-text">
            {resolvedDayType === 'sick_leave'
              ? "Really sick? I mean sick sick? JK! take care! :-)"
              : "Take a break. you deserve this! focus on your 'ME' Time"}
          </span>
        </div>
      </div>
    );
  }

  // ── Normal working-day layout ─────────────────────────────────────────────
  return (
    <div className="metrics-wrapper">
      <div className="summary-cards">

        {/* Coverage — clickable → opens breakdown popup */}
        <div
          className="summary-card summary-card--clickable"
          onClick={e => { e.stopPropagation(); setPopupOpen(v => !v); }}
        >
          <div className="summary-card-header-row">
            <span className="summary-label">
              Coverage <span className="summary-baseline">(8h)</span>
            </span>
            <svg
              className={`summary-chevron${popupOpen ? ' summary-chevron--open' : ''}`}
              width="11" height="11" viewBox="0 0 12 12" fill="none"
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="summary-val">{coveragePct}%</span>
          <div className="coverage-bar-track">
            <div
              className="coverage-bar-fill"
              style={{
                width:      `${coverageBarPct}%`,
                background: coveragePct >= 100 ? '#a3d4ac' : '#93b8de',
              }}
            />
          </div>
        </div>

        {/* Logged */}
        <div className="summary-card">
          <span className="summary-label">Logged</span>
          <span className="summary-val">{fmtMins(totalWorkMins)}</span>
        </div>

        {/* Remaining */}
        <div className="summary-card">
          <span className="summary-label">Remaining</span>
          {remainingMins <= 0
            ? <span className="summary-val summary-val--goal-met">Goal met ✓</span>
            : <span className="summary-val">{fmtMins(remainingMins)}</span>
          }
        </div>
      </div>

      {/* Breakdown popup */}
      {popupOpen && (
        <BreakdownPopup
          logs={logs}
          typeMap={typeMap}
          date={date}
          dayType={resolvedDayType}
          onClose={() => setPopupOpen(false)}
        />
      )}
    </div>
  );
}
