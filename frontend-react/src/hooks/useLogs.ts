import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { LogEntry, CreateLogEntry } from '@/types';

// ── Query key factory ─────────────────────────────────────────────────────────
export const logsKey = (date: string) => ['logs', date] as const;

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchLogs(date: string): Promise<LogEntry[]> {
  const res = await api.get<LogEntry[]>(`/logs/${date}`);
  return res.data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLogs(date: string) {
  return useQuery({
    queryKey: logsKey(date),
    queryFn:  () => fetchLogs(date),
    enabled:  !!date,
    staleTime: 30_000,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────
export function useCreateLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: CreateLogEntry) =>
      api.post<LogEntry>(`/logs/${date}`, entry).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: logsKey(date) }),
  });
}

// ── Update ────────────────────────────────────────────────────────────────────
export function useUpdateLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, entry }: { id: string; entry: Partial<CreateLogEntry> }) =>
      api.put<LogEntry>(`/logs/${date}/${id}`, entry).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: logsKey(date) }),
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
