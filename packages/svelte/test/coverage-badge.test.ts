/**
 * Calendar renders a staff coverage badge per visible day when given `staff`, and none
 * without it.
 */
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { Calendar, type StaffSpan } from '../src/index.js';

const D = '2030-06-10';
const at = (date: string, h: number) => `${date}T${String(h).padStart(2, '0')}:00:00.000Z`;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

let app: ReturnType<typeof mount> | null = null;
afterEach(() => {
  if (app) unmount(app);
  app = null;
  document.body.innerHTML = '';
});

function render(staff?: { spans: StaffSpan[] }) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(Calendar, {
    target,
    props: {
      events: [],
      resources: [{ id: 'r1', title: 'Room 1' }],
      timeZone: 'UTC',
      view: 'week',
      // jsdom has no layout (width 0): keep the desktop week view
      compactBelow: 0,
      date: D,
      hours: () => ({ open: 10 * 60, close: 22 * 60 }),
      now: new Date(at(D, 8)),
      staff
    }
  });
  flushSync();
  return target;
}

describe('Calendar staff coverage badge', () => {
  test('one badge per day: covered, gaps and uncovered', () => {
    const el = render({
      spans: [
        { userId: 'ana', start: at(D, 10), end: at(D, 22), kind: 'shift' },
        { userId: 'ben', start: at('2030-06-11', 10), end: at('2030-06-11', 16), kind: 'shift' }
      ]
    });
    const badges = [...el.querySelectorAll('[data-coverage]')];
    expect(badges).toHaveLength(7);
    const byTone = (tone: string) => badges.filter((b) => b.getAttribute('data-coverage') === tone).map((b) => b.textContent?.trim());
    expect(byTone('ok')).toEqual([expect.stringContaining('1 staff')]);
    expect(byTone('gap')).toEqual([expect.stringContaining('1 staff, gaps')]);
    expect(byTone('none')).toHaveLength(5);
    expect(badges[0].textContent).toContain('Staff coverage');
  });

  test('no staff prop, no badges', () => {
    expect(render().querySelectorAll('[data-coverage]')).toHaveLength(0);
  });
});
