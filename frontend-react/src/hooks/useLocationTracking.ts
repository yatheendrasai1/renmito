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
const TRACK_START_HOUR = 8;
const TRACK_STOP_HOUR  = 22;
const INTERVAL_MS      = 5 * 60 * 1000;

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

function isWithinTrackingWindow(): boolean {
  const h = new Date().getHours();
  return h >= TRACK_START_HOUR && h < TRACK_STOP_HOUR;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLocationTracking() {
  const [stored, setStored]               = useState<Coordinate[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [syncing, setSyncing]             = useState(false);
  const [syncMsg, setSyncMsg]             = useState<string | null>(null);

  const watcherIdRef   = useRef<string | null>(null);
  const lastSavedAtRef = useRef<number>(0); // timestamp of last saved point
  const isNative       = Capacitor.isNativePlatform();

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

        // Always update the live position on the map
        setCurrentPosition(coord);

        if (!isWithinTrackingWindow()) return;

        const now = Date.now();
        const msSinceLast = now - lastSavedAtRef.current;

        // Save immediately on the first fix, then respect the 5-min interval
        if (lastSavedAtRef.current === 0 || msSinceLast >= INTERVAL_MS) {
          lastSavedAtRef.current = now;
          await appendCoordinate(coord);
          setStored(prev => [...prev, coord]);
        }
      }
    ).then(id => {
      watcherIdRef.current = id;

      // Safety net: if the watcher never fires (e.g. GPS cold start takes long),
      // we still re-check every minute so we don't miss the window open/close.
      timerId = setInterval(() => {
        if (!isWithinTrackingWindow() && watcherIdRef.current) {
          // Outside window — nothing to do; watcher stays alive for live position
        }
      }, 60_000);
    });

    return () => {
      clearInterval(timerId);
      if (watcherIdRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        watcherIdRef.current = null;
      }
    };
  }, [isNative]);

  // ── Sync ─────────────────────────────────────────────────────────────────────
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

  return { stored, currentPosition, syncing, syncMsg, sync, refresh };
}
