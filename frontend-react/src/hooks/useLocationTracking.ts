import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type {
  BackgroundGeolocationPlugin,
  Location,
} from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);
import api from '@/lib/api';

export interface Coordinate {
  lat: number;
  lng: number;
  timestamp: string; // ISO string
}

const STORAGE_KEY = 'renmito-location-logs';
const TRACK_START_HOUR = 8;   // 8 AM
const TRACK_STOP_HOUR  = 22;  // 10 PM
const INTERVAL_MINUTES = 5;

// ── Local storage helpers ─────────────────────────────────────────────────────

async function readStored(): Promise<Coordinate[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendCoordinate(coord: Coordinate): Promise<void> {
  const existing = await readStored();
  existing.push(coord);
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(existing) });
}

async function clearStored(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEY });
}

// ── Time-window guard ─────────────────────────────────────────────────────────

function isWithinTrackingWindow(): boolean {
  const h = new Date().getHours();
  return h >= TRACK_START_HOUR && h < TRACK_STOP_HOUR;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLocationTracking() {
  const [stored, setStored]     = useState<Coordinate[]>([]);
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState<string | null>(null);
  const watcherIdRef            = useRef<string | null>(null);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // Load stored coords on mount
  const refresh = useCallback(async () => {
    setStored(await readStored());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Background tracking (native only) ────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (!isNative || watcherIdRef.current) return;
    if (!isWithinTrackingWindow()) return;

    const id = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Renmito is tracking your location',
        backgroundTitle:   'Location Tracking',
        requestPermissions: true,
        stale: false,
        distanceFilter: 0, // time-based, not distance-based
      },
      async (location: Location | undefined, error: Error | undefined) => {
        if (error || !location) return;
        if (!isWithinTrackingWindow()) return;

        const coord: Coordinate = {
          lat:       location.latitude,
          lng:       location.longitude,
          timestamp: new Date().toISOString(),
        };
        await appendCoordinate(coord);
        setStored(prev => [...prev, coord]);
      }
    );

    watcherIdRef.current = id;
  }, [isNative]);

  const stopTracking = useCallback(async () => {
    if (!isNative || !watcherIdRef.current) return;
    await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
    watcherIdRef.current = null;
  }, [isNative]);

  // Auto-start on mount; enforce time window via interval
  useEffect(() => {
    if (!isNative) return;

    startTracking();

    // Check every minute whether we should start/stop based on the window
    intervalRef.current = setInterval(() => {
      if (isWithinTrackingWindow()) {
        startTracking();
      } else {
        stopTracking();
      }
    }, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopTracking();
    };
  }, [isNative, startTracking, stopTracking]);

  // Poll every INTERVAL_MINUTES — the watcher fires continuously; we throttle
  // storage writes via a separate interval so we record ~every 5 min, not every second.
  // NOTE: The watcher above appends on every location event. To enforce the 5-min
  // interval we instead use a dedicated poller that captures a single snapshot.
  // The watcher is replaced with a manual poll below for precision.
  useEffect(() => {
    if (!isNative) return;

    // Remove the continuous watcher we set up above; replace with a timed poll.
    stopTracking();
    if (watcherIdRef.current) {
      BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
      watcherIdRef.current = null;
    }

    const poll = async () => {
      if (!isWithinTrackingWindow()) return;
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Renmito is logging your location',
          backgroundTitle:   'Location Tracking Active',
          requestPermissions: true,
          stale: false,
          distanceFilter: 0,
        },
        async (location: Location | undefined, error: Error | undefined) => {
          if (error || !location) return;
          // Capture one point then remove watcher immediately
          BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current! });
          watcherIdRef.current = null;

          const coord: Coordinate = {
            lat:       location.latitude,
            lng:       location.longitude,
            timestamp: new Date().toISOString(),
          };
          await appendCoordinate(coord);
          setStored(prev => [...prev, coord]);
        }
      );
      watcherIdRef.current = id;
    };

    if (isWithinTrackingWindow()) poll();

    const timer = setInterval(() => {
      if (isWithinTrackingWindow()) poll();
    }, INTERVAL_MINUTES * 60 * 1000);

    return () => {
      clearInterval(timer);
      if (watcherIdRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  // ── Sync ──────────────────────────────────────────────────────────────────────
  const sync = useCallback(async () => {
    const coords = await readStored();
    if (coords.length === 0) {
      setSyncMsg('No data to sync.');
      return;
    }

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

  return { stored, syncing, syncMsg, sync, refresh };
}
