import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type {
  BackgroundGeolocationPlugin,
  Location,
} from '@capacitor-community/background-geolocation';
import api from '@/lib/api';

type LocationPoint = { _id: string; lat: number; lng: number; name: string; radius: number };

async function fetchLocationPoints(): Promise<LocationPoint[]> {
  try {
    // Backgrounded WebView requests get throttled by Android after ~5 min;
    // bound this so a stalled request can't block a pending save forever.
    const res = await api.get('/location-points', { timeout: 8000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);

interface BatteryOptimizationPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<{ ignoring: boolean }>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>(
  'BatteryOptimization'
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
const INTERVAL_MS             = 5 * 60 * 1000;
const BIG_MOVEMENT_THRESHOLD  = 10; // metres
const LOCATION_POINTS_TTL_MS  = 15 * 60 * 1000;

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

const TRACKING_ENABLED_KEY    = 'renmito-location-tracking-enabled';
const TRACKING_START_HOUR_KEY = 'renmito-location-track-start';
const TRACKING_END_HOUR_KEY   = 'renmito-location-track-end';
const DEFAULT_START_HOUR      = 8;
const DEFAULT_END_HOUR        = 22;

function readHour(key: string, fallback: number): number {
  const v = parseInt(localStorage.getItem(key) ?? '', 10);
  return isNaN(v) ? fallback : v;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLocationTracking() {
  const [stored, setStored]                   = useState<StoredPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [syncing, setSyncing]                 = useState(false);
  const [syncMsg, setSyncMsg]                 = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabledState] = useState<boolean>(
    () => localStorage.getItem(TRACKING_ENABLED_KEY) === 'true'
  );
  const [trackStartHour, setTrackStartHourState] = useState<number>(
    () => readHour(TRACKING_START_HOUR_KEY, DEFAULT_START_HOUR)
  );
  const [trackEndHour, setTrackEndHourState] = useState<number>(
    () => readHour(TRACKING_END_HOUR_KEY, DEFAULT_END_HOUR)
  );

  // Refs so the watcher callback always sees current window values without
  // needing to restart the watcher when hours change.
  const trackStartRef = useRef(trackStartHour);
  const trackEndRef   = useRef(trackEndHour);
  useEffect(() => { trackStartRef.current = trackStartHour; }, [trackStartHour]);
  useEffect(() => { trackEndRef.current   = trackEndHour;   }, [trackEndHour]);

  const watcherIdRef      = useRef<string | null>(null);
  const lastSavedAtRef    = useRef<number>(0);
  const lastSavedCoordRef = useRef<Coordinate | null>(null);
  const isNative          = Capacitor.isNativePlatform();

  // Cache of user-defined location points, refreshed on a TTL rather than
  // re-fetched on every save — keeps the save path off the network in the
  // common case, since a stalled background request would otherwise block
  // that cycle's point from ever being appended.
  const locationPointsRef      = useRef<LocationPoint[]>([]);
  const locationPointsFetchedAt = useRef<number>(0);

  const getLocationPoints = useCallback(async (): Promise<LocationPoint[]> => {
    const now = Date.now();
    if (now - locationPointsFetchedAt.current < LOCATION_POINTS_TTL_MS) {
      return locationPointsRef.current;
    }
    locationPointsRef.current = await fetchLocationPoints();
    locationPointsFetchedAt.current = now;
    return locationPointsRef.current;
  }, []);

  const setTrackingEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(TRACKING_ENABLED_KEY, String(enabled));
    setTrackingEnabledState(enabled);

    // "Allow all the time" location permission does not exempt the app from
    // battery optimization — without that separate exemption, OEM battery
    // managers can still kill the tracking service hours after the app was
    // last opened. Prompt for it at the moment the user opts in.
    if (enabled && Capacitor.isNativePlatform()) {
      BatteryOptimization.requestIgnoreBatteryOptimizations().catch(() => {});
    }
  }, []);

  const setTrackingWindow = useCallback((startHour: number, endHour: number) => {
    localStorage.setItem(TRACKING_START_HOUR_KEY, String(startHour));
    localStorage.setItem(TRACKING_END_HOUR_KEY,   String(endHour));
    setTrackStartHourState(startHour);
    setTrackEndHourState(endHour);
  }, []);

  const refresh = useCallback(async () => {
    setStored(await readStored());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!isNative || !trackingEnabled) {
      // If disabled while a watcher is active, tear it down.
      if (watcherIdRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        watcherIdRef.current = null;
        lastSavedAtRef.current = 0;
        lastSavedCoordRef.current = null;
      }
      return;
    }

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

        // Use the GPS fix time (UTC epoch ms) so the stored timestamp reflects
        // when the position was actually recorded, not when the callback fired.
        const fixMs = location.time ?? Date.now();
        const coord: Coordinate = {
          lat:       location.latitude,
          lng:       location.longitude,
          timestamp: new Date(fixMs).toISOString(), // always UTC ISO-8601
        };

        // Only update React state if position changed by >1 m to avoid
        // re-rendering the entire app on every GPS poll.
        setCurrentPosition(prev => {
          if (prev && haversineMeters(prev, coord) < 1) return prev;
          return coord;
        });

        const h = new Date().getHours();
        if (h < trackStartRef.current || h >= trackEndRef.current) return;

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

          const savedPoints = await getLocationPoints();
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
  }, [isNative, trackingEnabled, getLocationPoints]);

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

  return {
    stored, bigMovements, currentPosition,
    syncing, syncMsg, sync, refresh, removePoints,
    trackingEnabled, setTrackingEnabled,
    trackStartHour, trackEndHour, setTrackingWindow,
  };
}
