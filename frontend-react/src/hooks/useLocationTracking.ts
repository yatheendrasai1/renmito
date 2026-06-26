import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type {
  BackgroundGeolocationPlugin,
  Location,
} from '@capacitor-community/background-geolocation';
import api from '@/lib/api';

async function fetchLocationPoints(): Promise<{ _id: string; lat: number; lng: number; name: string; radius: number }[]> {
  try {
    const res = await api.get('/location-points');
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);

export interface Coordinate {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface StoredPoint extends Coordinate {
  distanceFromPrev: number | null;
  nearbyLocationName?: string | null;
  nearbyLocationId?: string | null;
}

const STORAGE_KEY             = 'renmito-location-logs';
const TRACK_START_HOUR        = 8;
const TRACK_STOP_HOUR         = 22;
const INTERVAL_MS             = 5 * 60 * 1000;
const BIG_MOVEMENT_THRESHOLD  = 10; // metres

// ── Haversine distance ────────────────────────────────────────────────────────

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R     = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat  = toRad(b.lat - a.lat);
  const dLng  = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Storage helpers ───────────────────────────────────────────────────────────

async function readStored(): Promise<StoredPoint[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    // Normalise legacy records that predate distanceFromPrev
    return parsed.map(p => ({
      lat:                p.lat,
      lng:                p.lng,
      timestamp:          p.timestamp,
      distanceFromPrev:   p.distanceFromPrev  ?? null,
      nearbyLocationName: p.nearbyLocationName ?? null,
      nearbyLocationId:   p.nearbyLocationId   ?? null,
    }));
  } catch {
    return [];
  }
}

async function appendPoint(point: StoredPoint): Promise<void> {
  const existing = await readStored();
  existing.push(point);
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(existing) });
}

async function clearStored(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEY });
}

async function removeStoredByTimestamps(timestamps: Set<string>): Promise<StoredPoint[]> {
  const existing = await readStored();
  const kept = existing.filter(p => !timestamps.has(p.timestamp));
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(kept) });
  return kept;
}

function isWithinTrackingWindow(): boolean {
  const h = new Date().getHours();
  return h >= TRACK_START_HOUR && h < TRACK_STOP_HOUR;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLocationTracking() {
  const [stored, setStored]                   = useState<StoredPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [syncing, setSyncing]                 = useState(false);
  const [syncMsg, setSyncMsg]                 = useState<string | null>(null);

  const watcherIdRef      = useRef<string | null>(null);
  const lastSavedAtRef    = useRef<number>(0);
  const lastSavedCoordRef = useRef<Coordinate | null>(null);
  const isNative          = Capacitor.isNativePlatform();

  const refresh = useCallback(async () => {
    setStored(await readStored());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!isNative) return;

    let timerId: ReturnType<typeof setInterval>;

    BackgroundGeolocation.addWatcher(
      {
        backgroundMessage:  'Renmito is tracking your location',
        backgroundTitle:    'Location Tracking Active',
        requestPermissions: true,
        stale:              false,
        distanceFilter:     0,
      },
      async (location: Location | undefined, error: Error | undefined) => {
        if (error || !location) return;

        const coord: Coordinate = {
          lat:       location.latitude,
          lng:       location.longitude,
          timestamp: new Date().toISOString(),
        };

        setCurrentPosition(coord);

        if (!isWithinTrackingWindow()) return;

        const now          = Date.now();
        const msSinceLast  = now - lastSavedAtRef.current;
        const isFirst      = lastSavedAtRef.current === 0;

        if (isFirst || msSinceLast >= INTERVAL_MS) {
          // Gate immediately (synchronously) so concurrent callbacks
          // that arrive before the awaits below don't also pass the check.
          lastSavedAtRef.current    = now;
          lastSavedCoordRef.current = coord;

          const distanceFromPrev = lastSavedCoordRef.current
            ? haversineMeters(lastSavedCoordRef.current, coord)
            : null;

          const savedPoints = await fetchLocationPoints();
          const nearby = savedPoints.find(
            p => haversineMeters(coord, p) <= (p.radius ?? 10)
          );

          const point: StoredPoint = {
            ...coord,
            distanceFromPrev,
            nearbyLocationName: nearby?.name ?? null,
            nearbyLocationId:   nearby?._id  ?? null,
          };

          await appendPoint(point);
          setStored(prev => [...prev, point]);
        }
      }
    ).then(id => {
      watcherIdRef.current = id;
      timerId = setInterval(() => { /* window open/close heartbeat */ }, 60_000);
    });

    return () => {
      clearInterval(timerId);
      if (watcherIdRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        watcherIdRef.current = null;
      }
    };
  }, [isNative]);

  const removePoints = useCallback(async (timestamps: Set<string>) => {
    const kept = await removeStoredByTimestamps(timestamps);
    setStored(kept);
  }, []);

  const sync = useCallback(async () => {
    const coords = await readStored();
    if (coords.length === 0) { setSyncMsg('No data to sync.'); return; }
    setSyncing(true);
    setSyncMsg(null);
    try {
      await api.post('/location-logs/sync', { coordinates: coords });
      await clearStored();
      setStored([]);
      setSyncMsg(`Synced ${coords.length} points successfully.`);
    } catch {
      setSyncMsg('Sync failed. Data retained locally.');
    } finally {
      setSyncing(false);
    }
  }, []);

  const bigMovements = stored.filter(
    p => p.distanceFromPrev !== null && p.distanceFromPrev >= BIG_MOVEMENT_THRESHOLD
  );

  return { stored, bigMovements, currentPosition, syncing, syncMsg, sync, refresh, removePoints };
}
