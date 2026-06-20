import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/api';
import { readCache, writeCache, pruneOldDateCaches } from '@/lib/queryCache';
import type { DayMetadata, DayType } from '@/types';

export const dayMetaKey = (date: string) => ['day-metadata', date] as const;

async function fetchDayMetadata(date: string): Promise<DayMetadata | null> {
  try {
    const res = await api.get<DayMetadata>(`/day-metadata/${date}`);
    return res.data ?? null;
  } catch {
    return null;
  }
}

export function useDayMetadata(date: string) {
  const cacheKey = `day-meta-${date}`;
  const query = useQuery({
    queryKey:    dayMetaKey(date),
    queryFn:     () => fetchDayMetadata(date),
    enabled:     !!date,
    staleTime:   60_000,
    initialData: () => readCache<DayMetadata>(cacheKey) ?? undefined,
  });

  useEffect(() => {
    if (query.data) {
      writeCache(cacheKey, query.data);
      pruneOldDateCaches('day-meta-', 4);
    }
  }, [query.data, cacheKey]);

  return query;
}

export function useSetDayType(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dayType: DayType) =>
      api.put<DayMetadata>(`/day-metadata/${date}/day-type`, { dayType }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dayMetaKey(date) }),
  });
}

export function useCaptureDayMeta(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<DayMetadata>(`/day-metadata/${date}/capture`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dayMetaKey(date) }),
  });
}
