/**
 * Calendar model. Instants are ISO strings; calendar days are 'YYYY-MM-DD'
 * strings in the calendar's time zone (never the host's).
 */

export interface CalendarEvent {
  id: string;
  /** ISO instant */
  start: string;
  /** ISO instant (exclusive) */
  end: string;
  resourceId?: string;
  title: string;
  /** Status or category key: picks the colour and the sidebar filter */
  calendarId?: string;
  /** false: the event cannot be moved, resized or swapped */
  editable?: boolean;
  /** Pinned events are never moved by schedule shuffling */
  pinned?: boolean;
  /** Only resources with the same compatKey may host the event (e.g. the service a resource offers) */
  compatKey?: string;
  /** e.g. party size, checked against resource capacity */
  size?: number;
  /** Optimistic concurrency token sent back with a change */
  version?: string;
  meta?: Record<string, unknown>;
}

export interface CalendarResource {
  id: string;
  title: string;
  color?: string;
  compatKey?: string;
  capacity?: { min: number; max: number };
  order?: number;
}

export interface CalendarDef {
  id: string;
  label: string;
  /** CSS custom property name holding the colour, e.g. '--color-success' */
  colorVar?: string;
}

export type ViewKind = 'day' | 'week' | 'month' | 'list' | 'resource-day' | 'resource-week' | 'timeline-day' | 'timeline-week';

/** Opening hours of a day in minutes from midnight; null = closed. */
export type DayHours = { open: number; close: number } | null;
export type HoursFn = (date: string) => DayHours;

export interface EventChange {
  id: string;
  start: string;
  end: string;
  resourceId?: string;
}

export type MoveKind = 'move' | 'resize' | 'create' | 'swap';
