import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type {
  BackgroundGeolocationPlugin,
  Location,
} from '@capacitor-community/background-geolocation';
import api from '@/lib/api';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);

export interface Coordinate {
  lat: number;
  lng: number;
  timestamp: string;
}

const STORAGE_KEY      = 'renmito-location-logs';
const TRACK_START_HOUR = 8;   // 8 AM
const TRACK_STOP_HOUR  = 22;  // 10 PM
const INTERVAL_MS      = 5 * 60 * 1000; // 5 minutes

// ── Storage helpers ───────────────────────────────────────────────────────────

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
  const [stored, setStored]   = useState<Coordinate[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Holds the latest position reported by the continuous watcher
  const latestLocationRef = useRef<Location | null>(null);
  const watcherIdRef      = useRef<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  const refresh = useCallback(async () => {
    setStored(await readStored());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Background tracking (native only) ────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;

    // One persistent watcher keeps the Android Foreground Service alive and
    // continuously updates latestLocationRef. A separate setInterval snapshots
    // that value every 5 minutes — no race condition with addWatcher's promise.
    let timerId: ReturnType<typeof setInterval>;

    BackgroundGeolocation.addWatcher(
      {
        backgroundMessage:  'Renmito is tracking your location',
        backgroundTitle:    'Location Tracking Active',
        requestPermissions: true,
        stale:              false,
        distanceFilter:     0,
      },
      (location: Location | undefined, error: Error | undefined) => {
        if (error || !location) return;
        latestLocationRef.current = location;
      }
    ).then(id => {
      watcherIdRef.current = id;

      const saveSnapshot = async () => {
        if (!isWithinTrackingWindow()) return;
        const loc = latestLocationRef.current;
        if (!loc) return;

        const coord: Coordinate = {
          lat:       loc.latitude,
          lng:       loc.longitude,
          timestamp: new Date().toISOString(),
        };
        await appendCoordinate(coord);
        setStored(prev => [...prev, coord]);
      };

      // Save immediately on start if within window, then every 5 minutes
      if (isWithinTrackingWindow()) saveSnapshot();
      timerId = setInterval(saveSnapshot, INTERVAL_MS);
    });

    return () => {
      clearInterval(timerId);
      if (watcherIdRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        watcherIdRef.current = null;
      }
    };
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
