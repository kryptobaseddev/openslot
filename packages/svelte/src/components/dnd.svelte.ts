/**
 * Pointer drag and drop for every view (mouse, pen and touch).
 *
 * Views mark drop lanes with data attributes: `data-lane`, `data-date`,
 * optional `data-resource`, `data-axis` ('y' time grid, 'x' timeline, 'day'
 * month cell: keeps the time), `data-origin-min` (wall-clock minute at the
 * lane's start edge) and `data-ppm` (pixels per minute). Events carry
 * `data-event-id`. Mouse drags start after 5px; touch drags start after a
 * 300ms long press, so a plain swipe still scrolls.
 */
import { type CalendarEvent, snap, minutesBetween, zonedParts, zonedToIso } from '@openslot/core';
import type { EventTemplate } from './types.js';

export type DragKind = 'move' | 'resize-start' | 'resize-end' | 'create' | 'template';

export interface DragPreview {
  date: string;
  resourceId?: string;
  start: string;
  end: string;
  /** Dropping now swaps with this event */
  swapWith?: string;
}

interface Lane {
  date: string;
  resourceId?: string;
  axis: 'x' | 'y' | 'day';
  minutes: number;
}

export interface DropResult {
  kind: DragKind;
  eventId?: string;
  template?: EventTemplate;
  preview: DragPreview;
}

export interface DndOptions {
  timeZone: () => string;
  snapMin: () => number;
  minDurationMin?: () => number;
  editable: () => boolean;
  onDrop: (result: DropResult) => void;
  onTap: (eventId: string) => void;
  /** Tap (no drag) on an empty lane spot */
  onLaneTap?: (lane: { date: string; resourceId?: string; minutes: number }) => void;
}

const LONG_PRESS_MS = 300;
/** A mouse or pen drag starts after the pointer moves 5px; a click stays a click. */
const MOUSE_SLOP = 5;
const TOUCH_SLOP = 8;

function laneAt(x: number, y: number): Lane | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLElement) || el.dataset.lane === undefined) continue;
    const rect = el.getBoundingClientRect();
    const axis = (el.dataset.axis as Lane['axis']) ?? 'y';
    const ppm = Number(el.dataset.ppm ?? 1);
    const origin = Number(el.dataset.originMin ?? 0);
    const offset = axis === 'x' ? x - rect.left : y - rect.top;
    return {
      date: el.dataset.date!,
      resourceId: el.dataset.resource || undefined,
      axis,
      minutes: axis === 'day' ? 0 : origin + offset / ppm
    };
  }
  return null;
}

function eventAt(x: number, y: number, except?: string): string | undefined {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.ghost !== undefined) continue;
    const id = el.closest<HTMLElement>('[data-event-id]')?.dataset.eventId;
    if (id && id !== except) return id;
  }
  return undefined;
}

export class DragController {
  preview = $state<DragPreview | null>(null);
  kind = $state<DragKind | null>(null);
  draggingId = $state<string | null>(null);

  #opts: DndOptions;
  #pointerId = -1;
  #x0 = 0;
  #y0 = 0;
  #active = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #event: CalendarEvent | undefined;
  #template: EventTemplate | undefined;
  #grabMin = 0;
  #anchor: Lane | null = null;
  #touch = false;

  constructor(opts: DndOptions) {
    this.#opts = opts;
  }

  get active(): boolean {
    return this.#active;
  }

  /** pointerdown on an event body or one of its resize handles. */
  startEvent(e: PointerEvent, event: CalendarEvent, kind: 'move' | 'resize-start' | 'resize-end' = 'move'): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.#begin(e, kind);
    this.#event = event;
    this.draggingId = null;
    const lane = laneAt(e.clientX, e.clientY);
    const start = zonedParts(event.start, this.#opts.timeZone()).minutes;
    this.#grabMin = lane && lane.axis !== 'day' ? lane.minutes - start : 0;
  }

  /** pointerdown on empty lane space: drag out a new event, or tap. */
  startLane(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.#begin(e, 'create');
    this.#anchor = laneAt(e.clientX, e.clientY);
  }

  /** pointerdown on a sidebar template. */
  startTemplate(e: PointerEvent, template: EventTemplate): void {
    if (e.button !== 0) return;
    this.#begin(e, 'template');
    this.#template = template;
  }

  cancel(): void {
    clearTimeout(this.#timer);
    this.#active = false;
    this.preview = null;
    this.kind = null;
    this.draggingId = null;
    this.#event = undefined;
    this.#template = undefined;
    this.#anchor = null;
    // onDestroy also runs during server rendering, where there is no window
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointermove', this.#move);
    window.removeEventListener('pointerup', this.#up);
    window.removeEventListener('pointercancel', this.#cancelEvt);
    window.removeEventListener('keydown', this.#key);
    window.removeEventListener('touchmove', this.#blockScroll);
  }

  #begin(e: PointerEvent, kind: DragKind): void {
    this.cancel();
    this.kind = kind;
    this.#pointerId = e.pointerId;
    this.#x0 = e.clientX;
    this.#y0 = e.clientY;
    this.#touch = e.pointerType === 'touch';
    window.addEventListener('pointermove', this.#move);
    window.addEventListener('pointerup', this.#up);
    window.addEventListener('pointercancel', this.#cancelEvt);
    window.addEventListener('keydown', this.#key);
    window.addEventListener('touchmove', this.#blockScroll, { passive: false });
    if (this.#touch) {
      this.#timer = setTimeout(() => {
        this.#activate();
        navigator.vibrate?.(10);
        this.#update(this.#x0, this.#y0);
      }, LONG_PRESS_MS);
    }
  }

  #activate(): void {
    if (this.kind !== 'create' && this.kind !== 'template' && !this.#opts.editable()) return;
    if (this.#event && this.#event.editable === false) return;
    this.#active = true;
    this.draggingId = this.#event?.id ?? null;
  }

  #blockScroll = (e: TouchEvent) => {
    if (this.#active) e.preventDefault();
  };

  #key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cancel();
  };

  #cancelEvt = () => this.cancel();

  #move = (e: PointerEvent) => {
    if (e.pointerId !== this.#pointerId) return;
    const dist = Math.hypot(e.clientX - this.#x0, e.clientY - this.#y0);
    if (!this.#active) {
      if (this.#touch) {
        // Moving before the long press means the user is scrolling
        if (dist > TOUCH_SLOP) this.cancel();
        return;
      }
      if (dist < MOUSE_SLOP) return;
      this.#activate();
      if (!this.#active) return;
    }
    this.#update(e.clientX, e.clientY);
  };

  #up = (e: PointerEvent) => {
    if (e.pointerId !== this.#pointerId) return;
    const wasActive = this.#active;
    const preview = this.preview;
    const kind = this.kind!;
    const event = this.#event;
    const template = this.#template;
    const anchor = this.#anchor;
    this.cancel();
    if (wasActive && preview) {
      this.#opts.onDrop({ kind, eventId: event?.id, template, preview });
    } else if (!wasActive && event && kind === 'move') {
      this.#opts.onTap(event.id);
    } else if (!wasActive && kind === 'create' && anchor && anchor.axis !== 'day') {
      this.#opts.onLaneTap?.({ date: anchor.date, resourceId: anchor.resourceId, minutes: snap(anchor.minutes, this.#opts.snapMin()) });
    }
  };

  #update(x: number, y: number): void {
    const tz = this.#opts.timeZone();
    const step = this.#opts.snapMin();
    const minDur = this.#opts.minDurationMin?.() ?? step;
    const lane = laneAt(x, y);
    const kind = this.kind;
    if (!kind) return;

    if (kind === 'move' && this.#event) {
      const ev = this.#event;
      const swapWith = eventAt(x, y, ev.id);
      if (!lane) return;
      const duration = minutesBetween(ev.start, ev.end);
      const startMin = lane.axis === 'day' ? zonedParts(ev.start, tz).minutes : snap(lane.minutes - this.#grabMin, step);
      const start = zonedToIso(lane.date, startMin, tz);
      const end = new Date(Date.parse(start) + duration * 60_000).toISOString();
      this.preview = { date: lane.date, resourceId: lane.resourceId ?? ev.resourceId, start, end, swapWith };
      return;
    }

    if ((kind === 'resize-end' || kind === 'resize-start') && this.#event) {
      const ev = this.#event;
      const own = zonedParts(ev.start, tz);
      if (!lane || lane.date !== own.date || lane.axis === 'day') return;
      const endMin = own.minutes + minutesBetween(ev.start, ev.end);
      const m = snap(lane.minutes, step);
      const start = kind === 'resize-start' ? zonedToIso(own.date, Math.min(m, endMin - minDur), tz) : ev.start;
      const end = kind === 'resize-end' ? zonedToIso(own.date, Math.max(m, own.minutes + minDur), tz) : ev.end;
      this.preview = { date: own.date, resourceId: ev.resourceId, start, end };
      return;
    }

    if (kind === 'create' && this.#anchor && lane) {
      const a = this.#anchor;
      if (a.axis === 'day') return;
      const lo = snap(Math.min(a.minutes, lane.minutes), step);
      const hi = Math.max(snap(Math.max(a.minutes, lane.minutes), step), lo + minDur);
      this.preview = { date: a.date, resourceId: a.resourceId, start: zonedToIso(a.date, lo, tz), end: zonedToIso(a.date, hi, tz) };
      return;
    }

    if (kind === 'template' && this.#template && lane) {
      const t = this.#template;
      const startMin = lane.axis === 'day' ? 0 : snap(lane.minutes, step);
      const start = zonedToIso(lane.date, startMin, tz);
      const end = new Date(Date.parse(start) + t.durationMin * 60_000).toISOString();
      this.preview = { date: lane.date, resourceId: lane.resourceId ?? t.resourceId, start, end };
    }
  }
}
