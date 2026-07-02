import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
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
  accuracy?: number | null;
}

export interface StoredPoint extends Coordinate {
  distanceFromPrev: number | null;
  nearbyLocationName?: string | null;
  nearbyLocationId?: string | null;
}

const STORAGE_KEY             = 'renmito-location-logs';
const BIG_MOVEMENT_THRESHOLD  = 10; // metres
const LOCATION_POINTS_TTL_MS  = 15 * 60 * 1000;
// Fixes worse than this (metres, 68% confidence radius) are still logged —
// going silent instead would look like tracking had stopped working — but
// are flagged as low-confidence so the UI can mark them distinctly. Realistic
// outdoor GPS reports ~5-15m; anything looser is usually a cell/wifi-based
// fallback fix (indoors, urban canyon, cold GPS start).
export const ACCURACY_THRESHOLD_M = 15;

export function isLowConfidence(accuracy: number | null | undefined): boolean {
  return accuracy != null && accuracy > ACCURACY_THRESHOLD_M;
}

// Cap on how much a fix's own uncertainty can widen a stored point's
// geofence when matching "nearby" locations. Without a cap, a badly noisy
// fix (e.g. ~150m indoor cell/wifi fallback) would appear to match almost
// any nearby point; without any buffer at all, a small-radius point (e.g.
// a 5m meeting room) would routinely miss real matches to ordinary GPS
// noise, since consumer GPS realistically reports 5-15m even outdoors.
const NEARBY_ACCURACY_BUFFER_CAP_M = 20;

export const LOCATION_INTERVAL_OPTIONS = [
  { label: '10 sec', value: 10 / 60 },
  { label: '5 min',  value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
];

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
    // Normalise legacy records that predate distanceFromPrev/accuracy
    return parsed.map(p => ({
      lat:                p.lat,
      lng:                p.lng,
      timestamp:          p.timestamp,
      accuracy:           p.accuracy          ?? null,
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

const TRACKING_ENABLED_KEY   = 'renmito-location-tracking-enabled';
const TRACKING_START_MIN_KEY = 'renmito-location-track-start-min';
const TRACKING_END_MIN_KEY   = 'renmito-location-track-end-min';
const TRACKING_INTERVAL_KEY  = 'renmito-location-track-interval';
const DEFAULT_START_MIN      = 8 * 60;  // 08:00
const DEFAULT_END_MIN        = 22 * 60; // 22:00
const DEFAULT_INTERVAL_MIN   = 15;

// Interval values can be fractional (e.g. 10 sec = 1/6 min), so this must
// use parseFloat rather than parseInt — parseInt would truncate anything
// under 1 down to 0, collapsing the interval gate to "save every callback".
function readNumber(key: string, fallback: number): number {
  const v = parseFloat(localStorage.getItem(key) ?? '');
  return isNaN(v) ? fallback : v;
}

export function minutesToHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
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
  // Minutes since midnight (0-1439), so the tracking window can be set to
  // any time of day, not just whole hours.
  const [trackStartMin, setTrackStartMinState] = useState<number>(
    () => readNumber(TRACKING_START_MIN_KEY, DEFAULT_START_MIN)
  );
  const [trackEndMin, setTrackEndMinState] = useState<number>(
    () => readNumber(TRACKING_END_MIN_KEY, DEFAULT_END_MIN)
  );
  const [trackIntervalMin, setTrackIntervalMinState] = useState<number>(
    () => readNumber(TRACKING_INTERVAL_KEY, DEFAULT_INTERVAL_MIN)
  );

  // Refs so the watcher callback always sees current window/interval values
  // without needing to restart the watcher when they change.
  const trackStartRef    = useRef(trackStartMin);
  const trackEndRef      = useRef(trackEndMin);
  const trackIntervalRef = useRef(trackIntervalMin);
  useEffect(() => { trackStartRef.current    = trackStartMin;    }, [trackStartMin]);
  useEffect(() => { trackEndRef.current      = trackEndMin;      }, [trackEndMin]);
  useEffect(() => { trackIntervalRef.current = trackIntervalMin; }, [trackIntervalMin]);

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

  const setTrackingWindow = useCallback((startMin: number, endMin: number) => {
    localStorage.setItem(TRACKING_START_MIN_KEY, String(startMin));
    localStorage.setItem(TRACKING_END_MIN_KEY,   String(endMin));
    setTrackStartMinState(startMin);
    setTrackEndMinState(endMin);
  }, []);

  const setTrackInterval = useCallback((minutes: number) => {
    localStorage.setItem(TRACKING_INTERVAL_KEY, String(minutes));
    setTrackIntervalMinState(minutes);
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

    // The location plugin only requests the location permission alias — it
    // never asks for POST_NOTIFICATIONS (Android 13+). Without it, the OS
    // silently withholds the foreground service's persistent notification
    // even though tracking keeps running. Check every time the watcher
    // (re)starts, not just on toggle, so it also covers app relaunches
    // where tracking was already on.
    LocalNotifications.checkPermissions().then(status => {
      if (status.display !== 'granted') {
        LocalNotifications.requestPermissions().catch(() => {});
      }
    }).catch(() => {});

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
          accuracy:  location.accuracy ?? null,
        };

        // Only update React state if position changed by >1 m to avoid
        // re-rendering the entire app on every GPS poll.
        setCurrentPosition(prev => {
          if (prev && haversineMeters(prev, coord) < 1) return prev;
          return coord;
        });

        const nowDate = new Date();
        const minutesOfDay = nowDate.getHours() * 60 + nowDate.getMinutes();
        if (minutesOfDay < trackStartRef.current || minutesOfDay >= trackEndRef.current) return;

        const now          = Date.now();
        const msSinceLast  = now - lastSavedAtRef.current;
        const isFirst      = lastSavedAtRef.current === 0;

        if (isFirst || msSinceLast >= trackIntervalRef.current * 60 * 1000) {
          // Capture the previous point before the gate below overwrites it.
          const prevCoord = lastSavedCoordRef.current;

          // Gate immediately (synchronously) so concurrent callbacks
          // that arrive before the awaits below don't also pass the check.
          lastSavedAtRef.current    = now;
          lastSavedCoordRef.current = coord;

          const distanceFromPrev = prevCoord
            ? haversineMeters(prevCoord, coord)
            : null;

          const savedPoints = await getLocationPoints();
          const accuracyBuffer = Math.min(coord.accuracy ?? 0, NEARBY_ACCURACY_BUFFER_CAP_M);
          const nearby = savedPoints.find(
            p => haversineMeters(coord, p) <= (p.radius ?? 10) + accuracyBuffer
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
    trackStartMin, trackEndMin, setTrackingWindow,
    trackIntervalMin, setTrackInterval,
  };
}
