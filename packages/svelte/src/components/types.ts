import type { Snippet } from 'svelte';
import type { LabelOverrides } from './labels.js';
import type { CalendarDef, CalendarEvent, CalendarResource, EventChange, HoursFn, ViewKind, StaffSpan } from '@openslot/core';

/** A draggable "create" template in the sidebar (e.g. "Consultation, 60 min"). */
export interface EventTemplate {
  id: string;
  label: string;
  durationMin: number;
  calendarId?: string;
  compatKey?: string;
  /** Prefer this resource when the template is dropped on a time-only view */
  resourceId?: string;
}

/** A new event the user asked for (click, drag on the grid, a template, the assistant). */
export interface EventDraft {
  start: string;
  end: string;
  resourceId?: string;
  template?: EventTemplate;
}

export type ChangeKind = 'move' | 'resize' | 'swap' | 'reseat' | 'undo';

/** What the host must persist. Reject (throw) to roll the calendar back. */
export interface ChangeRequest {
  kind: ChangeKind;
  changes: EventChange[];
  /** Human sentence for toasts and screen readers, e.g. "Moved Rivera to 7:30 PM" */
  label: string;
}

export interface StaffOptions {
  /** Shift and time-off spans of the people who can staff an event */
  spans: StaffSpan[];
  /** Staff one event needs (default 1) */
  perBooking?: number;
  /** Badge noun, singular and plural (default staff, staff) */
  noun?: [string, string];
}

export interface CompatOption {
  value: string;
  label: string;
}

export interface CalendarProps {
  events: CalendarEvent[];
  resources?: CalendarResource[];
  calendars?: CalendarDef[];
  /** IANA zone every day boundary and wall-clock time is shown in */
  timeZone: string;
  view?: ViewKind;
  /** Local day 'YYYY-MM-DD' in `timeZone` */
  date?: string;
  /** Opening hours per local day; the grid shows the widest open span of the visible days */
  hours?: HoursFn;
  /** Grid bounds when no hours are known (minutes from midnight) */
  dayStartMin?: number;
  dayEndMin?: number;
  slotMin?: number;
  snapMin?: number;
  firstDay?: number;
  locale?: string;
  editable?: boolean;
  bufferMin?: number;
  templates?: EventTemplate[];
  compatOptions?: CompatOption[];
  /** Views offered in the view switcher (phones always get list and day) */
  views?: ViewKind[];
  /** Width (px) below which the phone layout is used */
  compactBelow?: number;
  sidebarOpen?: boolean;
  /** Phone "new event" button; false when the host renders its own (e.g. a no-JS link) */
  fab?: boolean;
  /** "Now" for the current-time line and the assistant (tests pin it) */
  now?: Date;
  /**
   * Staffing: the assistant only offers slots with free staff, and each day
   * shows a coverage badge. Omit when shifts are not recorded.
   */
  staff?: StaffOptions;
  /** Domain words and messages (defaults are neutral: resource, event) */
  labels?: LabelOverrides;
  onchange?: (request: ChangeRequest) => Promise<void> | void;
  oncreate?: (draft: EventDraft) => void;
  onselect?: (event: CalendarEvent) => void;
  onrangechange?: (range: { from: string; to: string; view: ViewKind }) => void;
  /** Event body; default: time, title and calendar label */
  eventContent?: Snippet<[CalendarEvent]>;
  /** Extra buttons in the event modal (edit, check in, ...) */
  eventActions?: Snippet<[CalendarEvent, () => void]>;
  /** Extra body in the event modal */
  eventDetails?: Snippet<[CalendarEvent]>;
}

export type { CalendarDef, CalendarEvent, CalendarResource, EventChange, HoursFn, ViewKind };
