import { useState, type FormEvent } from 'react';
import { useAppStore }    from '@/store/appStore';
import { useLogTypes }    from '@/hooks/useLogTypes';
import { useCreateLog }   from '@/hooks/useLogs';
import { useSetActiveLog } from '@/hooks/usePreferences';
import TypeSelector        from './TypeSelector';
import TimeInput           from './TimeInput';
import './UnifiedSheet.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function minsAgo(n: number): string {
  const d = new Date(Date.now() - n * 60000);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const PLANNED_OPTS = [
  { v: null,  l: 'None' },
  { v: 15,    l: '15 m' },
  { v: 30,    l: '30 m' },
  { v: 60,    l: '1 h'  },
  { v: 90,    l: '1.5 h'},
  { v: 120,   l: '2 h'  },
];

type Tab = 1 | 2 | 3;

interface Props {
  onClose:        () => void;
  initialTab?:    Tab;
}

// ── Details sub-form (shared between tabs 1 & 2) ──────────────────────────────

interface DetailsFormState {
  priority:          'High' | 'Medium' | 'Low' | null;
  ticketId:          string;
  crucialPerson:     'Yes' | 'No' | 'Shared' | null;
  collaborators:     string[];
  collaboratorInput: string;
  satisfactoryScore: number | null;
}

function initDetails(): DetailsFormState {
  return { priority: null, ticketId: '', crucialPerson: null, collaborators: [], collaboratorInput: '', satisfactoryScore: null };
}

interface DetailsProps {
  state:     DetailsFormState;
  onChange:  (patch: Partial<DetailsFormState>) => void;
  domain:    'work' | 'personal';
  showPlan?: boolean;
  planned?:  number | null;
  onPlanned?: (v: number | null) => void;
}

function DetailsCard({ state, onChange, domain, showPlan, planned, onPlanned }: DetailsProps) {
  const scoreRange = [1,2,3,4,5,6,7,8,9,10];

  function addCollab() {
    const name = state.collaboratorInput.trim();
    if (!name) return;
    onChange({ collaborators: [...state.collaborators, name], collaboratorInput: '' });
  }

  return (
    <div className="ln-details-card">
      <div className="ln-details-header">Details</div>

      {/* Plan for (timer tab) */}
      {showPlan && onPlanned && (
        <div className="ln-detail-row ln-detail-row--plan">
          <span className="ln-detail-label">Plan for</span>
          <div className="ln-detail-ctrl ln-detail-ctrl--plan">
            {PLANNED_OPTS.map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                className={`ln-plan-chip${planned === opt.v ? ' ln-plan-chip--active' : ''}`}
                onClick={() => onPlanned(opt.v)}
              >{opt.l}</button>
            ))}
          </div>
        </div>
      )}

      {/* Priority (work only) */}
      {domain === 'work' && (
        <div className="ln-detail-row">
          <span className="ln-detail-label">Priority</span>
          <div className="ln-detail-ctrl">
            {(['High','Medium','Low'] as const).map(p => (
              <button key={p} type="button"
                className={`ln-priority-chip ln-priority-chip--${p.toLowerCase()}${state.priority === p ? ' ln-priority-chip--active' : ''}`}
                onClick={() => onChange({ priority: state.priority === p ? null : p })}>
                <span className="ln-priority-dot" />
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ticket ID (work only) */}
      {domain === 'work' && (
        <div className="ln-detail-row">
          <span className="ln-detail-label">Ticket ID</span>
          <div className="ln-detail-ctrl">
            <input type="text" className="ln-detail-input"
                   value={state.ticketId}
                   onChange={e => onChange({ ticketId: e.target.value })}
                   placeholder="e.g. JIRA-1234" maxLength={100} autoComplete="off"/>
          </div>
        </div>
      )}

      {/* Crucial (work only) */}
      {domain === 'work' && (
        <div className="ln-detail-row">
          <span className="ln-detail-label">Crucial</span>
          <div className="ln-detail-ctrl">
            {(['Yes','Shared','No'] as const).map(v => (
              <button key={v} type="button"
                className={`ln-crucial-btn ln-crucial-btn--${v.toLowerCase()}${state.crucialPerson === v ? ' ln-crucial-btn--active' : ''}`}
                onClick={() => onChange({ crucialPerson: state.crucialPerson === v ? null : v })}>
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collaborators (work only) */}
      {domain === 'work' && (
        <div className="ln-detail-row ln-detail-row--collab">
          <span className="ln-detail-label">Collaborators</span>
          <div className="ln-detail-ctrl--collab">
            {state.collaborators.length > 0 && (
              <div className="ln-collab-chips">
                {state.collaborators.map((c, i) => (
                  <span key={i} className="ln-collab-chip">
                    {c}
                    <button type="button" className="ln-collab-remove"
                            onClick={() => onChange({ collaborators: state.collaborators.filter((_,j) => j !== i) })}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="ln-collab-row">
              <input type="text" className="ln-collab-input"
                     value={state.collaboratorInput}
                     onChange={e => onChange({ collaboratorInput: e.target.value })}
                     placeholder="Name or team…" maxLength={60} autoComplete="off"
                     onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCollab(); }}}/>
              <button type="button" className="ln-collab-add"
                      onClick={addCollab} disabled={!state.collaboratorInput.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Score */}
      <div className="ln-detail-row ln-detail-row--score">
        <span className="ln-detail-label">Score</span>
        <div className="ln-detail-ctrl ln-detail-ctrl--score">
          <div className="ln-score-track">
            {scoreRange.map(n => (
              <button key={n} type="button"
                className={`ln-score-btn${state.satisfactoryScore !== null && n <= state.satisfactoryScore ? ' ln-score-btn--filled' : ''}`}
                onClick={() => onChange({ satisfactoryScore: state.satisfactoryScore === n ? null : n })}>
                {n}
              </button>
            ))}
          </div>
          <div className="ln-score-bar-wrap">
            <div className="ln-score-bar-fill"
                 style={{ width: `${state.satisfactoryScore ? (state.satisfactoryScore / 10) * 100 : 0}%` }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function UnifiedSheet({ onClose, initialTab = 1 }: Props) {
  const selectedDate  = useAppStore(s => s.selectedDate);
  const showToast     = useAppStore(s => s.showToast);

  const { data: logTypes = [] } = useLogTypes();
  const createLog               = useCreateLog(selectedDate);
  const setActiveLog            = useSetActiveLog();

  const [tab, setTab] = useState<Tab>(initialTab);

  // ── Tab 1 — Add Log ───────────────────────────────────────────────────────
  const [t1Title,   setT1Title]   = useState('');
  const [t1Domain,  setT1Domain]  = useState<'work'|'personal'>('work');
  const [t1TypeId,  setT1TypeId]  = useState('');
  const [t1Start,   setT1Start]   = useState(() => minsAgo(60));
  const [t1End,     setT1End]     = useState(() => nowHHMM());
  const [t1Details, setT1Details] = useState<DetailsFormState>(initDetails);

  // ── Tab 2 — Add Point ─────────────────────────────────────────────────────
  const [t2Title,   setT2Title]   = useState('');
  const [t2Domain,  setT2Domain]  = useState<'work'|'personal'>('work');
  const [t2TypeId,  setT2TypeId]  = useState('');
  const [t2Time,    setT2Time]    = useState(() => nowHHMM());
  const [t2Details, setT2Details] = useState<DetailsFormState>(initDetails);

  // ── Tab 3 — Start Timer ───────────────────────────────────────────────────
  const [t3Title,   setT3Title]   = useState('');
  const [t3Domain,  setT3Domain]  = useState<'work'|'personal'>('work');
  const [t3TypeId,  setT3TypeId]  = useState('');
  const [t3Planned, setT3Planned] = useState<number | null>(null);
  const [t3Details, setT3Details] = useState<DetailsFormState>(initDetails);

  // ── Save handlers ─────────────────────────────────────────────────────────

  function saveAddLog(e: FormEvent) {
    e.preventDefault();
    if (!t1TypeId) return;
    createLog.mutate({
      startTime:         t1Start,
      endTime:           t1End,
      title:             t1Title,
      logTypeId:         t1TypeId,
      entryType:         'range',
      priority:          t1Details.priority,
      ticketId:          t1Details.ticketId || undefined,
      crucialPerson:     t1Details.crucialPerson,
      collaborators:     t1Details.collaborators,
      satisfactoryScore: t1Details.satisfactoryScore,
    }, {
      onSuccess: () => { showToast('Log saved'); onClose(); },
      onError:   () => showToast('Failed to save log'),
    });
  }

  function saveAddPoint(e: FormEvent) {
    e.preventDefault();
    if (!t2TypeId) return;
    createLog.mutate({
      startTime:         t2Time,
      endTime:           t2Time,
      title:             t2Title,
      logTypeId:         t2TypeId,
      entryType:         'point',
      pointTime:         t2Time,
      priority:          t2Details.priority,
      ticketId:          t2Details.ticketId || undefined,
      crucialPerson:     t2Details.crucialPerson,
      collaborators:     t2Details.collaborators,
      satisfactoryScore: t2Details.satisfactoryScore,
    }, {
      onSuccess: () => { showToast('Point logged'); onClose(); },
      onError:   () => showToast('Failed to save point'),
    });
  }

  function saveStartTimer(e: FormEvent) {
    e.preventDefault();
    if (!t3TypeId) return;
    const logType = logTypes.find(lt => lt._id === t3TypeId);
    setActiveLog.mutate({
      logTypeId:   t3TypeId,
      title:       t3Title || (logType?.name ?? ''),
      startedAt:   new Date().toISOString(),
      plannedMins: t3Planned,
    }, {
      onSuccess: () => { showToast('Timer started'); onClose(); },
      onError:   () => showToast('Failed to start timer'),
    });
  }

  // ── Date label ────────────────────────────────────────────────────────────
  const isToday = selectedDate === (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const dateLabel = isToday ? 'Today' : selectedDate;

  return (
    <>
      <div className="uni-backdrop" onClick={onClose} />
      <div className="uni-sheet">

        {/* Header */}
        <div className="uni-header">
          <div className="uni-tabs">
            {([['Add Log', 1], ['Add Point', 2], ['Start Timer', 3]] as const).map(([label, t]) => (
              <button key={t} className={`uni-tab${tab === t ? ' uni-tab--active' : ''}`}
                      onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>
          <div className="uni-date-ctx">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {dateLabel}
          </div>
        </div>

        {/* ── Tab 1: Add Log ── */}
        {tab === 1 && (
          <form className="uni-form" onSubmit={saveAddLog}>
            <div className="uni-fields">
              <textarea className="ln-title-input" rows={3} placeholder="Title (optional)"
                        value={t1Title} onChange={e => setT1Title(e.target.value)} />
              <TypeSelector logTypes={logTypes} domain={t1Domain} selectedId={t1TypeId}
                            onDomain={setT1Domain} onSelect={setT1TypeId} />
              <TimeInput label="Start" value={t1Start} onChange={setT1Start} />
              <TimeInput label="End"   value={t1End}   onChange={setT1End} />
              <DetailsCard state={t1Details} onChange={p => setT1Details(s => ({...s, ...p}))} domain={t1Domain} />
            </div>
            <div className="uni-actions">
              <button type="button" className="ln-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="ln-save" disabled={!t1TypeId || createLog.isPending}>
                {createLog.isPending ? 'Saving…' : 'Save Log'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab 2: Add Point ── */}
        {tab === 2 && (
          <form className="uni-form" onSubmit={saveAddPoint}>
            <div className="uni-fields">
              <textarea className="ln-title-input" rows={3} placeholder="Title (optional)"
                        value={t2Title} onChange={e => setT2Title(e.target.value)} />
              <TypeSelector logTypes={logTypes} domain={t2Domain} selectedId={t2TypeId}
                            onDomain={setT2Domain} onSelect={setT2TypeId} />
              <TimeInput label="Time" value={t2Time} onChange={setT2Time} />
              <DetailsCard state={t2Details} onChange={p => setT2Details(s => ({...s, ...p}))} domain={t2Domain} />
            </div>
            <div className="uni-actions">
              <button type="button" className="ln-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="ln-save" disabled={!t2TypeId || createLog.isPending}>
                {createLog.isPending ? 'Saving…' : 'Add Point'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab 3: Start Timer ── */}
        {tab === 3 && (
          <form className="uni-form" onSubmit={saveStartTimer}>
            <div className="uni-fields">
              <textarea className="ln-title-input" rows={3} placeholder="Title (optional — defaults to type name)"
                        value={t3Title} onChange={e => setT3Title(e.target.value)} />
              <TypeSelector logTypes={logTypes} domain={t3Domain} selectedId={t3TypeId}
                            onDomain={setT3Domain} onSelect={setT3TypeId} />
              <DetailsCard
                state={t3Details}
                onChange={p => setT3Details(s => ({...s, ...p}))}
                domain={t3Domain}
                showPlan
                planned={t3Planned}
                onPlanned={setT3Planned}
              />
            </div>
            <div className="uni-actions">
              <button type="button" className="ln-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="ln-save ln-save--start" disabled={!t3TypeId || setActiveLog.isPending}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {setActiveLog.isPending ? 'Starting…' : 'Start Timer'}
              </button>
            </div>
          </form>
        )}

      </div>
    </>
  );
}
