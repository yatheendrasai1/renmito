import { useState, useEffect } from 'react';
import type { ActiveLog, LogType } from '@/types';
import './ActiveLogBar.css';

interface Props {
  activeLog:  ActiveLog;
  logType:    LogType | undefined;
  onStop:     () => void;
  isStopping: boolean;
}

/** Formats elapsed seconds → "H:MM:SS" or "M:SS". */
function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function ActiveLogBar({ activeLog, logType, onStop, isStopping }: Props) {
  const [elapsed, setElapsed] = useState(0);

  // Tick every second
  useEffect(() => {
    const startMs = new Date(activeLog.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeLog.startedAt]);

  const color = logType?.color ?? '#6366f1';

  return (
    <div className="active-log-bar">
      <div className="alb-left">
        <span className="alb-dot" style={{ background: color }} />
        <div className="alb-info">
          <span className="alb-name">{logType?.name ?? 'Running'}</span>
          {activeLog.title && (
            <span className="alb-title">{activeLog.title}</span>
          )}
        </div>
      </div>
      <div className="alb-right">
        <span className="alb-elapsed">{formatElapsed(elapsed)}</span>
        <button
          className="alb-stop-btn"
          onClick={onStop}
          disabled={isStopping}
          title="Stop timer"
        >
          <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="2" width="10" height="10" rx="2"/>
          </svg>
          {isStopping ? 'Stopping…' : 'Stop'}
        </button>
      </div>
    </div>
  );
}
