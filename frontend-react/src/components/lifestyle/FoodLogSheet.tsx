import { useState, useRef } from 'react';
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

// ── Time picker button ────────────────────────────────────────────────────────

function TimePick({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      className="fls-time-pick"
      onClick={() => ref.current?.showPicker?.()}
    >
      <span className="fls-tp-label">{label}</span>
      <span className="fls-tp-value">{to12(value)}</span>
      <input
        ref={ref}
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="fls-tp-hidden"
        tabIndex={-1}
      />
    </button>
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
  const [endTime,   setEndTime]   = useState(
    isEdit && editEntry.endAt
      ? isoToHHMM(editEntry.endAt)
      : addMins(defaultStart, 30),
  );
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
      endAtISO:   localToISOString(date, endTime),
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
            <div className="fls-time-row">
              <TimePick label="Start"  value={startTime} onChange={setStartTime} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
              <TimePick label="Finish" value={endTime}   onChange={setEndTime} />
            </div>
          </div>

          {/* Q2 — What */}
          <div className="fls-question">
            <div className="fls-q-row">
              <span className="fls-q-num">2</span>
              <span className="fls-q-text">What did you eat?</span>
              <span className="fls-q-optional">optional</span>
            </div>
            <Textarea
              className="fls-textarea"
              placeholder="e.g. oatmeal, banana, black coffee…"
              value={foodItems}
              onChange={e => setFoodItems(e.target.value)}
              rows={3}
            />
            <p className="fls-future-hint">
              ✦ Detailed nutrition &amp; food item tracking coming soon
            </p>
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
