import { create } from 'zustand';
import type { ActiveLog } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns today's date as YYYY-MM-DD in the user's LOCAL timezone.
 * Do NOT use toISOString() here — that returns UTC, which is wrong for users
 * east of UTC (e.g. IST UTC+5:30) between midnight and 5:30 AM local time.
 */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── State shape ───────────────────────────────────────────────────────────────

interface AppState {
  // ── Date navigation (shared across all views) ─────────────────────────────
  selectedDate:    string;
  setSelectedDate: (date: string) => void;
  goToToday:       () => void;

  // ── Running timer ─────────────────────────────────────────────────────────
  activeLog:    ActiveLog | null;
  setActiveLog: (log: ActiveLog | null) => void;

  // ── Navigation UI ─────────────────────────────────────────────────────────
  navOpen:    boolean;
  setNavOpen: (open: boolean) => void;
  toggleNav:  () => void;

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: { message: string; undoFn?: () => void } | null;
  showToast:   (message: string, undoFn?: () => void) => void;
  dismissToast: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  // Date
  selectedDate:    todayISO(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  goToToday:       () => set({ selectedDate: todayISO() }),

  // Active log
  activeLog:    null,
  setActiveLog: (activeLog) => set({ activeLog }),

  // Nav
  navOpen:    false,
  setNavOpen: (navOpen) => set({ navOpen }),
  toggleNav:  () => set((s) => ({ navOpen: !s.navOpen })),

  // Toast
  toast:        null,
  showToast:    (message, undoFn) => set({ toast: { message, undoFn } }),
  dismissToast: () => set({ toast: null }),
}));
