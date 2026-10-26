import { describe, expect, test } from 'vitest';
import { titleFor, whenLabel } from '../src/components/format.js';
import { viewRange } from '@openslot/core';

/** Intl uses thin and narrow no-break spaces around range dashes and before AM/PM. */
const plain = (s: string) => s.replace(/[\u2009\u202f\u00a0]/g, ' ');

describe('labels', () => {
  test('toolbar titles per view', () => {
    expect(titleFor('day', ['2030-06-10'], 'en-US')).toBe('Monday, June 10, 2030');
    expect(plain(titleFor('week', viewRange('week', '2030-06-10').days, 'en-US'))).toBe('Jun 9 – 15, 2030');
    expect(plain(titleFor('week', viewRange('week', '2030-07-01').days, 'en-US'))).toBe('Jun 30 – Jul 6, 2030');
    expect(titleFor('month', viewRange('month', '2030-06-10').days, 'en-US')).toBe('June 2030');
  });

  test('times are shown in the calendar zone, not the host zone', () => {
    // 00:00 UTC on Jun 11 is 5:00 PM on Jun 10 in Los Angeles
    expect(plain(whenLabel('2030-06-11T00:00:00Z', '2030-06-11T01:00:00Z', 'America/Los_Angeles', 'en-US'))).toBe(
      'Mon, Jun 10, 5:00 PM – 6:00 PM'
    );
  });
});
