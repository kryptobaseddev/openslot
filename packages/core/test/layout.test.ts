import { describe, expect, test } from 'vitest';
import { clampToHours, createHistory, createRange, dragResult, layoutDay, layoutMonthWeek, snap, yToMinutes } from '../src/index.js';

const byId = (r: ReturnType<typeof layoutDay>) => Object.fromEntries(r.map((p) => [p.id, p]));

describe('time grid overlap layout', () => {
  test('three mutually overlapping events take three columns', () => {
    const r = byId(
      layoutDay([
        { id: 'a', startMin: 600, endMin: 720 },
        { id: 'b', startMin: 630, endMin: 700 },
        { id: 'c', startMin: 640, endMin: 710 }
      ])
    );
    expect([r.a.col, r.b.col, r.c.col]).toEqual([0, 1, 2]);
    expect(r.a.cols).toBe(3);
    expect([r.a.span, r.b.span, r.c.span]).toEqual([1, 1, 1]);
  });

  test('an event expands across columns that stay free', () => {
    const r = byId(
      layoutDay([
        { id: 'a', startMin: 600, endMin: 660 },
        { id: 'b', startMin: 600, endMin: 630 },
        { id: 'c', startMin: 600, endMin: 615 },
        { id: 'd', startMin: 640, endMin: 700 }
      ])
    );
    expect(r.a.cols).toBe(3);
    // d starts after b and c ended: it reuses column 1 and spans to the right
    expect(r.d.col).toBe(1);
    expect(r.d.span).toBe(2);
  });

  test('separate clusters are laid out independently', () => {
    const r = byId(
      layoutDay([
        { id: 'a', startMin: 600, endMin: 660 },
        { id: 'b', startMin: 630, endMin: 690 },
        { id: 'c', startMin: 700, endMin: 760 }
      ])
    );
    expect(r.c).toEqual({ id: 'c', col: 0, cols: 1, span: 1 });
    expect(r.b.cols).toBe(2);
  });

  test('month cells keep a row for +N more', () => {
    const items = [1, 2, 3, 4].map((i) => ({ id: `e${i}`, date: '2030-06-10' }));
    const m = layoutMonthWeek(items, ['2030-06-10', '2030-06-11'], 3);
    expect(m.get('2030-06-10')).toMatchObject({ more: 2 });
    expect(m.get('2030-06-10')!.visible).toHaveLength(2);
    expect(m.get('2030-06-11')).toEqual({ visible: [], more: 0 });
    expect(layoutMonthWeek(items.slice(0, 3), ['2030-06-10'], 3).get('2030-06-10')!.more).toBe(0);
  });
});

describe('snap and drag math', () => {
  test('snap helpers', () => {
    expect(snap(37, 15)).toBe(30);
    expect(snap(38, 15)).toBe(45);
    expect(clampToHours(1300, 60, 600, 1320)).toBe(1260);
    expect(clampToHours(500, 60, 600, 1320)).toBe(600);
    expect(yToMinutes(130, 2, 540, 15)).toBe(600);
  });

  const TZ = 'America/New_York';
  const event = { id: 'e', start: '2030-06-10T14:00:00.000Z', end: '2030-06-10T15:00:00.000Z', resourceId: 'r1' };

  test('move snaps and keeps the duration; target day and resource apply', () => {
    expect(dragResult({ event, mode: 'move', deltaMin: 22, stepMin: 15, timeZone: TZ })).toEqual({
      id: 'e',
      start: '2030-06-10T14:15:00.000Z',
      end: '2030-06-10T15:15:00.000Z',
      resourceId: 'r1'
    });
    const r = dragResult({ event, mode: 'move', deltaMin: 0, stepMin: 15, timeZone: TZ, targetDate: '2030-06-11', targetResourceId: 'r2' });
    expect(r).toEqual({ id: 'e', start: '2030-06-11T14:00:00.000Z', end: '2030-06-11T15:00:00.000Z', resourceId: 'r2' });
  });

  test('resize respects the minimum duration; non-editable and no-op return null', () => {
    expect(dragResult({ event, mode: 'resize-end', deltaMin: 30, stepMin: 15, timeZone: TZ })!.end).toBe('2030-06-10T15:30:00.000Z');
    expect(dragResult({ event, mode: 'resize-end', deltaMin: -120, stepMin: 15, timeZone: TZ })!.end).toBe('2030-06-10T14:15:00.000Z');
    expect(dragResult({ event, mode: 'resize-start', deltaMin: -15, stepMin: 15, timeZone: TZ })!.start).toBe('2030-06-10T13:45:00.000Z');
    expect(dragResult({ event: { ...event, editable: false }, mode: 'move', deltaMin: 60, stepMin: 15, timeZone: TZ })).toBeNull();
    expect(dragResult({ event, mode: 'move', deltaMin: 5, stepMin: 15, timeZone: TZ })).toBeNull();
  });

  test('drag to create runs either direction with a minimum length', () => {
    expect(createRange({ date: '2030-06-10', anchorMin: 600, pointerMin: 548, stepMin: 15, timeZone: 'UTC' })).toEqual({
      start: '2030-06-10T09:15:00.000Z',
      end: '2030-06-10T10:00:00.000Z'
    });
    expect(createRange({ date: '2030-06-10', anchorMin: 600, pointerMin: 602, stepMin: 15, minDurationMin: 60, timeZone: 'UTC' }).end).toBe(
      '2030-06-10T11:00:00.000Z'
    );
  });
});

describe('history', () => {
  test('push, peek, pop and the limit', () => {
    const h = createHistory(2);
    for (const label of ['a', 'b', 'c']) h.push({ label, undo: [], redo: [] });
    expect(h.size).toBe(2);
    expect(h.peek()!.label).toBe('c');
    expect(h.pop()!.label).toBe('c');
    expect(h.pop()!.label).toBe('b');
    expect(h.pop()).toBeUndefined();
  });
});
