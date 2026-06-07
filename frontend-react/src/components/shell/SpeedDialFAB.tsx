import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import './SpeedDialFAB.css';

const FAB_SIZE    = 42;
const DRAG_THRESH = 5;

export default function SpeedDialFAB() {
  const [open, setOpen]           = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [side, setSide]         = useState<'left' | 'right'>(() =>
    (localStorage.getItem('renmito-fab-side') as 'left' | 'right') || 'right'
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragLeft,   setDragLeft]   = useState(0);
  // tilt angle during drag (-1 = moving left, +1 = moving right, 0 = idle)
  const [tiltDir, setTiltDir]       = useState(0);

  const drag    = useRef({ active: false, didDrag: false, startX: 0, startLeft: 0, lastX: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = document.querySelector('.app-body') ?? window;
    function onScroll() {
      setScrolling(true);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setScrolling(false), 400);
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const { pathname }   = useLocation();
  const isJourneys     = pathname === '/journeys';
  const openLogForm    = useAppStore(s => s.openLogForm);
  const openRenniStore = useAppStore(s => s.openRenni);

  function close()     { setOpen(false); }
  function openSheet() { close(); openLogForm(); }
  function openRenni() { close(); openRenniStore(); }

  // ── drag handlers ─────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = wrapRef.current!.getBoundingClientRect();
    drag.current = { active: true, didDrag: false, startX: e.clientX, startLeft: rect.left, lastX: e.clientX };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.didDrag && Math.abs(dx) < DRAG_THRESH) return;

    drag.current.didDrag = true;
    if (!isDragging) setIsDragging(true);

    // tilt based on movement direction
    const moveDx = e.clientX - drag.current.lastX;
    if (Math.abs(moveDx) > 1) setTiltDir(moveDx > 0 ? 1 : -1);
    drag.current.lastX = e.clientX;

    const clamped = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, drag.current.startLeft + dx));
    setDragLeft(clamped);
  }

  function onPointerUp() {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (!drag.current.didDrag) {
      setOpen(v => !v);
      return;
    }
    const fabCenter = dragLeft + FAB_SIZE / 2;
    const newSide: 'left' | 'right' = fabCenter > window.innerWidth / 2 ? 'right' : 'left';
    setSide(newSide);
    localStorage.setItem('renmito-fab-side', newSide);
    setTiltDir(0);
    setIsDragging(false);
  }

  const isLeft = side === 'left';

  // tilt angle: subtle ±6 degrees
  const tiltDeg = isDragging ? tiltDir * 6 : 0;

  return (
    <>
      {open && <div className="sd-backdrop" onClick={close} />}

      <div
        ref={wrapRef}
        className={[
          'sd-wrap',
          isLeft             ? 'sd-wrap--left'     : 'sd-wrap--right',
          isDragging         ? 'sd-wrap--dragging'  : '',
          scrolling && !open ? 'sd-wrap--scrolling' : '',
        ].filter(Boolean).join(' ')}
        style={isDragging ? { left: dragLeft, right: 'auto' } : undefined}
      >
        <div className={`sd-options${open ? ' sd-options--open' : ''}`}>

          {/* Ask Renni */}
          <div className="sd-item">
            <button className="sd-btn sd-btn--renni" onClick={openRenni} title="Chat with Renni">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
                <path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25L5 3Z"/>
              </svg>
            </button>
            <span className="sd-label">Ask Renni</span>
          </div>

          {/* Log Now / New Journey */}
          <div className="sd-item">
            <button className="sd-btn sd-btn--primary" onClick={openSheet}
                    title={isJourneys ? 'New Journey' : 'Log Now'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <span className="sd-label">{isJourneys ? 'New Journey' : 'Log Now'}</span>
          </div>
        </div>

        {/* Main FAB — drag handle */}
        <button
          className={`sd-main${open ? ' sd-main--open' : ''}${isDragging ? ' sd-main--dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Actions"
          aria-label="Open actions"
          aria-expanded={open}
          style={{
            touchAction: 'none',
            transform: isDragging
              ? `scale(1.13) rotate(${tiltDeg}deg)`
              : open ? 'rotate(45deg)' : undefined,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </>
  );
}
