/**
 * Slot generation for booking pages and the server re-check of a chosen slot.
 *
 * A slot is a start time the host can offer, with the resources that could
 * take it. Slots are either exact times or arrival windows: with
 * `arrivalWindowMin`, the customer is promised an arrival inside
 * [start, start + window) and the resource is held for the window plus the
 * duration (the latest arrival still has to finish). The core holds no
 * policy beyond that arithmetic; which services use windows is the host's
 * choice.
 *
 * Every rule is checked on real instants: durations are elapsed minutes, so
 * a slot that crosses a DST change keeps its length, and a wall-clock start
 * skipped by a DST jump rolls forward (and is offered once).
 */
import type { CalendarEvent, CalendarResource, HoursFn } from './types.js';
import type { StaffModel } from './assistant.js';
import { byOrder, conflictsFor, fits, overlaps } from './occupancy.js';
import { addDays, daysBetween, todayIn, zonedToIso } from './time.js';

/** A closed span: for one resource, or for all of them when `resourceId` is absent. */
export interface Blackout {
  start: string;
  end: string;
  resourceId?: string;
}

export interface SlotRules {
  /** Minutes the resource is busy for one booking (the service length) */
  durationMin: number;
  /** Arrival window length; omit for exact start times */
  arrivalWindowMin?: number;
  /** Candidate grid in minutes from local midnight (default: the window, else 15) */
  stepMin?: number;
  /** Free minutes kept on both sides of every booking */
  bufferMin?: number;
  /** Earliest start, in minutes after `now` */
  leadMin?: number;
  /** Last local day that may be booked, in days after today (inclusive) */
  horizonDays?: number;
  /** Only resources with this compatKey */
  compatKey?: string;
  /** Size checked against each resource's capacity */
  size?: number;
}

export interface SlotContext {
  events: CalendarEvent[];
  resources: CalendarResource[];
  timeZone: string;
  /** Open hours per local day; the whole held span must be inside them */
  hours: HoursFn;
  blackouts?: Blackout[];
  staff?: StaffModel;
  /** Event ids to ignore (e.g. the booking being rescheduled) */
  excludeIds?: string[];
  now?: Date;
}

export interface Slot {
  /** First instant held (the window start, or the exact start) */
  start: string;
  /** End of the held span: start + window + duration */
  end: string;
  /** The promised arrival window, when `arrivalWindowMin` is set */
  arrival?: { from: string; to: string };
  /**
   * Free resources that fit, in resource order. With a staff model, cut to
   * the bookings the staff on shift can still take, so its length is the
   * number of bookings the slot can still accept.
   */
  resourceIds: string[];
}

export interface SlotQuery extends SlotContext, SlotRules {
  /** First local day searched ('YYYY-MM-DD') */
  from: string;
  /** Last local day searched, inclusive (default: `from`; never past the horizon) */
  to?: string;
  /** Stop after this many slots (default: no limit) */
  limit?: number;
}

export type SlotRejection = 'LEAD_TIME' | 'HORIZON' | 'CLOSED' | 'BLACKOUT' | 'NO_RESOURCE' | 'CONFLICT' | 'STAFF';

export type SlotCheck = { ok: true; resourceId: string } | { ok: false; reason: SlotRejection };

const MIN = 60_000;

function heldEnd(start: number, rules: SlotRules): number {
  return start + ((rules.arrivalWindowMin ?? 0) + rules.durationMin) * MIN;
}

function blackedOut(blackouts: Blackout[] | undefined, resourceId: string | undefined, s: number, e: number): boolean {
  return (blackouts ?? []).some(
    (b) => (b.resourceId === undefined || b.resourceId === resourceId) && overlaps(s, e, Date.parse(b.start), Date.parse(b.end))
  );
}

/** How many more bookings the staff on shift can take for [start, end) (Infinity without a staff model). */
function staffRoom(ctx: SlotContext, start: string, end: string): number {
  if (!ctx.staff) return Infinity;
  const per = ctx.staff.perBooking ?? 1;
  const s = Date.parse(start);
  const e = Date.parse(end);
  const skip = new Set(ctx.excludeIds ?? []);
  const busy = ctx.events.filter((ev) => !skip.has(ev.id) && overlaps(s, e, Date.parse(ev.start), Date.parse(ev.end))).length;
  return Math.max(0, Math.floor(ctx.staff.available(start, end) / per) - busy);
}

/** Is [s, e) inside the open hours of the local day it starts on? */
function withinHours(ctx: SlotContext, date: string, s: number, e: number): boolean {
  const h = ctx.hours(date);
  if (!h) return false;
  return s >= Date.parse(zonedToIso(date, h.open, ctx.timeZone)) && e <= Date.parse(zonedToIso(date, h.close, ctx.timeZone));
}

/** Resources that fit the rules and are free (no conflict, no blackout) for [start, end). */
function freeResources(ctx: SlotContext, rules: SlotRules, start: string, end: string): string[] {
  const s = Date.parse(start);
  const e = Date.parse(end);
  return ctx.resources
    .filter((r) => fits(r, rules.compatKey, rules.size))
    .sort(byOrder)
    .filter((r) => !blackedOut(ctx.blackouts, r.id, s, e))
    .filter((r) => conflictsFor(ctx.events, r.id, start, end, rules.bufferMin ?? 0, ctx.excludeIds ?? []).length === 0)
    .map((r) => r.id);
}

function lastBookableDay(ctx: SlotContext, rules: SlotRules): string | undefined {
  if (rules.horizonDays === undefined) return undefined;
  return addDays(todayIn(ctx.timeZone, ctx.now ?? new Date()), rules.horizonDays);
}

function toSlot(start: number, rules: SlotRules, resourceIds: string[]): Slot {
  const slot: Slot = { start: new Date(start).toISOString(), end: new Date(heldEnd(start, rules)).toISOString(), resourceIds };
  if (rules.arrivalWindowMin !== undefined) {
    slot.arrival = { from: slot.start, to: new Date(start + rules.arrivalWindowMin * MIN).toISOString() };
  }
  return slot;
}

/** Bookable slots from `from` to `to`, earliest first; each lists the resources free for it. */
export function generateSlots(query: SlotQuery): Slot[] {
  const step = query.stepMin ?? query.arrivalWindowMin ?? 15;
  const earliest = (query.now ?? new Date()).getTime() + (query.leadMin ?? 0) * MIN;
  const lastDay = lastBookableDay(query, query);
  let to = query.to ?? query.from;
  if (lastDay !== undefined && to > lastDay) to = lastDay;
  const out: Slot[] = [];
  const seen = new Set<number>();
  for (let d = 0; d <= daysBetween(query.from, to); d++) {
    const date = addDays(query.from, d);
    const h = query.hours(date);
    if (!h) continue;
    // Step on real instants from the first grid time: across a DST change every
    // real start is offered once (no skipped hour twice, no repeated hour lost)
    const open = Date.parse(zonedToIso(date, Math.ceil(h.open / step) * step, query.timeZone));
    const close = Date.parse(zonedToIso(date, h.close, query.timeZone));
    for (let s = open; s < close; s += step * MIN) {
      if (seen.has(s)) continue;
      seen.add(s);
      const e = heldEnd(s, query);
      if (s < earliest || e > close || blackedOut(query.blackouts, undefined, s, e)) continue;
      const start = new Date(s).toISOString();
      const end = new Date(e).toISOString();
      const room = staffRoom(query, start, end);
      if (room === 0) continue;
      const free = freeResources(query, query, start, end).slice(0, room);
      if (free.length === 0) continue;
      out.push(toSlot(s, query, free));
      if (query.limit !== undefined && out.length >= query.limit) return out;
    }
  }
  return out;
}

/**
 * Re-check one chosen start (the server side of a booking): the same rules
 * as `generateSlots`, with the first reason it fails. With `resourceId`, only
 * that resource is considered; otherwise the first free one in order is picked.
 * The start does not need to be on the step grid.
 */
export function checkSlot(ctx: SlotContext, rules: SlotRules, start: string, resourceId?: string): SlotCheck {
  const s = Date.parse(start);
  const e = heldEnd(s, rules);
  const now = (ctx.now ?? new Date()).getTime();
  if (s < now + (rules.leadMin ?? 0) * MIN) return { ok: false, reason: 'LEAD_TIME' };
  const date = todayIn(ctx.timeZone, new Date(s));
  const lastDay = lastBookableDay(ctx, rules);
  if (lastDay !== undefined && date > lastDay) return { ok: false, reason: 'HORIZON' };
  if (!withinHours(ctx, date, s, e)) return { ok: false, reason: 'CLOSED' };
  if (blackedOut(ctx.blackouts, undefined, s, e)) return { ok: false, reason: 'BLACKOUT' };
  const iso = new Date(s).toISOString();
  const endIso = new Date(e).toISOString();
  const candidates = ctx.resources
    .filter((r) => (resourceId === undefined || r.id === resourceId) && fits(r, rules.compatKey, rules.size))
    .sort(byOrder);
  if (candidates.length === 0) return { ok: false, reason: 'NO_RESOURCE' };
  const open = candidates.filter((r) => !blackedOut(ctx.blackouts, r.id, s, e));
  if (open.length === 0) return { ok: false, reason: 'BLACKOUT' };
  const free = open.find((r) => conflictsFor(ctx.events, r.id, iso, endIso, rules.bufferMin ?? 0, ctx.excludeIds ?? []).length === 0);
  if (!free) return { ok: false, reason: 'CONFLICT' };
  if (staffRoom(ctx, iso, endIso) === 0) return { ok: false, reason: 'STAFF' };
  return { ok: true, resourceId: free.id };
}
