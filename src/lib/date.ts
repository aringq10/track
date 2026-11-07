const DAY = 24 * 60 * 60 * 1000;
export const WEEK = 7 * DAY;

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

export function formatDuration(total: number): string {
  total = Math.trunc(total);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hourString = h.toString().padStart(2, "0");
  const minuteString = m.toString().padStart(2, "0");
  const secondString = s.toString().padStart(2, "0");
  return `${hourString}h${minuteString}m${secondString}s`;
}

/**
 * Returns a Date if `s` is a valid date of YYYY-MM-DD format, otherwise null
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
