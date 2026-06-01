import { useState, useEffect, useRef } from 'react';
import { jiraApi, type TicketQuery } from '@/lib/jiraApi';
import './JiraConfigPage.css';

const MAX_QUERIES = 15;

// ── JIRA logo SVG ─────────────────────────────────────────────────────────────
function JiraLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2.67L2.67 16 9.33 22.67 22.67 9.33 16 2.67Z" fill="#2684FF"/>
      <path d="M16 29.33L29.33 16 22.67 9.33 9.33 22.67 16 29.33Z" fill="#2684FF" opacity="0.55"/>
    </svg>
  );
}

// ── Query form (shared for create + edit) ─────────────────────────────────────
interface QueryFormProps {
  initialName?:   string;
  initialJql?:    string;
  sourceJql?:     string;    // clone: original jql — verification disabled until changed
  submitLabel:    string;
  onSubmit:       (name: string, jql: string) => Promise<void>;
  onCancel:       () => void;
  error?:         string;
}

const PLACEHOLDERS = [
  { label: '{{log-title}}', hint: 'Replaced with the log description when searching' },
];

function QueryForm({ initialName = '', initialJql = '', sourceJql, submitLabel, onSubmit, onCancel, error }: QueryFormProps) {
  const [name,      setName]      = useState(initialName);
  const [jql,       setJql]       = useState(initialJql);
  const [verifying, setVerifying] = useState(false);
  const jqlRef = useRef<HTMLTextAreaElement>(null);

  const isClone    = sourceJql !== undefined;
  const jqlChanged = !isClone || jql.trim() !== sourceJql!.trim();
  const canVerify  = name.trim() && jql.trim() && jqlChanged && !verifying;

  function insertPlaceholder(text: string) {
    const el = jqlRef.current;
    if (!el) { setJql(j => j + text); return; }
    const start = el.selectionStart ?? jql.length;
    const end   = el.selectionEnd   ?? jql.length;
    const next  = jql.slice(0, start) + text + jql.slice(end);
    setJql(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    });
  }

  async function handleVerify() {
    if (!canVerify) return;
    setVerifying(true);
    try {
      await onSubmit(name.trim(), jql.trim());
    } catch {
      // error surfaced via parent's error prop
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="jq-form">
      <div className="jq-form-field">
        <label className="jq-form-lbl">Query Name</label>
        <input
          className="jq-form-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. My Sprint Tickets"
          maxLength={80}
          disabled={verifying}
        />
      </div>

      <div className="jq-form-field">
        <div className="jq-form-jql-header">
          <label className="jq-form-lbl">JQL</label>
          <div className="jq-placeholder-pills">
            {PLACEHOLDERS.map(p => (
              <button
                key={p.label}
                type="button"
                className="jq-placeholder-pill"
                title={p.hint}
                onClick={() => insertPlaceholder(p.label)}
                disabled={verifying}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          ref={jqlRef}
          className="jq-form-jql"
          value={jql}
          onChange={e => setJql(e.target.value)}
          placeholder={'project = ENG AND sprint in openSprints() ORDER BY priority DESC'}
          rows={4}
          spellCheck={false}
          disabled={verifying}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleVerify(); } }}
        />
        {isClone && !jqlChanged && (
          <span className="jq-form-hint jq-form-hint--warn">
            Modify the JQL to enable verification.
          </span>
        )}
        {isClone && jqlChanged && (
          <span className="jq-form-hint">JQL modified — you can now verify.</span>
        )}
        {jql.includes('{{log-title}}') && (
          <span className="jq-form-hint">
            <strong>{'{{log-title}}'}</strong> will be replaced with the log description at search time.
          </span>
        )}
      </div>

      {error && <div className="jq-form-error">{error}</div>}

      <div className="jq-form-actions">
        <button type="button" className="jq-btn jq-btn--cancel" onClick={onCancel} disabled={verifying}>
          Cancel
        </button>
        <button
          type="button"
          className="jq-btn jq-btn--verify"
          onClick={handleVerify}
          disabled={!canVerify}
        >
          {verifying && <span className="jira-spinner" />}
          {verifying ? 'Verifying…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JiraConfigPage() {
  // ── Credential state ───────────────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAs, setConnectedAs] = useState('');
  const [showToken,   setShowToken]   = useState(false);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');
  const [baseUrl,     setBaseUrl]     = useState('');
  const [email,       setEmail]       = useState('');
  const [apiToken,    setApiToken]    = useState('');

  // ── Query state ────────────────────────────────────────────────────────────
  const [queries,       setQueries]       = useState<TicketQuery[]>([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [showNewForm,   setShowNewForm]   = useState(false);
  const [newFormError,  setNewFormError]  = useState('');
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editFormError, setEditFormError] = useState('');
  const [deleteTarget,  setDeleteTarget]  = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [cloningId,     setCloningId]     = useState<string | null>(null);

  const canSave = isConnected
    ? !!(baseUrl.trim() && email.trim())
    : !!(baseUrl.trim() && email.trim() && apiToken.trim());

  function clearFeedback() { setErrorMsg(''); setSuccessMsg(''); }

  function flashSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  // ── Load config on mount ───────────────────────────────────────────────────
  useEffect(() => {
    jiraApi.getConfig()
      .then(config => {
        if (config) {
          setIsConnected(true);
          setBaseUrl(config.baseUrl);
          setEmail(config.email);
          jiraApi.testConnection()
            .then(res => setConnectedAs(res.displayName))
            .catch(() => setConnectedAs(config.email));
          loadQueries();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadQueries() {
    setQueriesLoading(true);
    try {
      const qs = await jiraApi.listQueries();
      setQueries(qs);
    } catch {
      // non-critical
    } finally {
      setQueriesLoading(false);
    }
  }

  // ── Credential handlers ────────────────────────────────────────────────────
  async function handleSave() {
    if (!canSave || saving) return;
    clearFeedback();
    setSaving(true);
    const tokenToSend = (isConnected && !apiToken.trim()) ? '••••••••' : apiToken;
    try {
      await jiraApi.saveConfig({ baseUrl, email, apiToken: tokenToSend });
      setIsConnected(true);
      setApiToken('');
      flashSuccess('JIRA credentials saved.');
      jiraApi.testConnection()
        .then(res => setConnectedAs(res.displayName))
        .catch(() => setConnectedAs(email));
      loadQueries();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to save. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    clearFeedback();
    setTesting(true);
    try {
      const res = await jiraApi.testConnection();
      setConnectedAs(res.displayName);
      flashSuccess(`Connected as ${res.displayName}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Connection test failed. Check your credentials.';
      setErrorMsg(msg);
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove() {
    clearFeedback();
    setSaving(true);
    try {
      await jiraApi.deleteConfig();
      setIsConnected(false); setConnectedAs('');
      setBaseUrl(''); setEmail(''); setApiToken('');
      setQueries([]);
      flashSuccess('JIRA disconnected.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to disconnect.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Query handlers ─────────────────────────────────────────────────────────
  async function handleCreateQuery(name: string, jql: string) {
    setNewFormError('');
    try {
      const q = await jiraApi.createQuery(name, jql);
      setQueries(prev => [q, ...prev]);
      setShowNewForm(false);
      flashSuccess(`Query "${q.name}" saved.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Verification failed. Check your JQL.';
      setNewFormError(msg);
      throw err;
    }
  }

  async function handleUpdateQuery(id: string, name: string, jql: string) {
    setEditFormError('');
    try {
      const q = await jiraApi.updateQuery(id, name, jql);
      setQueries(prev => prev.map(x => x._id === id ? q : x));
      setEditingId(null);
      flashSuccess(`Query "${q.name}" updated.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Verification failed. Check your JQL.';
      setEditFormError(msg);
      throw err;
    }
  }

  async function handleDeleteQuery(id: string) {
    setDeletingId(id);
    try {
      await jiraApi.deleteQuery(id);
      setQueries(prev => prev.filter(q => q._id !== id));
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCloneQuery(id: string) {
    setCloningId(id);
    try {
      const clone = await jiraApi.cloneQuery(id);
      setQueries(prev => [clone, ...prev]);
      setEditingId(clone._id);
      setEditFormError('');
    } catch {
      // ignore
    } finally {
      setCloningId(null);
    }
  }

  const editingQuery = queries.find(q => q._id === editingId) ?? null;

  return (
    <div className="jira-page">

      {/* ── Header ── */}
      <div className="jira-page-header">
        <div className="jira-page-header-icon">
          <JiraLogo size={20} />
        </div>
        <div>
          <h2 className="jira-page-title">JIRA Integration</h2>
          <p className="jira-page-sub">Connect your Atlassian account to link work logs to JIRA tickets.</p>
        </div>
      </div>

      {/* ── Status banner ── */}
      {!loading && (
        <div className={`jira-status-banner${isConnected ? ' jira-status-banner--connected' : ''}`}>
          <span className={`jira-status-dot${isConnected ? ' jira-status-dot--on' : ''}`} />
          <span className="jira-status-text">
            {isConnected ? `Connected as ${connectedAs}` : 'Not connected'}
          </span>
          {isConnected && (
            <button className="jira-status-remove" onClick={handleRemove} disabled={saving || testing}>
              Disconnect
            </button>
          )}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="jira-skeleton">
          <div className="jira-sk-line jira-sk-line--wide" />
          <div className="jira-sk-line" />
          <div className="jira-sk-line" />
        </div>
      )}

      {/* ── Credentials form ── */}
      {!loading && (
        <div className="jira-form">
          <div className="jira-field">
            <label className="jira-label">JIRA Base URL</label>
            <input className="jira-input" type="url"
              placeholder="https://yourcompany.atlassian.net"
              value={baseUrl} onChange={e => setBaseUrl(e.target.value)} disabled={saving} />
            <span className="jira-hint">Your Atlassian workspace URL.</span>
          </div>
          <div className="jira-field">
            <label className="jira-label">Atlassian Email</label>
            <input className="jira-input" type="email"
              placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} disabled={saving} />
          </div>
          <div className="jira-field">
            <label className="jira-label">API Token</label>
            <div className="jira-token-row">
              <input className="jira-input"
                type={showToken ? 'text' : 'password'}
                placeholder={isConnected ? '••••••••  (leave blank to keep current)' : 'Paste your API token'}
                value={apiToken} onChange={e => setApiToken(e.target.value)} disabled={saving} />
              <button className="jira-token-toggle" type="button" onClick={() => setShowToken(v => !v)}
                title={showToken ? 'Hide' : 'Show'}>
                {showToken ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <span className="jira-hint">
              Generate at{' '}
              <a className="jira-link" href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank" rel="noopener noreferrer">
                id.atlassian.com → Security → API tokens
              </a>.
              {' '}Copy it immediately — it's shown only once.
            </span>
          </div>

          {errorMsg   && <div className="jira-feedback jira-feedback--error">{errorMsg}</div>}
          {successMsg && <div className="jira-feedback jira-feedback--ok">{successMsg}</div>}

          <div className="jira-actions">
            <button className="jira-btn jira-btn--test" onClick={handleTest}
              disabled={saving || testing || !isConnected}>
              {testing && <span className="jira-spinner" />}
              {!testing && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button className="jira-btn jira-btn--save" onClick={handleSave}
              disabled={saving || testing || !canSave}>
              {saving && <span className="jira-spinner" />}
              {saving ? 'Saving…' : isConnected ? 'Update' : 'Save & Connect'}
            </button>
          </div>
        </div>
      )}

      {/* ── Stored Queries ── */}
      {!loading && isConnected && (
        <div className="jq-section">
          <div className="jq-section-header">
            <div>
              <h3 className="jq-section-title">Stored Queries</h3>
              <p className="jq-section-sub">Save JQL queries to quickly search JIRA when logging work.</p>
            </div>
            {queries.length < MAX_QUERIES && !showNewForm && (
              <button className="jq-add-btn" onClick={() => { setShowNewForm(true); setNewFormError(''); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                + Query
              </button>
            )}
            {queries.length >= MAX_QUERIES && (
              <span className="jq-limit-note">Limit of {MAX_QUERIES} reached</span>
            )}
          </div>

          {/* New query form */}
          {showNewForm && (
            <div className="jq-card jq-card--new">
              <div className="jq-card-title-row">
                <span className="jq-card-new-label">New Query</span>
              </div>
              <QueryForm
                submitLabel="Verify & Save"
                onSubmit={handleCreateQuery}
                onCancel={() => { setShowNewForm(false); setNewFormError(''); }}
                error={newFormError}
              />
            </div>
          )}

          {/* Query list */}
          {queriesLoading && (
            <div className="jq-loading">
              <span className="jira-spinner jira-spinner--muted" />
              Loading queries…
            </div>
          )}

          {!queriesLoading && queries.length === 0 && !showNewForm && (
            <div className="jq-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
              <p>No saved queries yet.</p>
              <button className="jq-add-btn" onClick={() => { setShowNewForm(true); setNewFormError(''); }}>
                + Add your first query
              </button>
            </div>
          )}

          {!queriesLoading && queries.map(q => (
            <div key={q._id} className={`jq-card${!q.isValid ? ' jq-card--invalid' : ''}`}>
              {editingId === q._id ? (
                <>
                  <div className="jq-card-title-row">
                    <span className="jq-card-new-label">Editing: {q.name}</span>
                  </div>
                  <QueryForm
                    initialName={q.name}
                    initialJql={q.jql}
                    sourceJql={q.sourceJql}
                    submitLabel="Verify & Update"
                    onSubmit={(name, jql) => handleUpdateQuery(q._id, name, jql)}
                    onCancel={() => { setEditingId(null); setEditFormError(''); }}
                    error={editFormError}
                  />
                </>
              ) : (
                <>
                  <div className="jq-card-header">
                    <div className="jq-card-name-row">
                      {!q.isValid && <span className="jq-badge jq-badge--draft">Unverified</span>}
                      <span className="jq-card-name">{q.name}</span>
                    </div>
                    <div className="jq-card-actions">
                      <button
                        className="jq-icon-btn"
                        title="Edit"
                        onClick={() => { setEditingId(q._id); setEditFormError(''); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        className="jq-icon-btn"
                        title="Clone"
                        onClick={() => handleCloneQuery(q._id)}
                        disabled={cloningId === q._id || queries.length >= MAX_QUERIES}
                      >
                        {cloningId === q._id ? (
                          <span className="jira-spinner jira-spinner--sm" />
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                            <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                      <button
                        className="jq-icon-btn jq-icon-btn--danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(q._id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9H3z"
                                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="jq-card-jql">{q.jql}</div>

                  {deleteTarget === q._id && (
                    <div className="jq-delete-confirm">
                      <span>Delete "{q.name}"?</span>
                      <button
                        className="jq-btn-sm jq-btn-sm--cancel"
                        onClick={() => setDeleteTarget(null)}
                      >Keep</button>
                      <button
                        className="jq-btn-sm jq-btn-sm--delete"
                        onClick={() => handleDeleteQuery(q._id)}
                        disabled={deletingId === q._id}
                      >
                        {deletingId === q._id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── How-to card ── */}
      <div className="jira-howto">
        <div className="jira-howto-title">How to get your API token</div>
        <ol className="jira-howto-steps">
          <li>
            Go to{' '}
            <a className="jira-link" href="https://id.atlassian.com/manage-profile/security/api-tokens"
               target="_blank" rel="noopener noreferrer">
              id.atlassian.com → Security → API tokens
            </a>
          </li>
          <li>Click <strong>Create API token</strong>, give it a name (e.g. "Renmito")</li>
          <li>Copy the token immediately — it won't be shown again</li>
          <li>Paste it above along with your workspace URL and email</li>
        </ol>
      </div>

    </div>
  );
}
