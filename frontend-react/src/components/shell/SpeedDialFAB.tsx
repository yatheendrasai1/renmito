import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import RenniChat    from '@/components/chat/RenniChat';
import { useAppStore } from '@/store/appStore';
import './SpeedDialFAB.css';

export default function SpeedDialFAB() {
  const [open,       setOpen]       = useState(false);
  const [renniOpen,  setRenniOpen]  = useState(false);
  const [scrolling,  setScrolling]  = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The page scrolls inside .app-body, not window
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
  const { pathname }              = useLocation();
  const isJourneys                = pathname === '/journeys';
  const openLogForm               = useAppStore(s => s.openLogForm);

  function close() { setOpen(false); }

  function openSheet()  { close(); openLogForm(); }
  function openRenni()  { close(); setRenniOpen(true); }

  return (
    <>
      {open && <div className="sd-backdrop" onClick={close} />}

      <div className={`sd-wrap${scrolling && !open ? ' sd-wrap--scrolling' : ''}`}>
        <div className={`sd-options${open ? ' sd-options--open' : ''}`}>

          {/* Ask Renni */}
          <div className="sd-item">
            <span className="sd-label">Ask Renni</span>
            <button className="sd-btn sd-btn--renni" onClick={openRenni} title="Chat with Renni">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
                <path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25L5 3Z"/>
              </svg>
            </button>
          </div>

          {/* Log Now / New Journey */}
          <div className="sd-item">
            <span className="sd-label">{isJourneys ? 'New Journey' : 'Log Now'}</span>
            <button className="sd-btn sd-btn--primary" onClick={openSheet}
                    title={isJourneys ? 'New Journey' : 'Log Now'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Main FAB */}
        <button
          className={`sd-main${open ? ' sd-main--open' : ''}`}
          onClick={() => setOpen(v => !v)}
          title="Actions"
          aria-label="Open actions"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Renni chat */}
      {renniOpen && <RenniChat onClose={() => setRenniOpen(false)} />}
    </>
  );
}
