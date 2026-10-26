/**
 * Domain words and messages the calendar shows. The defaults are neutral
 * ("resource", "event"); a host names its own domain ("Room", "Party size",
 * "Booking") with the `labels` prop. Interface chrome (Today, Undo, ...) is
 * English in phase 1; full message catalogs are phase 2.
 */
import type { SwapError } from '@openslot/core';

export interface CalendarLabels {
  /** A resource, e.g. "Room", "Technician", "Court" */
  resource: string;
  /** Resources, e.g. "Rooms" (sidebar filter and view names) */
  resources: string;
  /** The event's size field, e.g. "Party size", "Seats" */
  size: string;
  /** The compatKey picker in "Find a time", e.g. "Game", "Service" */
  compat: string;
  /** One event, capitalised, e.g. "Booking", "Job" */
  event: string;
  /** Events, lowercase, in sentences */
  eventsLower: string;
  /** The new-event button and the shuffle row of an unnamed new event */
  newEvent: string;
  /** Agenda text for an empty day */
  empty: string;
  /** Title of the re-seat preview */
  shuffleTitle: string;
  /** Body of the re-seat preview */
  shuffleBody: (moves: number) => string;
  /** Modal alert on an event that overlaps another on its resource */
  overlapAlert: string;
  /** Toast when a new event fits nowhere */
  noneFree: string;
  /** Toast when a conflict cannot be resolved */
  noneCompatibleFree: string;
  /** Refusal when a drop targets a resource with another compatKey */
  incompatible: (resourceTitle: string) => string;
  /** Refusal when the event's size does not fit the target resource */
  tooLarge: (resourceTitle: string) => string;
  /** Refusals of a swap */
  swapErrors: Record<SwapError, string>;
}

/** What a host passes: any subset, including a subset of the swap errors. */
export type LabelOverrides = Partial<Omit<CalendarLabels, 'swapErrors'>> & { swapErrors?: Partial<Record<SwapError, string>> };

export const DEFAULT_LABELS: CalendarLabels = {
  resource: 'Resource',
  resources: 'Resources',
  size: 'Size',
  compat: 'Type',
  event: 'Event',
  eventsLower: 'events',
  newEvent: 'New event',
  empty: 'Nothing scheduled',
  shuffleTitle: 'Rearrange to fit it in?',
  shuffleBody: (n) => `${n === 1 ? 'One event moves' : `${n} events move`} to another compatible resource, at the same time.`,
  overlapAlert: 'This event overlaps another event on the same resource.',
  noneFree: 'No resource is free at that time.',
  noneCompatibleFree: 'No compatible resource is free at that time.',
  incompatible: (t) => `${t} cannot host this event.`,
  tooLarge: (t) => `The size does not fit ${t}.`,
  swapErrors: {
    COMPAT_MISMATCH: 'Those resources are not compatible.',
    PINNED: 'A pinned event cannot be swapped.',
    NOT_EDITABLE: 'That event cannot be moved.',
    CAPACITY: 'An event does not fit the other resource.',
    OVERLAP: 'The swap would overlap another event.'
  }
};

export function resolveLabels(overrides?: LabelOverrides): CalendarLabels {
  return { ...DEFAULT_LABELS, ...overrides, swapErrors: { ...DEFAULT_LABELS.swapErrors, ...overrides?.swapErrors } };
}
