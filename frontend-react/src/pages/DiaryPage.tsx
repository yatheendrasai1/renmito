import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import './DiaryPage.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Sentiment { label: string; emoji: string; }
interface Episode {
  _id: string;
  date: string;
  episodeName: string;
  content: string;
  seasonId: string | null;
  sentiment: Sentiment;
  dayNumber: number;
  startedWritingAt: string | null;
}
interface Season {
  _id: string;
  name: string;
  color: string;
  startDate: string;
}

const SENTIMENTS: Sentiment[] = [
  { label: 'Calm',       emoji: '🌿' },
  { label: 'Happy',      emoji: '😊' },
  { label: 'Grateful',   emoji: '🙏' },
  { label: 'Energized',  emoji: '⚡' },
  { label: 'Focused',    emoji: '🎯' },
  { label: 'Creative',   emoji: '🎨' },
  { label: 'Reflective', emoji: '🌙' },
  { label: 'Anxious',    emoji: '😰' },
  { label: 'Low',        emoji: '😔' },
  { label: 'Tired',      emoji: '😴' },
];

const DOW_ABBR = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function dateToStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchEpisode(date: string): Promise<Episode | null> {
  try {
    const res = await api.get<Episode>(`/episodes/${date}`);
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

async function fetchSeasons(): Promise<Season[]> {
  return api.get<Season[]>('/seasons').then(r => r.data);
}

// ── Inline calendar ───────────────────────────────────────────────────────────

interface CalProps {
  selYear: number; selMonth: number; selDay: number;
  onPick: (y: number, m: number, d: number) => void;
  onClose: () => void;
}

function CalPopover({ selYear, selMonth, selDay, onPick, onClose }: CalProps) {
  const [vy, setVy] = useState(selYear);
  const [vm, setVm] = useState(selMonth);

  const today     = new Date();
  const firstDow  = new Date(vy, vm - 1, 1).getDay();
  const lastDay   = new Date(vy, vm, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);

  function shift(delta: number) {
    let m = vm + delta, y = vy;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setVy(y); setVm(m);
  }

  return (
    <>
      <div className="cal-backdrop" onClick={onClose} />
      <div className="cal-popover" onClick={e => e.stopPropagation()}>
        <div className="cal-header">
          <button className="cal-month-nav" onClick={() => shift(-1)}>‹</button>
          <span className="cal-month-label">
            {new Date(vy, vm - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button className="cal-month-nav" onClick={() => shift(1)}>›</button>
        </div>
        <div className="cal-grid">
          {DOW_ABBR.map(d => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="cal-day cal-day--empty" />;
            const isSel   = day === selDay && vm === selMonth && vy === selYear;
            const isToday = day === today.getDate() && vm === today.getMonth()+1 && vy === today.getFullYear();
            return (
              <button key={day}
                className={`cal-day${isSel ? ' cal-day--selected' : ''}${isToday && !isSel ? ' cal-day--today' : ''}`}
                onClick={() => { onPick(vy, vm, day); onClose(); }}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiaryPage() {
  const today       = new Date();
  const [selYear,   setSelYear]   = useState(today.getFullYear());
  const [selMonth,  setSelMonth]  = useState(today.getMonth() + 1);
  const [selDay,    setSelDay]    = useState(today.getDate());

  const [calOpen,           setCalOpen]           = useState(false);
  const [seasonPickerOpen,  setSeasonPickerOpen]  = useState(false);
  const [sentPickerOpen,    setSentPickerOpen]    = useState(false);
  const [overflowOpen,      setOverflowOpen]      = useState(false);

  const [saveStatus, setSaveStatus] = useState<'' | 'saving' | 'saved'>('');
  const [wordCount,  setWordCount]  = useState(0);
  const [readTime,   setReadTime]   = useState(1);
  const [boldActive,   setBoldActive]   = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);

  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonDate, setNewSeasonDate] = useState('');

  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef  = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const episodeRef = useRef<Episode | null>(null);

  const qc = useQueryClient();
  const dateStr = dateToStr(selYear, selMonth, selDay);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: episode } = useQuery({
    queryKey: ['episode', dateStr],
    queryFn:  () => fetchEpisode(dateStr),
    staleTime: 30_000,
  });

  const { data: seasons = [], refetch: refetchSeasons } = useQuery({
    queryKey: ['seasons'],
    queryFn:  fetchSeasons,
    staleTime: 60_000,
  });

  // Keep ref in sync so auto-save closure can read it
  useEffect(() => { episodeRef.current = episode ?? null; }, [episode]);

  // Apply loaded episode to editors
  useEffect(() => {
    if (!titleRef.current || !bodyRef.current) return;
    titleRef.current.textContent = episode?.episodeName ?? '';
    bodyRef.current.innerHTML    = episode?.content ?? '';
    updateWordCount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?._id, dateStr]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const upsertMut = useMutation({
    mutationFn: (body: object) => api.put<Episode>(`/episodes/${dateStr}`, body).then(r => r.data),
    onSuccess: (ep) => {
      qc.setQueryData(['episode', dateStr], ep);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/episodes/${dateStr}`),
    onSuccess:  () => {
      qc.setQueryData(['episode', dateStr], null);
      if (titleRef.current) titleRef.current.textContent = '';
      if (bodyRef.current)  bodyRef.current.innerHTML    = '';
      setWordCount(0); setReadTime(1); setSaveStatus('');
    },
  });

  const createSeasonMut = useMutation({
    mutationFn: (body: { name: string; startDate: string }) =>
      api.post<Season>('/seasons', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getEditorPayload(overrides?: Partial<{ seasonId: string | null; sentiment: Sentiment }>) {
    return {
      episodeName: titleRef.current?.textContent?.trim() ?? '',
      content:     bodyRef.current?.innerHTML ?? '',
      seasonId:    overrides?.seasonId !== undefined ? overrides.seasonId : (episodeRef.current?.seasonId ?? null),
      sentiment:   overrides?.sentiment ?? episodeRef.current?.sentiment ?? { label: '', emoji: '' },
    };
  }

  function triggerAutoSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await upsertMut.mutateAsync(getEditorPayload());
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch {
        setSaveStatus('');
      }
    }, 800);
  }

  function updateWordCount() {
    const text = (bodyRef.current?.textContent ?? '').trim();
    const wc   = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
    setWordCount(wc);
    setReadTime(Math.max(1, Math.ceil(wc / 200)));
  }

  function updateFormatState() {
    setBoldActive(document.queryCommandState('bold'));
    setItalicActive(document.queryCommandState('italic'));
  }

  function closeOverflows() {
    setOverflowOpen(false);
    setCalOpen(false);
  }

  // ── Format commands ───────────────────────────────────────────────────────────

  function formatBold() {
    bodyRef.current?.focus();
    document.execCommand('bold', false, '');
    updateFormatState();
    triggerAutoSave();
  }

  function formatItalic() {
    bodyRef.current?.focus();
    document.execCommand('italic', false, '');
    updateFormatState();
    triggerAutoSave();
  }

  function applyHighlight() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !bodyRef.current?.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    const mark  = document.createElement('mark');
    mark.className = 'highlight-orange';
    try {
      range.surroundContents(mark);
    } catch {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
    sel.removeAllRanges();
    setHighlightMode(false);
    updateWordCount();
    triggerAutoSave();
  }

  function toggleHighlightMode() {
    if (!highlightMode) {
      applyHighlight();
    } else {
      setHighlightMode(false);
    }
  }

  // ── Season picker ─────────────────────────────────────────────────────────────

  function openSeasonPicker() {
    setNewSeasonName('');
    setNewSeasonDate(dateStr);
    refetchSeasons();
    setSeasonPickerOpen(true);
  }

  async function handleSelectSeason(s: Season) {
    const ep = await upsertMut.mutateAsync(getEditorPayload({ seasonId: s._id }));
    episodeRef.current = ep;
    setSeasonPickerOpen(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 2000);
  }

  async function handleCreateAndSelectSeason() {
    if (!newSeasonName.trim() || !newSeasonDate) return;
    const s = await createSeasonMut.mutateAsync({ name: newSeasonName.trim(), startDate: newSeasonDate });
    await handleSelectSeason(s);
  }

  // ── Sentiment picker ──────────────────────────────────────────────────────────

  async function handleSelectSentiment(s: Sentiment) {
    const ep = await upsertMut.mutateAsync(getEditorPayload({ sentiment: s }));
    episodeRef.current = ep;
    setSentPickerOpen(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 2000);
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  function pickDay(y: number, m: number, d: number) {
    setSelYear(y); setSelMonth(m); setSelDay(d);
  }

  const currentSeason = episode?.seasonId
    ? seasons.find(s => s._id === episode.seasonId) ?? null
    : null;

  const weekdayMonthLabel = new Date(selYear, selMonth - 1, selDay)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'long', year: 'numeric' });

  const startedWritingTime = episode?.startedWritingAt
    ? new Date(episode.startedWritingAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="diary-page" onClick={closeOverflows}>

      {/* Season bottom sheet */}
      {seasonPickerOpen && (
        <div className="sheet-overlay" onClick={() => setSeasonPickerOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Add to a Season</div>
            {seasons.length > 0 ? (
              <div className="season-list">
                {seasons.map(s => (
                  <div key={s._id}
                       className={`season-list-item${episode?.seasonId === s._id ? ' season-list-item--selected' : ''}`}
                       onClick={() => handleSelectSeason(s)}>
                    <span className="sl-dot" style={{ background: s.color }} />
                    <span className="sl-name">{s.name}</span>
                    <span className="sl-date">{s.startDate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sheet-empty">No seasons yet — create one below.</div>
            )}
            <div className="sheet-divider" />
            <div className="new-season-label">New Season</div>
            <input className="sheet-input" placeholder="Season name"
                   value={newSeasonName} onChange={e => setNewSeasonName(e.target.value)} />
            <input className="sheet-input" type="date"
                   value={newSeasonDate} onChange={e => setNewSeasonDate(e.target.value)} />
            <div className="sheet-actions">
              <button className="diary-btn diary-btn--ghost" onClick={() => setSeasonPickerOpen(false)}>Cancel</button>
              <button className="diary-btn diary-btn--primary"
                      disabled={!newSeasonName.trim() || !newSeasonDate}
                      onClick={handleCreateAndSelectSeason}>
                Create &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sentiment bottom sheet */}
      {sentPickerOpen && (
        <div className="sheet-overlay" onClick={() => setSentPickerOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">How are you feeling?</div>
            <div className="sentiment-grid">
              {SENTIMENTS.map(s => (
                <div key={s.label}
                     className={`sentiment-option${episode?.sentiment?.label === s.label ? ' sentiment-option--selected' : ''}`}
                     onClick={() => handleSelectSentiment(s)}>
                  <span className="sent-emoji">{s.emoji}</span>
                  <span className="sent-label">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="sheet-actions" style={{ marginTop: 4 }}>
              <button className="diary-btn diary-btn--ghost" onClick={() => setSentPickerOpen(false)}>Cancel</button>
              {episode?.sentiment?.label && (
                <button className="diary-btn diary-btn--ghost" onClick={() => handleSelectSentiment({ label: '', emoji: '' })}>Clear</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-header */}
      <div className="sub-header" onClick={e => e.stopPropagation()}>
        <button className="back-btn" disabled>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Diary
        </button>
        <div className="sh-spacer" />
        <button className="sh-icon-btn" onClick={() => { setCalOpen(c => !c); setOverflowOpen(false); }} aria-label="Calendar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </button>
        <div style={{ position: 'relative' }}>
          <button className="sh-icon-btn" onClick={e => { e.stopPropagation(); setOverflowOpen(o => !o); setCalOpen(false); }} aria-label="More options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="5"  r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
          {overflowOpen && (
            <div className="overflow-menu" onClick={e => e.stopPropagation()}>
              <button className="om-item om-item--danger" onClick={() => { setOverflowOpen(false); deleteMut.mutate(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Delete Entry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="diary-scroll">

        {/* Hero card */}
        <div className="hero-card">
          {/* Date row — relative so CalPopover anchors here */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '10px' }}>
            <button className="date-chip" style={{ marginBottom: 0 }} onClick={e => { e.stopPropagation(); setCalOpen(c => !c); setOverflowOpen(false); }}>
              <span className="date-num-badge">{selDay}</span>
              <span className="date-chip-label">{weekdayMonthLabel}</span>
              <span className="date-chip-chevron">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </button>
            {calOpen && (
              <CalPopover
                selYear={selYear} selMonth={selMonth} selDay={selDay}
                onPick={pickDay} onClose={() => setCalOpen(false)}
              />
            )}
          </div>

          <div className="title-label">Episode Title</div>
          <div
            ref={titleRef}
            className="title-editable"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Name this episode…"
            onInput={triggerAutoSave}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.focus(); } }}
          />

          <div className="hero-divider" />

          {/* Meta row: day info left · mood + season right */}
          <div className="hero-meta-row">
            <span className="hero-meta-left">
              Day {episode?.dayNumber ?? 1}
              {startedWritingTime && ` · Started ${startedWritingTime}`}
            </span>
            <div className="hero-meta-right">
              <button
                className={`sentiment-chip${!episode?.sentiment?.label ? ' sentiment-chip--empty' : ''}`}
                onClick={e => { e.stopPropagation(); setSentPickerOpen(true); }}>
                {episode?.sentiment?.label
                  ? `${episode.sentiment.emoji} ${episode.sentiment.label}`
                  : '+ Mood'}
              </button>
              {currentSeason ? (
                <button className="season-chip" onClick={e => { e.stopPropagation(); openSeasonPicker(); }}>
                  <span className="season-dot" style={{ background: currentSeason.color }} />
                  {currentSeason.name}
                </button>
              ) : (
                <button className="season-add-chip" onClick={e => { e.stopPropagation(); openSeasonPicker(); }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5"  y1="12" x2="19" y2="12"/>
                  </svg>
                  Season
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notepad body — full-bleed below hero card */}
        <div className="notepad-area" onClick={() => bodyRef.current?.focus()}>
          <div
            ref={bodyRef}
            className="body-editable"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="What happened today…"
            onInput={() => { updateWordCount(); updateFormatState(); triggerAutoSave(); }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="fmt-toolbar">
        <button className={`fmt-btn${boldActive ? ' fmt-btn--active' : ''}`} onClick={formatBold} title="Bold">
          <strong>B</strong>
        </button>
        <button className={`fmt-btn${italicActive ? ' fmt-btn--active' : ''}`} onClick={formatItalic} title="Italic">
          <em>I</em>
        </button>
        <button
          className={`fmt-btn fmt-btn--highlight${highlightMode ? ' fmt-btn--active' : ''}`}
          onClick={toggleHighlightMode} title="Highlight">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button className="fmt-btn" disabled style={{ opacity: 0.4, cursor: 'default' }} title="Activity (coming soon)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </button>

        <div className="fmt-spacer" />

        {saveStatus === 'saving' && (
          <span className="save-pill save-pill--saving"><span className="save-dot" />saving…</span>
        )}
        {saveStatus === 'saved' && (
          <span className="save-pill save-pill--saved"><span className="save-dot" />saved</span>
        )}

        <div className="word-count-pill">
          <span>{wordCount}</span>
          <span className="wc-sep">·</span>
          <span>{readTime} min</span>
        </div>
      </div>
    </div>
  );
}
