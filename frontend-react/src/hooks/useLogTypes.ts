import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { LogType } from '@/types';

export const LOG_TYPES_KEY = ['log-types'] as const;

async function fetchLogTypes(): Promise<LogType[]> {
  const res = await api.get<LogType[]>('/logtypes');
  return Array.isArray(res.data) ? res.data : [];
}

/** Returns all active log types (default + user-created) for the auth'd user. */
export function useLogTypes() {
  return useQuery({
    queryKey: LOG_TYPES_KEY,
    queryFn:  fetchLogTypes,
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

interface CreateLogTypePayload {
  name:   string;
  domain: 'work' | 'personal' | 'family';
  color:  string;
}

export function useCreateLogType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLogTypePayload) =>
      api.post<LogType>('/logtypes', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOG_TYPES_KEY }),
  });
}

export function useRenameLogType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<LogType>(`/logtypes/${id}`, { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOG_TYPES_KEY }),
  });
}

export function useDeleteLogType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/logtypes/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOG_TYPES_KEY }),
  });
}
