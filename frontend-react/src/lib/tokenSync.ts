import { Capacitor, registerPlugin } from '@capacitor/core';
import type { LogType } from '@/types';

// ── TokenSync — custom Capacitor plugin (native impl in TokenSyncPlugin.java).
//    Mirrors the JWT and the point-log widget tiles into native SharedPreferences
//    so the Android home-screen widget can log without opening the app.
//    All calls are no-ops on web (guarded by isNativePlatform).
interface TokenSyncPlugin {
  saveToken(options: { token: string }): Promise<void>;
  clearToken(): Promise<void>;
  saveTiles(options: { tiles: string }): Promise<void>;
}

const TokenSync = registerPlugin<TokenSyncPlugin>('TokenSync');

/** Fixed set of point-log titles shown as widget tiles, in display order.
 *  Titles must match seeded DefaultLogType names (backend/src/data/defaultLogTypes.json). */
export const WIDGET_TILE_TITLES = ['Woke Up', 'Breakfast', 'Lunch', 'Dinner'] as const;

export interface WidgetTile {
  title: string;
  logTypeId: string;
}

/** Mirror the current JWT to native storage for the widget. */
export function syncNativeToken(token: string): void {
  if (!Capacitor.isNativePlatform()) return;
  TokenSync.saveToken({ token }).catch(() => {});
}

/** Clear the mirrored JWT on logout. */
export function clearNativeToken(): void {
  if (!Capacitor.isNativePlatform()) return;
  TokenSync.clearToken().catch(() => {});
}

/** Resolve the fixed tile titles to { title, logTypeId } and mirror to native.
 *  logTypeId is the DefaultLogType _id, resolved at runtime (IDs aren't stable). */
export function syncWidgetTiles(logTypes: LogType[] | undefined): void {
  if (!Capacitor.isNativePlatform() || !logTypes?.length) return;

  const tiles: WidgetTile[] = WIDGET_TILE_TITLES
    .map((title): WidgetTile | null => {
      const lt = logTypes.find(t => t.name === title);
      return lt ? { title, logTypeId: lt._id } : null;
    })
    .filter((t): t is WidgetTile => t !== null);

  if (tiles.length === 0) return;
  TokenSync.saveTiles({ tiles: JSON.stringify(tiles) }).catch(() => {});
}
