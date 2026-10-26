import { describe, expect, test, vi, afterEach } from 'vitest';
import { CalendarController, UNDO_MS } from '../src/components/store.svelte.js';
import type { ChangeRequest } from '../src/components/types.js';
import type { CalendarEvent } from '@openslot/core';

const events: CalendarEvent[] = [
  { id: 'a', title: 'Rivera', start: '2030-06-10T18:00:00.000Z', end: '2030-06-10T19:00:00.000Z', resourceId: 'r1' },
  { id: 'b', title: 'Okafor', start: '2030-06-10T20:00:00.000Z', end: '2030-06-10T21:00:00.000Z', resourceId: 'r2' }
];
const move = { id: 'a', start: '2030-06-10T19:30:00.000Z', end: '2030-06-10T20:30:00.000Z', resourceId: 'r1' };

afterEach(() => vi.useRealTimers());

describe('CalendarController (optimistic changes)', () => {
  test('shows the change at once and keeps it after the host confirms', async () => {
    const calls: ChangeRequest[] = [];
    let release!: () => void;
    const ctl = new CalendarController(() => (req) => {
      calls.push(req);
      return new Promise<void>((r) => (release = r));
    });
    const done = ctl.commit('move', [move], 'Moved Rivera', events);
    expect(ctl.apply(events)[0].start).toBe(move.start);
    release();
    expect(await done).toBe(true);
    expect(calls).toEqual([{ kind: 'move', changes: [move], label: 'Moved Rivera' }]);
    expect(ctl.apply(events)[0].start).toBe(move.start);
    expect(ctl.toasts.at(-1)?.action?.label).toBe('Undo');
    // New host data replaces settled overrides
    ctl.sync();
    expect(ctl.apply(events)[0].start).toBe(events[0].start);
    ctl.destroy();
  });

  test('rolls back and explains when the host rejects (e.g. 409)', async () => {
    const ctl = new CalendarController(() => async () => {
      throw new Error('That time overlaps booking K7Q2.');
    });
    expect(await ctl.commit('move', [move], 'Moved Rivera', events)).toBe(false);
    expect(ctl.apply(events)[0].start).toBe(events[0].start);
    expect(ctl.rejected).toEqual(['a']);
    expect(ctl.toasts.at(-1)).toMatchObject({ tone: 'error', message: 'That time overlaps booking K7Q2. Moved back.' });
    expect(ctl.canUndo).toBe(false);
    ctl.destroy();
  });

  test('undo sends the inverse change and is not itself undoable', async () => {
    const calls: ChangeRequest[] = [];
    const ctl = new CalendarController(() => async (req) => void calls.push(req));
    await ctl.commit('move', [move], 'Moved Rivera', events);
    expect(ctl.canUndo).toBe(true);
    await ctl.undo(events);
    expect(calls[1].kind).toBe('undo');
    expect(calls[1].changes).toEqual([{ id: 'a', start: events[0].start, end: events[0].end, resourceId: 'r1' }]);
    expect(ctl.canUndo).toBe(false);
    ctl.destroy();
  });

  test('a drop refused before the host is asked shakes back with the reason', () => {
    const calls: ChangeRequest[] = [];
    const ctl = new CalendarController(() => async (req) => void calls.push(req));
    ctl.refuse(['a'], 'Vault B runs a different game.');
    expect(ctl.rejected).toEqual(['a']);
    expect(ctl.toasts.at(-1)).toMatchObject({ tone: 'error', message: 'Vault B runs a different game.' });
    expect(ctl.announcement).toBe('Vault B runs a different game.');
    expect(calls).toHaveLength(0);
    ctl.destroy();
  });

  test('the undo toast expires after six seconds', async () => {
    vi.useFakeTimers();
    const ctl = new CalendarController(() => async () => {});
    await ctl.commit('move', [move], 'Moved Rivera', events);
    expect(ctl.toasts).toHaveLength(1);
    vi.advanceTimersByTime(UNDO_MS + 1);
    expect(ctl.toasts).toHaveLength(0);
    ctl.destroy();
  });
});
