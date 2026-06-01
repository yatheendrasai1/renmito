import type { ColorPalette } from '@/types';

// ── Built-in presets — must match Angular exactly ─────────────────────────────
export const PALETTE_PRESETS: ColorPalette[] = [
  { name: 'Renmito Dark', bg: '#121320', primary: '#982598', secondary: '#15173D', accent: '#E94F37' },
  { name: 'Warm Earth',   bg: '#F4F0E4', primary: '#44A194', secondary: '#537D96', accent: '#EC8F8D' },
  { name: 'Ocean Depth',  bg: '#0C1A2E', primary: '#1A6E8A', secondary: '#0A3D5C', accent: '#E9C46A' },
  { name: 'Forest',       bg: '#1A2F1A', primary: '#2D7A5A', secondary: '#1B4332', accent: '#95D5B2' },
  { name: 'Rose Quartz',  bg: '#FFF0F3', primary: '#9B59B6', secondary: '#6C3483', accent: '#FF6B9D' },
];

// ── Colour math helpers ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [
    parseInt(f.slice(0, 2), 16),
    parseInt(f.slice(2, 4), 16),
    parseInt(f.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b].reduce((lum, v, i) => {
    const c   = v / 255;
    const lin = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return lum + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function isLight(hex: string): boolean { return getLuminance(hex) > 0.35; }

function contrastText(hex: string): string { return isLight(hex) ? '#1A1C2A' : '#F1E9E9'; }

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Public API ────────────────────────────────────────────────────────────────

const MANAGED_VARS = [
  '--bg-primary', '--bg-surface', '--bg-card', '--accent', '--accent-bright',
  '--accent-hover', '--border', '--border-light', '--shadow',
  '--text-primary', '--text-secondary', '--text-muted',
  '--nav-bg', '--nav-text', '--nav-text-muted',
  '--nav-item-hover', '--nav-item-active', '--nav-item-active-border',
  '--highlight-selected',
  '--secondary', '--header-bg', '--header-text', '--header-icon-bg', '--header-icon-hover',
  '--timeline-bg', '--timeline-line', '--timeline-text', '--timeline-text-muted',
  '--highlight-today', '--drag-overlay',
];

/**
 * Derives all CSS custom properties from the 4-colour palette and writes them
 * directly to :root — matches the Angular applyPaletteToDOM exactly.
 */
export function applyPaletteToDOM(p: ColorPalette): void {
  const root = document.documentElement;
  const set  = (v: string, val: string) => root.style.setProperty(v, val);

  // ── Background → surfaces / text / borders ────────────────────────────────
  const lightBg   = isLight(p.bg);
  const bgSurface = lightBg ? lighten(p.bg, 0.60) : darken(p.bg, 0.18);
  const bgCard    = lightBg ? darken(p.bg, 0.05)  : darken(p.bg, 0.25);
  const accentHov = lightBg ? darken(p.bg, 0.10)  : lighten(p.bg, 0.08);
  const border    = lightBg ? darken(p.bg, 0.22)  : lighten(p.bg, 0.12);
  const borderLt  = lightBg ? darken(p.bg, 0.14)  : lighten(p.bg, 0.07);

  set('--bg-primary',   p.bg);
  set('--bg-surface',   bgSurface);
  set('--bg-card',      bgCard);
  set('--accent',       bgCard);        // subtle elevated surface (mirrors Angular)
  set('--accent-hover', accentHov);
  set('--border',       border);
  set('--border-light', borderLt);
  set('--shadow', lightBg
    ? '0 4px 20px rgba(0,0,0,0.08)'
    : '0 4px 20px rgba(0,0,0,0.45)');

  if (lightBg) {
    set('--text-primary',   '#1A1C2A');
    set('--text-secondary', '#3A4060');
    set('--text-muted',     '#6A7290');
  } else {
    set('--text-primary',   '#E0E4F0');
    set('--text-secondary', '#8090A8');
    set('--text-muted',     '#4A5878');
  }

  // ── Primary → nav sidebar ─────────────────────────────────────────────────
  const primText = contrastText(p.primary);
  const navBase  = isLight(p.primary) ? '0,0,0' : '255,255,255';

  set('--nav-bg',                 p.primary);
  set('--nav-text',               primText);
  set('--nav-text-muted',         rgba(primText, 0.55));
  set('--nav-item-hover',         `rgba(${navBase},0.12)`);
  set('--nav-item-active',        `rgba(${navBase},0.18)`);
  set('--nav-item-active-border', primText);
  set('--highlight-selected',     p.primary);  // CTAs match primary brand colour

  // ── Secondary → hero card & timeline ─────────────────────────────────────
  const secText = contrastText(p.secondary);
  const secRgb  = isLight(p.secondary) ? '0,0,0' : '241,233,233';
  const tlLine  = isLight(p.secondary) ? darken(p.secondary, 0.25) : lighten(p.secondary, 0.15);

  set('--secondary',            p.secondary);
  set('--header-bg',            p.secondary);
  set('--header-text',          secText);
  set('--header-icon-bg',       `rgba(${secRgb},0.13)`);
  set('--header-icon-hover',    `rgba(${secRgb},0.24)`);
  set('--timeline-bg',          p.secondary);
  set('--timeline-line',        tlLine);
  set('--timeline-text',        secText);
  set('--timeline-text-muted',  rgba(secText, 0.4));

  // ── Accent → CTA / drag / highlights ─────────────────────────────────────
  set('--accent-bright',   p.accent);
  set('--highlight-today', p.accent);
  set('--drag-overlay',    rgba(p.accent, 0.35));
}

/** Removes all palette overrides — CSS falls back to :root defaults. */
export function clearPaletteFromDOM(): void {
  MANAGED_VARS.forEach(v => document.documentElement.style.removeProperty(v));
}
