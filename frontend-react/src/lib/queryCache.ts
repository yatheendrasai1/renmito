const PREFIX = 'renmito-cache-';

export function readCache<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // Ignore quota errors — cache is best-effort
  }
}

/**
 * Remove cache entries whose key ends with a YYYY-MM-DD date older than keepDays.
 * e.g. pruneOldDateCaches('logs-', 4) removes renmito-cache-logs-2024-01-01 etc.
 */
export function pruneOldDateCaches(keyPrefix: string, keepDays: number): void {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD
    const fullPrefix = PREFIX + keyPrefix;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(fullPrefix)) continue;
      const dateStr = k.slice(fullPrefix.length); // extract YYYY-MM-DD part
      if (dateStr < cutoffStr) localStorage.removeItem(k);
    }
  } catch {
    // Best-effort
  }
}
