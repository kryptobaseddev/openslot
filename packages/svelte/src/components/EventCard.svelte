<script lang="ts">
  import type { CalendarEvent } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import { timeRange } from './format.js';

  interface Props {
    event: CalendarEvent;
    /** 'y' time grid (resize top/bottom), 'x' timeline (resize start/end), 'none' month/list */
    axis?: 'x' | 'y' | 'none';
    style?: string;
    compact?: boolean;
    /** Too small for a start handle: only the end edge resizes */
    short?: boolean;
    ghost?: boolean;
  }

  let { event, axis = 'y', style = '', compact = false, short = false, ghost = false }: Props = $props();
  const ctx = getCalendarContext();

  const cal = $derived(ctx.calendar(event.calendarId));
  const color = $derived(cal?.colorVar ? `var(${cal.colorVar})` : 'var(--osl-event)');
  const canEdit = $derived(ctx.editable && event.editable !== false);
  const when = $derived(timeRange(event.start, event.end, ctx.tz, ctx.locale));
  const conflict = $derived(ctx.conflicts.has(event.id));
  const dragging = $derived(ctx.dnd.draggingId === event.id);
  const swapTarget = $derived(ctx.dnd.preview?.swapWith === event.id);
  const shake = $derived(ctx.ctl.rejected.includes(event.id));
  const grabbed = $derived(ctx.keyboardId === event.id);
  const label = $derived(
    [event.title, when, cal?.label, ctx.resource(event.resourceId)?.title, event.pinned ? 'pinned' : '', conflict ? 'conflict' : '']
      .filter(Boolean)
      .join(', ')
  );

  function onkeydown(e: KeyboardEvent) {
    if (grabbed) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ctx.keyboardCommit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        ctx.keyboardCancel();
      } else if (ctx.keyboardNudge(event, e.key, e.shiftKey)) {
        e.preventDefault();
      }
      return;
    }
    if ((e.key === 'm' || e.key === 'M') && canEdit) {
      e.preventDefault();
      ctx.keyboardStart(event);
    }
  }

  function onclick(e: MouseEvent) {
    // Pointer taps are handled by the drag controller; this is Enter / Space
    if (e.detail === 0 && !grabbed) ctx.select(event);
  }
</script>

{#if ghost}
  <div class="osl-event osl-ghost" data-ghost style="{style}; --osl-c: {color}" aria-hidden="true">
    <span class="osl-event-time">{when}</span>
    <span class="osl-event-title">{event.title}</span>
  </div>
{:else}
  <button
    type="button"
    class="osl-event"
    class:osl-compact={compact}
    class:osl-dragging={dragging}
    class:osl-swap-target={swapTarget}
    class:osl-conflict={conflict}
    class:osl-shake={shake}
    class:osl-grabbed={grabbed}
    class:osl-readonly={!canEdit}
    data-event-id={event.id}
    data-calendar={event.calendarId}
    style="{style}; --osl-c: {color}"
    aria-label={label}
    aria-describedby={canEdit ? 'osl-move-help' : undefined}
    aria-pressed={grabbed ? 'true' : undefined}
    onpointerdown={(e) => ctx.dnd.startEvent(e, event, 'move')}
    {onclick}
    {onkeydown}
  >
    {#if ctx.eventContent}
      {@render ctx.eventContent(event)}
    {:else}
      <span class="osl-event-time">{when}</span>
      <span class="osl-event-title">
        {#if event.pinned}<svg class="osl-pin" viewBox="0 0 16 16" aria-hidden="true"
            ><path d="M10 1l5 5-2 1-3 3 1 4-1 1-3-3-4 4-1-1 4-4-3-3 1-1 4 1 3-3z" fill="currentColor" /></svg
          >{/if}
        {event.title}
      </span>
      {#if cal && !compact}<span class="osl-event-cal">{cal.label}</span>{/if}
      {#if conflict}<span class="osl-event-flag">Conflict</span>{/if}
    {/if}
    {#if canEdit && axis !== 'none' && !short}
      <span
        class="osl-handle osl-handle-start"
        class:osl-handle-x={axis === 'x'}
        aria-hidden="true"
        onpointerdown={(e) => ctx.dnd.startEvent(e, event, 'resize-start')}
      ></span>
    {/if}
    {#if canEdit && axis !== 'none'}
      <span
        class="osl-handle osl-handle-end"
        class:osl-handle-x={axis === 'x'}
        class:osl-handle-thin={short}
        aria-hidden="true"
        onpointerdown={(e) => ctx.dnd.startEvent(e, event, 'resize-end')}
      ></span>
    {/if}
  </button>
{/if}
