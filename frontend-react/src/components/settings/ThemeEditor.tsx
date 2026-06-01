import { useState, useEffect, useRef } from 'react';
import {
  usePreferences,
  useSavePalette,
  useAddPreset,
  useDeletePreset,
  useDeletePalette,
} from '@/hooks/usePreferences';
import { applyPaletteToDOM, PALETTE_PRESETS } from '@/lib/palette';
import type { ColorPalette } from '@/types';
import './ThemeEditor.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function paletteMatch(a: ColorPalette, b: ColorPalette): boolean {
  return a.bg === b.bg && a.primary === b.primary &&
         a.secondary === b.secondary && a.accent === b.accent;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ThemeEditor({ onClose }: Props) {
  const { data: prefs }  = usePreferences();
  const savePalette      = useSavePalette();
  const addPreset        = useAddPreset();
  const deletePreset     = useDeletePreset();
  const deletePalette    = useDeletePalette();

  const customPresets    = prefs?.customPresets ?? [];

  // Working copy — live-previewed, not yet saved
  const [current, setCurrent] = useState<ColorPalette>(() => {
    return prefs?.palette ?? PALETTE_PRESETS[0];
  });

  // Name-prompt state
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [pendingName,    setPendingName]    = useState('');
  const [nameError,      setNameError]      = useState('');

  // Saved flash
  const [savedMsg, setSavedMsg] = useState('');
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync current from loaded prefs (on first load)
  useEffect(() => {
    if (prefs?.palette) setCurrent(prefs.palette);
  }, [prefs?.palette?.bg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live preview whenever current changes
  useEffect(() => {
    applyPaletteToDOM(current);
  }, [current]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function flash(msg: string) {
    setSavedMsg(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedMsg(''), 2200);
  }

  function selectPreset(p: ColorPalette) {
    setCurrent({ ...p });
  }

  function onColorChange(key: keyof Omit<ColorPalette, 'name'>, value: string) {
    setCurrent(prev => ({ ...prev, [key]: value }));
  }

  function apply() {
    savePalette.mutate(current, {
      onSuccess: () => flash('Applied ✓'),
      onError:   () => flash('Failed to save'),
    });
  }

  function reset() {
    const def = PALETTE_PRESETS[0];
    setCurrent({ ...def });
    deletePalette.mutate(undefined, { onSuccess: () => flash('Reset ✓') });
  }

  function openNamePrompt() {
    if (customPresets.length >= 10) return;
    setPendingName(current.name !== 'Custom' ? current.name : '');
    setNameError('');
    setShowNamePrompt(true);
  }

  function confirmSavePreset() {
    const name = pendingName.trim();
    if (!name) { setNameError('Please enter a name.'); return; }
    if (customPresets.length >= 10) { setNameError('Maximum 10 presets.'); return; }
    const preset: ColorPalette = { ...current, name };
    addPreset.mutate(preset, {
      onSuccess: () => { setShowNamePrompt(false); setPendingName(''); flash('Preset saved ✓'); },
      onError:   () => setNameError('Failed to save. Try again.'),
    });
  }

  const PICKER_CONFIGS: { label: string; key: keyof Omit<ColorPalette, 'name'> }[] = [
    { label: 'Background',          key: 'bg'        },
    { label: 'Navigation',          key: 'primary'   },
    { label: 'Header / Timeline',   key: 'secondary' },
    { label: 'Accent / Highlights', key: 'accent'    },
  ];

  return (
    <div className="te-panel" role="dialog" aria-label="Color palette editor">

      {/* ── Header ── */}
      <div className="te-header">
        <div className="te-title-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="2.5"/>
            <circle cx="19"   cy="13"  r="2.5"/>
            <circle cx="6"    cy="13"  r="2.5"/>
            <circle cx="10"   cy="19"  r="2.5"/>
          </svg>
          <span className="te-title">Color Palette</span>
        </div>
        <button className="te-close-btn" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Built-in presets ── */}
      <div className="te-section">
        <div className="te-section-label">Built-in Presets</div>
        <div className="te-presets">
          {PALETTE_PRESETS.map(p => (
            <button
              key={p.name}
              className={`te-preset-chip${paletteMatch(current, p) ? ' te-preset-chip--active' : ''}`}
              onClick={() => selectPreset(p)}
              title={p.name}
            >
              <div className="te-swatch-row">
                <div className="te-swatch" style={{ background: p.bg }}        title="Background"/>
                <div className="te-swatch" style={{ background: p.primary }}   title="Navigation"/>
                <div className="te-swatch" style={{ background: p.secondary }} title="Header"/>
                <div className="te-swatch" style={{ background: p.accent }}    title="Accent"/>
              </div>
              <span className="te-preset-name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Custom presets ── */}
      {customPresets.length > 0 && (
        <div className="te-section">
          <div className="te-section-label">
            My Presets
            <span className="te-preset-count">{customPresets.length}/10</span>
          </div>
          <div className="te-presets">
            {customPresets.map(p => (
              <div
                key={p.name}
                className={`te-preset-chip te-preset-chip--custom${paletteMatch(current, p) ? ' te-preset-chip--active' : ''}`}
              >
                <div
                  className="te-preset-apply"
                  onClick={() => selectPreset(p)}
                  title={`Apply ${p.name}`}
                >
                  <div className="te-swatch-row">
                    <div className="te-swatch" style={{ background: p.bg }}        title="Background"/>
                    <div className="te-swatch" style={{ background: p.primary }}   title="Navigation"/>
                    <div className="te-swatch" style={{ background: p.secondary }} title="Header"/>
                    <div className="te-swatch" style={{ background: p.accent }}    title="Accent"/>
                  </div>
                  <span className="te-preset-name">{p.name}</span>
                </div>
                <button
                  className="te-preset-delete"
                  onClick={() => deletePreset.mutate(p.name)}
                  title={`Delete ${p.name}`}
                  aria-label="Delete preset"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Color pickers ── */}
      <div className="te-section">
        <div className="te-section-label">Customize</div>
        <div className="te-pickers">
          {PICKER_CONFIGS.map(cfg => (
            <div key={cfg.key} className="te-picker-row">
              <label className="te-picker-label">{cfg.label}</label>
              <div className="te-picker-wrap">
                <div className="te-color-preview" style={{ background: current[cfg.key] }}/>
                <input
                  type="color"
                  className="te-color-input"
                  value={current[cfg.key]}
                  onChange={e => onColorChange(cfg.key, e.target.value)}
                />
                <span className="te-hex-val">{current[cfg.key].toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Save-as-preset prompt ── */}
      {showNamePrompt && (
        <div className="te-section te-name-prompt">
          <div className="te-section-label">Name your preset</div>
          <div className="te-name-row">
            <input
              className="te-name-input"
              type="text"
              value={pendingName}
              onChange={e => setPendingName(e.target.value)}
              placeholder="e.g. My Ocean Blue"
              maxLength={32}
              onKeyDown={e => {
                if (e.key === 'Enter')  confirmSavePreset();
                if (e.key === 'Escape') { setShowNamePrompt(false); setPendingName(''); }
              }}
              autoFocus
            />
            <button
              className="te-name-confirm"
              onClick={confirmSavePreset}
              disabled={!pendingName.trim() || addPreset.isPending}
            >
              {addPreset.isPending ? '…' : 'Save'}
            </button>
            <button
              className="te-name-cancel"
              onClick={() => { setShowNamePrompt(false); setPendingName(''); setNameError(''); }}
            >✕</button>
          </div>
          {nameError && <span className="te-name-error">{nameError}</span>}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="te-footer">
        <button className="te-reset-btn" onClick={reset} disabled={deletePalette.isPending}>
          Reset
        </button>
        <div className="te-footer-right">
          {savedMsg && <span className="te-saved-badge">{savedMsg}</span>}
          <button className="te-save-btn" onClick={apply} disabled={savePalette.isPending}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {savePalette.isPending ? 'Saving…' : 'Apply'}
          </button>
          <button
            className="te-preset-save-btn"
            onClick={openNamePrompt}
            disabled={customPresets.length >= 10}
            title={customPresets.length >= 10 ? 'Maximum 10 presets reached' : 'Save as named preset'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5"  y1="12" x2="19" y2="12"/>
            </svg>
            Preset
          </button>
        </div>
      </div>
    </div>
  );
}
