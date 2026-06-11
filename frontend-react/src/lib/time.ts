// ── Display helpers (read path) ───────────────────────────────────────────────
// All functions take a UTC ISO string and return a value in the browser's local
// timezone. Use these everywhere times need to be shown to the user.

/** Local HH:MM (24h) from a UTC ISO string — for <input type="time"> */
export function isoToLocal24h(iso: string): string {
  if (!iso) return '';
  if (/^\d{2}:\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Local h:MM AM/PM from a UTC ISO string — for display */
export function isoToLocal12h(iso: string): string {
  const hhmm = isoToLocal24h(iso);
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Local YYYY-MM-DD from a UTC ISO string */
export function isoToLocalDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// ── Write helpers (write path) ────────────────────────────────────────────────
// Converts user-entered local date/time back to a true UTC ISO string.

/**
 * Combines a local YYYY-MM-DD + local HH:MM into a UTC ISO string.
 * Omitting the 'Z' causes JS to interpret the string as local time.
 */
export function localToISOString(localDate: string, localHHMM: string): string {
  return new Date(`${localDate}T${localHHMM}:00`).toISOString();
}
