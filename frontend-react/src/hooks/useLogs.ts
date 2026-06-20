import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { readCache, writeCache } from '@/lib/queryCache';
import type { LogEntry, CreateLogEntry } from '@/types';

// ── Query key factory ─────────────────────────────────────────────────────────
export const logsKey = (date: string) => ['logs', date] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  if (e.response?.data?.error) return e.response.data.error;
  if (e.message === 'Network Error' || !navigator.onLine) return 'No internet connection. Changes saved locally.';
  return e.message ?? 'Failed to save. Changes saved locally.';
}

function buildOptimisticLog(date: string, entry: CreateLogEntry): LogEntry {
  const startAt = entry.startAtISO ?? `${date}T${entry.startTime ?? '00:00'}:00.000Z`;
  const endAt   = entry.entryType === 'point' ? null
    : (entry.endAtISO ?? (entry.endTime ? `${date}T${entry.endTime}:00.000Z` : null));
  const durMins = startAt && endAt
    ? Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)
    : null;
  return {
    id:          `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date,
    endDate:     null,
    startAt,
    endAt,
    title:       entry.title,
    durationMins: durMins,
    logType:     null,
    logTypeSource: null,
    entryType:   entry.entryType ?? 'range',
    status:      'completed',
    priority:    entry.priority ?? null,
    collaborators: entry.collaborators ?? [],
    satisfactoryScore: entry.satisfactoryScore ?? null,
    crucialPerson: entry.crucialPerson ?? null,
    source:      entry.source ?? 'manual',
    updatedAt:   null,
    _syncStatus: 'pending',
  };
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchLogs(date: string): Promise<LogEntry[]> {
  const tz = new Date().getTimezoneOffset();
  const res = await api.get<LogEntry[]>(`/logs/${date}`, { params: { tz } });
  return Array.isArray(res.data) ? res.data : [];
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLogs(date: string) {
  const cacheKey = `logs-${date}`;
  const query = useQuery({
    queryKey:    logsKey(date),
    queryFn:     () => fetchLogs(date),
    enabled:     !!date,
    staleTime:   30_000,
    initialData: () => readCache<LogEntry[]>(cacheKey),
  });

  // Write fresh server data back to cache (skip items that are still pending/failed)
  useEffect(() => {
    if (query.data) {
      const serverOnly = query.data.filter(l => !l._syncStatus);
      if (serverOnly.length > 0) writeCache(cacheKey, serverOnly);
    }
  }, [query.data, cacheKey]);

  return query;
}

function invalidateBothDates(qc: ReturnType<typeof useQueryClient>, primaryDate: string, log: LogEntry) {
  qc.invalidateQueries({ queryKey: logsKey(primaryDate) });
  if (log.endDate && log.endDate !== primaryDate) {
    qc.invalidateQueries({ queryKey: logsKey(log.endDate) });
  }
}

// ── Create ────────────────────────────────────────────────────────────────────
export function useCreateLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: CreateLogEntry) =>
      api.post<LogEntry>(`/logs/${date}`, entry).then(r => r.data),

    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: logsKey(date) });
      const optimistic = buildOptimisticLog(date, entry);
      qc.setQueryData<LogEntry[]>(logsKey(date), old => [...(old ?? []), optimistic]);
      return { tempId: optimistic.id };
    },

    onSuccess: (serverLog, _vars, context) => {
      // Replace the temp item with the real server item
      qc.setQueryData<LogEntry[]>(logsKey(date), old =>
        (old ?? []).map(l => l.id === context.tempId ? serverLog : l)
      );
      invalidateBothDates(qc, date, serverLog);
    },

    onError: (err, _vars, context) => {
      const message = extractErrorMessage(err);
      // Mark the temp item as failed — do NOT remove it
      qc.setQueryData<LogEntry[]>(logsKey(date), old =>
        (old ?? []).map(l =>
          l.id === context?.tempId ? { ...l, _syncStatus: 'failed', _syncError: message } : l
        )
      );
      toast.error(message);
    },
  });
}

// ── Update ────────────────────────────────────────────────────────────────────
export function useUpdateLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, entry }: { id: string; entry: Partial<CreateLogEntry> }) =>
      api.put<LogEntry>(`/logs/${date}/${id}`, entry).then(r => r.data),

    onMutate: async ({ id, entry }) => {
      await qc.cancelQueries({ queryKey: logsKey(date) });
      qc.setQueryData<LogEntry[]>(logsKey(date), old =>
        (old ?? []).map(l => {
          if (l.id !== id) return l;
          return {
            ...l,
            ...(entry.title      !== undefined && { title: entry.title }),
            ...(entry.startAtISO !== undefined && { startAt: entry.startAtISO }),
            ...(entry.endAtISO   !== undefined && { endAt:   entry.endAtISO }),
            _syncStatus: 'pending' as const,
            _syncError:  undefined,
          };
        })
      );
    },

    onSuccess: (serverLog, { id }) => {
      qc.setQueryData<LogEntry[]>(logsKey(date), old =>
        (old ?? []).map(l => l.id === id ? serverLog : l)
      );
      invalidateBothDates(qc, date, serverLog);
    },

    onError: (err, { id }) => {
      const message = extractErrorMessage(err);
      qc.setQueryData<LogEntry[]>(logsKey(date), old =>
        (old ?? []).map(l =>
          l.id === id ? { ...l, _syncStatus: 'failed', _syncError: message } : l
        )
      );
      toast.error(message);
    },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────
export function useDeleteLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ message: string }>(`/logs/${date}/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: logsKey(date) }),
  });
}
