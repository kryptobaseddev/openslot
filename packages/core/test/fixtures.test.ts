/**
 * Runs the shared scenarios in /fixtures, the contract every adapter tests
 * against. See fixtures/README.md for the format.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  checkSlot,
  dayCoverage,
  findOpenSlots,
  generateSlots,
  hoursFromSpec,
  proposeConflictResolution,
  proposeReseat,
  staffModel,
  zonedToIso,
  type HoursSpec,
  type StaffSpan
} from '../src/index.js';

const dir = new URL('../../../fixtures/', import.meta.url);

interface Fixture {
  name: string;
  timeZone: string;
  now?: string;
  hours?: HoursSpec;
  staff?: { spans: StaffSpan[]; perBooking?: number };
  rules?: Record<string, unknown>;
  cases: Array<{ name: string; fn: string; input: Record<string, unknown>; expect: unknown }>;
  [key: string]: unknown;
}

/** Shared data, then the fixture's rules, then the case input; JSON shapes become core arguments. */
function argsFor(fx: Fixture, input: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cases, rules, name, description, $schema, ...shared } = fx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a: any = { events: [], resources: [], ...shared, ...rules, ...input };
  a.now = a.now ? new Date(a.now) : undefined;
  a.hours = hoursFromSpec(a.hours ?? { default: null });
  a.spans = a.staff?.spans ?? [];
  a.staff = a.staff ? staffModel(a.staff.spans, a.staff.perBooking ?? 1) : undefined;
  return a;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run: Record<string, (a: any) => unknown> = {
  generateSlots: (a) => generateSlots(a),
  checkSlot: (a) => checkSlot(a, a, a.start, a.resourceId),
  findOpenSlots: (a) => findOpenSlots(a),
  proposeReseat: (a) => proposeReseat(a),
  proposeConflictResolution: (a) => proposeConflictResolution(a),
  dayCoverage: (a) => dayCoverage(a.spans, a.date, a.timeZone, a.hours, a.stepMin, a.noun),
  zonedToIso: (a) => zonedToIso(a.date, a.minutes, a.timeZone)
};

const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'fixture.schema.json');

test('fixtures exist', () => {
  expect(files.length).toBeGreaterThanOrEqual(4);
});

for (const file of files) {
  const fx = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Fixture;
  describe(`fixture ${fx.name}`, () => {
    test('file name matches the fixture name', () => expect(file).toBe(`${fx.name}.json`));
    for (const c of fx.cases) {
      test(c.name, () => {
        const fn = run[c.fn];
        expect(fn, `unknown fn ${c.fn}`).toBeTypeOf('function');
        const got = fn(argsFor(fx, c.input));
        if (c.expect === null || typeof c.expect !== 'object') expect(got).toEqual(c.expect);
        else expect(got).toMatchObject(c.expect as object);
      });
    }
  });
}
