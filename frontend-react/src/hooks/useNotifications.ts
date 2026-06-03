import { useState, useEffect, useCallback } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// ── Constants ──────────────────────────────────────────────────────────────────

const STORAGE_ENABLED  = 'renmito-notif-enabled';
const STORAGE_INTERVAL = 'renmito-notif-interval'; // minutes
const STORAGE_PHRASE_IDX = 'renmito-notif-phrase-idx';

// Batch size: pre-schedule this many notifications at a time.
// At 5-min interval that covers ~8 hours; at 6h interval covers 25 days.
const BATCH_SIZE = 100;

// Refill when fewer than this many pending notifications remain.
const REFILL_THRESHOLD = 20;

// Allowed frequency options in minutes (0.25 = 15 seconds — temporary for testing)
export const FREQUENCY_OPTIONS = [
  { label: '15 sec', value: 0.25 },
  { label: '5 min',  value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '6 hours', value: 360 },
];

const NUDGE_PHRASES = [
  "What have you been up to? Log it before it slips away.",
  "Quick check-in: how's your time being spent?",
  "Your future self will thank you — log this block now.",
  "Don't let the hours vanish untracked. Tap to log.",
  "Time flies! Capture what you've done so far today.",
  "A moment to log is worth an hour of guessing later.",
  "Still at it? Great — mark your progress in Renmito.",
  "Nudge: you've got unlogged time. Take 10 seconds to record it.",
  "Every block counts. Log your last activity now.",
  "Stay on top of your day — a quick log keeps the picture clear.",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Generate a block of unique notification IDs starting from an offset stored
// in localStorage so IDs don't collide across reschedule calls.
const STORAGE_ID_OFFSET = 'renmito-notif-id-offset';
function nextIdBlock(count: number): number[] {
  const base = parseInt(localStorage.getItem(STORAGE_ID_OFFSET) ?? '1000', 10);
  // Use range 1000–999999 then wrap
  const newBase = base + count > 999999 ? 1000 : base + count;
  localStorage.setItem(STORAGE_ID_OFFSET, String(newBase));
  return Array.from({ length: count }, (_, i) => base + i);
}

// ── Core scheduling ────────────────────────────────────────────────────────────

async function scheduleNudgeBatch(intervalMinutes: number, startFrom: Date): Promise<void> {
  const ids = nextIdBlock(BATCH_SIZE);
  const phraseStart = parseInt(localStorage.getItem(STORAGE_PHRASE_IDX) ?? '0', 10);

  const notifications = ids.map((id, i) => {
    const phraseIdx = (phraseStart + i) % NUDGE_PHRASES.length;
    const at = new Date(startFrom.getTime() + (i + 1) * intervalMinutes * 60 * 1000);
    return {
      id,
      title: 'Time to log!',
      body: NUDGE_PHRASES[phraseIdx],
      schedule: { at, allowWhileIdle: true },
      channelId: 'renmito-nudge',
      smallIcon: 'ic_stat_icon_config_sample',
    };
  });

  // Advance phrase index by batch size
  const newIdx = (phraseStart + BATCH_SIZE) % NUDGE_PHRASES.length;
  localStorage.setItem(STORAGE_PHRASE_IDX, String(newIdx));

  await LocalNotifications.schedule({ notifications });
}

async function cancelAllNudges(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }
}

// ── Public hook ────────────────────────────────────────────────────────────────

export interface NotificationState {
  supported: boolean;
  permissionGranted: boolean | null; // null = not yet determined
  enabled: boolean;
  intervalMinutes: number;
  requesting: boolean;
  error: string | null;
}

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    supported: isNative(),
    permissionGranted: null,
    enabled: localStorage.getItem(STORAGE_ENABLED) === 'true',
    intervalMinutes: parseInt(localStorage.getItem(STORAGE_INTERVAL) ?? '30', 10),
    requesting: false,
    error: null,
  });

  // On mount: check actual permission status and top up notifications if needed
  useEffect(() => {
    if (!isNative()) return;

    (async () => {
      const status = await LocalNotifications.checkPermissions();
      const granted = status.display === 'granted';
      setState(s => ({ ...s, permissionGranted: granted }));

      // Ensure notification channel exists (Android 8+)
      try {
        await LocalNotifications.createChannel({
          id: 'renmito-nudge',
          name: 'Time logging nudges',
          description: 'Periodic reminders to log your time',
          importance: 3, // DEFAULT
          visibility: 1, // PUBLIC
          vibration: true,
        });
      } catch {
        // channel creation may not be supported on all versions
      }

      // If notifications are enabled and permission is granted, top up the batch
      const isEnabled = localStorage.getItem(STORAGE_ENABLED) === 'true';
      if (granted && isEnabled) {
        await topUpIfNeeded(parseInt(localStorage.getItem(STORAGE_INTERVAL) ?? '30', 10));
      }
    })();
  }, []);

  const topUpIfNeeded = useCallback(async (intervalMinutes: number) => {
    if (!isNative()) return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length < REFILL_THRESHOLD) {
      // Find the furthest scheduled time so we append after it
      const now = new Date();
      let startFrom = now;
      if (pending.notifications.length > 0) {
        const times = pending.notifications
          .map(n => (n.schedule?.at ? new Date(n.schedule.at).getTime() : 0))
          .filter(t => t > now.getTime());
        if (times.length > 0) startFrom = new Date(Math.max(...times));
      }
      await scheduleNudgeBatch(intervalMinutes, startFrom);
    }
  }, []);

  const enable = useCallback(async (intervalMinutes: number) => {
    if (!isNative()) return;
    setState(s => ({ ...s, requesting: true, error: null }));

    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }

      if (perm.display !== 'granted') {
        setState(s => ({
          ...s,
          requesting: false,
          permissionGranted: false,
          error: 'Notification permission was denied. Please enable it in device settings.',
        }));
        return;
      }

      // Cancel existing and schedule fresh batch from now
      await cancelAllNudges();
      await scheduleNudgeBatch(intervalMinutes, new Date());

      localStorage.setItem(STORAGE_ENABLED, 'true');
      localStorage.setItem(STORAGE_INTERVAL, String(intervalMinutes));

      setState(s => ({
        ...s,
        requesting: false,
        permissionGranted: true,
        enabled: true,
        intervalMinutes,
        error: null,
      }));
    } catch (e) {
      setState(s => ({
        ...s,
        requesting: false,
        error: 'Failed to schedule notifications. Please try again.',
      }));
    }
  }, []);

  const disable = useCallback(async () => {
    if (!isNative()) return;
    await cancelAllNudges();
    localStorage.setItem(STORAGE_ENABLED, 'false');
    setState(s => ({ ...s, enabled: false, error: null }));
  }, []);

  const changeInterval = useCallback(async (intervalMinutes: number) => {
    if (!isNative()) return;
    setState(s => ({ ...s, intervalMinutes }));
    localStorage.setItem(STORAGE_INTERVAL, String(intervalMinutes));

    if (state.enabled && state.permissionGranted) {
      await cancelAllNudges();
      await scheduleNudgeBatch(intervalMinutes, new Date());
    }
  }, [state.enabled, state.permissionGranted]);

  const previewNotification = useCallback(async () => {
    if (!isNative()) return;

    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') {
      setState(s => ({ ...s, permissionGranted: false, error: 'Notification permission was denied.' }));
      return;
    }

    const phraseIdx = parseInt(localStorage.getItem(STORAGE_PHRASE_IDX) ?? '0', 10);
    const [id] = nextIdBlock(1);
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: 'Time to log!',
        body: NUDGE_PHRASES[phraseIdx],
        schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
        channelId: 'renmito-nudge',
        smallIcon: 'ic_stat_icon_config_sample',
      }],
    });
  }, []);

  return { state, enable, disable, changeInterval, topUpIfNeeded, previewNotification };
}

// Call this from App.tsx or AppLayout on app resume/foreground to keep the
// notification queue healthy even after a long idle period.
export async function topUpNotificationsOnResume(): Promise<void> {
  if (!isNative()) return;
  const enabled = localStorage.getItem(STORAGE_ENABLED) === 'true';
  if (!enabled) return;
  const intervalMinutes = parseInt(localStorage.getItem(STORAGE_INTERVAL) ?? '30', 10);

  const status = await LocalNotifications.checkPermissions();
  if (status.display !== 'granted') return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length < 20) {
    const now = new Date();
    let startFrom = now;
    const times = pending.notifications
      .map(n => (n.schedule?.at ? new Date(n.schedule.at).getTime() : 0))
      .filter(t => t > now.getTime());
    if (times.length > 0) startFrom = new Date(Math.max(...times));
    await scheduleNudgeBatch(intervalMinutes, startFrom);
  }
}
