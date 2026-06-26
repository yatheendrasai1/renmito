import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

export interface LocationPoint {
  _id: string;
  name: string;
  lat: number;
  lng: number;
}

export function useLocationPoints() {
  const [points, setPoints]   = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/location-points');
      setPoints(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (name: string, lat: number, lng: number) => {
    const res = await api.post('/location-points', { name, lat, lng });
    setPoints(prev => [res.data, ...prev]);
    return res.data as LocationPoint;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.delete(`/location-points/${id}`);
    setPoints(prev => prev.filter(p => p._id !== id));
  }, []);

  return { points, loading, fetchAll, create, remove };
}
