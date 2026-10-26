/** The calendar's domain words are neutral by default and named by the host through `labels`. */
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { Calendar, DEFAULT_LABELS, resolveLabels, type LabelOverrides } from '../src/index.js';

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

function render(labels?: LabelOverrides) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(Calendar, {
    target,
    props: {
      events: [],
      resources: [
        { id: 'r1', title: 'One' },
        { id: 'r2', title: 'Two' }
      ],
      timeZone: 'UTC',
      view: 'resource-day',
      compactBelow: 0,
      date: '2030-06-10',
      now: new Date('2030-06-10T08:00:00Z'),
      labels
    }
  });
  flushSync();
  return target;
}

describe('labels', () => {
  test('neutral defaults', () => {
    expect(render().querySelector('.osl-sidebar legend')?.textContent).toBe('Resources');
  });

  test('a host names its domain', () => {
    expect(render({ resources: 'Rooms' }).querySelector('.osl-sidebar legend')?.textContent).toBe('Rooms');
  });

  test('partial swap errors keep the other defaults', () => {
    const l = resolveLabels({ swapErrors: { PINNED: 'Locked.' } });
    expect(l.swapErrors.PINNED).toBe('Locked.');
    expect(l.swapErrors.OVERLAP).toBe(DEFAULT_LABELS.swapErrors.OVERLAP);
  });
});
