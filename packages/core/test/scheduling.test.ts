import { describe, expect, test } from 'vitest';
import {
  applyChanges,
  findOpenSlots,
  invertChanges,
  isFree,
  movesToChanges,
  nextOpenSlotPerResource,
  planSwap,
  proposeConflictResolution,
  proposeReseat,
  type CalendarEvent,
  type CalendarResource
} from '../src/index.js';

const TZ = 'UTC';
const D = '2030-06-10';
const iso = (h: number, m = 0, date = D) => `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const ev = (id: string, resourceId: string, h: number, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  resourceId,
  title: id,
  start: iso(h),
  end: iso(h + 1),
  compatKey: 'vault',
  size: 4,
  ...extra
});

const resources: CalendarResource[] = [
  { id: 'r1', title: 'Room 1', compatKey: 'vault', capacity: { min: 2, max: 8 }, order: 1 },
  { id: 'r2', title: 'Room 2', compatKey: 'vault', capacity: { min: 2, max: 8 }, order: 2 },
  { id: 'r3', title: 'Room 3', compatKey: 'vault', capacity: { min: 2, max: 4 }, order: 3 },
  { id: 'lab', title: 'Lab', compatKey: 'lab', capacity: { min: 2, max: 8 }, order: 4 }
];
const hours = () => ({ open: 10 * 60, close: 22 * 60 });

describe('scheduling assistant', () => {
  const base = { resources, durationMin: 60, from: D, to: D, timeZone: TZ, hours, now: new Date(iso(0)), stepMin: 30 };

  test('filters by compatKey and capacity, earliest first, ties by resource order', () => {
    const slots = findOpenSlots({ ...base, events: [], compatKey: 'vault', size: 6, limit: 3 });
    expect(slots.map((s) => [s.resourceId, s.start])).toEqual([
      ['r1', iso(10)],
      ['r2', iso(10)],
      ['r1', iso(10, 30)]
    ]);
    expect(findOpenSlots({ ...base, events: [], compatKey: 'lab', limit: 1 })[0].resourceId).toBe('lab');
  });

  test('keeps the buffer free and skips busy rooms', () => {
    const events = [ev('a', 'r1', 10), ev('b', 'r2', 10), ev('c', 'r3', 10)];
    const [first] = findOpenSlots({ ...base, events, compatKey: 'vault', bufferMin: 15, limit: 1 });
    expect(first.start).toBe(iso(11, 30));
    const [noBuffer] = findOpenSlots({ ...base, events, compatKey: 'vault', limit: 1 });
    expect(noBuffer.start).toBe(iso(11));
  });

  test('respects opening hours, closed days and lead time', () => {
    const late = findOpenSlots({ ...base, events: [], compatKey: 'lab', limit: 100 });
    expect(late[late.length - 1].end).toBe(iso(22));
    expect(findOpenSlots({ ...base, events: [], hours: () => null })).toEqual([]);
    const [soon] = findOpenSlots({ ...base, events: [], compatKey: 'lab', now: new Date(iso(13, 10)), leadMin: 30, limit: 1 });
    expect(soon.start).toBe(iso(14));
  });

  test('staff on shift limit concurrent bookings', () => {
    const events = [ev('a', 'r1', 10)];
    const staff = { available: (s: string) => (s < iso(12) ? 1 : 3) };
    const [first] = findOpenSlots({ ...base, events, compatKey: 'vault', staff, limit: 1 });
    expect(first.start).toBe(iso(11));
  });

  test('next open slot per resource', () => {
    const events = [ev('a', 'r1', 10), ev('b', 'r1', 11)];
    const next = nextOpenSlotPerResource({ ...base, events, compatKey: 'vault' });
    expect(next.map((s) => [s.resourceId, s.start])).toEqual([
      ['r1', iso(12)],
      ['r2', iso(10)],
      ['r3', iso(10)]
    ]);
  });
});

describe('re-seat proposals', () => {
  const need = { start: iso(12), end: iso(13), compatKey: 'vault', size: 4 };

  test('zero moves when a compatible room is free, preferring the requested room', () => {
    const p = proposeReseat({ need: { ...need, preferredResourceId: 'r2' }, events: [], resources });
    expect(p).toEqual({ resourceId: 'r2', moves: [], score: 0 });
  });

  test('one move frees a room', () => {
    const events = [ev('a', 'r1', 12), ev('b', 'r2', 12)];
    // r3 is free and fits a party of 4
    expect(proposeReseat({ need, events, resources })).toMatchObject({ resourceId: 'r3', moves: [] });
    // Every vault room busy and nothing can move anywhere: no proposal
    const full = [...events, ev('c', 'r3', 12, { size: 3 })];
    expect(proposeReseat({ need: { ...need, size: 6 }, events: full, resources })).toBeNull();
    const roomy = proposeReseat({ need: { ...need, size: 6 }, events: [ev('a', 'r1', 12, { size: 3 }), ev('b', 'r2', 12)], resources });
    expect(roomy).toMatchObject({ resourceId: 'r1', moves: [{ eventId: 'a', fromResourceId: 'r1', toResourceId: 'r3' }] });
  });

  test('a two-move chain', () => {
    // r1 and r2 busy; r3 busy with a small party that can go nowhere but... add r4 free.
    const res = [...resources, { id: 'r4', title: 'Room 4', compatKey: 'vault', capacity: { min: 2, max: 3 }, order: 5 }];
    const events = [
      ev('a', 'r1', 12, { size: 4 }), // fits r1, r2, r3
      ev('b', 'r2', 12, { size: 6 }), // fits r1, r2 only
      ev('c', 'r3', 12, { size: 3 }) // fits r1, r2, r3, r4
    ];
    // Need a party of 6 at 12: only r1/r2 can host. r2's b (6) can only go to r1 (busy with a).
    // Cheapest: free r1 by moving a -> r3 after c -> r4 (two moves).
    const p = proposeReseat({ need: { ...need, size: 6 }, events, resources: res });
    expect(p!.resourceId).toBe('r1');
    expect(p!.moves).toEqual([
      { eventId: 'c', fromResourceId: 'r3', toResourceId: 'r4' },
      { eventId: 'a', fromResourceId: 'r1', toResourceId: 'r3' }
    ]);
    const after = applyChanges(events, movesToChanges(events, p!.moves));
    expect(isFree(after, 'r1', need.start, need.end)).toBe(true);
    expect(proposeReseat({ need: { ...need, size: 6 }, events, resources: res, maxMoves: 1 })).toBeNull();
  });

  test('pinned and non-editable events are never moved', () => {
    const events = [ev('a', 'r1', 12, { pinned: true }), ev('b', 'r2', 12, { editable: false }), ev('c', 'r3', 12)];
    const res = [...resources, { id: 'r4', title: 'Room 4', compatKey: 'vault', order: 5 }];
    const p = proposeReseat({ need: { ...need, preferredResourceId: 'r1' }, events, resources: res });
    expect(p).toEqual({ resourceId: 'r4', moves: [], score: 1 });
    const busy = [...events, ev('d', 'r4', 12)];
    const q = proposeReseat({ need, events: busy, resources: res });
    expect(q).toBeNull();
  });

  test('never moves an event to a resource with another compatKey', () => {
    const events = [ev('a', 'r1', 12), ev('b', 'r2', 12), ev('c', 'r3', 12)];
    // lab is free but has another compatKey: no compatible target for the vault events
    expect(proposeReseat({ need, events, resources })).toBeNull();
  });

  test('conflict resolution moves the overlapping event, or the other one when it is pinned', () => {
    const events = [ev('a', 'r1', 12), ev('b', 'r1', 12, { start: iso(12, 30), end: iso(13, 30) })];
    const p = proposeConflictResolution({ eventId: 'b', events, resources });
    expect(p!.moves).toEqual([{ eventId: 'b', fromResourceId: 'r1', toResourceId: 'r2' }]);
    const pinned = events.map((e) => (e.id === 'b' ? { ...e, pinned: true } : e));
    const q = proposeConflictResolution({ eventId: 'b', events: pinned, resources });
    expect(q!.moves).toEqual([{ eventId: 'a', fromResourceId: 'r1', toResourceId: 'r2' }]);
    expect(proposeConflictResolution({ eventId: 'a', events: [ev('a', 'r1', 12)], resources })).toBeNull();
  });
});

describe('swap', () => {
  const a = ev('a', 'r1', 12);
  const b = ev('b', 'r2', 14, { size: 6 });

  test('resource, time and both', () => {
    expect(planSwap(a, b, 'resource', { resources })).toEqual([
      { id: 'a', start: a.start, end: a.end, resourceId: 'r2' },
      { id: 'b', start: b.start, end: b.end, resourceId: 'r1' }
    ]);
    const longB = { ...b, end: iso(16) };
    expect(planSwap(a, longB, 'time', { resources })).toEqual([
      { id: 'a', start: iso(14), end: iso(15), resourceId: 'r1' },
      { id: 'b', start: iso(12), end: iso(14), resourceId: 'r2' }
    ]);
    expect(planSwap(a, b, 'both', { resources })).toEqual([
      { id: 'a', start: iso(14), end: iso(15), resourceId: 'r2' },
      { id: 'b', start: iso(12), end: iso(13), resourceId: 'r1' }
    ]);
  });

  test('errors: compat mismatch, pinned, not editable, capacity, overlap', () => {
    const lab = ev('l', 'lab', 12, { compatKey: 'lab' });
    expect(planSwap(a, lab, 'resource', { resources })).toEqual({ error: 'COMPAT_MISMATCH' });
    expect(planSwap(a, { ...b, pinned: true }, 'resource', { resources })).toEqual({ error: 'PINNED' });
    expect(planSwap({ ...a, editable: false }, b, 'resource', { resources })).toEqual({ error: 'NOT_EDITABLE' });
    expect(planSwap(a, ev('s', 'r3', 12, { size: 3 }), 'resource', { resources })).not.toHaveProperty('error');
    expect(planSwap(ev('s', 'r3', 12, { size: 3 }), b, 'resource', { resources })).toEqual({ error: 'CAPACITY' });
    const third = ev('t', 'r2', 12, { start: iso(12, 30), end: iso(13, 30) });
    expect(planSwap(a, b, 'resource', { resources, events: [a, b, third] })).toEqual({ error: 'OVERLAP' });
  });

  test('applyChanges and invertChanges round trip', () => {
    const events = [a, b];
    const changes = planSwap(a, b, 'both', { resources }) as ReturnType<typeof movesToChanges>;
    const undo = invertChanges(events, changes);
    expect(applyChanges(applyChanges(events, changes), undo)).toEqual(events);
  });
});
