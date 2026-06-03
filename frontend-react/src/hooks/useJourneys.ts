import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Journey, JourneyEntry, CreateJourney, CreateJourneyEntry } from '@/types';

// ── Query keys ────────────────────────────────────────────────────────────────

export const journeysKey    = ()         => ['journeys']                  as const;
export const entriesKey     = (id: string) => ['journey-entries', id]    as const;

// ── List journeys ─────────────────────────────────────────────────────────────

export function useJourneys() {
  return useQuery({
    queryKey: journeysKey(),
    queryFn:  () => api.get<Journey[]>('/journeys').then(r => Array.isArray(r.data) ? r.data : []),
    staleTime: 60_000,
  });
}

// ── Create journey ────────────────────────────────────────────────────────────

export function useCreateJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateJourney) =>
      api.post<Journey>('/journeys', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: journeysKey() }),
  });
}

// ── Update journey ────────────────────────────────────────────────────────────

export function useUpdateJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: object }) =>
      api.put<Journey>(`/journeys/${id}`, patch).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: journeysKey() }),
  });
}

// ── Delete journey ────────────────────────────────────────────────────────────

export function useDeleteJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/journeys/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: journeysKey() }),
  });
}

// ── List entries ──────────────────────────────────────────────────────────────

export function useJourneyEntries(journeyId: string | null) {
  return useQuery({
    queryKey: entriesKey(journeyId ?? ''),
    queryFn:  () => api.get<JourneyEntry[]>(`/journeys/${journeyId}/entries`).then(r => Array.isArray(r.data) ? r.data : []),
    enabled:  !!journeyId,
    staleTime: 30_000,
  });
}

// ── Add entry ─────────────────────────────────────────────────────────────────

export function useAddJourneyEntry(journeyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateJourneyEntry) =>
      api.post<JourneyEntry>(`/journeys/${journeyId}/entries`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey(journeyId) });
      qc.invalidateQueries({ queryKey: journeysKey() });
    },
  });
}

// ── Update entry ──────────────────────────────────────────────────────────────

export function useUpdateJourneyEntry(journeyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, patch }: { entryId: string; patch: Partial<CreateJourneyEntry> }) =>
      api.put<JourneyEntry>(`/journeys/${journeyId}/entries/${entryId}`, patch).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey(journeyId) });
      qc.invalidateQueries({ queryKey: journeysKey() });
    },
  });
}

// ── Delete entry ──────────────────────────────────────────────────────────────

export function useDeleteJourneyEntry(journeyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api.delete(`/journeys/${journeyId}/entries/${entryId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey(journeyId) });
      qc.invalidateQueries({ queryKey: journeysKey() });
    },
  });
}

// ── Resync derived journey ────────────────────────────────────────────────────

export function useResyncJourney(journeyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<JourneyEntry[]>(`/journeys/${journeyId}/resync`, {}).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey(journeyId) });
      qc.invalidateQueries({ queryKey: journeysKey() });
    },
  });
}
