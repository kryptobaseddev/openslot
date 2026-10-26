import { describe, expect, test } from 'vitest';
import { checkSlot, generateSlots, hoursFromSpec, staffModel, type CalendarResource, type StaffSpan } from '../src/index.js';

const D = '2030-06-10'; // a Monday
const iso = (h: number, m = 0, date = D) => `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const resources: CalendarResource[] = [
  { id: 'r1', title: 'One', order: 1 },
  { id: 'r2', title: 'Two', order: 2 }
];
const base = { events: [], resources, timeZone: 'UTC', hours: () => ({ open: 600, close: 720 }), now: new Date(iso(0)), durationMin: 60 };

describe('hoursFromSpec', () => {
  test('a date wins over its weekday, which wins over the default', () => {
    const h = hoursFromSpec({
      default: { open: 540, close: 1020 },
      weekly: { 0: null, 1: { open: 600, close: 1200 } },
      dates: { '2030-06-17': null }
    });
    expect(h('2030-06-10')).toEqual({ open: 600, close: 1200 });
    expect(h('2030-06-17')).toBeNull();
    expect(h('2030-06-09')).toBeNull();
    expect(h('2030-06-11')).toEqual({ open: 540, close: 1020 });
    expect(hoursFromSpec({})('2030-06-11')).toBeNull();
  });
});

describe('generateSlots', () => {
  test('pooled resources: one slot per start lists every free resource', () => {
    expect(generateSlots({ ...base, from: D, stepMin: 30 })).toEqual([
      { start: iso(10), end: iso(11), resourceIds: ['r1', 'r2'] },
      { start: iso(10, 30), end: iso(11, 30), resourceIds: ['r1', 'r2'] },
      { start: iso(11), end: iso(12), resourceIds: ['r1', 'r2'] }
    ]);
  });

  test('the horizon cuts the searched days; limit stops early', () => {
    const multi = { ...base, from: D, to: '2030-06-20', stepMin: 60 };
    expect(generateSlots({ ...multi, horizonDays: 1 }).map((s) => s.start)).toEqual([
      iso(10),
      iso(11),
      iso(10, 0, '2030-06-11'),
      iso(11, 0, '2030-06-11')
    ]);
    expect(generateSlots({ ...multi, limit: 3 })).toHaveLength(3);
  });

  test('an all-resource blackout removes the slot; a resource blackout removes that resource', () => {
    const all = generateSlots({ ...base, from: D, stepMin: 60, blackouts: [{ start: iso(10, 30), end: iso(10, 45) }] });
    expect(all.map((s) => s.start)).toEqual([iso(11)]);
    const one = generateSlots({ ...base, from: D, stepMin: 60, blackouts: [{ start: iso(10), end: iso(11), resourceId: 'r1' }] });
    expect(one[0].resourceIds).toEqual(['r2']);
  });

  test('two staff per booking: three people on shift run one booking at a time', () => {
    const spans: StaffSpan[] = ['a', 'b', 'c'].map((userId) => ({ userId, kind: 'shift', start: iso(10), end: iso(12) }));
    const [first] = generateSlots({ ...base, from: D, stepMin: 60, staff: staffModel(spans, 2) });
    expect(first.resourceIds).toEqual(['r1']);
  });
});

describe('checkSlot', () => {
  test('picks the first free resource, or checks the one asked for', () => {
    const events = [{ id: 'e', title: 'e', resourceId: 'r1', start: iso(10), end: iso(11) }];
    expect(checkSlot({ ...base, events }, base, iso(10))).toEqual({ ok: true, resourceId: 'r2' });
    expect(checkSlot({ ...base, events }, base, iso(10), 'r1')).toEqual({ ok: false, reason: 'CONFLICT' });
    expect(checkSlot(base, base, iso(10, 7))).toEqual({ ok: true, resourceId: 'r1' });
    expect(checkSlot(base, base, iso(11, 30))).toEqual({ ok: false, reason: 'CLOSED' });
  });
});
