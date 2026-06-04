import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { useMonthSummary } from '@/hooks/useMonthSummary';
import type { DayButton } from 'react-day-picker';
import './CalendarModal.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWorkMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = mins / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open:         boolean;
  selectedDate: string;
  onClose:      () => void;
  onSelect:     (iso: string) => void;
}

export default function CalendarModal({ open, selectedDate, onClose, onSelect }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDateObj = useMemo(() => isoToDate(selectedDate), [selectedDate]);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const { data: workData = {} } = useMonthSummary(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onSelect(toISO(date));
    onClose();
  }

  return createPortal(
    <div className="cal-backdrop" onClick={onClose}>
      <div className="cal-popup" onClick={e => e.stopPropagation()}>
        <Calendar
          mode="single"
          selected={selectedDateObj}
          onSelect={handleSelect}
          month={viewMonth}
          onMonthChange={setViewMonth}
          disabled={(date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d > today;
          }}
          className="cal-picker p-0"
          components={{
            DayButton: ({ day, modifiers, children, ...props }: React.ComponentProps<typeof DayButton>) => {
              const iso = toISO(day.date);
              const mins = workData[iso];
              return (
                <CalendarDayButton day={day} modifiers={modifiers} {...props}>
                  {children}
                  {mins ? <span className="cal-work-mins">{formatWorkMins(mins)}</span> : null}
                </CalendarDayButton>
              );
            },
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
