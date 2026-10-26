<script lang="ts">
  import { type CalendarEvent, layoutMonthWeek, todayIn, zonedParts } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import EventCard from './EventCard.svelte';
  import { dayLabel } from './format.js';
  import CoverageBadge from './CoverageBadge.svelte';

  interface Props {
    days: string[];
    /** Any day of the month shown (days outside it are dimmed) */
    date: string;
    events: CalendarEvent[];
    ghost: CalendarEvent | null;
    maxPerDay?: number;
  }

  let { days, date, events, ghost, maxPerDay = 4 }: Props = $props();
  const ctx = getCalendarContext();

  const today = $derived(todayIn(ctx.tz, ctx.now));
  const month = $derived(date.slice(0, 7));
  const cells = $derived(
    layoutMonthWeek(
      events.map((e) => ({ ...e, date: zonedParts(e.start, ctx.tz).date })).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
      days,
      maxPerDay
    )
  );
  const ghostDate = $derived(ghost ? zonedParts(ghost.start, ctx.tz).date : null);
  const weekdays = $derived(days.slice(0, 7).map((d) => dayLabel(d, ctx.locale, { weekday: 'short' })));
</script>

<div class="osl-month" role="grid" aria-label="Month">
  <div class="osl-month-head" role="row">
    {#each weekdays as w (w)}<div role="columnheader" class="osl-month-wd">{w}</div>{/each}
  </div>
  {#each [0, 1, 2, 3, 4, 5] as week (week)}
    <div class="osl-month-row" role="row">
      {#each days.slice(week * 7, week * 7 + 7) as day (day)}
        {@const cell = cells.get(day)}
        <div
          class="osl-month-cell"
          class:osl-other-month={day.slice(0, 7) !== month}
          class:osl-today={day === today}
          role="gridcell"
          data-lane
          data-date={day}
          data-axis="day"
        >
          <button
            type="button"
            class="osl-month-num"
            aria-label={dayLabel(day, ctx.locale, { weekday: 'long', month: 'long', day: 'numeric' })}
            onclick={() => ctx.openDay(day)}>{Number(day.slice(8))}</button
          >
          <CoverageBadge date={day} />
          {#each cell?.visible ?? [] as ev (ev.id)}
            <EventCard event={ev} axis="none" compact />
          {/each}
          {#if ghost && ghostDate === day}<EventCard event={ghost} axis="none" compact ghost />{/if}
          {#if cell && cell.more > 0}
            <button type="button" class="osl-more" onclick={() => ctx.openDay(day)}>+{cell.more} more</button>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>
