import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button }   from '@/components/ui/button';
import { useCreateLog, useUpdateLog, useDeleteLog } from '@/hooks/useLogs';
import { localToISOString } from '@/lib/time';
import type { LogEntry, LogType } from '@/types';
import './FoodLogSheet.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addMins(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + mins) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function isoToHHMM(iso: string): string {
  if (!iso) return '';
  if (/^\d{2}:\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function to12(hhmm: string): string {
  if (!hhmm || !hhmm.includes(':')) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const p   = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

// ── Time text parser ─────────────────────────────────────────────────────────

function parseTimeInput(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, ' ').toUpperCase();

  // "H:MM AM" / "H:MM PM"
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    if (h < 1 || h > 12 || m > 59) return null;
    if (m12[3] === 'PM' && h !== 12) h += 12;
    if (m12[3] === 'AM' && h === 12) h = 0;
    const snapped = Math.min(55, Math.round(m / 5) * 5);
    return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
  }

  // "HH:MM" or "H:MM" 24-hour
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h > 23 || m > 59) return null;
    const snapped = Math.min(55, Math.round(m / 5) * 5);
    return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
  }

  return null;
}

// ── Dual Slider Time Picker ───────────────────────────────────────────────────

function DualSliderTimePick({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const parts  = value.split(':').map(Number);
  const hour   = isNaN(parts[0]) ? 0 : parts[0];
  const rawMin = isNaN(parts[1]) ? 0 : parts[1];
  const minute = Math.min(55, Math.max(0, Math.round(rawMin / 5) * 5));

  const hourFrac = hour / 23;
  const minFrac  = minute / 55;

  const [activeBar, setActiveBar] = useState<'hr' | 'min' | null>(null);
  const [isEditing, setIsEditing]  = useState(false);
  const [editValue, setEditValue]  = useState('');

  // thumb is 10px wide; half = 5px — used for fill and tooltip alignment
  const thumbW = 10;
  const halfW  = thumbW / 2;
  const labelLeft = (frac: number) =>
    `calc(${halfW}px + ${frac} * (100% - ${thumbW}px))`;

  function startEdit() {
    setEditValue(to12(value));
    setIsEditing(true);
  }

  function commitEdit() {
    const parsed = parseTimeInput(editValue);
    if (parsed) onChange(parsed);
    setIsEditing(false);
  }

  return (
    <div className="fls-dual-slider">
      <div className="fls-time-display-row">
        {isEditing ? (
          <input
            className="fls-time-edit-input"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onFocus={e => e.target.select()}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') setIsEditing(false);
            }}
            autoFocus
          />
        ) : (
          <>
            <span
              className="fls-time-display"
              onClick={startEdit}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && startEdit()}
            >
              {to12(value)}
            </span>
            <span className="fls-time-note">till next 15mins</span>
          </>
        )}
      </div>
      <div className="fls-slider-group">
        <div className="fls-slider-row">
          <span className="fls-slider-lbl">hr</span>
          <div className="fls-track-wrap">
            <div className="fls-track-bg">
              <div className="fls-track-fill" style={{ '--frac': hourFrac } as React.CSSProperties} />
            </div>
            {activeBar === 'hr' && (
              <span className="fls-thumb-label" style={{ left: labelLeft(hourFrac) }}>
                {hour}
              </span>
            )}
            <input
              type="range"
              className="fls-range"
              min={0} max={23} step={1}
              value={hour}
              onPointerDown={() => setActiveBar('hr')}
              onPointerUp={() => setActiveBar(null)}
              onChange={e => {
                const h = Number(e.target.value);
                onChange(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
              }}
            />
          </div>
        </div>
        <div className="fls-slider-row">
          <span className="fls-slider-lbl">min</span>
          <div className="fls-track-wrap">
            <div className="fls-track-bg">
              <div className="fls-track-fill" style={{ '--frac': minFrac } as React.CSSProperties} />
            </div>
            {activeBar === 'min' && (
              <span className="fls-thumb-label" style={{ left: labelLeft(minFrac) }}>
                {minute}
              </span>
            )}
            <input
              type="range"
              className="fls-range"
              min={0} max={55} step={5}
              value={minute}
              onPointerDown={() => setActiveBar('min')}
              onPointerUp={() => setActiveBar(null)}
              onChange={e => {
                const m = Number(e.target.value);
                onChange(`${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FoodLogSheet ──────────────────────────────────────────────────────────────

interface Props {
  logType:    LogType;
  date:       string;
  editEntry?: LogEntry;
  onClose:    () => void;
  onSaved:    () => void;
}

export default function FoodLogSheet({
  logType, date, editEntry, onClose, onSaved,
}: Props) {
  const isEdit       = !!editEntry;
  const defaultStart = isEdit ? isoToHHMM(editEntry.startAt) : nowHHMM();

  const [startTime, setStartTime] = useState(defaultStart);
  const [foodItems, setFoodItems] = useState(
    isEdit && editEntry.title !== logType.name ? editEntry.title : '',
  );
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const createLog = useCreateLog(date);
  const updateLog = useUpdateLog(editEntry?.date ?? date);
  const deleteLog = useDeleteLog(editEntry?.date ?? date);

  function handleSave() {
    if (!startTime || saving) return;
    setSaving(true);
    const entry = {
      startAtISO: localToISOString(date, startTime),
      endAtISO:   localToISOString(date, addMins(startTime, 15)),
      title:      foodItems.trim() || logType.name,
      logTypeId:  logType._id,
      entryType:  'range' as const,
    };
    if (isEdit && editEntry) {
      updateLog.mutate({ id: editEntry.id, entry }, {
        onSuccess: () => { toast(`${logType.name} updated`); onSaved(); },
        onError:   () => { setSaving(false); toast('Failed to update'); },
      });
    } else {
      createLog.mutate(entry, {
        onSuccess: () => { toast(`${logType.name} logged`); onSaved(); },
        onError:   () => { setSaving(false); toast('Failed to save'); },
      });
    }
  }

  function handleDelete() {
    if (!editEntry || deleting) return;
    setDeleting(true);
    deleteLog.mutate(editEntry.id, {
      onSuccess: () => { toast(`${logType.name} deleted`); onSaved(); },
      onError:   () => { setDeleting(false); toast('Failed to delete'); },
    });
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="fls-panel" showCloseButton={false} aria-label="Log food intake">

        {/* ── Header ── */}
        <div className="fls-header">
          <span className="fls-meal-dot" style={{ background: logType.color }} />
          <DialogTitle className="fls-meal-title">{logType.name}</DialogTitle>
          <button className="fls-close-btn" onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6"  y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="fls-body">

          {/* Q1 — When */}
          <div className="fls-question">
            <div className="fls-q-row">
              <span className="fls-q-num">1</span>
              <span className="fls-q-text">When did you eat?</span>
            </div>
            <DualSliderTimePick value={startTime} onChange={setStartTime} />
          </div>

          {/* Q2 — What */}
          <div className="fls-question">
            <div className="fls-q-row">
              <span className="fls-q-num">2</span>
              <span className="fls-q-text">What did you eat?</span>
            </div>
            <Textarea
              className="fls-textarea"
              placeholder="e.g. oatmeal, banana, black coffee…"
              value={foodItems}
              onChange={e => setFoodItems(e.target.value)}
              rows={3}
            />
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="fls-footer">
          {isEdit && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          <Button
            className="fls-save-btn"
            onClick={handleSave}
            disabled={saving || !startTime}
          >
            {saving
              ? 'Saving…'
              : isEdit
                ? `Update ${logType.name}`
                : `Log ${logType.name}`}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
