<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { OpenSlot, CalendarEvent } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import { whenLabel } from './format.js';

  interface Props {
    event: CalendarEvent | null;
    onclose: () => void;
    /** Next open times for this event (same compatKey, fits the size); empty when none */
    findTimes: (event: CalendarEvent) => OpenSlot[];
    onmoveTo: (event: CalendarEvent, slot: OpenSlot) => void;
    onresolve: (event: CalendarEvent) => void;
    actions?: Snippet<[CalendarEvent, () => void]>;
    details?: Snippet<[CalendarEvent]>;
  }

  let { event, onclose, findTimes, onmoveTo, onresolve, actions, details }: Props = $props();
  const ctx = getCalendarContext();
  let dialog: HTMLDialogElement | undefined = $state();
  let slots = $state<OpenSlot[] | null>(null);
  const uid = $props.id();

  $effect(() => {
    if (!dialog) return;
    if (event && !dialog.open) {
      slots = null;
      dialog.showModal();
    } else if (!event && dialog.open) dialog.close();
  });

  // The content renders the last opened event, so a host action that closes the
  // modal (Edit: close, then open a form) never re-renders its snippets with null.
  let lastEvent: CalendarEvent | null = null;
  const shown = $derived.by(() => {
    if (event) lastEvent = event;
    return event ?? lastEvent;
  });
  const cal = $derived(shown ? ctx.calendar(shown.calendarId) : undefined);
  const canEdit = $derived(!!shown && ctx.editable && shown.editable !== false);
  const close = () => onclose();
</script>

<dialog
  bind:this={dialog}
  class="osl-modal"
  aria-labelledby="{uid}-t"
  onclose={close}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  {#if shown}
    <div class="osl-modal-body">
      <span class="osl-sheet-grip" aria-hidden="true"></span>
      <header class="osl-modal-head">
        <span class="osl-swatch" style="--osl-c: {cal?.colorVar ? `var(${cal.colorVar})` : 'var(--osl-event)'}" aria-hidden="true"></span>
        <h2 id="{uid}-t">{shown.title}</h2>
        <button type="button" class="osl-icon-btn" aria-label="Close" onclick={close}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="2" /></svg>
        </button>
      </header>
      <dl class="osl-modal-facts">
        <dt>When</dt>
        <dd>{whenLabel(shown.start, shown.end, ctx.tz, ctx.locale)}</dd>
        {#if ctx.resource(shown.resourceId)}
          <dt>{ctx.labels.resource}</dt>
          <dd>{ctx.resource(shown.resourceId)?.title}</dd>
        {/if}
        {#if cal}
          <dt>Status</dt>
          <dd>{cal.label}</dd>
        {/if}
        {#if shown.size}
          <dt>{ctx.labels.size}</dt>
          <dd>{shown.size}</dd>
        {/if}
      </dl>
      {#if ctx.conflicts.has(shown.id)}
        <p class="osl-alert" role="alert">{ctx.labels.overlapAlert}</p>
      {/if}
      {@render details?.(shown)}

      {#if slots}
        <section aria-live="polite" class="osl-modal-slots">
          <h3>Open times</h3>
          {#if slots.length === 0}
            <p class="osl-empty">No open time in the next two weeks.</p>
          {:else}
            <ul class="osl-assist-results">
              {#each slots as s (s.resourceId + s.start)}
                <li>
                  <button type="button" class="osl-slot" onclick={() => onmoveTo(shown, s)}>
                    <span>{whenLabel(s.start, s.end, ctx.tz, ctx.locale)}</span>
                    <span class="osl-slot-resource">{ctx.resource(s.resourceId)?.title ?? ''}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}

      <div class="osl-modal-actions">
        {@render actions?.(shown, close)}
        {#if canEdit}
          <button type="button" class="osl-btn" onclick={() => (slots = findTimes(shown))}>Find another time</button>
          {#if ctx.conflicts.has(shown.id)}
            <button type="button" class="osl-btn" onclick={() => onresolve(shown)}>Resolve conflict</button>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</dialog>
