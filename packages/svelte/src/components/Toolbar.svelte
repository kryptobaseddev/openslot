<script lang="ts">
  import type { ViewKind } from '@openslot/core';
  import { VIEW_LABELS } from './format.js';

  interface Props {
    title: string;
    view: ViewKind;
    views: ViewKind[];
    date: string;
    sidebarOpen: boolean;
    canUndo: boolean;
    onview: (v: ViewKind) => void;
    ondate: (d: string) => void;
    onstep: (dir: -1 | 1) => void;
    ontoday: () => void;
    ontoggleSidebar: () => void;
    onundo: () => void;
  }

  let p: Props = $props();
  const uid = $props.id();
</script>

<div class="osl-toolbar" role="toolbar" aria-label="Calendar navigation">
  <button
    type="button"
    class="osl-icon-btn"
    aria-label={p.sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
    aria-expanded={p.sidebarOpen}
    onclick={p.ontoggleSidebar}
  >
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2" /></svg>
  </button>
  <button type="button" class="osl-btn" onclick={p.ontoday}>Today</button>
  <div class="osl-step">
    <button type="button" class="osl-icon-btn" aria-label="Previous" onclick={() => p.onstep(-1)}>
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
    <button type="button" class="osl-icon-btn" aria-label="Next" onclick={() => p.onstep(1)}>
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
  </div>
  <h2 class="osl-title" aria-live="polite">{p.title}</h2>
  {#if p.canUndo}
    <button type="button" class="osl-btn osl-undo" onclick={p.onundo} aria-keyshortcuts="Control+Z Meta+Z">Undo</button>
  {/if}
  <div class="osl-selects">
    <div class="osl-outlined">
      <label for="{uid}-v">View</label>
      <select id="{uid}-v" value={p.view} onchange={(e) => p.onview(e.currentTarget.value as ViewKind)}>
        {#each p.views as v (v)}<option value={v}>{VIEW_LABELS[v]}</option>{/each}
      </select>
    </div>
    <div class="osl-outlined">
      <label for="{uid}-d">Date</label>
      <input id="{uid}-d" type="date" value={p.date} onchange={(e) => e.currentTarget.value && p.ondate(e.currentTarget.value)} />
    </div>
  </div>
</div>
