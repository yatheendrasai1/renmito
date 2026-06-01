import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreferences, useUpdateFeatures } from '@/hooks/usePreferences';
import api from '@/lib/api';
import './IntelligencePage.css';

// ── Config query ──────────────────────────────────────────────────────────────

interface AccountConfig { geminiConfigured: boolean; }

function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<AccountConfig>('/config').then(r => r.data),
    staleTime: 60_000,
  });
}

// ── Prompt strings ────────────────────────────────────────────────────────────

const FOOD_SYSTEM = `You are a precise nutrition analysis assistant. When given a meal log, analyse the food items and return a structured nutritional breakdown.

Guidelines:
- Base calorie estimates on standard portion sizes if quantity is not specified
- Use average values for dishes unless cooking method/oil suggests otherwise
- For cumulative daily totals, sum across all meals listed as previous meals
- Keep responses concise and structured exactly as requested
- If information is insufficient for a field, state "Insufficient data" rather than guessing wildly
- Express confidence where data allows; flag assumptions clearly`;

const FOOD_USER = `Analyse this meal log:
- Meal: [breakfast/lunch/dinner]
- Time: [HH:MM]
- Items: [dish name, quantity, cooking method, oil used]
- User profile: [age, weight, height, gender, activity level]

Previous meals today:
[list of earlier meal logs for the day, or "None yet"]

Return:
1. Total calories and % of daily quota
2. Macronutrient breakdown (carbs, protein, fat in g and %)
3. Fat % of total calories, broken by saturated/unsaturated if possible
4. Protein and fibre presence (g), with a quality note
5. Cumulative totals for the day so far (including this meal)`;

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab  = 'models' | 'prompts' | 'features';
type Step = 'list' | 'choose' | 'gemini-key';
const TABS: Tab[] = ['models', 'prompts', 'features'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const { data: cfg, refetch: refetchCfg } = useConfig();
  const { data: prefs } = usePreferences();
  const updateFeatures = useUpdateFeatures();

  const geminiConfigured    = cfg?.geminiConfigured ?? false;
  const foodInsightsEnabled = prefs?.features?.foodInsights?.enabled ?? false;

  const [activeTab,  setActiveTab]  = useState<Tab>('models');
  const [step,       setStep]       = useState<Step>('list');
  const [apiKey,     setApiKey]     = useState('');
  const [showKey,    setShowKey]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [errMsg,     setErrMsg]     = useState('');
  const [okMsg,      setOkMsg]      = useState('');
  const [togglingFI, setTogglingFI] = useState(false);

  const tabIndex    = TABS.indexOf(activeTab);
  const touchStartX = useRef(0);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'models') { setStep('list'); setApiKey(''); setErrMsg(''); setOkMsg(''); }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.changedTouches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    const i = tabIndex;
    if (diff >  50 && i < TABS.length - 1) setActiveTab(TABS[i + 1]);
    if (diff < -50 && i > 0)               setActiveTab(TABS[i - 1]);
  }

  function cancelKey() { setStep('list'); setApiKey(''); setErrMsg(''); setOkMsg(''); }

  async function saveKey() {
    if (saving || !apiKey.trim()) return;
    setSaving(true); setErrMsg(''); setOkMsg('');
    try {
      const { data } = await api.post<{ message: string }>('/config/gemini-key', { apiKey: apiKey.trim() });
      setOkMsg(data.message);
      setApiKey('');
      refetchCfg();
      setTimeout(() => { setOkMsg(''); setStep('list'); }, 2000);
    } catch (err: any) {
      setErrMsg(err?.response?.data?.error ?? 'Failed to verify API key.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFoodInsights() {
    if (togglingFI || !geminiConfigured) return;
    setTogglingFI(true);
    try {
      await updateFeatures.mutateAsync({ foodInsights: { enabled: !foodInsightsEnabled } });
    } finally {
      setTogglingFI(false);
    }
  }

  return (
    <div className="intel-page">

      {/* ── Header ── */}
      <div className="intel-header">
        <div className="intel-header-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
          </svg>
        </div>
        <div className="intel-header-text">
          <h2 className="intel-title">Intelligence</h2>
          <p className="intel-sub">AI models, prompts &amp; features</p>
        </div>
        {geminiConfigured && <span className="intel-badge">Connected</span>}
      </div>

      {/* ── Tab bar ── */}
      <div className="intel-tab-bar">
        {TABS.map(t => (
          <button key={t}
                  className={`intel-tab-btn${activeTab === t ? ' intel-tab-btn--active' : ''}`}
                  onClick={() => selectTab(t)} type="button">
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div className="intel-tab-indicator" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
      </div>

      {/* ── Swipeable panels ── */}
      <div className="intel-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="intel-track" style={{ transform: `translateX(${-tabIndex * 33.333}%)` }}>

          {/* Models */}
          <div className="intel-panel">
            {!geminiConfigured && step === 'list' && (
              <div className="model-empty">
                <div className="model-empty-art">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.25">
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                  </svg>
                </div>
                <p className="model-empty-text">No AI model connected</p>
                <p className="model-empty-hint">Connect a model to unlock Renni and smart log parsing.</p>
                <button className="model-add-btn" onClick={() => setStep('choose')} type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Connect a model
                </button>
              </div>
            )}

            {geminiConfigured && step === 'list' && (
              <div className="model-connected">
                <div className="intel-section-label">Connected Model</div>
                <div className="model-card">
                  <div className="model-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div className="model-card-info">
                    <span className="model-card-name">Google Gemini</span>
                    <span className="model-card-model">gemini-2.5-flash-lite</span>
                    <span className="model-card-desc">Powers Renni chat &amp; smart log parsing</span>
                  </div>
                  <span className="intel-status-badge intel-status-badge--ok">Active</span>
                </div>
                <div className="model-actions">
                  <button className="model-action-btn" onClick={() => setStep('gemini-key')} type="button">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Update API key
                  </button>
                </div>
                <div className="intel-section-label" style={{ marginTop: 24 }}>Used by</div>
                <div className="feature-chip-list">
                  <div className="feature-chip">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Renni Chat
                  </div>
                  <div className="feature-chip">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    Log Parsing
                  </div>
                </div>
              </div>
            )}

            {step === 'choose' && (
              <div className="choose-provider">
                <div className="intel-section-label">Choose a provider</div>
                <button className="provider-card" onClick={() => setStep('gemini-key')} type="button">
                  <div className="provider-card-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div className="provider-card-info">
                    <span className="provider-card-name">Google Gemini</span>
                    <span className="provider-card-desc">Fast, multimodal AI — gemini-2.5-flash-lite</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <button className="back-btn" onClick={() => setStep('list')} type="button">← Back</button>
              </div>
            )}

            {step === 'gemini-key' && (
              <div className="key-form">
                <div className="key-form-header">
                  <div className="provider-card-icon provider-card-icon--sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <span className="key-form-title">Gemini API Key</span>
                </div>
                <div className="key-row">
                  <input className="key-input"
                         type={showKey ? 'text' : 'password'}
                         value={apiKey}
                         placeholder="AIza…"
                         autoComplete="off"
                         spellCheck={false}
                         onChange={e => setApiKey(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && saveKey()} />
                  <button className="key-toggle" onClick={() => setShowKey(s => !s)} type="button">
                    {showKey ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                <p className="key-hint">
                  Get your key from{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="key-link">
                    Google AI Studio
                  </a>. The key is verified before saving.
                </p>
                {errMsg && <div className="intel-feedback intel-feedback--err">{errMsg}</div>}
                {okMsg  && <div className="intel-feedback intel-feedback--ok">{okMsg}</div>}
                <div className="key-form-footer">
                  <button className="intel-btn-cancel" onClick={cancelKey} type="button">Cancel</button>
                  <button className="intel-btn-save" onClick={saveKey}
                          disabled={saving || !apiKey.trim()} type="button">
                    {saving ? 'Verifying…' : 'Verify & Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Prompts */}
          <div className="intel-panel">
            <div className="intel-section-label" style={{ marginBottom: 12 }}>System Prompts</div>
            <div className="prompt-card">
              <div className="prompt-card-head">
                <div className="prompt-card-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                    <path d="M7 2v20"/>
                    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                  </svg>
                </div>
                <div className="prompt-card-meta">
                  <span className="prompt-card-name">Food Insights Analyser</span>
                  <span className="prompt-card-tag">system</span>
                </div>
              </div>
              <div className="prompt-card-desc">
                Used by the <strong>Extract Food Insights</strong> feature to analyse meal logs and return nutritional breakdowns.
              </div>
              <div className="prompt-body">
                <div className="prompt-section-label">System instruction</div>
                <pre className="prompt-pre">{FOOD_SYSTEM}</pre>
                <div className="prompt-section-label" style={{ marginTop: 10 }}>User prompt template</div>
                <pre className="prompt-pre">{FOOD_USER}</pre>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="intel-panel">
            <div className="intel-section-label" style={{ marginBottom: 12 }}>AI Features</div>
            {!geminiConfigured && (
              <div className="feature-no-model">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Connect a model in the Models tab to enable features.
              </div>
            )}
            <div className={`feat-card${!geminiConfigured ? ' feat-card--disabled' : ''}`}>
              <div className="feat-card-top">
                <div className="feat-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                    <path d="M7 2v20"/>
                    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                  </svg>
                </div>
                <div className="feat-card-meta">
                  <span className="feat-card-name">Extract Food Insights from food log</span>
                  <span className="feat-card-sub">Analyses breakfast, lunch, dinner &amp; food intake logs to return calorie counts, macros, and daily totals.</span>
                </div>
                <button className={`feat-toggle${foodInsightsEnabled ? ' feat-toggle--on' : ''}`}
                        disabled={!geminiConfigured || togglingFI}
                        onClick={toggleFoodInsights}
                        type="button"
                        title={foodInsightsEnabled ? 'Disable' : 'Enable'}>
                  <span className="feat-toggle-knob" />
                </button>
              </div>
              <div className="feat-card-footer">
                <span className="feat-tag">personal domain</span>
                <span className="feat-tag">auto on log save</span>
                <span className={`feat-status${foodInsightsEnabled ? ' feat-status--on' : ''}`}>
                  {foodInsightsEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
