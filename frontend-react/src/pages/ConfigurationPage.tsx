import { useState, useRef } from 'react';
import {
  usePreferences,
  useUpdateDaySettings,
  useUpdateUserProfile,
} from '@/hooks/usePreferences';
import {
  useLogTypes,
  useCreateLogType,
  useRenameLogType,
  useDeleteLogType,
} from '@/hooks/useLogTypes';
import ThemeEditor from '@/components/settings/ThemeEditor';
import { useAuth } from '@/hooks/useAuth';
import type { DaySettings, UserProfile } from '@/types';
import './ConfigurationPage.css';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_DAY: DaySettings = {
  wakeTarget: '06:30', breakfastTarget: '08:00', lunchTarget: '13:00',
  dinnerTarget: '20:00', bedtimeTarget: '23:00',
  workStart: '09:00', workEnd: '18:00',
  commuteStart: '08:30', officeReach: '09:00',
  officeLeave: '18:00', homeReach: '19:00',
};

const DEFAULT_PROFILE: UserProfile = {
  dateOfBirth: null, weight: null, height: null, targetWeight: null,
  gender: '', activityLevel: '', designation: '',
  designationSince: null, yearsOfExperience: null, workDomain: '',
};

type Section = 'profile' | 'preferences' | 'theming' | null;

// ── Chevron SVG ───────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`cfg-chevron${open ? ' cfg-chevron--open' : ''}`}
         width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const { user } = useAuth();
  const { data: prefs } = usePreferences();
  const [openSection, setOpenSection] = useState<Section>(null);

  function toggleSection(s: NonNullable<Section>) {
    setOpenSection(prev => (prev === s ? null : s));
  }

  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">Preferences</h2>
        <p className="cfg-page-sub">Manage your account, profile, and integrations.</p>
      </div>

      {/* Account card */}
      {user && (
        <div className="cfg-account">
          <div className="cfg-account-avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="cfg-account-info">
            <span className="cfg-account-name">{user.userName}</span>
            <span className="cfg-account-email">{user.email}</span>
          </div>
        </div>
      )}

      {/* Profile accordion */}
      <Accordion
        id="profile"
        open={openSection === 'profile'}
        onToggle={() => toggleSection('profile')}
        iconClass="cfg-icon--profile"
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
        title="User Profile"
        sub="Personal details for health calculations"
      >
        <ProfileSection
          initial={{ ...DEFAULT_PROFILE, ...(prefs?.userProfile ?? {}) }}
          onClose={() => setOpenSection(null)}
        />
      </Accordion>

      {/* Preferences accordion */}
      <Accordion
        id="preferences"
        open={openSection === 'preferences'}
        onToggle={() => toggleSection('preferences')}
        iconClass="cfg-icon--pref"
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>}
        title="Preferences"
        sub="Ideal day targets & custom log types"
      >
        <PreferencesSection
          initialDay={{ ...DEFAULT_DAY, ...(prefs?.daySettings ?? {}) }}
          onClose={() => setOpenSection(null)}
        />
      </Accordion>

      {/* Theming accordion */}
      <Accordion
        id="theming"
        open={openSection === 'theming'}
        onToggle={() => toggleSection('theming')}
        iconClass="cfg-icon--theme"
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="6" cy="13" r="2.5"/><circle cx="10" cy="19" r="2.5"/></svg>}
        title="Theming"
        sub="Color palette and visual style"
        noBodyPad
      >
        <ThemeEditor onClose={() => setOpenSection(null)} />
      </Accordion>
    </div>
  );
}

// ── Accordion shell ───────────────────────────────────────────────────────────

interface AccordionProps {
  id: string;
  open: boolean;
  onToggle: () => void;
  iconClass: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
  noBodyPad?: boolean;
}

function Accordion({ open, onToggle, iconClass, icon, title, sub, children, noBodyPad }: AccordionProps) {
  return (
    <div className={`cfg-acc${open ? ' cfg-acc--open' : ''}`}>
      <button className="cfg-acc-head" onClick={onToggle} type="button">
        <div className={`cfg-acc-icon ${iconClass}`}>{icon}</div>
        <div className="cfg-acc-meta">
          <span className="cfg-acc-title">{title}</span>
          <span className="cfg-acc-sub">{sub}</span>
        </div>
        <Chevron open={open} />
      </button>
      {open && (
        <div className={`cfg-acc-body${noBodyPad ? ' cfg-acc-body--bare' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ initial, onClose }: { initial: UserProfile; onClose: () => void }) {
  const [draft, setDraft] = useState<UserProfile>({ ...initial });
  const update = useUpdateUserProfile();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  async function save() {
    try {
      await update.mutateAsync(draft);
      setMsg({ ok: true, text: 'Saved.' });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg({ ok: false, text: 'Could not save. Please try again.' });
    }
  }

  return (
    <>
      <div className="cfg-section">
        <div className="cfg-grid">
          <Field label="Date of Birth">
            <input className="cfg-input" type="date" value={draft.dateOfBirth ?? ''}
                   onChange={e => set('dateOfBirth', e.target.value || null)} />
          </Field>
          <Field label="Weight (kg)">
            <input className="cfg-input" type="number" min={20} max={300} step={0.1}
                   value={draft.weight ?? ''} placeholder="e.g. 70"
                   onChange={e => set('weight', e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Target Weight (kg)">
            <input className="cfg-input" type="number" min={20} max={300} step={0.1}
                   value={draft.targetWeight ?? ''} placeholder="e.g. 65"
                   onChange={e => set('targetWeight', e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Height (cm)">
            <input className="cfg-input" type="number" min={100} max={250} step={1}
                   value={draft.height ?? ''} placeholder="e.g. 175"
                   onChange={e => set('height', e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Gender">
            <select className="cfg-input" value={draft.gender}
                    onChange={e => set('gender', e.target.value as UserProfile['gender'])}>
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Activity Level" fullWidth>
            <select className="cfg-input" value={draft.activityLevel}
                    onChange={e => set('activityLevel', e.target.value as UserProfile['activityLevel'])}>
              <option value="">Not specified</option>
              <option value="sedentary">Sedentary (little/no exercise)</option>
              <option value="light">Light (1–3 days/week)</option>
              <option value="moderate">Moderate (3–5 days/week)</option>
              <option value="active">Active (6–7 days/week)</option>
              <option value="very-active">Very Active (hard exercise daily)</option>
            </select>
          </Field>
          <div className="cfg-divider-label" style={{ gridColumn: '1 / -1' }}>Professional</div>
          <Field label="Current Designation" fullWidth>
            <input className="cfg-input" type="text" value={draft.designation}
                   placeholder="e.g. Senior Software Engineer"
                   onChange={e => set('designation', e.target.value)} />
          </Field>
          <Field label="In Role Since">
            <input className="cfg-input" type="date" value={draft.designationSince ?? ''}
                   onChange={e => set('designationSince', e.target.value || null)} />
          </Field>
          <Field label="Years of Experience">
            <input className="cfg-input" type="number" min={0} max={60} step={0.5}
                   value={draft.yearsOfExperience ?? ''} placeholder="e.g. 5"
                   onChange={e => set('yearsOfExperience', e.target.value ? +e.target.value : null)} />
          </Field>
          <Field label="Domain / Industry" fullWidth>
            <input className="cfg-input" type="text" value={draft.workDomain}
                   placeholder="e.g. Software, Finance, Healthcare"
                   onChange={e => set('workDomain', e.target.value)} />
          </Field>
        </div>
        {msg && <div className={`cfg-feedback${msg.ok ? ' cfg-feedback--ok' : ' cfg-feedback--err'}`}>{msg.text}</div>}
      </div>
      <AccFooter
        onCancel={() => { setDraft({ ...initial }); onClose(); }}
        onSave={save}
        saving={update.isPending}
      />
    </>
  );
}

// ── Preferences section ───────────────────────────────────────────────────────

function PreferencesSection({ initialDay, onClose }: { initialDay: DaySettings; onClose: () => void }) {
  const [day, setDay] = useState<DaySettings>({ ...initialDay });
  const updateDay = useUpdateDaySettings();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setTime(key: keyof DaySettings, val: string) {
    setDay(d => ({ ...d, [key]: val }));
  }

  async function save() {
    try {
      await updateDay.mutateAsync(day);
      setMsg({ ok: true, text: 'Saved.' });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg({ ok: false, text: 'Could not save. Please try again.' });
    }
  }

  return (
    <>
      <div className="cfg-section">
        <div className="cfg-section-label">My Ideal Day</div>

        <TimeGroup label="Daily routine">
          <TimeField label="Wake up"   value={day.wakeTarget}      onChange={v => setTime('wakeTarget', v)} />
          <TimeField label="Breakfast" value={day.breakfastTarget} onChange={v => setTime('breakfastTarget', v)} />
          <TimeField label="Lunch"     value={day.lunchTarget}     onChange={v => setTime('lunchTarget', v)} />
          <TimeField label="Dinner"    value={day.dinnerTarget}    onChange={v => setTime('dinnerTarget', v)} />
          <TimeField label="Sleep"     value={day.bedtimeTarget}   onChange={v => setTime('bedtimeTarget', v)} />
        </TimeGroup>

        <TimeGroup label="Office work">
          <TimeField label="Start work" value={day.workStart} onChange={v => setTime('workStart', v)} />
          <TimeField label="End work"   value={day.workEnd}   onChange={v => setTime('workEnd', v)} />
        </TimeGroup>

        <TimeGroup label="Commute to office">
          <TimeField label="Leave home"   value={day.commuteStart} onChange={v => setTime('commuteStart', v)} />
          <TimeField label="Reach office" value={day.officeReach}  onChange={v => setTime('officeReach', v)} />
        </TimeGroup>

        <TimeGroup label="Commute home">
          <TimeField label="Leave office" value={day.officeLeave} onChange={v => setTime('officeLeave', v)} />
          <TimeField label="Reach home"   value={day.homeReach}   onChange={v => setTime('homeReach', v)} />
        </TimeGroup>

        {msg && <div className={`cfg-feedback${msg.ok ? ' cfg-feedback--ok' : ' cfg-feedback--err'}`}>{msg.text}</div>}
      </div>

      <div className="cfg-section cfg-section--sep">
        <div className="cfg-section-label">Custom Log Types</div>
        <LogTypesManager />
      </div>

      <AccFooter
        onCancel={() => { setDay({ ...initialDay }); onClose(); }}
        onSave={save}
        saving={updateDay.isPending}
      />
    </>
  );
}

// ── Log types manager ─────────────────────────────────────────────────────────

function LogTypesManager() {
  const { data: allTypes = [] } = useLogTypes();
  const createLt  = useCreateLogType();
  const renameLt  = useRenameLogType();
  const deleteLt  = useDeleteLogType();

  const userTypes = allTypes.filter(lt => lt.source === 'user');

  const [editingId,   setEditingId]   = useState('');
  const [editingName, setEditingName] = useState('');
  const [showNew,     setShowNew]     = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newDomain,   setNewDomain]   = useState<'work' | 'personal' | 'family'>('personal');

  function startEdit(id: string, name: string) {
    setEditingId(id); setEditingName(name);
  }
  function cancelEdit() { setEditingId(''); setEditingName(''); }

  async function saveEdit(id: string) {
    const name = editingName.trim();
    if (!name) return;
    await renameLt.mutateAsync({ id, name });
    cancelEdit();
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    await createLt.mutateAsync({ name: newName.trim(), domain: newDomain, color: '#888888' });
    setShowNew(false); setNewName(''); setNewDomain('personal');
  }

  return (
    <div className="lt-wrap">
      {userTypes.length > 0 && (
        <div className="lt-list">
          {userTypes.map(lt => (
            <div className="lt-row" key={lt._id}>
              <span className="lt-dot" style={{ background: lt.color || '#888' }} />
              {editingId === lt._id ? (
                <input className="lt-name-input" autoFocus value={editingName}
                       onChange={e => setEditingName(e.target.value)}
                       onKeyDown={e => { if (e.key === 'Enter') saveEdit(lt._id); if (e.key === 'Escape') cancelEdit(); }} />
              ) : (
                <span className="lt-name">{lt.name}</span>
              )}
              <span className="lt-domain">{lt.domain}</span>
              <div className="lt-actions">
                {editingId === lt._id ? (
                  <>
                    <button className="lt-btn lt-btn--save" onClick={() => saveEdit(lt._id)}>Save</button>
                    <button className="lt-btn" onClick={cancelEdit}>✕</button>
                  </>
                ) : (
                  <button className="lt-btn" onClick={() => startEdit(lt._id, lt.name)} title="Rename">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
                <button className="lt-btn lt-btn--del" onClick={() => deleteLt.mutate(lt._id)} title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {userTypes.length === 0 && !showNew && (
        <p className="lt-empty">No custom log types yet.</p>
      )}

      {showNew && (
        <div className="lt-new-form">
          <input className="lt-name-input" autoFocus value={newName} placeholder="Name" maxLength={40}
                 onChange={e => setNewName(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false); }} />
          <select className="lt-domain-select" value={newDomain}
                  onChange={e => setNewDomain(e.target.value as typeof newDomain)}>
            <option value="work">Work</option>
            <option value="personal">Personal</option>
            <option value="family">Family</option>
          </select>
          <div className="lt-new-actions">
            <button className="lt-btn" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="lt-btn lt-btn--save" onClick={handleCreate} disabled={!newName.trim()}>Add</button>
          </div>
        </div>
      )}

      {!showNew && (
        <button className="lt-add-btn" onClick={() => { setShowNew(true); setNewName(''); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New type
        </button>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className="cfg-field" style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <label className="cfg-label">{label}</label>
      {children}
    </div>
  );
}

function TimeGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cfg-time-group">
      <div className="cfg-time-group-label">{label}</div>
      <div className="cfg-grid">{children}</div>
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input className="cfg-input" type="time" value={value} onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

function AccFooter({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="cfg-footer">
      <button className="cfg-cancel-btn" onClick={onCancel} type="button">Cancel</button>
      <button className="cfg-save-btn" onClick={onSave} disabled={saving} type="button">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
