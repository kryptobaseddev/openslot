/**
 * Schedule shuffling:
 * - re-seat proposals: free a compatible resource for a new or conflicting
 *   event by moving existing events, at the same times, to other resources
 *   with the same compatKey (a bounded search, fewest moves first);
 * - swap: two events exchange resources, start times, or both.
 * Pinned and non-editable events are never moved. Proposals are previews;
 * the caller applies them through the server, which re-checks everything.
 */
import type { CalendarEvent, CalendarResource, EventChange } from './types.js';
import { byOrder, conflictsFor, fits } from './occupancy.js';

export interface ReseatMove {
  eventId: string;
  fromResourceId: string;
  toResourceId: string;
}

export interface ReseatProposal {
  /** Where the needed event goes */
  resourceId: string;
  moves: ReseatMove[];
  /** lower is better */
  score: number;
}

export interface ReseatNeed {
  start: string;
  end: string;
  compatKey?: string;
  size?: number;
  preferredResourceId?: string;
  /** The event being placed, when it already exists (conflict resolution) */
  excludeEventId?: string;
}

export interface ReseatInput {
  need: ReseatNeed;
  events: CalendarEvent[];
  resources: CalendarResource[];
  bufferMin?: number;
  maxMoves?: number;
}

const movable = (e: CalendarEvent) => !e.pinned && e.editable !== false;

/** Events with their planned resources applied. */
function withMoves(events: CalendarEvent[], moves: ReseatMove[]): CalendarEvent[] {
  if (moves.length === 0) return events;
  const to = new Map(moves.map((m) => [m.eventId, m.toResourceId]));
  return events.map((e) => (to.has(e.id) ? { ...e, resourceId: to.get(e.id) } : e));
}

/** After `plan`, is the freed resource free and every moved event clear at its target? */
function planHolds(
  after: CalendarEvent[],
  plan: ReseatMove[],
  resourceId: string,
  start: string,
  end: string,
  bufferMin: number,
  exclude: Set<string>
): boolean {
  if (conflictsFor(after, resourceId, start, end, bufferMin, exclude).length > 0) return false;
  return plan.every((m) => {
    const e = after.find((x) => x.id === m.eventId)!;
    return conflictsFor(after, m.toResourceId, e.start, e.end, bufferMin, [e.id, ...exclude]).length === 0;
  });
}

/** A slot being freed higher up the search: nothing may move into it. */
interface Reserved {
  resourceId: string;
  start: string;
  end: string;
}

function reservedHit(reserved: Reserved[], resourceId: string, start: string, end: string, bufferMin: number): boolean {
  const s = Date.parse(start);
  const e = Date.parse(end);
  const buf = bufferMin * 60_000;
  return reserved.some((r) => r.resourceId === resourceId && s < Date.parse(r.end) + buf && Date.parse(r.start) < e + buf);
}

/**
 * Try to make `resource` free for [start, end) by moving its blockers, each to
 * a resource that fits it; recursion lets a moved event displace another
 * (chains), bounded by `budget` moves in total.
 */
function freeUp(
  resource: CalendarResource,
  start: string,
  end: string,
  events: CalendarEvent[],
  resources: CalendarResource[],
  bufferMin: number,
  exclude: Set<string>,
  budget: number,
  locked: Set<string>,
  reserved: Reserved[] = []
): ReseatMove[] | null {
  const blockers = conflictsFor(events, resource.id, start, end, bufferMin, exclude);
  if (blockers.length === 0) return [];
  if (blockers.length > budget || blockers.some((b) => !movable(b) || locked.has(b.id))) return null;

  let best: ReseatMove[] | null = null;
  const tryBlocker = (index: number, current: CalendarEvent[], plan: ReseatMove[], left: number, lockedNow: Set<string>) => {
    if (index === blockers.length) {
      if ((!best || plan.length < best.length) && planHolds(current, plan, resource.id, start, end, bufferMin, exclude)) best = plan;
      return;
    }
    const b = blockers[index];
    const targets = resources
      .filter((r) => r.id !== resource.id && r.id !== b.resourceId && fits(r, b.compatKey, b.size))
      .filter((r) => !reservedHit(reserved, r.id, b.start, b.end, bufferMin))
      .sort(byOrder);
    for (const t of targets) {
      if (left < 1) return;
      const lockedNext = new Set([...lockedNow, b.id]);
      const sub = freeUp(t, b.start, b.end, current, resources, bufferMin, new Set([...exclude, b.id]), left - 1, lockedNext, [
        ...reserved,
        { resourceId: resource.id, start, end }
      ]);
      if (!sub) continue;
      const move: ReseatMove = { eventId: b.id, fromResourceId: b.resourceId!, toResourceId: t.id };
      const nextPlan = [...plan, ...sub, move];
      if (best && nextPlan.length >= best.length) continue;
      tryBlocker(index + 1, withMoves(current, [...sub, move]), nextPlan, left - 1 - sub.length, lockedNext);
    }
  };
  tryBlocker(0, events, [], budget, new Set([...locked, ...blockers.map((b) => b.id)]));
  return best;
}

/** Cheapest way to seat `need`: zero moves when a compatible resource is free. */
export function proposeReseat(input: ReseatInput): ReseatProposal | null {
  const { need, events, resources } = input;
  const bufferMin = input.bufferMin ?? 0;
  const maxMoves = input.maxMoves ?? 3;
  const exclude = new Set(need.excludeEventId ? [need.excludeEventId] : []);
  const hosts = resources.filter((r) => fits(r, need.compatKey, need.size)).sort(byOrder);

  let best: ReseatProposal | null = null;
  for (const r of hosts) {
    const moves = freeUp(r, need.start, need.end, events, resources, bufferMin, exclude, maxMoves, new Set(exclude));
    if (!moves) continue;
    const score = moves.length * 10 + (r.id === need.preferredResourceId ? 0 : 1);
    if (!best || score < best.score) best = { resourceId: r.id, moves, score };
  }
  return best;
}

/**
 * Resolve an event that overlaps another on its resource: re-seat it, or,
 * when it is pinned or cannot move, re-seat the events it collides with.
 */
export function proposeConflictResolution(input: {
  eventId: string;
  events: CalendarEvent[];
  resources: CalendarResource[];
  bufferMin?: number;
  maxMoves?: number;
}): ReseatProposal | null {
  const event = input.events.find((e) => e.id === input.eventId);
  if (!event || !event.resourceId) return null;
  const bufferMin = input.bufferMin ?? 0;
  const others = conflictsFor(input.events, event.resourceId, event.start, event.end, bufferMin, [event.id]);
  if (others.length === 0) return null;

  if (movable(event)) {
    const rest = input.events.filter((e) => e.id !== event.id);
    const away = proposeReseat({
      need: { start: event.start, end: event.end, compatKey: event.compatKey, size: event.size },
      events: rest,
      resources: input.resources.filter((r) => r.id !== event.resourceId),
      bufferMin,
      maxMoves: (input.maxMoves ?? 3) - 1
    });
    if (away) {
      return {
        resourceId: away.resourceId,
        moves: [...away.moves, { eventId: event.id, fromResourceId: event.resourceId, toResourceId: away.resourceId }],
        score: away.score + 10
      };
    }
  }

  // The event stays: move every event it collides with
  const resource = input.resources.find((r) => r.id === event.resourceId);
  if (!resource) return null;
  const moves = freeUp(
    resource,
    event.start,
    event.end,
    input.events,
    input.resources,
    bufferMin,
    new Set([event.id]),
    input.maxMoves ?? 3,
    new Set([event.id])
  );
  return moves ? { resourceId: event.resourceId, moves, score: moves.length * 10 } : null;
}

export type SwapMode = 'resource' | 'time' | 'both';
export type SwapError = 'COMPAT_MISMATCH' | 'PINNED' | 'NOT_EDITABLE' | 'CAPACITY' | 'OVERLAP';

/**
 * Changes that swap `a` and `b`: their resources ('resource'), their start
 * times keeping each duration ('time'), or their whole slots ('both').
 */
export function planSwap(
  a: CalendarEvent,
  b: CalendarEvent,
  mode: SwapMode,
  ctx: { resources: CalendarResource[]; events?: CalendarEvent[]; bufferMin?: number }
): EventChange[] | { error: SwapError } {
  if (a.editable === false || b.editable === false) return { error: 'NOT_EDITABLE' };
  if (a.pinned || b.pinned) return { error: 'PINNED' };

  const dur = (e: CalendarEvent) => Date.parse(e.end) - Date.parse(e.start);
  const at = (start: string, ms: number) => new Date(Date.parse(start) + ms).toISOString();
  const swapResource = mode !== 'time';
  const swapTime = mode !== 'resource';

  const changeA: EventChange = {
    id: a.id,
    start: swapTime ? b.start : a.start,
    end: swapTime ? at(b.start, dur(a)) : a.end,
    resourceId: swapResource ? b.resourceId : a.resourceId
  };
  const changeB: EventChange = {
    id: b.id,
    start: swapTime ? a.start : b.start,
    end: swapTime ? at(a.start, dur(b)) : b.end,
    resourceId: swapResource ? a.resourceId : b.resourceId
  };

  if (swapResource && a.resourceId !== b.resourceId) {
    const ra = ctx.resources.find((r) => r.id === a.resourceId);
    const rb = ctx.resources.find((r) => r.id === b.resourceId);
    if (!ra || !rb) return { error: 'COMPAT_MISMATCH' };
    if (!fits(rb, a.compatKey) || !fits(ra, b.compatKey)) return { error: 'COMPAT_MISMATCH' };
    if (!fits(rb, undefined, a.size) || !fits(ra, undefined, b.size)) return { error: 'CAPACITY' };
  }

  const changes = [changeA, changeB];
  const third = (ctx.events ?? []).filter((e) => e.id !== a.id && e.id !== b.id);
  const bufferMin = ctx.bufferMin ?? 0;
  for (const c of changes) {
    if (c.resourceId && conflictsFor(third, c.resourceId, c.start, c.end, bufferMin).length > 0) return { error: 'OVERLAP' };
  }
  // The two swapped events must not collide with each other either
  if (
    changeA.resourceId === changeB.resourceId &&
    conflictsFor([{ ...a, ...changeA }], changeB.resourceId!, changeB.start, changeB.end, bufferMin).length > 0
  ) {
    return { error: 'OVERLAP' };
  }
  return changes;
}

/** Re-seat moves as changes (times unchanged). */
export function movesToChanges(events: CalendarEvent[], moves: ReseatMove[]): EventChange[] {
  return moves.map((m) => {
    const e = events.find((x) => x.id === m.eventId)!;
    return { id: e.id, start: e.start, end: e.end, resourceId: m.toResourceId };
  });
}

/** Events with `changes` applied (pure). */
export function applyChanges(events: CalendarEvent[], changes: EventChange[]): CalendarEvent[] {
  const byId = new Map(changes.map((c) => [c.id, c]));
  return events.map((e) => {
    const c = byId.get(e.id);
    return c ? { ...e, start: c.start, end: c.end, resourceId: c.resourceId ?? e.resourceId } : e;
  });
}

/** The inverse of `changes` against the current events (for undo). */
export function invertChanges(events: CalendarEvent[], changes: EventChange[]): EventChange[] {
  return changes.flatMap((c) => {
    const e = events.find((x) => x.id === c.id);
    return e ? [{ id: e.id, start: e.start, end: e.end, resourceId: e.resourceId }] : [];
  });
}
