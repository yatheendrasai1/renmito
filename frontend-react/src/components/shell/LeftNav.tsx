import { useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore }  from '@/store/appStore';
import { useAuth }      from '@/hooks/useAuth';
import ThemeEditor      from '@/components/settings/ThemeEditor';
import './LeftNav.css';

// ── Reset-password modal ──────────────────────────────────────────────────────

interface ResetPwModalProps {
  onClose: () => void;
}

function ResetPasswordModal({ onClose }: ResetPwModalProps) {
  const { user, changePassword } = useAuth();
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!current || !next || !confirm) return;
    if (next !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await changePassword(current, next);
      setSuccess(res.message ?? 'Password updated!');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="profile-popup">

        <div className="profile-header">
          <span className="profile-title">Reset Password</span>
          <button className="profile-close-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="profile-info">
          <div className="profile-info-row">
            <span className="profile-label">Username</span>
            <span className="profile-value">{user?.userName}</span>
          </div>
          <div className="profile-info-row">
            <span className="profile-label">Email</span>
            <span className="profile-value">{user?.email}</span>
          </div>
        </div>

        <div className="profile-section-title">Change Password</div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="profile-field">
            <label className="profile-field-label">Current password</label>
            <input className="profile-input" type="password"
                   value={current} onChange={e => setCurrent(e.target.value)}
                   placeholder="Current password" disabled={saving} />
          </div>
          <div className="profile-field">
            <label className="profile-field-label">New password</label>
            <input className="profile-input" type="password"
                   value={next} onChange={e => setNext(e.target.value)}
                   placeholder="Min 8 characters" disabled={saving} />
          </div>
          <div className="profile-field">
            <label className="profile-field-label">Confirm new password</label>
            <input className="profile-input" type="password"
                   value={confirm} onChange={e => setConfirm(e.target.value)}
                   placeholder="Repeat new password" disabled={saving} />
          </div>

          {error   && <div className="profile-error">{error}</div>}
          {success && <div className="profile-success">{success}</div>}

          <div className="profile-actions">
            <button
              type="submit"
              className="btn-profile-save"
              disabled={saving || !current || !next || !confirm}
            >
              {saving && <span className="btn-spinner" />}
              <span>{saving ? 'Saving…' : 'Update password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── LeftNav ───────────────────────────────────────────────────────────────────

export default function LeftNav() {
  const navOpen    = useAppStore(s => s.navOpen);
  const setNavOpen = useAppStore(s => s.setNavOpen);
  const { logout } = useAuth();

  const [showGear,      setShowGear]      = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [showTheme,     setShowTheme]     = useState(false);
  const [egExpanded,    setEgExpanded]    = useState(false);
  const [extExpanded,   setExtExpanded]   = useState(false);

  function close() { setNavOpen(false); setShowGear(false); }

  function navItemClass({ isActive }: { isActive: boolean }) {
    return `left-nav-item${isActive ? ' left-nav-item--active' : ''}`;
  }

  return (
    <>
      {/* Dim backdrop */}
      {navOpen && (
        <div className="nav-dim-backdrop" onClick={close} />
      )}

      {/* Drawer */}
      <nav
        className={`left-nav${navOpen ? ' left-nav--overlay' : ''}`}
        onClick={close}
      >

        {/* ── Renmito section ── */}
        <div className="nav-group" onClick={e => e.stopPropagation()}>

          <div className="nav-group-header">
            <span className="nav-group-label">Renmito</span>

            {/* Palette / theme button */}
            <button
              className="nav-gear-btn"
              onClick={e => { e.stopPropagation(); setShowTheme(v => !v); setShowGear(false); }}
              title="Color theme"
              aria-label="Color theme"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="2.5"/>
                <circle cx="19"   cy="13"  r="2.5"/>
                <circle cx="6"    cy="13"  r="2.5"/>
                <circle cx="10"   cy="19"  r="2.5"/>
              </svg>
            </button>

            {/* Gear button */}
            <button
              className="nav-gear-btn"
              onClick={() => setShowGear(v => !v)}
              title="Settings"
              aria-label="Settings"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
                         a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
                         A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
                         l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
                         A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
                         l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
                         a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
                         l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
                         a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>

          {/* Gear dropdown */}
          {showGear && (
            <div className="nav-gear-menu">
              <button
                className="nav-gear-item"
                onClick={() => { setShowProfile(true); setShowGear(false); setNavOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Reset Password
              </button>
            </div>
          )}

          {/* Preferences */}
          <NavLink className={navItemClass} to="/configuration" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Preferences</span>
          </NavLink>

          {/* Diary */}
          <NavLink className={navItemClass} to="/diary" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9"  x2="8" y2="9"/>
            </svg>
            <span>Diary</span>
          </NavLink>

          {/* Intelligence */}
          <NavLink className={navItemClass} to="/intelligence" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08
                       3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08
                       3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
            </svg>
            <span>Intelligence</span>
          </NavLink>

          {/* Timeline */}
          <NavLink className={navItemClass} to="/timeline" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3"  y1="6"  x2="21" y2="6"/>
              <line x1="3"  y1="12" x2="21" y2="12"/>
              <line x1="3"  y1="18" x2="21" y2="18"/>
              <circle cx="8"  cy="6"  r="2" fill="currentColor" stroke="none"/>
              <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>
              <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>
            </svg>
            <span>Timeline</span>
          </NavLink>

          {/* Log out */}
          <button className="left-nav-item nav-logout" onClick={() => { close(); logout(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Log out</span>
          </button>
        </div>

        {/* ── ExpenseGuide section ── */}
        <div className="nav-group" onClick={e => e.stopPropagation()}>
          <div className="nav-group-header">
            <span className="nav-group-label">ExpenseGuide</span>
            <button
              className="nav-section-toggle"
              onClick={() => setEgExpanded(v => !v)}
              aria-expanded={egExpanded}
              title="Toggle ExpenseGuide"
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: egExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.18s ease' }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {egExpanded && (
            <>
              <NavLink
                className={({ isActive }) =>
                  `left-nav-item left-nav-item--sub${isActive ? ' left-nav-item--active' : ''}`
                }
                to="/expense-guide/configuration"
                onClick={close}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
                           a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
                           A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
                           l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
                           A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
                           l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
                           a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
                           l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
                           a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span>Configurations</span>
              </NavLink>

              <NavLink
                className={({ isActive }) =>
                  `left-nav-item left-nav-item--sub${isActive ? ' left-nav-item--active' : ''}`
                }
                to="/expense-guide/expenses"
                onClick={close}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1"  x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <span>Expenses</span>
              </NavLink>
            </>
          )}
        </div>

        {/* ── External Configurations section ── */}
        <div className="nav-group" onClick={e => e.stopPropagation()}>
          <div className="nav-group-header">
            <span className="nav-group-label">External Configs</span>
            <button
              className="nav-section-toggle"
              onClick={() => setExtExpanded(v => !v)}
              aria-expanded={extExpanded}
              title="Toggle External Configurations"
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: extExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.18s ease' }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {extExpanded && (
            <NavLink
              className={({ isActive }) =>
                `left-nav-item left-nav-item--sub${isActive ? ' left-nav-item--active' : ''}`
              }
              to="/external-configs/jira"
              onClick={close}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 9h6M9 12h6M9 15h4"/>
              </svg>
              <span>JIRA</span>
            </NavLink>
          )}
        </div>

      </nav>

      {/* Reset-password modal — outside the nav so it's not clipped */}
      {showProfile && (
        <ResetPasswordModal onClose={() => setShowProfile(false)} />
      )}

      {/* Theme editor panel */}
      {showTheme && (
        <>
          {/* Backdrop catches outside clicks */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 599 }}
            onClick={() => setShowTheme(false)}
          />
          <ThemeEditor onClose={() => setShowTheme(false)} />
        </>
      )}
    </>
  );
}
