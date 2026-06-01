import { useState }         from 'react';
import { useAppStore }      from '@/store/appStore';
import { useLogs }           from '@/hooks/useLogs';
import { useLogTypes }       from '@/hooks/useLogTypes';
import { usePreferences, useSetActiveLog } from '@/hooks/usePreferences';
import { useDayMetadata }    from '@/hooks/useDayMetadata';
import HeroDateCard           from '@/components/logger/HeroDateCard';
import ActiveLogBar           from '@/components/logger/ActiveLogBar';
import MetricsCards           from '@/components/logger/MetricsCards';
import LogList                from '@/components/logger/LogList';
import NotesSheet             from '@/components/logger/NotesSheet';
import './LoggerPage.css';

// ── Logger page ───────────────────────────────────────────────────────────────

export default function LoggerPage() {
  const selectedDate  = useAppStore(s => s.selectedDate);
  const [notesOpen, setNotesOpen] = useState(false);

  const { data: logs,     isLoading: logsLoading }  = useLogs(selectedDate);
  const { data: logTypes, isLoading: typesLoading } = useLogTypes();
  const { data: prefs }                              = usePreferences();
  const { data: meta }                               = useDayMetadata(selectedDate);
  const stopActiveLog                                = useSetActiveLog();

  const activeLog = prefs?.activeLog ?? null;

  const allTypes      = logTypes ?? [];
  const activeLogType = activeLog
    ? allTypes.find(lt => lt._id === activeLog.logTypeId)
    : undefined;

  function handleStopTimer() {
    stopActiveLog.mutate(null);
  }

  return (
    <div className="logger-page">

      {/* Hero date card */}
      <HeroDateCard />

      {/* Metrics: Coverage / Logged / Remaining */}
      <MetricsCards logs={logs ?? []} dayType={meta?.dayType} date={selectedDate} />

      {/* Running timer bar */}
      {activeLog && (
        <ActiveLogBar
          activeLog={activeLog}
          logType={activeLogType}
          onStop={handleStopTimer}
          isStopping={stopActiveLog.isPending}
        />
      )}

      {/* Log list section */}
      <section className="logger-log-section">
        <div className="logger-section-header">
          <span className="logger-section-title">Logs</span>
          {logs && <span className="logger-log-count">{logs.length}</span>}

          {/* Notes trigger */}
          <button
            className="logger-notes-btn"
            onClick={() => setNotesOpen(true)}
            title="Notes"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Notes
          </button>
        </div>
        <LogList
          logs={logs ?? []}
          logTypes={allTypes}
          isLoading={logsLoading || typesLoading}
          date={selectedDate}
        />
      </section>

      {/* Notes bottom sheet */}
      {notesOpen && (
        <NotesSheet
          date={selectedDate}
          onClose={() => setNotesOpen(false)}
        />
      )}

    </div>
  );
}
