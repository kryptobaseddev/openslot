/**
 * Time-zone math for one calendar zone, on the platform Intl API (no
 * dependency; date-fns-tz 3.2.0 getTimezoneOffset returned the wrong offset
 * in the hour before a DST jump). Days are 'YYYY-MM-DD' strings; minutes are
 * minutes from local midnight.
 */
import type { ViewKind } from './types.js';

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

function dayToUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall clock of an instant in `tz`, as UTC milliseconds of the same fields. */
function wallMs(ms: number, tz: string): number {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Offset of `tz` from UTC at an instant, in ms (east positive). */
const offset = (tz: string, ms: number) => wallMs(Math.floor(ms / 1000) * 1000, tz) - Math.floor(ms / 1000) * 1000;

/** Local day and minutes-from-midnight of an instant in `tz`. */
export function zonedParts(iso: string | Date, tz: string): { date: string; minutes: number } {
  const w = new Date(wallMs(typeof iso === 'string' ? Date.parse(iso) : iso.getTime(), tz));
  return { date: utcMsToDay(w.getTime()), minutes: w.getUTCHours() * 60 + w.getUTCMinutes() };
}

/**
 * The instant of local wall-clock `minutes` on `date` in `tz`. A time skipped
 * by a DST jump rolls forward (02:30 becomes 03:30); a repeated time picks
 * the first occurrence.
 */
export function zonedToIso(date: string, minutes: number, tz: string): string {
  const wall = dayToUtcMs(date) + minutes * 60_000;
  const before = offset(tz, wall - DAY_MS / 2);
  const after = offset(tz, wall + DAY_MS / 2);
  const valid = [...new Set([before, after])].map((o) => wall - o).filter((t) => wall - offset(tz, t) === t);
  const t = valid.length > 0 ? Math.min(...valid) : wall - before;
  return new Date(t).toISOString();
}

export function todayIn(tz: string, now: Date = new Date()): string {
  return zonedParts(now, tz).date;
}

export function addDays(date: string, n: number): string {
  return utcMsToDay(dayToUtcMs(date) + n * DAY_MS);
}

/** 0 = Sunday */
export function dayOfWeek(date: string): number {
  return new Date(dayToUtcMs(date)).getUTCDay();
}

export function startOfWeek(date: string, firstDay = 0): string {
  return addDays(date, -((dayOfWeek(date) - firstDay + 7) % 7));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtcMs(to) - dayToUtcMs(from)) / DAY_MS);
}

export function dayList(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

/** The 6-week grid (42 days) of the month containing `date`. */
export function monthGridDays(date: string, firstDay = 0): string[] {
  return dayList(startOfWeek(`${date.slice(0, 8)}01`, firstDay), 42);
}

/** Days a view shows for `date`. */
export function viewRange(view: ViewKind, date: string, firstDay = 0): { from: string; to: string; days: string[] } {
  let days: string[];
  switch (view) {
    case 'week':
    case 'resource-week':
    case 'timeline-week':
      days = dayList(startOfWeek(date, firstDay), 7);
      break;
    case 'month':
      days = monthGridDays(date, firstDay);
      break;
    case 'list':
      days = dayList(date, 7);
      break;
    default:
      days = [date];
  }
  return { from: days[0], to: days[days.length - 1], days };
}

/** Wall-clock minutes as a short local time, e.g. '7:30 PM'. */
export function formatTime(minutes: number, locale?: string): string {
  const d = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60));
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);
}

export function minutesBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 60_000);
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}
