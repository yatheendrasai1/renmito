import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// Returns { "YYYY-MM-DD": workMinutes }
async function fetchMonthSummary(year: number, month: number): Promise<Record<string, number>> {
  const res = await api.get<Record<string, number>>(`/logs/month/${year}/${month}`);
  return res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : {};
}

export function useMonthSummary(year: number, month: number) {
  return useQuery({
    queryKey: ['month-summary', year, month],
    queryFn:  () => fetchMonthSummary(year, month),
    staleTime: 60_000,
  });
}
