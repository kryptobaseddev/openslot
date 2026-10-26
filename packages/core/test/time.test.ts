import { describe, expect, test } from 'vitest';
import {
  addDays,
  dayOfWeek,
  formatTime,
  minutesBetween,
  monthGridDays,
  startOfWeek,
  todayIn,
  viewRange,
  zonedParts,
  zonedToIso
} from '../src/index.js';

const NY = 'America/New_York';

describe('zoned time', () => {
  test('round trips a normal day in New York, Kolkata and Sydney', () => {
    for (const tz of [NY, 'Asia/Kolkata', 'Australia/Sydney']) {
      for (const m of [0, 9 * 60 + 30, 23 * 60 + 45]) {
        const iso = zonedToIso('2030-06-10', m, tz);
        expect(zonedParts(iso, tz)).toEqual({ date: '2030-06-10', minutes: m });
      }
    }
    expect(zonedToIso('2030-06-10', 19 * 60, NY)).toBe('2030-06-10T23:00:00.000Z');
    expect(zonedToIso('2030-06-10', 19 * 60, 'Asia/Kolkata')).toBe('2030-06-10T13:30:00.000Z');
  });

  test('spring forward in New York: a skipped time rolls forward', () => {
    expect(zonedToIso('2030-03-10', 2 * 60 + 30, NY)).toBe('2030-03-10T07:30:00.000Z');
    expect(zonedParts('2030-03-10T07:30:00.000Z', NY)).toEqual({ date: '2030-03-10', minutes: 3 * 60 + 30 });
    expect(zonedToIso('2030-03-10', 3 * 60, NY)).toBe('2030-03-10T07:00:00.000Z');
    expect(zonedToIso('2030-03-10', 60, NY)).toBe('2030-03-10T06:00:00.000Z');
  });

  test('fall back in New York: a repeated time picks the first occurrence', () => {
    expect(zonedToIso('2030-11-03', 60 + 30, NY)).toBe('2030-11-03T05:30:00.000Z');
    expect(zonedToIso('2030-11-03', 3 * 60, NY)).toBe('2030-11-03T08:00:00.000Z');
    for (const m of [0, 4 * 60, 20 * 60]) {
      expect(zonedParts(zonedToIso('2030-11-03', m, NY), NY)).toEqual({ date: '2030-11-03', minutes: m });
    }
  });

  test('Sydney DST (April fall back, October spring forward)', () => {
    const tz = 'Australia/Sydney';
    for (const date of ['2030-04-07', '2030-10-06']) {
      for (const m of [0, 12 * 60, 22 * 60]) {
        expect(zonedParts(zonedToIso(date, m, tz), tz)).toEqual({ date, minutes: m });
      }
    }
  });

  test('todayIn uses the calendar zone, not the host', () => {
    const now = new Date('2030-06-11T02:00:00Z');
    expect(todayIn(NY, now)).toBe('2030-06-10');
    expect(todayIn('Asia/Kolkata', now)).toBe('2030-06-11');
  });
});

describe('days and ranges', () => {
  test('day arithmetic', () => {
    expect(addDays('2030-02-28', 1)).toBe('2030-03-01');
    expect(addDays('2030-01-01', -1)).toBe('2029-12-31');
    expect(dayOfWeek('2030-06-10')).toBe(1);
    expect(startOfWeek('2030-06-12', 0)).toBe('2030-06-09');
    expect(startOfWeek('2030-06-12', 1)).toBe('2030-06-10');
    expect(startOfWeek('2030-06-09', 1)).toBe('2030-06-03');
  });

  test('month grid is 42 days from the week start', () => {
    const days = monthGridDays('2030-06-18', 0);
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2030-05-26');
    expect(days).toContain('2030-06-30');
  });

  test('viewRange for every view', () => {
    expect(viewRange('day', '2030-06-12').days).toEqual(['2030-06-12']);
    expect(viewRange('resource-day', '2030-06-12').days).toEqual(['2030-06-12']);
    expect(viewRange('timeline-day', '2030-06-12').days).toEqual(['2030-06-12']);
    for (const v of ['week', 'resource-week', 'timeline-week'] as const) {
      expect(viewRange(v, '2030-06-12', 1)).toMatchObject({ from: '2030-06-10', to: '2030-06-16' });
    }
    expect(viewRange('month', '2030-06-12').days).toHaveLength(42);
    expect(viewRange('list', '2030-06-12')).toMatchObject({ from: '2030-06-12', to: '2030-06-18' });
  });

  test('formatting helpers', () => {
    expect(formatTime(19 * 60 + 30, 'en-US')).toBe('7:30 PM');
    expect(minutesBetween('2030-06-10T10:00:00Z', '2030-06-10T11:30:00Z')).toBe(90);
  });
});
