/** Snapping for pointer and keyboard positioning (minutes from local midnight). */

export function snap(minutes: number, step: number): number {
  if (step <= 0) return minutes;
  return Math.round(minutes / step) * step;
}

/** Keep [start, start + duration) inside [open, close]; shortens nothing. */
export function clampToHours(start: number, duration: number, open: number, close: number): number {
  return Math.min(Math.max(start, open), Math.max(open, close - duration));
}

/** Pointer y (px from the top of the day column) to snapped minutes. */
export function yToMinutes(y: number, pxPerMinute: number, dayStartMin: number, step: number): number {
  return snap(dayStartMin + y / pxPerMinute, step);
}
