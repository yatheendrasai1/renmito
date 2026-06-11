import { useState, useMemo } from 'react';
import { useAppStore }  from '@/store/appStore';
import { useLogs }      from '@/hooks/useLogs';
import { useLogTypes }  from '@/hooks/useLogTypes';
import HeroDateCard     from '@/components/logger/HeroDateCard';
import LogFormModal     from '@/components/logger/LogFormModal';
import FoodLogSheet     from '@/components/lifestyle/FoodLogSheet';
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
  {
    id: 'activity',
    label: 'Activity & Sports',
    logCategories: ['sports'],
    pinnedNames: ['Sports'],
    color: '#4A8FA0',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8a2 2 0 0 1 2 2v4a2 2 0 0 1-4 0v-4a2 2 0 0 1 2-2z"/>
      </svg>
    ),
  },
  {
    id: 'wellbeing',
    label: 'Wellbeing & Health',
    logCategories: ['wellbeing', 'health'],
    pinnedNames: ['WellBeing', 'Medical'],
    color: '#7A9C7A',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    id: 'growth',
    label: 'Learning & Growth',
    logCategories: ['learning', 'entertainment', 'familytime'],
    pinnedNames: ['Learning', 'Entertainment', 'Family Time'],
    color: '#C4704A',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
];

// ── Nutrition macros config ───────────────────────────────────────────────────

const MACROS = [
  { label: 'Calories', value: '0', unit: 'kcal', color: '#F2A65A' },
  { label: 'Protein',  value: '0', unit: 'g',    color: '#4A8FA0' },
  { label: 'Fibre',    value: '0', unit: 'g',    color: '#7A9C7A' },
  { label: 'Nutrients',value: '0', unit: 'g',    color: '#7A6490' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Nutrition summary card ────────────────────────────────────────────────────

function NutritionSummary() {
  return (
    <div className="ls-nutrition-card">
      <div className="ls-nutrition-header">
        <span className="ls-nutrition-title">Nutrition Today</span>
        <Badge variant="outline" className="ls-coming-soon">Coming Soon</Badge>
      </div>
      <div className="ls-macro-row">
        {MACROS.map(m => (
          <div key={m.label} className="ls-macro-cell">
            <span className="ls-macro-big" style={{ color: m.color }}>
              {m.value}
              <span className="ls-macro-unit"> {m.unit}</span>
            </span>
            <span className="ls-macro-label">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

interface LogRowProps {
  typeName:  string;
  typeColor: string;
  entries:   LogEntry[];
  logType:   LogType | undefined;
  onAdd:     (lt: LogType | undefined) => void;
  onEdit:    (entry: LogEntry) => void;
}

function entryTimeLabel(e: LogEntry): string {
  if (e.entryType === 'point') return isoToHHMM12(e.startAt);
  const start = isoToHHMM12(e.startAt);
  const end   = e.endAt ? isoToHHMM12(e.endAt) : '';
  return end ? `${start} – ${end}` : start;
}

function LogRow({ typeName, typeColor, entries, logType, onAdd, onEdit }: LogRowProps) {
  const none   = entries.length === 0;
  const single = entries.length === 1;
  const multi  = entries.length > 1;

  // For no-entry and single-entry rows the whole body is a click target
  function handleBodyClick() {
    if (none)        onAdd(logType);
    else if (single) onEdit(entries[0]);
  }

  return (
    <div className={`ls-log-row${none ? '' : ' ls-log-row--logged'}`}>

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

          {/* Not logged */}
          {none && <span className="ls-log-empty">Tap to log</span>}

          {/* Single entry — show inline time + duration */}
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

          {/* Multiple entries — chips, each independently editable */}
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
                  {/* pencil micro-icon */}
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

        {/* Edit hint icon for single-entry rows */}
        {single && (
          <svg className="ls-edit-hint" width="13" height="13" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        )}
      </div>

      {/* ── Add button (always on the right, adds a new entry) ── */}
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

    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  cat:      LifestyleCat;
  logs:     LogEntry[];
  logTypes: LogType[];
  onAdd:    (lt: LogType | undefined) => void;
  onEdit:   (entry: LogEntry) => void;
}

function SectionCard({ cat, logs, logTypes, onAdd, onEdit }: SectionCardProps) {
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
        {pinnedRows.map(row => (
          <LogRow
            key={row.name}
            typeName={row.name}
            typeColor={row.color}
            entries={row.entries}
            logType={row.lt}
            onAdd={onAdd}
            onEdit={onEdit}
          />
        ))}
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

export default function LifestylePage() {
  const selectedDate        = useAppStore(s => s.selectedDate);
  const { data: logs = [] } = useLogs(selectedDate);
  const { data: logTypes = [] } = useLogTypes();

  const [modal, setModal] = useState<
    | { mode: 'create';      defaultLogType?: LogType }
    | { mode: 'edit';        entry: LogEntry }
    | { mode: 'food-create'; logType: LogType }
    | { mode: 'food-edit';   logType: LogType; entry: LogEntry }
    | null
  >(null);

  const personalLogs = useMemo(
    () => logs.filter(l => l.logType?.domain === 'personal'),
    [logs]
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

      <HeroDateCard />

      <NutritionSummary />

      {LIFESTYLE_CATS.map(cat => (
        <SectionCard
          key={cat.id}
          cat={cat}
          logs={personalLogs}
          logTypes={logTypes}
          onAdd={openAdd}
          onEdit={openEdit}
        />
      ))}

      {/* Generic log form for non-food categories */}
      {modal?.mode === 'create' && (
        <LogFormModal
          mode="create"
          date={selectedDate}
          defaultLogType={modal.defaultLogType}
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
