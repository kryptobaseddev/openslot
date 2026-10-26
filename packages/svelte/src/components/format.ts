/** Labels in the calendar's zone. Days are 'YYYY-MM-DD'; they are formatted as UTC noon so no zone shifts them. */
import { type ViewKind, formatTime, zonedParts } from '@openslot/core';

const noon = (date: string) => new Date(`${date}T12:00:00Z`);

export function dayLabel(
  date: string,
  locale?: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(noon(date));
}

export function titleFor(view: ViewKind, days: string[], locale?: string): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (view === 'month') {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(noon(days[10] ?? first));
  }
  if (days.length === 1) return dayLabel(first, locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  // "Jun 9 – 15, 2030" / "Jun 30 – Jul 6, 2030"
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatRange(
    noon(first),
    noon(last)
  );
}

export function timeOf(iso: string, tz: string, locale?: string): string {
  return formatTime(zonedParts(iso, tz).minutes, locale);
}

export function timeRange(start: string, end: string, tz: string, locale?: string): string {
  return `${timeOf(start, tz, locale)} – ${timeOf(end, tz, locale)}`;
}

/** "Fri, Oct 24, 7:30 PM – 8:30 PM" */
export function whenLabel(start: string, end: string, tz: string, locale?: string): string {
  return `${dayLabel(zonedParts(start, tz).date, locale)}, ${timeRange(start, end, tz, locale)}`;
}

export const VIEW_LABELS: Record<ViewKind, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  list: 'Agenda',
  'resource-day': 'Resources · day',
  'resource-week': 'Resources · week',
  'timeline-day': 'Timeline · day',
  'timeline-week': 'Timeline · week'
};
