import { describe, expect, test } from 'vitest';
import {
  availability,
  availableCount,
  dayCoverage,
  findOpenSlots,
  staffModel,
  type CalendarEvent,
  type CalendarResource,
  type StaffSpan
} from '../src/index.js';

const TZ = 'UTC';
const D = '2030-06-10';
const iso = (h: number, m = 0, date = D) => `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const shift = (userId: string, from: number, to: number, kind: StaffSpan['kind'] = 'shift', date = D): StaffSpan => ({
  userId,
  start: iso(from, 0, date),
  end: iso(to, 0, date),
  kind
});
const hours = () => ({ open: 10 * 60, close: 22 * 60 });
const resources: CalendarResource[] = [
  { id: 'r1', title: 'Room 1', compatKey: 'vault', order: 1 },
  { id: 'r2', title: 'Room 2', compatKey: 'vault', order: 2 }
];
const base = { resources, durationMin: 60, from: D, to: D, timeZone: TZ, hours, now: new Date(iso(0)), stepMin: 60, compatKey: 'vault' };

describe('staff availability', () => {
  test('back-to-back shifts merge; time off cuts a hole', () => {
    const avail = availability([shift('ana', 10, 14), shift('ana', 14, 18), shift('ana', 12, 13, 'time_off')]);
    expect(availableCount(avail, iso(13), iso(15))).toBe(1);
    expect(availableCount(avail, iso(11, 30), iso(12, 30))).toBe(0);
    expect(availableCount(avail, iso(17, 30), iso(18, 30))).toBe(0);
  });

  test('time off alone never makes anyone available', () => {
    expect(availableCount(availability([shift('ana', 10, 22, 'time_off')]), iso(11), iso(12))).toBe(0);
  });

  test('the assistant skips slots with nobody on shift', () => {
    const staff = staffModel([shift('ana', 15, 22)]);
    const [first] = findOpenSlots({ ...base, events: [], staff, limit: 1 });
    expect(first.start).toBe(iso(15));
  });

  test('one staff member per concurrent event', () => {
    const staff = staffModel([shift('ana', 10, 22), shift('ben', 12, 22)]);
    const events: CalendarEvent[] = [{ id: 'a', title: 'a', resourceId: 'r1', start: iso(10), end: iso(11), compatKey: 'vault' }];
    // 10:00 has a booking and only Ana: Room 2 waits until Ana is free at 11:00
    const [first] = findOpenSlots({ ...base, events, staff, limit: 1 });
    expect(first).toMatchObject({ resourceId: 'r1', start: iso(11) });
    const both = findOpenSlots({ ...base, events: [], staff, limit: 4 });
    expect(both.map((s) => [s.resourceId, s.start])).toEqual([
      ['r1', iso(10)],
      ['r2', iso(10)],
      ['r1', iso(11)],
      ['r2', iso(11)]
    ]);
  });

  test('the booking being moved does not hold its own staff member', () => {
    const staff = staffModel([shift('ana', 10, 22)]);
    const events: CalendarEvent[] = [{ id: 'a', title: 'a', resourceId: 'r1', start: iso(10), end: iso(11), compatKey: 'vault' }];
    const [first] = findOpenSlots({ ...base, events, staff, excludeIds: ['a'], limit: 1 });
    expect(first.start).toBe(iso(10));
  });
});

describe('day coverage badge', () => {
  test('counts people on shift and flags open time nobody covers', () => {
    expect(dayCoverage([shift('ana', 10, 22), shift('ben', 12, 20)], D, TZ, hours)).toMatchObject({
      onShift: 2,
      gapMin: 0,
      tone: 'ok',
      label: '2 staff'
    });
    expect(dayCoverage([shift('ana', 10, 18)], D, TZ, hours)).toMatchObject({
      onShift: 1,
      gapMin: 240,
      tone: 'gap',
      label: '1 staff, gaps'
    });
    expect(dayCoverage([shift('ana', 10, 22, 'shift', '2030-06-11')], D, TZ, hours)).toMatchObject({ tone: 'none', label: 'No staff' });
    expect(dayCoverage([], D, TZ, () => null)).toBeNull();
  });

  test('a full day of time off leaves the day uncovered', () => {
    expect(dayCoverage([shift('ana', 10, 22), shift('ana', 0, 23, 'time_off')], D, TZ, hours)?.tone).toBe('none');
  });
});
