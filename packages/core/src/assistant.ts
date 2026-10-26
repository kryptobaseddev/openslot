/**
 * Scheduling assistant: the next open slots across compatible resources for
 * a duration and size, inside opening hours, after the lead time, with
 * the buffer kept free and (when modelled) enough staff on shift.
 */
import type { CalendarEvent, CalendarResource, HoursFn } from './types.js';
import { byOrder, fits, isFree } from './occupancy.js';
import { addDays, daysBetween, zonedToIso } from './time.js';

export interface StaffModel {
  /** Staff on shift for the whole of [start, end) */
  available: (startIso: string, endIso: string) => number;
  /** Staff one event needs (default 1) */
  perBooking?: number;
}

export interface FindSlotsInput {
  events: CalendarEvent[];
  resources: CalendarResource[];
  durationMin: number;
  size?: number;
  compatKey?: string;
  /** first and last local day searched, inclusive */
  from: string;
  to: string;
  timeZone: string;
  hours: HoursFn;
  stepMin?: number;
  bufferMin?: number;
  now?: Date;
  leadMin?: number;
  limit?: number;
  staff?: StaffModel;
  /** Event ids to ignore (e.g. the booking being rescheduled) */
  excludeIds?: string[];
}

export interface OpenSlot {
  resourceId: string;
  start: string;
  end: string;
  /** lower is better: minutes from the search start */
  score: number;
}

function* candidates(input: FindSlotsInput): Generator<{ start: string; end: string; minutesFromFrom: number }> {
  const step = input.stepMin ?? 15;
  const earliest = (input.now ?? new Date()).getTime() + (input.leadMin ?? 0) * 60_000;
  const span = daysBetween(input.from, input.to);
  for (let d = 0; d <= span; d++) {
    const date = addDays(input.from, d);
    const h = input.hours(date);
    if (!h) continue;
    for (let m = Math.ceil(h.open / step) * step; m + input.durationMin <= h.close; m += step) {
      const start = zonedToIso(date, m, input.timeZone);
      if (Date.parse(start) < earliest) continue;
      const end = zonedToIso(date, m + input.durationMin, input.timeZone);
      yield { start, end, minutesFromFrom: d * 1440 + m };
    }
  }
}

function staffOk(input: FindSlotsInput, start: string, end: string, taken: OpenSlot[]): boolean {
  if (!input.staff) return true;
  const per = input.staff.perBooking ?? 1;
  const s = Date.parse(start);
  const e = Date.parse(end);
  const skip = new Set(input.excludeIds ?? []);
  const busy = input.events.filter((ev) => !skip.has(ev.id) && Date.parse(ev.start) < e && s < Date.parse(ev.end)).length;
  const planned = taken.filter((t) => Date.parse(t.start) < e && s < Date.parse(t.end)).length;
  return input.staff.available(start, end) >= (busy + planned + 1) * per;
}

/** Open slots, earliest first, ties broken by resource order. */
export function findOpenSlots(input: FindSlotsInput): OpenSlot[] {
  const limit = input.limit ?? 10;
  const resources = input.resources.filter((r) => fits(r, input.compatKey, input.size)).sort(byOrder);
  const out: OpenSlot[] = [];
  if (resources.length === 0) return out;
  for (const c of candidates(input)) {
    for (const r of resources) {
      if (!isFree(input.events, r.id, c.start, c.end, input.bufferMin ?? 0, input.excludeIds)) continue;
      if (!staffOk(input, c.start, c.end, [])) continue;
      out.push({ resourceId: r.id, start: c.start, end: c.end, score: c.minutesFromFrom });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** The first open slot of each compatible resource (resources with none are left out). */
export function nextOpenSlotPerResource(input: FindSlotsInput): OpenSlot[] {
  const out: OpenSlot[] = [];
  for (const r of input.resources.filter((res) => fits(res, input.compatKey, input.size)).sort(byOrder)) {
    const [first] = findOpenSlots({ ...input, resources: [r], limit: 1 });
    if (first) out.push(first);
  }
  return out;
}
