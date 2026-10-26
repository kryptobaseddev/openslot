<script lang="ts">
  import { type CalendarEvent, type CalendarResource, type DayHours, layoutDay, formatTime, todayIn, zonedParts } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import EventCard from './EventCard.svelte';
  import CoverageBadge from './CoverageBadge.svelte';
  import { dayLabel } from './format.js';

  interface Props {
    days: string[];
    /** Resource columns per day; empty for a plain day/week grid */
    resources: CalendarResource[];
    events: CalendarEvent[];
    ghost: CalendarEvent | null;
    startMin: number;
    endMin: number;
    ppm: number;
    hoursFor: (date: string) => DayHours;
  }

  let { days, resources, events, ghost, startMin, endMin, ppm, hoursFor }: Props = $props();
  const ctx = getCalendarContext();

  type Lane = { key: string; date: string; resource?: CalendarResource };
  const lanes = $derived<Lane[]>(
    days.flatMap((date) =>
      resources.length === 0 ? [{ key: date, date }] : resources.map((r) => ({ key: `${date}|${r.id}`, date, resource: r }))
    )
  );
  const height = $derived((endMin - startMin) * ppm);
  const today = $derived(todayIn(ctx.tz, ctx.now));
  const nowMin = $derived(zonedParts(ctx.now, ctx.tz).minutes);
  const hourMarks = $derived.by(() => {
    const out: number[] = [];
    for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) out.push(m);
    return out;
  });

  // Events per lane with their overlap layout, computed once per render
  const placed = $derived.by(() => {
    const byLane = new Map<string, Array<{ event: CalendarEvent; s: number; e: number }>>();
    for (const event of events) {
      const p = zonedParts(event.start, ctx.tz);
      const dur = (Date.parse(event.end) - Date.parse(event.start)) / 60_000;
      const key = resources.length === 0 ? p.date : `${p.date}|${event.resourceId}`;
      if (!byLane.has(key)) byLane.set(key, []);
      byLane.get(key)!.push({ event, s: p.minutes, e: p.minutes + dur });
    }
    const out = new Map<string, Array<{ event: CalendarEvent; style: string; short: boolean }>>();
    for (const [key, items] of byLane) {
      const layout = new Map(layoutDay(items.map((i) => ({ id: i.event.id, startMin: i.s, endMin: i.e }))).map((p) => [p.id, p]));
      out.set(
        key,
        items.map((i) => {
          const l = layout.get(i.event.id)!;
          const top = Math.max(0, (i.s - startMin) * ppm);
          const bottom = Math.min(height, (i.e - startMin) * ppm);
          const h = Math.max(22, bottom - top);
          return {
            event: i.event,
            style: `top:${top}px;height:${h}px;left:${(l.col / l.cols) * 100}%;width:${(l.span / l.cols) * 100}%`,
            // Too short for two lines: one row (title first) and a single resize handle
            short: h < 40
          };
        })
      );
    }
    return out;
  });

  const ghostStyle = $derived.by(() => {
    if (!ghost) return '';
    const p = zonedParts(ghost.start, ctx.tz);
    const dur = (Date.parse(ghost.end) - Date.parse(ghost.start)) / 60_000;
    return `top:${(p.minutes - startMin) * ppm}px;height:${Math.max(22, dur * ppm)}px;left:0;width:100%`;
  });
  const ghostLane = $derived(
    ghost
      ? resources.length === 0
        ? zonedParts(ghost.start, ctx.tz).date
        : `${zonedParts(ghost.start, ctx.tz).date}|${ghost.resourceId}`
      : null
  );

  function closedBands(date: string): Array<{ top: number; height: number }> {
    const h = hoursFor(date);
    if (!h) return [{ top: 0, height }];
    const bands = [];
    if (h.open > startMin) bands.push({ top: 0, height: (h.open - startMin) * ppm });
    if (h.close < endMin) bands.push({ top: (h.close - startMin) * ppm, height: (endMin - h.close) * ppm });
    return bands;
  }
</script>

<div
  class="osl-grid"
  class:osl-grid-resources={resources.length > 0}
  style="--osl-lanes:{lanes.length};--osl-slot:{ctx.slotMin * ppm}px;--osl-hour:{60 * ppm}px"
>
  <div class="osl-grid-head" role="row">
    <div class="osl-axis-head" aria-hidden="true"></div>
    {#each lanes as lane, i (lane.key)}
      <div class="osl-lane-head" class:osl-today={lane.date === today} role="columnheader">
        {#if resources.length === 0 || (days.length > 1 && i % resources.length === 0)}
          <button type="button" class="osl-day-link" onclick={() => ctx.openDay(lane.date)}>
            {dayLabel(lane.date, ctx.locale, { weekday: 'short', day: 'numeric' })}
          </button>
        {/if}
        {#if resources.length === 0 || i % resources.length === 0}<CoverageBadge date={lane.date} />{/if}
        {#if lane.resource}<span class="osl-lane-resource">{lane.resource.title}</span>{/if}
      </div>
    {/each}
  </div>

  <div class="osl-grid-body">
    <div class="osl-axis" style="height:{height}px" aria-hidden="true">
      {#each hourMarks as m (m)}
        <span class="osl-hour-label" style="top:{(m - startMin) * ppm}px">{formatTime(m, ctx.locale)}</span>
      {/each}
    </div>
    {#each lanes as lane (lane.key)}
      <div
        class="osl-lane"
        style="height:{height}px"
        class:osl-today={lane.date === today}
        class:osl-day-start={resources.length > 0 && lane.resource === resources[0]}
        data-lane
        data-date={lane.date}
        data-resource={lane.resource?.id ?? ''}
        data-axis="y"
        data-origin-min={startMin}
        data-ppm={ppm}
        aria-label="{dayLabel(lane.date, ctx.locale)}{lane.resource ? `, ${lane.resource.title}` : ''}"
        role="group"
        onpointerdown={(e) => ctx.dnd.startLane(e)}
      >
        {#each closedBands(lane.date) as band, b (b)}
          <div class="osl-closed" style="top:{band.top}px;height:{band.height}px" aria-hidden="true"></div>
        {/each}
        {#each placed.get(lane.key) ?? [] as item (item.event.id)}
          <EventCard event={item.event} style={item.style} compact={item.short} short={item.short} />
        {/each}
        {#if ghost && ghostLane === lane.key}
          <EventCard event={ghost} style={ghostStyle} ghost />
        {/if}
        {#if lane.date === today && nowMin >= startMin && nowMin <= endMin}
          <div class="osl-now" style="top:{(nowMin - startMin) * ppm}px" aria-hidden="true"></div>
        {/if}
      </div>
    {/each}
  </div>
</div>
