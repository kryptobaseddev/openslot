<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { CalendarDef, CalendarResource } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import MiniMonth from './MiniMonth.svelte';
  import type { EventTemplate } from './types.js';

  interface Props {
    date: string;
    today: string;
    firstDay: number;
    calendars: CalendarDef[];
    resources: CalendarResource[];
    templates: EventTemplate[];
    hiddenCalendars: Set<string>;
    hiddenResources: Set<string>;
    marked: Set<string>;
    onpick: (date: string) => void;
    onadd: () => void;
    ontoggleCalendar: (id: string) => void;
    ontoggleResource: (id: string) => void;
    /** Click / Enter on a template: the single-pointer alternative to dragging it */
    onuseTemplate: (t: EventTemplate) => void;
    onclose: () => void;
    children?: Snippet;
  }

  let p: Props = $props();
  const ctx = getCalendarContext();
</script>

<aside class="osl-sidebar" aria-label="Calendar tools">
  <div class="osl-side-top">
    <button type="button" class="osl-btn osl-btn-primary osl-add" onclick={p.onadd}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" /></svg>
      Add event
    </button>
    <button type="button" class="osl-icon-btn" aria-label="Hide sidebar" onclick={p.onclose}>
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
  </div>

  <MiniMonth value={p.date} today={p.today} firstDay={p.firstDay} locale={ctx.locale} marked={p.marked} onpick={p.onpick} />

  {#if p.calendars.length > 0}
    <fieldset class="osl-side-group">
      <legend>Calendars</legend>
      {#each p.calendars as c (c.id)}
        <label class="osl-check">
          <input type="checkbox" checked={!p.hiddenCalendars.has(c.id)} onchange={() => p.ontoggleCalendar(c.id)} />
          <span class="osl-swatch" style="--osl-c: {c.colorVar ? `var(${c.colorVar})` : 'var(--osl-event)'}" aria-hidden="true"></span>
          {c.label}
        </label>
      {/each}
    </fieldset>
  {/if}

  {#if p.resources.length > 1}
    <fieldset class="osl-side-group">
      <legend>{ctx.labels.resources}</legend>
      {#each p.resources as r (r.id)}
        <label class="osl-check">
          <input type="checkbox" checked={!p.hiddenResources.has(r.id)} onchange={() => p.ontoggleResource(r.id)} />
          {r.title}
        </label>
      {/each}
    </fieldset>
  {/if}

  {#if p.templates.length > 0}
    <section class="osl-side-group" aria-labelledby="osl-create-h">
      <h3 id="osl-create-h">Create</h3>
      <p class="osl-hint">Drag onto the calendar, or select to use the next open time.</p>
      <ul class="osl-templates">
        {#each p.templates as t (t.id)}
          {@const cal = ctx.calendar(t.calendarId)}
          <li>
            <button
              type="button"
              class="osl-template"
              style="--osl-c: {cal?.colorVar ? `var(${cal.colorVar})` : 'var(--osl-event)'}"
              onpointerdown={(e) => ctx.dnd.startTemplate(e, t)}
              onclick={() => p.onuseTemplate(t)}
            >
              <span class="osl-template-grip" aria-hidden="true">⋮⋮</span>
              <span>{t.label}</span>
              <span class="osl-template-len">{t.durationMin} min</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {@render p.children?.()}
</aside>
