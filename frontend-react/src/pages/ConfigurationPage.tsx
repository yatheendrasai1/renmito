import { useState, useRef, useEffect } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, FREQUENCY_OPTIONS, refreshMealNotificationsOnSettingsSave } from '@/hooks/useNotifications';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const { user } = useAuth();
  const { data: prefs } = usePreferences();

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

      <Accordion type="single" collapsible className="cfg-accordion-root">

        {/* Profile */}
        <AccordionItem value="profile" className="cfg-acc">
          <AccordionTrigger className="cfg-acc-head">
            <div className="cfg-acc-icon cfg-icon--profile">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="cfg-acc-meta">
              <span className="cfg-acc-title">User Profile</span>
              <span className="cfg-acc-sub">Personal details for health calculations</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="cfg-acc-body">
            <ProfileSection initial={{ ...DEFAULT_PROFILE, ...(prefs?.userProfile ?? {}) }} />
          </AccordionContent>
        </AccordionItem>

        {/* Preferences */}
        <AccordionItem value="preferences" className="cfg-acc">
          <AccordionTrigger className="cfg-acc-head">
            <div className="cfg-acc-icon cfg-icon--pref">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            </div>
            <div className="cfg-acc-meta">
              <span className="cfg-acc-title">Preferences</span>
              <span className="cfg-acc-sub">Ideal day targets & custom log types</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="cfg-acc-body">
            <PreferencesSection initialDay={{ ...DEFAULT_DAY, ...(prefs?.daySettings ?? {}) }} />
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <NotificationsAccordion />

      </Accordion>
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ initial }: { initial: UserProfile }) {
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
            <Select value={draft.gender || '_none'} onValueChange={v => set('gender', (v === '_none' ? '' : v) as UserProfile['gender'])}>
              <SelectTrigger className="cfg-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Not specified</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Activity Level" fullWidth>
            <Select value={draft.activityLevel || '_none'} onValueChange={v => set('activityLevel', (v === '_none' ? '' : v) as UserProfile['activityLevel'])}>
              <SelectTrigger className="cfg-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Not specified</SelectItem>
                <SelectItem value="sedentary">Sedentary (little/no exercise)</SelectItem>
                <SelectItem value="light">Light (1–3 days/week)</SelectItem>
                <SelectItem value="moderate">Moderate (3–5 days/week)</SelectItem>
                <SelectItem value="active">Active (6–7 days/week)</SelectItem>
                <SelectItem value="very-active">Very Active (hard exercise daily)</SelectItem>
              </SelectContent>
            </Select>
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
        onCancel={() => setDraft({ ...initial })}
        onSave={save}
        saving={update.isPending}
      />
    </>
  );
}

// ── Preferences section ───────────────────────────────────────────────────────

function PreferencesSection({ initialDay }: { initialDay: DaySettings }) {
  const [day, setDay] = useState<DaySettings>({ ...initialDay });
  const updateDay = useUpdateDaySettings();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed meal targets in localStorage so notifications hook can find them on enable
  useEffect(() => {
    refreshMealNotificationsOnSettingsSave(initialDay).catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTime(key: keyof DaySettings, val: string) {
    setDay(d => ({ ...d, [key]: val }));
  }

  async function save() {
    try {
      await updateDay.mutateAsync(day);
      setMsg({ ok: true, text: 'Saved.' });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 2500);
      // Keep meal-time notifications in sync with the updated day settings
      refreshMealNotificationsOnSettingsSave(day).catch(() => undefined);
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
        onCancel={() => setDay({ ...initialDay })}
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
          <Select value={newDomain} onValueChange={v => setNewDomain(v as typeof newDomain)}>
            <SelectTrigger className="lt-domain-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work">Work</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="family">Family</SelectItem>
            </SelectContent>
          </Select>
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

// ── Notifications accordion (mobile-only) ─────────────────────────────────────

function NotificationsAccordion() {
  const { state, enable, disable, changeInterval, previewNotification } = useNotifications();

  if (!state.supported) return null;

  return (
    <AccordionItem value="notifications" className="cfg-acc">
      <AccordionTrigger className="cfg-acc-head">
        <div className="cfg-acc-icon cfg-icon--notif">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div className="cfg-acc-meta">
          <span className="cfg-acc-title">Notifications</span>
          <span className="cfg-acc-sub">Nudges to keep your time log up to date</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="cfg-acc-body">
        <NotificationsSection state={state} enable={enable} disable={disable} changeInterval={changeInterval} previewNotification={previewNotification} />
      </AccordionContent>
    </AccordionItem>
  );
}

function NotificationsSection({
  state,
  enable,
  disable,
  changeInterval,
  previewNotification,
}: {
  state: ReturnType<typeof useNotifications>['state'];
  enable: (interval: number) => Promise<void>;
  disable: () => Promise<void>;
  changeInterval: (interval: number) => Promise<void>;
  previewNotification: () => Promise<void>;
}) {
  const [pendingInterval, setPendingInterval] = useState(state.intervalMinutes);

  async function handleToggle() {
    if (state.enabled) {
      await disable();
    } else {
      await enable(pendingInterval);
    }
  }

  async function handleIntervalChange(val: number) {
    setPendingInterval(val);
    if (state.enabled) {
      await changeInterval(val);
    }
  }

  return (
    <div className="cfg-section">
      {/* Enable / disable row */}
      <div className="notif-toggle-row">
        <div className="notif-toggle-label">
          <span className="notif-toggle-title">Logging nudges</span>
          <span className="notif-toggle-sub">Remind me to log my time</span>
        </div>
        <Switch
          checked={state.enabled}
          onCheckedChange={handleToggle}
          disabled={state.requesting}
          aria-label="Enable logging nudges"
        />
      </div>

      {/* Frequency selector — shown whether on or off so user can pre-configure */}
      <div className={`notif-freq-wrap${state.enabled ? '' : ' notif-freq-wrap--dim'}`}>
        <div className="cfg-section-label">Reminder frequency</div>
        <div className="notif-freq-grid">
          {FREQUENCY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`notif-freq-chip${pendingInterval === opt.value ? ' notif-freq-chip--active' : ''}`}
              onClick={() => handleIntervalChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview button */}
      <div className="notif-preview-row">
        <button className="notif-preview-btn" type="button" onClick={previewNotification}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Preview Notification
        </button>
      </div>

      {/* Status / error feedback */}
      {state.error && (
        <div className="cfg-feedback cfg-feedback--err">{state.error}</div>
      )}
      {state.enabled && !state.error && (
        <div className="cfg-feedback cfg-feedback--ok">
          Active — nudging every {FREQUENCY_OPTIONS.find(o => o.value === state.intervalMinutes)?.label ?? `${state.intervalMinutes} min`}
        </div>
      )}
      {state.permissionGranted === false && !state.error && (
        <div className="cfg-feedback cfg-feedback--err">
          Notifications are blocked. Open device Settings → Apps → Renmito → Notifications and enable them, then try again.
        </div>
      )}
    </div>
  );
}
