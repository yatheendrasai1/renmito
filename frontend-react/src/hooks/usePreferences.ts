import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/api';
import { applyPaletteToDOM, clearPaletteFromDOM } from '@/lib/palette';
import type { UserPreferences, ColorPalette, ActiveLog } from '@/types';

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

  // Apply palette whenever prefs load / change
  useEffect(() => {
    if (query.data?.palette) {
      applyPaletteToDOM(query.data.palette);
    } else if (query.data !== undefined) {
      clearPaletteFromDOM();
    }
  }, [query.data]);

  return query;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSavePalette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (palette: ColorPalette) =>
      api.put('/preferences/palette', palette).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useDeletePalette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/preferences/palette').then(r => r.data),
    onSuccess:  () => {
      clearPaletteFromDOM();
      qc.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });
}

export function useAddPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preset: ColorPalette) =>
      api.post<ColorPalette[]>('/preferences/presets', preset).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.delete<ColorPalette[]>(`/preferences/presets/${encodeURIComponent(name)}`).then(r => r.data),
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
