/**
 * @openslot/svelte: the Svelte 5 adapter of OpenSlot. It re-exports
 * @openslot/core, so one import gives the components and the scheduling math.
 *
 * Layout ideas follow the documented behaviour of FullCalendar (MIT) and
 * Schedule-X (MIT core); no premium code was used.
 */
export * from '@openslot/core';
export { default as VisuallyHidden } from './components/VisuallyHidden.svelte';

// Svelte components
export { default as Calendar } from './components/Calendar.svelte';
export { default as MiniMonth } from './components/MiniMonth.svelte';
export { CalendarController, UNDO_MS, type Toast } from './components/store.svelte.js';
export { DragController, type DragPreview, type DropResult } from './components/dnd.svelte.js';
export { titleFor, whenLabel, timeRange, dayLabel, VIEW_LABELS } from './components/format.js';
export { DEFAULT_LABELS, resolveLabels, type CalendarLabels, type LabelOverrides } from './components/labels.js';
export type {
  CalendarProps,
  ChangeKind,
  ChangeRequest,
  CompatOption,
  EventDraft,
  EventTemplate,
  StaffOptions
} from './components/types.js';
