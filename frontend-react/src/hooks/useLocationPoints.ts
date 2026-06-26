import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

export interface LocationPoint {
  _id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // metres
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

  const create = useCallback(async (name: string, lat: number, lng: number, radius: number) => {
    const res = await api.post('/location-points', { name, lat, lng, radius });
    setPoints(prev => [res.data, ...prev]);
    return res.data as LocationPoint;
  }, []);

  const update = useCallback(async (id: string, patch: { name?: string; radius?: number }) => {
    const res = await api.patch(`/location-points/${id}`, patch);
    setPoints(prev => prev.map(p => p._id === id ? (res.data as LocationPoint) : p));
    return res.data as LocationPoint;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.delete(`/location-points/${id}`);
    setPoints(prev => prev.filter(p => p._id !== id));
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map(id => api.delete(`/location-points/${id}`)));
    setPoints(prev => prev.filter(p => !ids.includes(p._id)));
  }, []);

  return { points, loading, fetchAll, create, update, remove, removeMany };
}
