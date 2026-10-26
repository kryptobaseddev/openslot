/**
 * Open hours as plain data, so hosts and fixtures can describe them in JSON
 * and get the `HoursFn` every scheduling function takes.
 */
import type { DayHours, HoursFn } from './types.js';
import { dayOfWeek } from './time.js';

export interface HoursSpec {
  /** Hours by weekday, 0 = Sunday; a missing weekday falls back to `default` */
  weekly?: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayHours>>;
  /** Hours for specific local days ('YYYY-MM-DD'), e.g. holidays (null = closed) */
  dates?: Record<string, DayHours>;
  /** Hours of any other day (default: closed) */
  default?: DayHours;
}

/** The `HoursFn` for a spec: a specific date wins over its weekday, which wins over the default. */
export function hoursFromSpec(spec: HoursSpec): HoursFn {
  return (date) => {
    if (spec.dates && date in spec.dates) return spec.dates[date];
    const weekday = dayOfWeek(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    if (spec.weekly && weekday in spec.weekly) return spec.weekly[weekday] ?? null;
    return spec.default ?? null;
  };
}
