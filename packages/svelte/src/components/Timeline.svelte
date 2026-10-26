<script lang="ts">
  import { type CalendarEvent, type CalendarResource, type DayHours, layoutDay, formatTime, todayIn, zonedParts } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import EventCard from './EventCard.svelte';
  import { dayLabel } from './format.js';
  import CoverageBadge from './CoverageBadge.svelte';

  interface Props {
    days: string[];
    resources: CalendarResource[];
    events: CalendarEvent[];
    ghost: CalendarEvent | null;
    startMin: number;
    endMin: number;
    /** pixels per minute along the time axis */
    ppm: number;
    hoursFor: (date: string) => DayHours;
  }

  let { days, resources, events, ghost, startMin, endMin, ppm, hoursFor }: Props = $props();
  const ctx = getCalendarContext();

  const width = $derived((endMin - startMin) * ppm);
  const today = $derived(todayIn(ctx.tz, ctx.now));
  const nowMin = $derived(zonedParts(ctx.now, ctx.tz).minutes);
  const marks = $derived.by(() => {
    const out: number[] = [];
    for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) out.push(m);
    return out;
  });

  const placed = $derived.by(() => {
    const byLane = new Map<string, Array<{ event: CalendarEvent; s: number; e: number }>>();
    for (const event of events) {
      const p = zonedParts(event.start, ctx.tz);
      const key = `${p.date}|${event.resourceId}`;
      if (!byLane.has(key)) byLane.set(key, []);
      byLane.get(key)!.push({ event, s: p.minutes, e: p.minutes + (Date.parse(event.end) - Date.parse(event.start)) / 60_000 });
    }
    const out = new Map<string, Array<{ event: CalendarEvent; style: string }>>();
    for (const [key, items] of byLane) {
      const layout = new Map(layoutDay(items.map((i) => ({ id: i.event.id, startMin: i.s, endMin: i.e }))).map((p) => [p.id, p]));
      out.set(
        key,
        items.map((i) => {
          const l = layout.get(i.event.id)!;
          const left = Math.max(0, (i.s - startMin) * ppm);
          const right = Math.min(width, (i.e - startMin) * ppm);
          return {
            event: i.event,
            style: `left:${left}px;width:${Math.max(24, right - left)}px;top:${(l.col / l.cols) * 100}%;height:${(l.span / l.cols) * 100}%`
          };
        })
      );
    }
    return out;
  });

  const ghostKey = $derived(ghost ? `${zonedParts(ghost.start, ctx.tz).date}|${ghost.resourceId}` : null);
  const ghostStyle = $derived.by(() => {
    if (!ghost) return '';
    const p = zonedParts(ghost.start, ctx.tz);
    const dur = (Date.parse(ghost.end) - Date.parse(ghost.start)) / 60_000;
    return `left:${(p.minutes - startMin) * ppm}px;width:${Math.max(24, dur * ppm)}px;top:0;height:100%`;
  });

  function closed(date: string): Array<{ left: number; width: number }> {
    const h = hoursFor(date);
    if (!h) return [{ left: 0, width }];
    const out = [];
    if (h.open > startMin) out.push({ left: 0, width: (h.open - startMin) * ppm });
    if (h.close < endMin) out.push({ left: (h.close - startMin) * ppm, width: (endMin - h.close) * ppm });
    return out;
  }
</script>

<div class="osl-timeline" style="--osl-day-w:{width}px;--osl-days:{days.length};--osl-hour-w:{60 * ppm}px">
  <div class="osl-tl-head" role="row">
    <div class="osl-tl-corner" aria-hidden="true"></div>
    {#each days as date (date)}
      <div class="osl-tl-day" class:osl-today={date === today} role="columnheader">
        {#if days.length > 1}
          <button type="button" class="osl-day-link" onclick={() => ctx.openDay(date)}>{dayLabel(date, ctx.locale)}</button>
        {/if}
        <CoverageBadge {date} />
        <div class="osl-tl-hours" aria-hidden="true">
          {#each marks as m (m)}<span style="left:{(m - startMin) * ppm}px">{formatTime(m, ctx.locale)}</span>{/each}
        </div>
      </div>
    {/each}
  </div>
  {#each resources as r (r.id)}
    <div class="osl-tl-row" role="row">
      <div class="osl-tl-label" role="rowheader">{r.title}</div>
      {#each days as date (date)}
        {@const key = `${date}|${r.id}`}
        <div
          class="osl-tl-lane"
          data-lane
          data-date={date}
          data-resource={r.id}
          data-axis="x"
          data-origin-min={startMin}
          data-ppm={ppm}
          role="group"
          aria-label="{r.title}, {dayLabel(date, ctx.locale)}"
          onpointerdown={(e) => ctx.dnd.startLane(e)}
        >
          {#each closed(date) as band, b (b)}
            <div class="osl-closed" style="left:{band.left}px;width:{band.width}px;top:0;bottom:0" aria-hidden="true"></div>
          {/each}
          {#each placed.get(key) ?? [] as item (item.event.id)}
            <EventCard event={item.event} style={item.style} axis="x" compact />
          {/each}
          {#if ghost && ghostKey === key}<EventCard event={ghost} style={ghostStyle} axis="x" ghost />{/if}
          {#if date === today && nowMin >= startMin && nowMin <= endMin}
            <div class="osl-now osl-now-x" style="left:{(nowMin - startMin) * ppm}px" aria-hidden="true"></div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>
