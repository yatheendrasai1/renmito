import { useState, useMemo, useRef } from 'react';
import { useAppStore }  from '@/store/appStore';
import { useLogs, useCreateLog, useUpdateLog } from '@/hooks/useLogs';
import { useLogTypes }  from '@/hooks/useLogTypes';
import HeroDateCard     from '@/components/logger/HeroDateCard';
import LogFormModal     from '@/components/logger/LogFormModal';
import FoodLogSheet          from '@/components/lifestyle/FoodLogSheet';
import SleepFoodTimeline     from '@/components/lifestyle/SleepFoodTimeline';
import { Button }       from '@/components/ui/button';
import { Badge }        from '@/components/ui/badge';
import type { LogEntry, LogType } from '@/types';
import './LifestylePage.css';

// ── Category config ───────────────────────────────────────────────────────────

interface LifestyleCat {
  id:            string;
  label:         string;
  logCategories: string[];
  pinnedNames:   string[];
  color:         string;
  icon:          React.ReactNode;
}

const LIFESTYLE_CATS: LifestyleCat[] = [
  {
    id: 'sleep',
    label: 'Sleep & Rest',
    logCategories: ['sleep'],
    pinnedNames: ['Sleep'],
    color: '#7A6490',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    ),
  },
  {
    id: 'meals',
    label: 'Meals',
    logCategories: ['food'],
    pinnedNames: ['Breakfast', 'Lunch', 'Dinner', 'Food Intake'],
    color: '#F2A65A',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/>
        <line x1="10" y1="1" x2="10" y2="4"/>
        <line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    ),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MEAL_DEFAULT_TIMES: Record<string, string> = {
  'Breakfast': '08:00',
  'Lunch':     '13:00',
  'Dinner':    '20:00',
};
const SWIPEABLE_MEALS = new Set(['Breakfast', 'Lunch', 'Dinner']);

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function localHHMMtoISO(date: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function fracToHHMM(frac: number): string {
  const snapped = Math.round(frac * 1439 / 5) * 5;
  const h = Math.floor(snapped / 60), mn = snapped % 60;
  return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
}

function hhmmToFrac(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) / 1439;
}

function toHHMM12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'am' : 'pm'}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function isoToHHMM12(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const h = d.getHours(), m = d.getMinutes();
  const p = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

// ── Log row ───────────────────────────────────────────────────────────────────

interface LogRowProps {
  typeName:       string;
  typeColor:      string;
  entries:        LogEntry[];
  logType:        LogType | undefined;
  onAdd:          (lt: LogType | undefined) => void;
  onEdit:         (entry: LogEntry) => void;
  swipeBaseTime?: string;
  onSwipeCommit?: (hhmm: string) => void;
}

function entryTimeLabel(e: LogEntry): string {
  if (e.entryType === 'point') return isoToHHMM12(e.startAt);
  const start = isoToHHMM12(e.startAt);
  const end   = e.endAt ? isoToHHMM12(e.endAt) : '';
  return end ? `${start} – ${end}` : start;
}

function LogRow({ typeName, typeColor, entries, logType, onAdd, onEdit, swipeBaseTime, onSwipeCommit }: LogRowProps) {
  const none   = entries.length === 0;
  const single = entries.length === 1;
  const multi  = entries.length > 1;

  const isSwipeable = !!swipeBaseTime && !!onSwipeCommit;

  // ── Swipe state ───────────────────────────────────────────────────────────
  const [dragFrac, setDragFrac]     = useState<number | null>(null);
  const [liveChip, setLiveChip]     = useState('');
  const [showChip, setShowChip]     = useState(false);
  const rowRef      = useRef<HTMLDivElement>(null);
  const dragging    = useRef(false);
  const dragFracRef = useRef<number | null>(null);
  const didSwipe    = useRef(false);
  const startFrac   = useRef<number | null>(null); // frac at touchStart, for threshold check

  function handleTouchStart(e: React.TouchEvent) {
    if (!isSwipeable || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    startFrac.current   = frac;
    dragging.current    = true;
    didSwipe.current    = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    dragFracRef.current = frac;
    setDragFrac(frac);
    setLiveChip(toHHMM12(fracToHHMM(frac)));
    // show chip once finger moved at least ~5px from start
    const moved = Math.abs(frac - (startFrac.current ?? frac)) * rect.width;
    setShowChip(moved > 5);
  }

  function handleTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    const frac = dragFracRef.current;
    if (frac !== null && rowRef.current) {
      const rect    = rowRef.current.getBoundingClientRect();
      const movedPx = Math.abs(frac - (startFrac.current ?? frac)) * rect.width;
      if (movedPx >= 15) {
        didSwipe.current = true;
        onSwipeCommit!(fracToHHMM(frac));
      }
    }
    setShowChip(false);
    setDragFrac(null);
    dragFracRef.current = null;
  }

  // ── Click (tap) ───────────────────────────────────────────────────────────
  function handleBodyClick() {
    if (didSwipe.current) { didSwipe.current = false; return; }
    if (none)        onAdd(logType);
    else if (single) onEdit(entries[0]);
  }

  // ── Inner content (shared for swipeable and plain) ────────────────────────
  const rowContent = (
    <>
      {/* ── Clickable body ── */}
      <div
        className="ls-log-body"
        role="button"
        tabIndex={0}
        onClick={!multi ? handleBodyClick : undefined}
        onKeyDown={!multi ? (e => e.key === 'Enter' && handleBodyClick()) : undefined}
        style={{ cursor: multi ? 'default' : 'pointer' }}
      >
        <span className="ls-log-dot" style={{ background: typeColor }} />

        <div className="ls-log-info">
          <span className="ls-log-name">
            {typeName}
            {!none && (
              <svg className="ls-logged-check" width="13" height="13" viewBox="0 0 24 24"
                   fill="none" stroke="#4caf7d" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>

          {none && <span className="ls-log-empty">Swipe to log</span>}

          {single && (
            <span className="ls-log-time-line">
              {entryTimeLabel(entries[0])}
              {(entries[0].durationMins ?? 0) > 0 && (
                <Badge variant="secondary" className="ls-entry-dur">
                  {fmtDuration(entries[0].durationMins!)}
                </Badge>
              )}
            </span>
          )}

          {multi && (
            <div className="ls-log-entries">
              {entries.map(e => (
                <button
                  key={e.id}
                  className="ls-entry-chip"
                  onClick={() => onEdit(e)}
                  aria-label={`Edit ${typeName} at ${entryTimeLabel(e)}`}
                >
                  <span className="ls-entry-time">{entryTimeLabel(e)}</span>
                  {(e.durationMins ?? 0) > 0 && (
                    <Badge variant="secondary" className="ls-entry-dur">
                      {fmtDuration(e.durationMins!)}
                    </Badge>
                  )}
                  <svg className="ls-chip-edit-icon" width="9" height="9" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {single && (
          <svg className="ls-edit-hint" width="13" height="13" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        )}
      </div>

      {/* ── Add button ── */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="ls-add-btn"
        onClick={() => onAdd(logType)}
        aria-label={`Add ${typeName}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </Button>
    </>
  );

  if (!isSwipeable) {
    return (
      <div className={`ls-log-row${none ? '' : ' ls-log-row--logged'}`}>
        {rowContent}
      </div>
    );
  }

  return (
    <div
      className="ls-swipe-wrap"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating time chip — visible only while dragging past 5px */}
      {showChip && (
        <div className="ls-swipe-chip">{liveChip}</div>
      )}

      <div
        ref={rowRef}
        className={`ls-log-row${none ? '' : ' ls-log-row--logged'}`}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Dim fill — only when a log already exists, showing its time on the 24h scale */}
        {swipeBaseTime && !none && (
          <div
            className="ls-swipe-fill"
            style={{
              width: `${hhmmToFrac(swipeBaseTime) * 100}%`,
              left: 0,
              background: 'linear-gradient(to right, rgba(120,160,220,0.06), rgba(120,160,220,0.10) 80%, rgba(120,160,220,0.28) 100%)',
            }}
          />
        )}

        {/* Active fill — absolute position across the row while dragging */}
        {dragFrac !== null && (
          <div
            className="ls-swipe-fill"
            style={{
              width: `${dragFrac * 100}%`,
              left: 0,
              background: 'linear-gradient(to right, rgba(76,175,80,0.08), rgba(76,175,80,0.16) 80%, rgba(76,175,80,0.52) 100%)',
            }}
          />
        )}

        <div className="ls-swipe-content">
          {rowContent}
        </div>
      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  cat:            LifestyleCat;
  logs:           LogEntry[];
  logTypes:       LogType[];
  onAdd:          (lt: LogType | undefined) => void;
  onEdit:         (entry: LogEntry) => void;
  onSwipeCommit?: (logType: LogType | undefined, entry: LogEntry | undefined, hhmm: string) => void;
}

function SectionCard({ cat, logs, logTypes, onAdd, onEdit, onSwipeCommit }: SectionCardProps) {
  const catTypes = logTypes.filter(
    lt => lt.domain === 'personal' && cat.logCategories.includes(lt.category)
  );

  // Always-shown pinned rows
  const pinnedRows = cat.pinnedNames.map(name => {
    const lt = catTypes.find(t => t.name === name);
    const entries = logs.filter(
      l => l.logType?.name === name && cat.logCategories.includes(l.logType?.category ?? '')
    );
    return { name, lt, entries, color: lt?.color ?? cat.color };
  });

  // Additional logged entries outside the pinned list
  const extraLogs = logs.filter(
    l =>
      cat.logCategories.includes(l.logType?.category ?? '') &&
      !cat.pinnedNames.includes(l.logType?.name ?? '')
  );
  const extraRows = extraLogs.map(e => ({
    name:    e.logType?.name ?? e.title,
    lt:      catTypes.find(t => t._id === e.logType?._id),
    entries: [e],
    color:   e.logType?.color ?? cat.color,
  }));

  const totalEntries = logs.filter(
    l => cat.logCategories.includes(l.logType?.category ?? '')
  ).length;

  return (
    <div className="ls-section-card">
      <div className="ls-section-header">
        <span className="ls-section-icon" style={{ color: cat.color }}>{cat.icon}</span>
        <span className="ls-section-label">{cat.label}</span>
        {totalEntries > 0 && (
          <span className="ls-section-count">{totalEntries}</span>
        )}
      </div>

      <div className="ls-section-rows">
        {pinnedRows.map(row => {
          const swipeable = !!onSwipeCommit && SWIPEABLE_MEALS.has(row.name) && cat.id === 'meals';
          const swipeBase = swipeable
            ? (row.entries[0]?.startAt ? isoToHHMM(row.entries[0].startAt) : MEAL_DEFAULT_TIMES[row.name])
            : undefined;
          return (
            <LogRow
              key={row.name}
              typeName={row.name}
              typeColor={row.color}
              entries={row.entries}
              logType={row.lt}
              onAdd={onAdd}
              onEdit={onEdit}
              swipeBaseTime={swipeBase}
              onSwipeCommit={swipeable ? (hhmm) => onSwipeCommit(row.lt, row.entries[0], hhmm) : undefined}
            />
          );
        })}
        {extraRows.map((row, i) => (
          <LogRow
            key={`extra-${i}`}
            typeName={row.name}
            typeColor={row.color}
            entries={row.entries}
            logType={row.lt}
            onAdd={onAdd}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  // Use local date parts — toISOString() returns UTC which can be a different calendar day
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function LifestylePage() {
  const selectedDate             = useAppStore(s => s.selectedDate);
  const { data: logs = [] }      = useLogs(selectedDate);
  const nextDate                 = useMemo(() => addDays(selectedDate, 1), [selectedDate]);
  const { data: nextDayLogs = [] } = useLogs(nextDate);
  const { data: logTypes = [] }  = useLogTypes();

  const createLog = useCreateLog(selectedDate);
  const updateLog = useUpdateLog(selectedDate);

  function handleSwipeCommit(
    logType: LogType | undefined,
    existingEntry: LogEntry | undefined,
    hhmm: string,
  ) {
    if (!logType) return;
    const startISO = localHHMMtoISO(selectedDate, hhmm);
    const endISO   = new Date(new Date(startISO).getTime() + 15 * 60_000).toISOString();
    if (existingEntry) {
      updateLog.mutate({
        id:    existingEntry.id,
        entry: { title: existingEntry.title, startAtISO: startISO, endAtISO: endISO },
      });
    } else {
      createLog.mutate({
        title:       logType.name,
        logTypeId:   logType._id,
        entryType:   'range',
        startAtISO:  startISO,
        endAtISO:    endISO,
        source:      'manual',
      });
    }
  }

  const [modal, setModal] = useState<
    | { mode: 'create';      defaultLogType?: LogType; startTime?: string }
    | { mode: 'edit';        entry: LogEntry }
    | { mode: 'food-create'; logType: LogType }
    | { mode: 'food-edit';   logType: LogType; entry: LogEntry }
    | null
  >(null);

  const personalLogs = useMemo(
    () => logs.filter(l => l.logType?.domain === 'personal'),
    [logs]
  );

  const nextDayPersonalLogs = useMemo(
    () => nextDayLogs.filter(l => l.logType?.domain === 'personal'),
    [nextDayLogs]
  );

  function openAdd(lt: LogType | undefined) {
    if (lt?.category === 'food') {
      setModal({ mode: 'food-create', logType: lt });
    } else {
      setModal({ mode: 'create', defaultLogType: lt });
    }
  }
  function openEdit(entry: LogEntry) {
    if (entry.logType?.category === 'food') {
      setModal({ mode: 'food-edit', logType: entry.logType, entry });
    } else {
      setModal({ mode: 'edit', entry });
    }
  }
  function closeModal() { setModal(null); }

  return (
    <div className="lifestyle-page">

      <HeroDateCard hideStrip />

      <SleepFoodTimeline
        logs={personalLogs}
        nextDayLogs={nextDayPersonalLogs}
        logTypes={logTypes}
        selectedDate={selectedDate}
        onEdit={openEdit}
        onAdd={(startTime) => setModal({ mode: 'create', defaultLogType: logTypes.find(lt => lt.domain === 'personal'), startTime })}
      />

      {LIFESTYLE_CATS.map(cat => (
        <SectionCard
          key={cat.id}
          cat={cat}
          logs={personalLogs}
          logTypes={logTypes}
          onAdd={openAdd}
          onEdit={openEdit}
          onSwipeCommit={cat.id === 'meals' ? handleSwipeCommit : undefined}
        />
      ))}

      {/* Generic log form for non-food categories */}
      {modal?.mode === 'create' && (
        <LogFormModal
          mode="create"
          date={selectedDate}
          defaultLogType={modal.defaultLogType}
          startTime={modal.startTime}
          onClose={closeModal}
          onSaved={closeModal}
        />
      )}
      {modal?.mode === 'edit' && (
        <LogFormModal
          mode="edit"
          date={selectedDate}
          editEntry={modal.entry}
          onClose={closeModal}
          onSaved={closeModal}
        />
      )}

      {/* Focused food questionnaire for Meals category */}
      {modal?.mode === 'food-create' && (
        <FoodLogSheet
          logType={modal.logType}
          date={selectedDate}
          onClose={closeModal}
          onSaved={closeModal}
        />
      )}
      {modal?.mode === 'food-edit' && (
        <FoodLogSheet
          logType={modal.logType}
          date={selectedDate}
          editEntry={modal.entry}
          onClose={closeModal}
          onSaved={closeModal}
        />
      )}

    </div>
  );
}
