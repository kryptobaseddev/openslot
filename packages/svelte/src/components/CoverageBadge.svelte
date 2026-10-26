<script lang="ts">
  import { getCalendarContext } from './context.js';

  let { date }: { date: string } = $props();
  const ctx = getCalendarContext();
  const c = $derived(ctx.coverage(date));
</script>

{#if c}
  <span class="osl-cov osl-cov-{c.tone}" data-coverage={c.tone}>
    <span class="osl-sr">Staff coverage: </span>{c.label}{#if c.tone === 'gap'}<span class="osl-sr">
        ({c.gapMin} minutes with nobody on shift)</span
      >{/if}
  </span>
{/if}
