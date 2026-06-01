// ── Palette / Theme ───────────────────────────────────────────────────────────
// Shape mirrors the backend paletteSchema and Angular's ColorPalette exactly.
// applyPaletteToDOM() derives all CSS custom properties from these 5 fields.

export interface ColorPalette {
  name:      string;
  bg:        string;  // body / surfaces
  primary:   string;  // nav sidebar
  secondary: string;  // header + timeline bar
  accent:    string;  // CTA, highlights, drag
}

// ── UserProfile ───────────────────────────────────────────────────────────────

export interface UserProfile {
  dateOfBirth:       string | null;  // YYYY-MM-DD
  weight:            number | null;  // kg
  height:            number | null;  // cm
  targetWeight:      number | null;  // kg
  gender:            'male' | 'female' | 'other' | '';
  activityLevel:     'sedentary' | 'light' | 'moderate' | 'active' | 'very-active' | '';
  designation:       string;
  designationSince:  string | null;  // YYYY-MM-DD
  yearsOfExperience: number | null;
  workDomain:        string;
}

// ── Day Settings ──────────────────────────────────────────────────────────────

export interface DaySettings {
  wakeTarget:      string;
  breakfastTarget: string;
  lunchTarget:     string;
  dinnerTarget:    string;
  workStart:       string;
  workEnd:         string;
  commuteStart:    string;
  officeReach:     string;
  officeLeave:     string;
  homeReach:       string;
  bedtimeTarget:   string;
}

// ── DayMetadata ───────────────────────────────────────────────────────────────

export type DayType = 'working' | 'holiday' | 'paid_leave' | 'sick_leave' | 'wfh';

export interface ImportantLogEntry {
  logId:        string | null;
  time:         string | null;  // HH:MM
  date:         string | null;  // YYYY-MM-DD
  logUpdatedAt: string | null;  // ISO
}

export interface ImportantLogs {
  wokeUp:    ImportantLogEntry | null;
  breakfast: ImportantLogEntry | null;
  lunch:     ImportantLogEntry | null;
  dinner:    ImportantLogEntry | null;
  sleep:     ImportantLogEntry | null;
}

export interface DayMetadata {
  date:          string;      // YYYY-MM-DD
  dayType:       DayType;
  importantLogs: ImportantLogs;
  capturedAt:    string | null;  // ISO
}

// ── Features ──────────────────────────────────────────────────────────────────

export interface Features {
  foodInsights?: { enabled: boolean };
}

// ── Quick Shortcuts ───────────────────────────────────────────────────────────

export interface QuickShortcut {
  logTypeId:   string;
  defaultMins: number;
}

// ── Active Log (live running timer) ──────────────────────────────────────────

export interface ActiveLog {
  logTypeId:   string;
  title:       string;
  startedAt:   string;        // ISO — set by server to avoid clock skew
  plannedMins: number | null;
}

// ── UserPreferences (full document) ──────────────────────────────────────────

export interface UserPreferences {
  palette:        ColorPalette | null;
  customPresets:  ColorPalette[];
  activeLog:      ActiveLog | null;
  quickShortcuts: QuickShortcut[];
  daySettings:    DaySettings | null;
  userProfile:    UserProfile | null;
  features:       Features | null;
}
