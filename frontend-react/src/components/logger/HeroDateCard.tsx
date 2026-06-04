import { useMemo, useRef, useEffect, useState } from 'react';
import { useAppStore }    from '@/store/appStore';
import { useDayMetadata, useSetDayType } from '@/hooks/useDayMetadata';
import ImportantLogsModal from './ImportantLogsModal';
import CalendarModal      from './CalendarModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { DayType }  from '@/types';
import './HeroDateCard.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const DAY_TYPES: { value: DayType; label: string; color: string }[] = [
  { value: 'working',    label: 'Working',    color: '#4ade80' },
  { value: 'wfh',        label: 'WFH',        color: '#60a5fa' },
  { value: 'holiday',    label: 'Holiday',    color: '#f87171' },
  { value: 'paid_leave', label: 'Paid Leave', color: '#facc15' },
  { value: 'sick_leave', label: 'Sick Leave', color: '#fb923c' },
];


function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function ordinalSuffix(n: number): string {
  const t = n % 10, h = n % 100;
  if (t === 1 && h !== 11) return 'st';
  if (t === 2 && h !== 12) return 'nd';
  if (t === 3 && h !== 13) return 'rd';
  return 'th';
}

function dateAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}


const HERO_VARS: React.CSSProperties = {
  '--hero-fg':       'rgba(255,255,255,0.95)',
  '--hero-fg-sub':   'rgba(255,255,255,0.75)',
  '--hero-fg-dim':   'rgba(255,255,255,0.55)',
  '--hero-border':   'rgba(255,255,255,0.25)',
  '--hero-surface':  'rgba(255,255,255,0.10)',
  '--hero-hover':    'rgba(255,255,255,0.14)',
  '--hero-selected': 'rgba(255,255,255,0.20)',
} as React.CSSProperties;

// ── Component ─────────────────────────────────────────────────────────────────

export default function HeroDateCard() {
  const selectedDate  = useAppStore(s => s.selectedDate);
  const setDate       = useAppStore(s => s.setSelectedDate);
  const goToToday     = useAppStore(s => s.goToToday);

  const { data: meta }     = useDayMetadata(selectedDate);
  const setDayTypeMutation = useSetDayType(selectedDate);

  const [impOpen, setImpOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  const today   = todayISO();
  const isToday = selectedDate === today;

  // ── Parse selected date ────────────────────────────────────────────────────
  const dateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const dayNum    = dateObj.getDate();
  const monthName = MONTHS[dateObj.getMonth()];
  const year      = dateObj.getFullYear();
  const weekday   = DAYS[dateObj.getDay()];

  // ── Day strip — -30 to +7 from today ──────────────────────────────────────
  const todayObj = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [today]);

  const stripDays = useMemo(() => {
    const days: { iso: string; d: number; dow: string; isToday: boolean; isFuture: boolean }[] = [];
    for (let i = -30; i <= 7; i++) {
      const dt = new Date(todayObj);
      dt.setDate(dt.getDate() + i);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      days.push({ iso, d: dt.getDate(), dow: DAYS[dt.getDay()], isToday: iso === today, isFuture: iso > today });
    }
    return days;
  }, [todayObj, today]);

  // Scroll selected day into view
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDate]);

  // Day type
  const currentDayType = meta?.dayType ?? 'working';
  const dtInfo = DAY_TYPES.find(d => d.value === currentDayType) ?? DAY_TYPES[0];

  // ── Touch swipe for date navigation ────────────────────────────────────────
  const touchStartX    = useRef(0);
  const currentSwipeX  = useRef(0);
  const isSwiping      = useRef(false);
  const [swipeOffset,  setSwipeOffset] = useState(0);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current   = e.touches[0].clientX;
    currentSwipeX.current = 0;
    isSwiping.current     = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isSwiping.current) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    currentSwipeX.current = delta;
    setSwipeOffset(delta);
  }

  function onTouchEnd() {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    const delta = currentSwipeX.current;
    setSwipeOffset(0);

    if (delta < -50) {
      const next = dateAddDays(selectedDate, 1);
      if (next <= today) setDate(next);
    } else if (delta > 50) {
      setDate(dateAddDays(selectedDate, -1));
    }
  }

  const clampedOffset = Math.min(Math.max(swipeOffset, -80), 80);
  const swipeOpacity  = Math.max(0.4, 1 - Math.abs(swipeOffset) / 200);

  return (
    <>
      <div className="hero-card" style={HERO_VARS}>
        <div
          className="hero-content"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >

          {/* Left — date (tap to open calendar) */}
          <div
            className="hero-left"
            style={{
              transform:  swipeOffset !== 0 ? `translateX(${clampedOffset}px)` : 'none',
              opacity:    swipeOffset !== 0 ? swipeOpacity : 1,
              transition: swipeOffset !== 0 ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
            }}
          >
            <button className="hero-date-line hero-date-line--btn" onClick={() => setCalOpen(true)}>
              <span className="hero-day-num">
                {dayNum}<sup className="hero-day-ord">{ordinalSuffix(dayNum)}</sup>
              </span>
              <svg className="hero-cal-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
            <span className="hero-day-sub">{weekday}, {monthName} {year}</span>
          </div>

          {/* Right — day type pill + star + today chip */}
          <div className="hero-right">
            <div className="hero-right-actions">

              {/* Day type pill */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="hero-daytype-wrap" style={{ cursor: 'pointer' }}>
                    <span className="hero-daytype-dot" style={{ background: dtInfo.color }} />
                    <span className="hero-daytype-lbl">{dtInfo.label}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {DAY_TYPES.map(dt => (
                    <DropdownMenuItem
                      key={dt.value}
                      className={currentDayType === dt.value ? 'font-semibold' : ''}
                      onClick={() => setDayTypeMutation.mutate(dt.value)}
                    >
                      <span className="hero-daytype-dot" style={{ background: dt.color }} />
                      {dt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Star — opens Important Logs modal */}
              <button
                className="hero-imp-open-btn"
                title="Important times"
                onClick={() => setImpOpen(true)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            </div>

            {/* Today / Go to today — below the actions row */}
            <div className="hero-today-row">
              {isToday
                ? <span className="hero-today-chip">Today</span>
                : <button className="hero-goto-today-btn" onClick={goToToday}>Go to today</button>
              }
            </div>
          </div>
        </div>

        {/* Day strip */}
        <div className="day-strip-wrapper">
        <div className="day-strip">
          {stripDays.map(day => (
            <button
              key={day.iso}
              ref={day.iso === selectedDate ? selectedRef : null}
              className={[
                'day-strip-item',
                day.iso === selectedDate ? 'day-strip-item--selected' : '',
                day.isToday             ? 'day-strip-item--today'    : '',
                day.isFuture            ? 'day-strip-item--future'   : '',
              ].join(' ')}
              disabled={day.isFuture}
              onClick={() => !day.isFuture && setDate(day.iso)}
            >
              <span className="day-strip-dow">{day.dow}</span>
              <span className="day-strip-num">{day.d}</span>
            </button>
          ))}
        </div>
        </div>{/* day-strip-wrapper */}
      </div>

      {/* Important logs modal */}
      <ImportantLogsModal
        open={impOpen}
        selectedDate={selectedDate}
        onClose={() => setImpOpen(false)}
      />

      {/* Calendar modal */}
      <CalendarModal
        open={calOpen}
        selectedDate={selectedDate}
        onClose={() => setCalOpen(false)}
        onSelect={iso => { setDate(iso); setCalOpen(false); }}
      />
    </>
  );
}
