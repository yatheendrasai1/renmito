import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/api';
import type { UserPreferences, ActiveLog } from '@/types';

// ── Query key ────────────────────────────────────────────────────────────────
export const PREFS_KEY = ['preferences'] as const;

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchPreferences(): Promise<UserPreferences | null> {
  const res = await api.get<UserPreferences>('/preferences');
  return res.data ?? null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePreferences() {
  const query = useQuery({
    queryKey: PREFS_KEY,
    queryFn:  fetchPreferences,
    staleTime: 60_000,
  });

  // Apply theme class whenever prefs load / change
  useEffect(() => {
    const theme = query.data?.theme ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [query.data]);

  return query;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSetTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (theme: 'light' | 'dark') =>
      api.put('/preferences/theme', { theme }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useUpdateFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (features: import('@/types').Features) =>
      api.put('/preferences/features', features).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useUpdateDaySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: import('@/types').DaySettings) =>
      api.put('/preferences/day-settings', settings).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useUpdateUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: import('@/types').UserProfile) =>
      api.put('/preferences/user-profile', profile).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useSetActiveLog() {
  const qc = useQueryClient();
  return useMutation({
    /** Pass an ActiveLog to start, or null to stop (DELETE). */
    mutationFn: (activeLog: ActiveLog | null) => {
      if (activeLog === null) {
        return api.delete('/preferences/active-log').then(r => r.data);
      }
      return api.put('/preferences/active-log', activeLog).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}
