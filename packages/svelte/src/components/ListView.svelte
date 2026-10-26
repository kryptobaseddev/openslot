<script lang="ts">
  import { type CalendarEvent, type CalendarResource, todayIn, zonedParts } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import { dayLabel, timeRange } from './format.js';
  import CoverageBadge from './CoverageBadge.svelte';

  interface Props {
    days: string[];
    events: CalendarEvent[];
    resources: CalendarResource[];
    /** Group each day's events under resource headings (phone agenda) */
    groupByResource?: boolean;
    /** Swipe left / right on phones */
    onswipe?: (dir: 1 | -1) => void;
    emptyLabel?: string;
  }

  const ctx = getCalendarContext();
  let { days, events, resources, groupByResource = false, onswipe, emptyLabel = ctx.labels.empty }: Props = $props();
  const today = $derived(todayIn(ctx.tz, ctx.now));

  const byDay = $derived.by(() => {
    const map = new Map<string, CalendarEvent[]>(days.map((d) => [d, []]));
    for (const e of [...events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
      map.get(zonedParts(e.start, ctx.tz).date)?.push(e);
    }
    return map;
  });

  function groups(list: CalendarEvent[]): Array<{ resource?: CalendarResource; events: CalendarEvent[] }> {
    if (!groupByResource) return [{ events: list }];
    return resources.map((r) => ({ resource: r, events: list.filter((e) => e.resourceId === r.id) })).filter((g) => g.events.length > 0);
  }

  let x0 = 0;
  let y0 = 0;
  function down(e: PointerEvent) {
    x0 = e.clientX;
    y0 = e.clientY;
  }
  function up(e: PointerEvent) {
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (onswipe && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onswipe(dx < 0 ? 1 : -1);
  }
</script>

<div class="osl-list" onpointerdown={down} onpointerup={up} role="list">
  {#each days as day (day)}
    {@const list = byDay.get(day) ?? []}
    {#if list.length > 0 || days.length === 1}
      <section class="osl-list-day" role="listitem" aria-labelledby="osl-ld-{day}">
        <h3 class="osl-list-date" class:osl-today={day === today} id="osl-ld-{day}">
          {dayLabel(day, ctx.locale, { weekday: 'long', month: 'short', day: 'numeric' })}
          <CoverageBadge date={day} />
        </h3>
        {#if list.length === 0}
          <p class="osl-empty">{emptyLabel}</p>
        {/if}
        {#each groups(list) as g, gi (g.resource?.id ?? gi)}
          {#if g.resource}<h4 class="osl-list-resource">{g.resource.title}</h4>{/if}
          <ul class="osl-list-items">
            {#each g.events as ev (ev.id)}
              {@const cal = ctx.calendar(ev.calendarId)}
              <li>
                <button
                  type="button"
                  class="osl-list-row"
                  class:osl-conflict={ctx.conflicts.has(ev.id)}
                  data-event-id={ev.id}
                  style="--osl-c: {cal?.colorVar ? `var(${cal.colorVar})` : 'var(--osl-event)'}"
                  onclick={() => ctx.select(ev)}
                >
                  <span class="osl-list-time">{timeRange(ev.start, ev.end, ctx.tz, ctx.locale)}</span>
                  <span class="osl-list-title">{ev.title}</span>
                  <span class="osl-list-meta">
                    {#if cal}<span class="osl-chip">{cal.label}</span>{/if}
                    {#if !groupByResource && ctx.resource(ev.resourceId)}<span>{ctx.resource(ev.resourceId)?.title}</span>{/if}
                    {#if ev.pinned}<span>Pinned</span>{/if}
                    {#if ctx.conflicts.has(ev.id)}<span class="osl-event-flag">Conflict</span>{/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/each}
      </section>
    {/if}
  {/each}
  {#if days.length > 1 && events.length === 0}
    <p class="osl-empty">{emptyLabel}</p>
  {/if}
</div>
