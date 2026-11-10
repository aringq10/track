export const DAY = 24 * 60 * 60 * 1000;
export const WEEK = 7 * DAY;

/**
 * Return `d` in YYYY-MM-DD format.
 */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * If `d` is undefined, return a "no time" string.
 */
export function formatTime(d?: Date): string {
  if (d === undefined) return "--:--:--";
  return d.toISOString().slice(11, 19);
}

/**
 * If `seconds` is undefined, return a "no duration" string.
 */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined) return "--:--:--";
  seconds = Math.trunc(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const hourString = h.toString().padStart(2, "0");
  const minuteString = m.toString().padStart(2, "0");
  const secondString = s.toString().padStart(2, "0");
  return `${hourString}:${minuteString}:${secondString}`;
}

/**
 * Returns a Date if `s` is a valid date of YYYY-MM-DD format, otherwise null.
 */
export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s);
  const valid = !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  return valid ? d : null;
}

/**
 * Returns the number days between `from` and `to`, inclusive.
 */
export function dayRange(from: Date, to: Date): number {
  const f = Math.trunc(from.getTime() / DAY) * DAY;
  const t = Math.trunc(to.getTime() / DAY) * DAY;
  return (t - f) / DAY + 1;
}
