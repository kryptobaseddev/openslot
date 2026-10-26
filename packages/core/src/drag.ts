/**
 * DOM-free drag math. The view turns pointer or keyboard input into a delta
 * in minutes (and optionally a target day or resource); this computes the
 * snapped result.
 */
import type { CalendarEvent, EventChange } from './types.js';
import { snap } from './snap.js';
import { addMinutesIso, minutesBetween, zonedParts, zonedToIso } from './time.js';

export type DragMode = 'move' | 'resize-start' | 'resize-end';

export interface DragInput {
  event: Pick<CalendarEvent, 'id' | 'start' | 'end' | 'resourceId' | 'editable'>;
  mode: DragMode;
  /** pointer movement in minutes since the drag began */
  deltaMin: number;
  stepMin: number;
  minDurationMin?: number;
  timeZone: string;
  /** move to another local day (keeps the wall-clock time, then applies the delta) */
  targetDate?: string;
  targetResourceId?: string;
}

/** The change a drag produces, or null when the event is not editable or nothing moved. */
export function dragResult(input: DragInput): EventChange | null {
  const { event, mode, timeZone } = input;
  if (event.editable === false) return null;
  const minDur = input.minDurationMin ?? input.stepMin;
  const startParts = zonedParts(event.start, timeZone);
  const duration = minutesBetween(event.start, event.end);
  const date = input.targetDate ?? startParts.date;
  const resourceId = input.targetResourceId ?? event.resourceId;

  let start = event.start;
  let end = event.end;
  if (mode === 'move') {
    const m = snap(startParts.minutes + input.deltaMin, input.stepMin);
    start = zonedToIso(date, m, timeZone);
    end = addMinutesIso(start, duration);
  } else if (mode === 'resize-end') {
    const len = Math.max(minDur, snap(duration + input.deltaMin, input.stepMin));
    end = addMinutesIso(event.start, len);
  } else {
    const len = Math.max(minDur, snap(duration - input.deltaMin, input.stepMin));
    start = addMinutesIso(event.end, -len);
  }
  if (start === event.start && end === event.end && resourceId === event.resourceId) return null;
  return { id: event.id, start, end, resourceId };
}

/** A new event dragged out on empty grid: from the anchor to the pointer, snapped, at least one step. */
export function createRange(input: {
  date: string;
  anchorMin: number;
  pointerMin: number;
  stepMin: number;
  minDurationMin?: number;
  timeZone: string;
}): { start: string; end: string } {
  const a = snap(input.anchorMin, input.stepMin);
  const b = snap(input.pointerMin, input.stepMin);
  const minDur = input.minDurationMin ?? input.stepMin;
  const lo = Math.min(a, b);
  const hi = Math.max(Math.max(a, b), lo + minDur);
  return { start: zonedToIso(input.date, lo, input.timeZone), end: zonedToIso(input.date, hi, input.timeZone) };
}
