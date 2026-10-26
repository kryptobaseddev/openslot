/** Resource occupancy: half-open intervals [start, end) with an optional buffer. */
import type { CalendarEvent, CalendarResource } from './types.js';

const ms = (iso: string) => Date.parse(iso);

/** Do [aStart, aEnd) and [bStart, bEnd) come closer than `bufferMs`? */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number, bufferMs = 0): boolean {
  return aStart < bEnd + bufferMs && bStart < aEnd + bufferMs;
}

/** Events that occupy a resource (cancelled-style events should be filtered out by the caller). */
export function busyFor(events: CalendarEvent[], resourceId: string, excludeIds: Iterable<string> = []): CalendarEvent[] {
  const skip = new Set(excludeIds);
  return events.filter((e) => e.resourceId === resourceId && !skip.has(e.id));
}

export function conflictsFor(
  events: CalendarEvent[],
  resourceId: string,
  start: string,
  end: string,
  bufferMin = 0,
  excludeIds: Iterable<string> = []
): CalendarEvent[] {
  const s = ms(start);
  const e = ms(end);
  return busyFor(events, resourceId, excludeIds).filter((o) => overlaps(s, e, ms(o.start), ms(o.end), bufferMin * 60_000));
}

export function isFree(
  events: CalendarEvent[],
  resourceId: string,
  start: string,
  end: string,
  bufferMin = 0,
  excludeIds: Iterable<string> = []
): boolean {
  return conflictsFor(events, resourceId, start, end, bufferMin, excludeIds).length === 0;
}

/** Can `resource` host an event of this compatKey and size? */
export function fits(resource: CalendarResource, compatKey?: string, size?: number): boolean {
  if (compatKey !== undefined && resource.compatKey !== compatKey) return false;
  if (size !== undefined && resource.capacity) {
    if (size < resource.capacity.min || size > resource.capacity.max) return false;
  }
  return true;
}

export function byOrder(a: CalendarResource, b: CalendarResource): number {
  return (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title);
}
