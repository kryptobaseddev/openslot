import { getContext, setContext, type Snippet } from 'svelte';
import type { CalendarDef, CalendarEvent, CalendarResource, DayCoverage } from '@openslot/core';
import type { DragController } from './dnd.svelte.js';
import type { CalendarLabels } from './labels.js';
import type { CalendarController } from './store.svelte.js';

export interface CalendarContext {
  readonly tz: string;
  readonly locale: string | undefined;
  readonly snapMin: number;
  readonly slotMin: number;
  readonly editable: boolean;
  readonly now: Date;
  readonly compact: boolean;
  readonly resources: CalendarResource[];
  readonly labels: CalendarLabels;
  readonly dnd: DragController;
  readonly ctl: CalendarController;
  readonly eventContent: Snippet<[CalendarEvent]> | undefined;
  /** Events whose start or end overlaps another event of the same resource */
  readonly conflicts: Set<string>;
  /** Staff coverage of a visible day; undefined when staffing is not modelled */
  coverage(date: string): DayCoverage | undefined;
  calendar(id: string | undefined): CalendarDef | undefined;
  resource(id: string | undefined): CalendarResource | undefined;
  select(event: CalendarEvent): void;
  /** Keyboard move mode (WCAG 2.5.7 single-pointer and keyboard alternative to dragging) */
  keyboardStart(event: CalendarEvent): void;
  keyboardNudge(event: CalendarEvent, key: string, shift: boolean): boolean;
  keyboardCommit(): void;
  keyboardCancel(): void;
  readonly keyboardId: string | null;
  openDay(date: string): void;
}

const KEY = Symbol('openslot');

export const setCalendarContext = (ctx: CalendarContext) => setContext(KEY, ctx);
export const getCalendarContext = () => getContext<CalendarContext>(KEY);
