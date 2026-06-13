import { useState, useRef, useCallback, useEffect } from 'react';
import type { LogEntry, LogType } from '@/types';
import './SleepFoodTimeline.css';

// ── Constants ─────────────────────────────────────────────────────────────────

// Timeline window: 00:00 → 23:59 (midnight to midnight)
const WINDOW_START_MINS = 0;
const WINDOW_END_MINS   = 24 * 60; // 1440
const WINDOW_SPAN       = WINDOW_END_MINS - WINDOW_START_MINS; // 1440

// Pastel milestone colours
const MILESTONE_COLORS: Record<string, string> = {
  'Woke Up':     '#A8C5B5',
  'Slept':       '#B0A8D4',
  'Breakfast':   '#E8B896',
  'Lunch':       '#8DC4DE',
  'Dinner':      '#C4AED8',
  'Food Intake': '#E89898',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return -1;
  return d.getHours() * 60 + d.getMinutes();
}

function minsToFrac(mins: number): number {
  return Math.max(0, Math.min(1, mins / WINDOW_SPAN));
}

function fracToMins(frac: number): number {
  return Math.round(frac * WINDOW_SPAN + WINDOW_START_MINS) % 1440;
}

function minsToHHMM(totalMins: number): string {
  const m = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function isoToHHMM12(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours(), m = d.getMinutes();
  const p = h < 12 ? 'am' : 'pm';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${p}`;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function nowHHMM12(): string {
  const d = new Date();
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtGap(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ── Milestone extraction ──────────────────────────────────────────────────────

interface Milestone {
  key:    string;
  label:  string;
  time:   string;
  frac:   number;
  mins:   number;   // adjusted minutes within the window
  color:  string;
  entry:  LogEntry;
  beyond: boolean;  // true when time falls outside the visible window (clamped to right edge)
}

function normName(s: string) { return s.toLowerCase().trim(); }

function isoToLocalYMD(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function extractMilestones(logs: LogEntry[], nextDayLogs: LogEntry[], selectedDate: string): Milestone[] {
  const milestones: Milestone[] = [];

  const push = (label: string, iso: string, key: string, entry: LogEntry, beyond = false) => {
    const raw = isoToMinutes(iso);
    if (raw < 0) return;
    milestones.push({
      key,
      label,
      time:   isoToHHMM12(iso),
      frac:   beyond ? 1 : minsToFrac(raw),
      mins:   beyond ? WINDOW_END_MINS : raw,
      color:  MILESTONE_COLORS[label] ?? '#A0A0A0',
      entry,
      beyond,
    });
  };

  logs.forEach(log => {
    const name = normName(log.logType?.name ?? log.title ?? '');
    const cat  = log.logType?.category ?? '';

    if (cat === 'sleep' && name.includes('sleep')) {
      if (log.endAt) push('Woke Up', log.endAt, `woke-${log.id}`, log);
      if (log.startAt) {
        const h = new Date(log.startAt).getHours();
        // Only show "Slept" if the sleep actually started on selectedDate (not a previous night spilling over)
        if (h >= 18 && isoToLocalYMD(log.startAt) === selectedDate) {
          push('Slept', log.startAt, `slept-${log.id}`, log);
        }
      }
    }
    if (cat === 'food' && name.includes('breakfast'))   push('Breakfast',   log.startAt, `breakfast-${log.id}`,   log);
    if (cat === 'food' && name.includes('lunch'))       push('Lunch',       log.startAt, `lunch-${log.id}`,       log);
    if (cat === 'food' && name.includes('dinner'))      push('Dinner',      log.startAt, `dinner-${log.id}`,      log);
    if (cat === 'food' && name.includes('food intake')) push('Food Intake', log.startAt, `foodintake-${log.id}`,  log);
  });

  // Slept (next-day): sleep that started 00:00–05:59 on the next day falls within
  // the 6pm→6am window but lives in the next day's log list.
  // Hours 00:00–03:59 land within the visible window; 04:00–05:59 are beyond → pin to edge.
  nextDayLogs.forEach(log => {
    const name = normName(log.logType?.name ?? log.title ?? '');
    const cat  = log.logType?.category ?? '';
    if (cat === 'sleep' && name.includes('sleep') && log.startAt) {
      const h = new Date(log.startAt).getHours();
      if (h < 6) {
        // Any sleep starting after midnight is "beyond" the current day — pin to right edge
        push('Slept', log.startAt, `slept-next-${log.id}`, log, true);
      }
    }
  });

  return milestones.sort((a, b) => a.frac - b.frac);
}

// ── Overlap resolution ────────────────────────────────────────────────────────

const OVERLAP_THRESHOLD = 0.11;
type Side = 'above' | 'below';

function assignSides(milestones: Milestone[]): Side[] {
  const sides: Side[] = [];
  let lastBelow = -Infinity;
  let lastAbove = -Infinity;

  for (const m of milestones) {
    const belowClear = m.frac - lastBelow >= OVERLAP_THRESHOLD;
    const aboveClear = m.frac - lastAbove >= OVERLAP_THRESHOLD;

    let side: Side;
    if (belowClear && aboveClear) {
      side = 'below';
    } else if (belowClear) {
      side = 'below';
    } else if (aboveClear) {
      side = 'above';
    } else {
      side = lastBelow < lastAbove ? 'below' : 'above';
    }

    sides.push(side);
    if (side === 'below') lastBelow = m.frac; else lastAbove = m.frac;
  }
  return sides;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  milestone: Milestone;
  onEdit:    (entry: LogEntry) => void;
  onClose:   () => void;
}

function MilestoneTooltip({ milestone, onEdit, onClose }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div className="sft-tooltip" ref={ref}>
      <button
        className="sft-tooltip-body"
        onClick={() => { onClose(); onEdit(milestone.entry); }}
      >
        <span className="sft-tooltip-label" style={{ color: milestone.color }}>
          {milestone.label}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </span>
        <span className="sft-tooltip-time" style={{ color: milestone.color }}>{milestone.time}</span>
      </button>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  logs:         LogEntry[];
  nextDayLogs:  LogEntry[];      // logs for selectedDate+1, used to find the "Slept" milestone
  logTypes:     LogType[];
  selectedDate: string;          // YYYY-MM-DD
  onEdit:       (entry: LogEntry) => void;
  onAdd:        (startTime?: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SleepFoodTimeline({ logs, nextDayLogs, selectedDate, onEdit, onAdd }: Props) {
  const milestones = extractMilestones(logs, nextDayLogs, selectedDate);
  const sides      = assignSides(milestones);

  const isToday = selectedDate === todayYMD();
  const nowFrac = isToday ? minsToFrac(nowMinutes()) : 1;

  const [tooltip, setTooltip] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.sft-milestone')) return;
    if (!trackRef.current) { onAdd(); return; }
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const mins = fracToMins(frac);
    onAdd(minsToHHMM(mins));
  }, [onAdd]);

  const toggleTooltip = useCallback((key: string) => {
    setTooltip(prev => prev === key ? null : key);
  }, []);

  const closeTooltip = useCallback(() => setTooltip(null), []);

  return (
    <div className="sft-card">
      <div className="sft-header">
        <span className="sft-title">Timeline</span>
        <span className="sft-subtitle">{isToday ? "Today's rhythm" : "Day's rhythm"}</span>
      </div>

      <div className="sft-track-area" ref={trackRef}>
        <div className="sft-track" onClick={handleTrackClick}>
          {/* Progress fill */}
          <div className="sft-fill" style={{ width: `${nowFrac * 100}%` }} />

          {/* Current time dot + label — today only */}
          {isToday && (
            <div className="sft-now-wrap" style={{ left: `${nowFrac * 100}%` }}>
              <span className="sft-now-time">{nowHHMM12()}</span>
              <div className="sft-now-dot" />
            </div>
          )}

          {/* Gap labels — only for the currently selected milestone's neighbours */}
          {(() => {
            const activeIdx = tooltip ? milestones.findIndex(m => m.key === tooltip) : -1;
            if (activeIdx < 0) return null;
            const active = milestones[activeIdx];
            const prev   = activeIdx > 0 ? milestones[activeIdx - 1] : null;
            const next   = activeIdx < milestones.length - 1 ? milestones[activeIdx + 1] : null;
            return (
              <>
                {prev && (active.mins - prev.mins) >= 120 && (
                  <div
                    className="sft-gap-label"
                    style={{ left: `${(prev.frac + active.frac) / 2 * 100}%`, color: active.color }}
                  >
                    {fmtGap(active.mins - prev.mins)}
                  </div>
                )}
                {next && (next.mins - active.mins) >= 120 && (
                  <div
                    className="sft-gap-label"
                    style={{ left: `${(active.frac + next.frac) / 2 * 100}%`, color: active.color }}
                  >
                    {fmtGap(next.mins - active.mins)}
                  </div>
                )}
              </>
            );
          })()}

          {/* Milestones */}
          {milestones.map((m, i) => {
            const side = sides[i];
            return (
              <div
                key={m.key}
                className={`sft-milestone sft-milestone--${side}${m.beyond ? ' sft-milestone--beyond' : ''}`}
                style={{ left: `${m.frac * 100}%`, color: m.color } as React.CSSProperties}
              >
                {side === 'above' && (
                  <div className="sft-milestone-label sft-milestone-label--above">
                    <span className="sft-ml-name" style={{ color: m.color }}>{m.label}</span>
                    <span className="sft-ml-time">{m.time}</span>
                    {m.beyond && <span className="sft-ml-nextday">next day</span>}
                  </div>
                )}

                <button
                  className={`sft-milestone-dot${m.beyond ? ' sft-milestone-dot--beyond' : ''}`}
                  style={{ borderColor: m.color, boxShadow: m.beyond ? 'none' : `inset 0 0 0 4px ${m.color}` }}
                  onClick={e => { e.stopPropagation(); toggleTooltip(m.key); }}
                  aria-label={`${m.label} at ${m.time}`}
                />

                {tooltip === m.key && (
                  <MilestoneTooltip
                    milestone={m}
                    onEdit={onEdit}
                    onClose={closeTooltip}
                  />
                )}

                {side === 'below' && (
                  <div className="sft-milestone-label sft-milestone-label--below">
                    <span className="sft-ml-name" style={{ color: m.color }}>{m.label}</span>
                    <span className="sft-ml-time">{m.time}</span>
                    {m.beyond && <span className="sft-ml-nextday">next day</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {milestones.length === 0 && (
        <p className="sft-empty">Log sleep &amp; meals to see your day's rhythm here.</p>
      )}
    </div>
  );
}
