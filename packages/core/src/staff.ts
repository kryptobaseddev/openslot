/**
 * Staff coverage: who is on shift, from shift and time-off spans. A person is
 * available for [start, end) when their shifts (merged, minus their time off) cover all of it.
 * `staffModel()` feeds the scheduling assistant; `dayCoverage()` feeds the per-day badge.
 */
import type { StaffModel } from './assistant.js';
import type { HoursFn } from './types.js';
import { zonedToIso } from './time.js';

export interface StaffSpan {
  userId: string;
  start: string;
  end: string;
  kind: 'shift' | 'time_off';
}

type Interval = [number, number];

function merge(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function subtract(list: Interval[], cuts: Interval[]): Interval[] {
  let out = list;
  for (const [cs, ce] of cuts) {
    out = out.flatMap(([s, e]): Interval[] => {
      if (ce <= s || cs >= e) return [[s, e]];
      const keep: Interval[] = [];
      if (cs > s) keep.push([s, cs]);
      if (ce < e) keep.push([ce, e]);
      return keep;
    });
  }
  return out;
}

/** Each person's available intervals (epoch ms): merged shifts minus time off. */
export function availability(spans: readonly StaffSpan[]): Map<string, Interval[]> {
  const shifts = new Map<string, Interval[]>();
  const off = new Map<string, Interval[]>();
  for (const sp of spans) {
    const s = Date.parse(sp.start);
    const e = Date.parse(sp.end);
    if (!(e > s)) continue;
    const into = sp.kind === 'time_off' ? off : shifts;
    if (!into.has(sp.userId)) into.set(sp.userId, []);
    into.get(sp.userId)!.push([s, e]);
  }
  const out = new Map<string, Interval[]>();
  for (const [user, list] of shifts) {
    const free = subtract(merge(list), merge(off.get(user) ?? []));
    if (free.length) out.set(user, free);
  }
  return out;
}

/** People available for the whole of [startIso, endIso). */
export function availableCount(avail: Map<string, Interval[]>, startIso: string, endIso: string): number {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  let n = 0;
  for (const list of avail.values()) if (list.some(([a, b]) => a <= s && b >= e)) n++;
  return n;
}

/** The assistant's staff model: `perBooking` staff for each event running at the same time. */
export function staffModel(spans: readonly StaffSpan[], perBooking = 1): StaffModel {
  const avail = availability(spans);
  return { available: (start, end) => availableCount(avail, start, end), perBooking };
}

export interface DayCoverage {
  /** People on shift at some point during open hours */
  onShift: number;
  /** Open time with nobody on shift, in minutes */
  gapMin: number;
  tone: 'ok' | 'gap' | 'none';
  label: string;
}

/**
 * Coverage of one local day: how many people work some of the open hours and how much
 * open time nobody covers (sampled every `stepMin`). Null when closed that day.
 */
export function dayCoverage(
  spans: readonly StaffSpan[],
  date: string,
  timeZone: string,
  hours: HoursFn,
  stepMin = 15,
  noun: [string, string] = ['staff', 'staff']
): DayCoverage | null {
  const h = hours(date);
  if (!h) return null;
  const avail = availability(spans);
  const open = Date.parse(zonedToIso(date, h.open, timeZone));
  const close = Date.parse(zonedToIso(date, h.close, timeZone));
  let onShift = 0;
  for (const list of avail.values()) if (list.some(([a, b]) => a < close && b > open)) onShift++;
  let gapMin = 0;
  for (let m = h.open; m < h.close; m += stepMin) {
    const s = zonedToIso(date, m, timeZone);
    const e = zonedToIso(date, Math.min(m + stepMin, h.close), timeZone);
    if (availableCount(avail, s, e) === 0) gapMin += Math.min(stepMin, h.close - m);
  }
  const count = `${onShift} ${onShift === 1 ? noun[0] : noun[1]}`;
  if (onShift === 0) return { onShift, gapMin, tone: 'none', label: `No ${noun[0]}` };
  if (gapMin > 0) return { onShift, gapMin, tone: 'gap', label: `${count}, gaps` };
  return { onShift, gapMin, tone: 'ok', label: count };
}
