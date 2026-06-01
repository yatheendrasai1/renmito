import { useMemo, useRef, useEffect, useState } from 'react';
import { useAppStore }    from '@/store/appStore';
import { useDayMetadata, useSetDayType } from '@/hooks/useDayMetadata';
import ImportantLogsModal from './ImportantLogsModal';
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

function dateAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

// ── Contrast helpers ──────────────────────────────────────────────────────────

function hexToLuminance(hex: string): number | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function resolveIsLightBg(): boolean {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim();
  if (!raw) return false;
  const lum = hexToLuminance(raw);
  if (lum === null) return false;
  return lum > 0.3;
}

/** Returns the two sets of CSS var values for dark vs light hero background. */
function heroVars(isLight: boolean): React.CSSProperties {
  return isLight ? {
    '--hero-fg':       'rgba(0,0,0,0.88)',
    '--hero-fg-sub':   'rgba(0,0,0,0.65)',
    '--hero-fg-dim':   'rgba(0,0,0,0.42)',
    '--hero-border':   'rgba(0,0,0,0.22)',
    '--hero-surface':  'rgba(0,0,0,0.05)',
    '--hero-hover':    'rgba(0,0,0,0.09)',
    '--hero-selected': 'rgba(0,0,0,0.13)',
  } as React.CSSProperties : {
    '--hero-fg':       'rgba(255,255,255,0.95)',
    '--hero-fg-sub':   'rgba(255,255,255,0.75)',
    '--hero-fg-dim':   'rgba(255,255,255,0.55)',
    '--hero-border':   'rgba(255,255,255,0.25)',
    '--hero-surface':  'rgba(255,255,255,0.10)',
    '--hero-hover':    'rgba(255,255,255,0.14)',
    '--hero-selected': 'rgba(255,255,255,0.20)',
  } as React.CSSProperties;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HeroDateCard() {
  const selectedDate  = useAppStore(s => s.selectedDate);
  const setDate       = useAppStore(s => s.setSelectedDate);
  const goToToday     = useAppStore(s => s.goToToday);

  const { data: meta }     = useDayMetadata(selectedDate);
  const setDayTypeMutation = useSetDayType(selectedDate);

  const [dtOpen,    setDtOpen]    = useState(false);
  const [impOpen,   setImpOpen]   = useState(false);
  const [isLight,   setIsLight]   = useState(false);
  const dtRef = useRef<HTMLDivElement>(null);

  const today   = todayISO();
  const isToday = selectedDate === today;

  // ── Contrast detection via MutationObserver ────────────────────────────────
  useEffect(() => {
    setIsLight(resolveIsLightBg());
    const observer = new MutationObserver(() => setIsLight(resolveIsLightBg()));
    observer.observe(document.documentElement, {
      attributes:     true,
      attributeFilter: ['style'],
    });
    return () => observer.disconnect();
  }, []);

  // ── Close day-type dropdown on outside click ────────────────────────────────
  useEffect(() => {
    if (!dtOpen) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (dtRef.current && !dtRef.current.contains(e.target as Node)) {
        setDtOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside as EventListener, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside as EventListener);
    };
  }, [dtOpen]);

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
      <div className="hero-card" style={heroVars(isLight)}>
        <div
          className="hero-content"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >

          {/* Left — date */}
          <div
            className="hero-left"
            style={{
              transform:  swipeOffset !== 0 ? `translateX(${clampedOffset}px)` : 'none',
              opacity:    swipeOffset !== 0 ? swipeOpacity : 1,
              transition: swipeOffset !== 0 ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
            }}
          >
            <div className="hero-date-line">
              <span className="hero-day-num">{dayNum}</span>
            </div>
            <span className="hero-day-sub">{weekday}, {monthName} {year}</span>
          </div>

          {/* Right — day type pill + star + today chip */}
          <div className="hero-right">
            <div className="hero-right-actions">

              {/* Day type pill */}
              <div ref={dtRef} className="hero-daytype-wrap" onClick={() => setDtOpen(v => !v)}>
                <span className="hero-daytype-dot" style={{ background: dtInfo.color }} />
                <span className="hero-daytype-lbl">{dtInfo.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>

                {dtOpen && (
                  <div className="hdr-dt-panel" onClick={e => e.stopPropagation()}>
                    {DAY_TYPES.map(dt => (
                      <button
                        key={dt.value}
                        className={`hdr-dt-option${currentDayType === dt.value ? ' hdr-dt-option--active' : ''}`}
                        onClick={() => { setDayTypeMutation.mutate(dt.value); setDtOpen(false); }}
                      >
                        <span className="hdr-dt-dot" style={{ background: dt.color }} />
                        {dt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
      {impOpen && (
        <ImportantLogsModal
          selectedDate={selectedDate}
          onClose={() => setImpOpen(false)}
        />
      )}
    </>
  );
}
