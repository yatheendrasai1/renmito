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

/** Default tile titles when the user hasn't picked their own. Must match
 *  seeded DefaultLogType names (backend/src/data/defaultLogTypes.json). */
export const WIDGET_TILE_TITLES = ['Woke Up', 'Breakfast', 'Lunch', 'Dinner'] as const;

/** The widget layout has a fixed 2x2 grid, so at most 4 tiles. */
export const MAX_WIDGET_TILES = 4;

/** Device-local key: the user's chosen tile logType ids, in display order. */
const TILE_SELECTION_KEY = 'renmito-widget-tile-ids';

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

/** Read the user's selected tile logType ids (device-local, capped at MAX). */
export function loadWidgetTileSelection(): string[] {
  try {
    const raw = localStorage.getItem(TILE_SELECTION_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string').slice(0, MAX_WIDGET_TILES)
      : [];
  } catch {
    return [];
  }
}

/** Persist the selection and immediately mirror the resulting tiles to native. */
export function saveWidgetTileSelection(ids: string[], logTypes: LogType[] | undefined): void {
  const trimmed = ids.slice(0, MAX_WIDGET_TILES);
  localStorage.setItem(TILE_SELECTION_KEY, JSON.stringify(trimmed));
  syncWidgetTiles(logTypes);
}

/** Build tiles from the saved selection (or the default set when none chosen)
 *  and mirror to native. logTypeId is resolved at runtime (IDs aren't stable). */
export function syncWidgetTiles(logTypes: LogType[] | undefined): void {
  if (!Capacitor.isNativePlatform() || !logTypes?.length) return;

  const selection = loadWidgetTileSelection();
  const tiles: WidgetTile[] = selection.length > 0
    ? selection
        .map((id): WidgetTile | null => {
          const lt = logTypes.find(t => t._id === id);
          return lt ? { title: lt.name, logTypeId: lt._id } : null;
        })
        .filter((t): t is WidgetTile => t !== null)
    : WIDGET_TILE_TITLES
        .map((title): WidgetTile | null => {
          const lt = logTypes.find(t => t.name === title);
          return lt ? { title, logTypeId: lt._id } : null;
        })
        .filter((t): t is WidgetTile => t !== null);

  if (tiles.length === 0) return;
  TokenSync.saveTiles({ tiles: JSON.stringify(tiles) }).catch(() => {});
}
