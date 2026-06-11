import { useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient }          from '@tanstack/react-query';
import { useLogs, useUpdateLog, useCreateLog } from '@/hooks/useLogs';
import { localToISOString } from '@/lib/time';
import { useDayMetadata, useCaptureDayMeta }   from '@/hooks/useDayMetadata';
import { useLogTypes }             from '@/hooks/useLogTypes';
import { logsKey }                 from '@/hooks/useLogs';
import type { LogEntry, LogType, ImportantLogEntry, DayMetadata } from '@/types';
import './ImportantLogsModal.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

type SlotKey = 'wokeUp' | 'breakfast' | 'lunch' | 'dinner' | 'sleep';

interface LiveSlot {
  key:       SlotKey;
  label:     string;
  /** Live time derived from current logs — HH:MM */
  time:      string | null;
  logEntry:  LogEntry | null;
  /** Date the log lives on (may differ from selectedDate for wake/sleep) */
  logDate:   string | null;
  stale:     boolean;
  dayBadge:  'prev' | 'next' | null;
  category:  string;
}

const SLOT_CATEGORY: Record<SlotKey, string> = {
  wokeUp:    'sleep',
  breakfast: 'breakfast',
  lunch:     'lunch',
  dinner:    'dinner',
  sleep:     'sleep',
};

function dateAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function parseHM(s: string): [number, number] {
  if (s.includes('T') || s.length > 5) {
    const d = new Date(s);
    return [d.getHours(), d.getMinutes()];
  }
  const [h, m] = s.split(':').map(Number);
  return [h, m];
}

function toHHMM(s: string): string {
  const [h, m] = parseHM(s);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function toMins(hhmm: string): number {
  const [h, m] = parseHM(hhmm);
  return h * 60 + m;
}

function toAmPm(hhmm: string | null): string | null {
  if (!hhmm) return null;
  const [h, m] = parseHM(hhmm);
  const period = h < 12 ? 'AM' : 'PM';
  const h12    = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

function addMins(hhmm: string, delta: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 59, toMins(hhmm) + delta));
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

function formatCapturedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' '
    + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isSleepLog(log: LogEntry): boolean {
  return log.logType?.domain === 'personal' && log.logType?.category === 'sleep';
}

function isMealLog(log: LogEntry, mealKey: string): boolean {
  const cat  = (log.logType?.category ?? '').toLowerCase();
  const name = (log.logType?.name     ?? '').toLowerCase();
  return log.logType?.domain === 'personal' && (cat === mealKey || name.includes(mealKey));
}

function buildSlots(
  todayLogs:    LogEntry[],
  prevLogs:     LogEntry[],
  nextLogs:     LogEntry[],
  meta:         DayMetadata | null | undefined,
  selectedDate: string,
): LiveSlot[] {
  const prevDate = dateAddDays(selectedDate, -1);
  const nextDate = dateAddDays(selectedDate,  1);
  const cap      = meta?.importantLogs;
  const capturedAt = meta?.capturedAt ?? null;

  // Wake Up
  const wokeUpCandidates = [
    ...prevLogs.filter(l => isSleepLog(l) && l.endAt && toMins(l.startAt) >= 23 * 60),
    ...todayLogs.filter(l => isSleepLog(l) && l.endAt && toMins(l.startAt) < 12 * 60),
  ].sort((a, b) => toMins(b.endAt!) - toMins(a.endAt!));
  const wokeUpLog = wokeUpCandidates[0] ?? null;

  // Meals
  const bfLog     = todayLogs.filter(l => isMealLog(l, 'breakfast')).sort((a, b) => toMins(a.startAt) - toMins(b.startAt))[0] ?? null;
  const lunchLog  = todayLogs.filter(l => isMealLog(l, 'lunch'    )).sort((a, b) => toMins(a.startAt) - toMins(b.startAt))[0] ?? null;
  const dinnerLog = todayLogs.filter(l => isMealLog(l, 'dinner'   )).sort((a, b) => toMins(a.startAt) - toMins(b.startAt))[0] ?? null;

  // Sleep
  const sleepCandidates = [
    ...todayLogs.filter(l => isSleepLog(l) && toMins(l.startAt) >= 19 * 60),
    ...nextLogs.filter(l => isSleepLog(l) && toMins(l.startAt) <= 5 * 60),
  ].sort((a, b) => toMins(a.startAt) - toMins(b.startAt));
  const sleepLog = sleepCandidates[0] ?? null;

  function makeSlot(
    key:       SlotKey,
    label:     string,
    logEntry:  LogEntry | null,
    liveTime:  string | null,
    logDate:   string | null,
    captured:  ImportantLogEntry | null,
  ): LiveSlot {
    const hasCaptured = !!(captured?.time && capturedAt);
    const capturedTime = captured?.time ?? null;
    const stale        = hasCaptured && liveTime != null && capturedTime != null && toHHMM(capturedTime) !== toHHMM(liveTime);
    let   dayBadge: LiveSlot['dayBadge'] = null;
    if (logDate && logDate !== selectedDate) {
      dayBadge = logDate === prevDate ? 'prev' : logDate === nextDate ? 'next' : null;
    }
    if (key === 'wokeUp' && logEntry?.date === prevDate) dayBadge = 'prev';
    return { key, label, time: liveTime, logEntry, logDate, stale, dayBadge, category: SLOT_CATEGORY[key] };
  }

  return [
    makeSlot('wokeUp',    'Woke Up',   wokeUpLog,  wokeUpLog?.endAt    ?? null, wokeUpLog?.date  ?? null, cap?.wokeUp    ?? null),
    makeSlot('breakfast', 'Breakfast', bfLog,      bfLog?.startAt      ?? null, bfLog?.date      ?? null, cap?.breakfast ?? null),
    makeSlot('lunch',     'Lunch',     lunchLog,   lunchLog?.startAt   ?? null, lunchLog?.date   ?? null, cap?.lunch     ?? null),
    makeSlot('dinner',    'Dinner',    dinnerLog,  dinnerLog?.startAt  ?? null, dinnerLog?.date  ?? null, cap?.dinner    ?? null),
    makeSlot('sleep',     'Sleep',     sleepLog,   sleepLog?.startAt   ?? null, sleepLog?.date   ?? null, cap?.sleep     ?? null),
  ];
}

// ── Inline slot form ──────────────────────────────────────────────────────────

interface SlotFormProps {
  slot:         LiveSlot;
  logTypes:     LogType[];
  selectedDate: string;
  onClose:      () => void;
  onSaved:      () => void;
}

function SlotForm({ slot, logTypes, selectedDate, onClose, onSaved }: SlotFormProps) {
  const now     = new Date();
  const nowHH   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const isEdit  = !!slot.logEntry;
  const logDate = slot.logDate ?? selectedDate;

  // For WokeUp: the "time" is endAt of the sleep log; for others it's startAt
  const initTime = isEdit
    ? toHHMM(slot.key === 'wokeUp' ? (slot.logEntry!.endAt ?? slot.time ?? nowHH) : (slot.logEntry!.startAt ?? slot.time ?? nowHH))
    : (slot.time ? toHHMM(slot.time) : nowHH);

  const [time,   setTime]   = useState(initTime);
  const [typeId, setTypeId] = useState<string>(() => {
    if (isEdit) return slot.logEntry!.logType?._id ?? '';
    // auto-select matching type for create
    return logTypes.find(lt =>
      lt.domain === 'personal' &&
      ((lt.category ?? '').toLowerCase() === slot.category ||
       (lt.name    ?? '').toLowerCase().includes(slot.category))
    )?._id ?? '';
  });

  const updateMutation = useUpdateLog(logDate);
  const createMutation = useCreateLog(logDate);
  const isPending      = updateMutation.isPending || createMutation.isPending;

  function save() {
    if (isEdit) {
      const log = slot.logEntry!;
      const entry = slot.key === 'wokeUp'
        ? { endAtISO: localToISOString(logDate, time), startAtISO: log.startAt, logTypeId: typeId, title: log.title }
        : { startAtISO: localToISOString(logDate, time), endAtISO: log.endAt ?? localToISOString(logDate, time), logTypeId: typeId, title: log.title };

      updateMutation.mutate({ id: log.id, entry }, { onSuccess: onSaved, onError: onClose });
    } else {
      const isoTime = localToISOString(logDate, time);
      createMutation.mutate(
        { pointAtISO: isoTime, title: '', logTypeId: typeId, entryType: 'point' },
        { onSuccess: onSaved, onError: onClose },
      );
    }
  }

  return (
    <div className="il-slot-form">
      <div className="il-slot-form-label">{isEdit ? 'Edit time' : 'Log time'}</div>

      {/* Type selector (only for create, or if no type on existing) */}
      {(!isEdit || !slot.logEntry?.logType) && (
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger className="il-slot-type-select">
            <SelectValue placeholder="Select type…" />
          </SelectTrigger>
          <SelectContent>
            {logTypes.filter(lt => lt.domain === 'personal').map(lt => (
              <SelectItem key={lt._id} value={lt._id}>{lt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Time row */}
      <div className="il-slot-time-row-edit">
        <button className="il-step-btn" onClick={() => setTime(addMins(time, -15))}>−15</button>
        <button className="il-step-btn" onClick={() => setTime(addMins(time,  -5))}>−5</button>
        <Input
          className="il-time-input"
          value={time}
          onChange={e => setTime(e.target.value)}
          maxLength={5}
        />
        <button className="il-step-btn" onClick={() => setTime(addMins(time,  +5))}>+5</button>
        <button className="il-step-btn" onClick={() => setTime(addMins(time, +15))}>+15</button>
      </div>

      <div className="il-slot-form-actions">
        <button className="il-btn-cancel" onClick={onClose}>Cancel</button>
        <button className="il-btn-save" onClick={save} disabled={isPending || !typeId}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  open:         boolean;
  selectedDate: string;
  onClose:      () => void;
}

export default function ImportantLogsModal({ open, selectedDate, onClose }: Props) {
  const prevDate = dateAddDays(selectedDate, -1);
  const nextDate = dateAddDays(selectedDate,  1);

  const { data: todayLogs = [], isLoading: l1 } = useLogs(selectedDate);
  const { data: prevLogs  = [], isLoading: l2 } = useLogs(prevDate);
  const { data: nextLogs  = [], isLoading: l3 } = useLogs(nextDate);
  const { data: meta }                          = useDayMetadata(selectedDate);
  const { data: logTypes  = [] }                = useLogTypes();
  const capture                                 = useCaptureDayMeta(selectedDate);
  const qc                                      = useQueryClient();

  const [activeSlotKey, setActiveSlotKey] = useState<SlotKey | null>(null);

  const loading = l1 || l2 || l3;

  const slots = useMemo(
    () => buildSlots(todayLogs, prevLogs, nextLogs, meta, selectedDate),
    [todayLogs, prevLogs, nextLogs, meta, selectedDate],
  );

  const anyStale = slots.some(s => s.stale);

  function handleSaved() {
    setActiveSlotKey(null);
    // Invalidate all three days' logs so live times update
    qc.invalidateQueries({ queryKey: logsKey(selectedDate) });
    qc.invalidateQueries({ queryKey: logsKey(prevDate) });
    qc.invalidateQueries({ queryKey: logsKey(nextDate) });
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="il-panel" showCloseButton={false} aria-label="Important Logs">

        {/* Header */}
        <div className="il-header">
          <div className="il-header-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Important Times
          </div>
          <button className="il-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="il-loading">
            <div className="il-spinner"/>
            <span>Loading…</span>
          </div>
        )}

        {/* Slots */}
        {!loading && (
          <div className="il-slots">
            {slots.map(slot => (
              <div key={slot.key} className="il-slot-wrap">
                <div className="il-slot">
                  <div className="il-slot-info">
                    <span className="il-slot-label">{slot.label}</span>
                    {slot.time ? (
                      <div className="il-slot-time-row">
                        <span className="il-slot-time">{toAmPm(slot.time)}</span>
                        {slot.dayBadge && (
                          <Badge variant="outline" className={`il-day-badge il-day-badge--${slot.dayBadge}`}>
                            {slot.dayBadge}
                          </Badge>
                        )}
                        {slot.stale && (
                          <span className="il-stale-warn" title="Time changed since last Capture">
                            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                              <path d="M10 2L2 17h16L10 2z" stroke="#F5A623" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(245,166,35,0.12)"/>
                              <line x1="10" y1="8" x2="10" y2="12" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round"/>
                              <circle cx="10" cy="14.5" r="0.8" fill="#F5A623"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="il-slot-empty">Not logged</span>
                    )}
                  </div>

                  <div className="il-slot-actions">
                    {slot.logEntry ? (
                      <button
                        className="il-btn il-btn--edit"
                        title="Edit time"
                        onClick={() => setActiveSlotKey(k => k === slot.key ? null : slot.key)}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : (
                      <button
                        className="il-btn il-btn--add"
                        title="Log this now"
                        onClick={() => setActiveSlotKey(k => k === slot.key ? null : slot.key)}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                          <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline form */}
                {activeSlotKey === slot.key && (
                  <SlotForm
                    slot={slot}
                    logTypes={logTypes}
                    selectedDate={selectedDate}
                    onClose={() => setActiveSlotKey(null)}
                    onSaved={handleSaved}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stale warning */}
        {!loading && anyStale && (
          <div className="il-stale-row">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
              <path d="M10 2L2 17h16L10 2z" stroke="#F5A623" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(245,166,35,0.12)"/>
              <line x1="10" y1="8" x2="10" y2="12" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="10" cy="14.5" r="0.8" fill="#F5A623"/>
            </svg>
            Times have changed — click Capture to update.
          </div>
        )}

        {/* Last captured */}
        {!loading && meta?.capturedAt && (
          <div className="il-captured-row">
            Last captured: {formatCapturedAt(meta.capturedAt)}
          </div>
        )}

        {/* Footer */}
        <div className="il-footer">
          <button
            className="il-capture-btn"
            disabled={capture.isPending}
            onClick={() => capture.mutate()}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
            </svg>
            {capture.isPending ? 'Capturing…' : 'Capture'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
