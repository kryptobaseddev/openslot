<script lang="ts">
  import { untrack } from 'svelte';
  import type { OpenSlot } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import { whenLabel } from './format.js';
  import type { CompatOption } from './types.js';

  interface Props {
    compatOptions: CompatOption[];
    durations: number[];
    search: (q: { durationMin: number; size?: number; compatKey?: string }) => OpenSlot[];
    onpick: (slot: OpenSlot) => void;
  }

  let { compatOptions, durations, search, onpick }: Props = $props();
  const ctx = getCalendarContext();

  let duration = $state(untrack(() => durations[0] ?? 60));
  let size = $state<number | undefined>(undefined);
  let compat = $state('');
  let results = $state<OpenSlot[] | null>(null);
  const uid = $props.id();

  function find(e: SubmitEvent) {
    e.preventDefault();
    results = search({ durationMin: duration, size: size || undefined, compatKey: compat || undefined });
  }
</script>

<details class="osl-side-group osl-assistant">
  <summary>Find a time</summary>
  <form onsubmit={find} class="osl-assist-form">
    {#if compatOptions.length > 0}
      <label for="{uid}-c">{ctx.labels.compat}</label>
      <select id="{uid}-c" class="osl-input" bind:value={compat}>
        <option value="">Any</option>
        {#each compatOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
      </select>
    {/if}
    <label for="{uid}-d">Length</label>
    <select id="{uid}-d" class="osl-input" bind:value={duration}>
      {#each durations as d (d)}<option value={d}>{d} min</option>{/each}
    </select>
    <label for="{uid}-s">{ctx.labels.size}</label>
    <input id="{uid}-s" class="osl-input" type="number" inputmode="numeric" min="1" max="99" bind:value={size} />
    <button type="submit" class="osl-btn">Find open times</button>
  </form>
  {#if results}
    <div aria-live="polite">
      {#if results.length === 0}
        <p class="osl-empty">No open time in the next two weeks.</p>
      {:else}
        <ul class="osl-assist-results">
          {#each results as slot (slot.resourceId + slot.start)}
            <li>
              <button type="button" class="osl-slot" onclick={() => onpick(slot)}>
                <span>{whenLabel(slot.start, slot.end, ctx.tz, ctx.locale)}</span>
                <span class="osl-slot-resource">{ctx.resource(slot.resourceId)?.title ?? ''}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</details>
