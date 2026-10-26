<script lang="ts">
  import { addDays, monthGridDays, startOfWeek } from '@openslot/core';
  import { dayLabel } from './format.js';

  interface Props {
    value: string;
    today: string;
    firstDay?: number;
    locale?: string;
    /** days that have events (a dot) */
    marked?: Set<string>;
    onpick: (date: string) => void;
  }

  let { value, today, firstDay = 0, locale, marked, onpick }: Props = $props();

  // Follows `value`; month navigation overrides it until the next pick
  let cursor = $derived(value);
  const days = $derived(monthGridDays(cursor, firstDay));
  const month = $derived(cursor.slice(0, 7));
  const title = $derived(dayLabel(`${month}-15`, locale, { month: 'long', year: 'numeric' }));
  const weekdays = $derived(days.slice(0, 7).map((d) => dayLabel(d, locale, { weekday: 'narrow' })));
  let grid: HTMLDivElement | undefined = $state();

  function shiftMonth(n: number, d = cursor) {
    const [y, m, day] = d.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return `${t.toISOString().slice(0, 8)}${String(Math.min(day, last)).padStart(2, '0')}`;
  }

  function move(next: string) {
    cursor = next;
    queueMicrotask(() => grid?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
  }

  function onkeydown(e: KeyboardEvent) {
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => shiftMonth(-1),
      PageDown: () => shiftMonth(1),
      Home: () => startOfWeek(cursor, firstDay),
      End: () => addDays(startOfWeek(cursor, firstDay), 6)
    };
    const f = keys[e.key];
    if (f) {
      e.preventDefault();
      move(f());
    }
  }
</script>

<div class="osl-mini">
  <div class="osl-mini-head">
    <button type="button" class="osl-icon-btn" aria-label="Previous month" onclick={() => (cursor = shiftMonth(-1))}>
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
    <span class="osl-mini-title" aria-live="polite">{title}</span>
    <button type="button" class="osl-icon-btn" aria-label="Next month" onclick={() => (cursor = shiftMonth(1))}>
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
  </div>
  <div class="osl-mini-grid" role="grid" aria-label={title} bind:this={grid} tabindex="-1" {onkeydown}>
    <div role="row" class="osl-mini-row">
      {#each weekdays as w, i (i)}<span role="columnheader" class="osl-mini-wd">{w}</span>{/each}
    </div>
    {#each [0, 1, 2, 3, 4, 5] as week (week)}
      <div role="row" class="osl-mini-row">
        {#each days.slice(week * 7, week * 7 + 7) as d (d)}
          <span role="gridcell" aria-selected={d === value}>
            <button
              type="button"
              class="osl-mini-day"
              class:osl-other-month={d.slice(0, 7) !== month}
              class:osl-today={d === today}
              class:osl-selected={d === value}
              class:osl-marked={marked?.has(d)}
              data-day={d}
              tabindex={d === cursor ? 0 : -1}
              aria-label={dayLabel(d, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-current={d === today ? 'date' : undefined}
              onclick={() => onpick(d)}>{Number(d.slice(8))}</button
            >
          </span>
        {/each}
      </div>
    {/each}
  </div>
</div>
