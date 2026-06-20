import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Journey, JourneyEntry, CreateJourney, CreateJourneyEntry } from '@/types';

function extractErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  if (e.response?.data?.error) return e.response.data.error;
  if (e.message === 'Network Error' || !navigator.onLine) return 'No internet connection. Changes saved locally.';
  return e.message ?? 'Failed to save. Changes saved locally.';
}

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

    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: entriesKey(journeyId) });
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: JourneyEntry = {
        id:               tempId,
        journeyId,
        timestamp:        payload.timestamp,
        valueType:        payload.valueType,
        numericValue:     payload.numericValue ?? null,
        categoricalValue: payload.categoricalValue ?? null,
        sourceLogId:      null,
        createdAt:        new Date().toISOString(),
        updatedAt:        new Date().toISOString(),
        _syncStatus:      'pending',
      };
      qc.setQueryData<JourneyEntry[]>(entriesKey(journeyId), old => [...(old ?? []), optimistic]);
      return { tempId };
    },

    onSuccess: (serverEntry, _vars, context) => {
      qc.setQueryData<JourneyEntry[]>(entriesKey(journeyId), old =>
        (old ?? []).map(e => e.id === context.tempId ? serverEntry : e)
      );
      qc.invalidateQueries({ queryKey: entriesKey(journeyId) });
      qc.invalidateQueries({ queryKey: journeysKey() });
    },

    onError: (err, _vars, context) => {
      const message = extractErrorMessage(err);
      qc.setQueryData<JourneyEntry[]>(entriesKey(journeyId), old =>
        (old ?? []).map(e =>
          e.id === context?.tempId ? { ...e, _syncStatus: 'failed', _syncError: message } : e
        )
      );
      toast.error(message);
    },
  });
}

// ── Update entry ──────────────────────────────────────────────────────────────

export function useUpdateJourneyEntry(journeyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, patch }: { entryId: string; patch: Partial<CreateJourneyEntry> }) =>
      api.put<JourneyEntry>(`/journeys/${journeyId}/entries/${entryId}`, patch).then(r => r.data),

    onMutate: async ({ entryId, patch }) => {
      await qc.cancelQueries({ queryKey: entriesKey(journeyId) });
      qc.setQueryData<JourneyEntry[]>(entriesKey(journeyId), old =>
        (old ?? []).map(e => e.id !== entryId ? e : {
          ...e,
          ...(patch.timestamp        !== undefined && { timestamp:        patch.timestamp }),
          ...(patch.numericValue     !== undefined && { numericValue:     patch.numericValue }),
          ...(patch.categoricalValue !== undefined && { categoricalValue: patch.categoricalValue }),
          _syncStatus: 'pending' as const,
          _syncError:  undefined,
        })
      );
    },

    onSuccess: (serverEntry, { entryId }) => {
      qc.setQueryData<JourneyEntry[]>(entriesKey(journeyId), old =>
        (old ?? []).map(e => e.id === entryId ? serverEntry : e)
      );
      qc.invalidateQueries({ queryKey: entriesKey(journeyId) });
      qc.invalidateQueries({ queryKey: journeysKey() });
    },

    onError: (err, { entryId }) => {
      const message = extractErrorMessage(err);
      qc.setQueryData<JourneyEntry[]>(entriesKey(journeyId), old =>
        (old ?? []).map(e =>
          e.id === entryId ? { ...e, _syncStatus: 'failed', _syncError: message } : e
        )
      );
      toast.error(message);
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
