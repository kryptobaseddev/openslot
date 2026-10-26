<script lang="ts">
  import type { CalendarController } from './store.svelte.js';

  let { ctl }: { ctl: CalendarController } = $props();
</script>

<div class="osl-toasts" role="region" aria-label="Notifications">
  {#each ctl.toasts as t (t.id)}
    <div class="osl-toast" class:osl-toast-error={t.tone === 'error'} role={t.tone === 'error' ? 'alert' : 'status'}>
      <span>{t.message}</span>
      {#if t.action}
        <button
          type="button"
          class="osl-toast-action"
          onclick={() => {
            const run = t.action!.run;
            ctl.dismiss(t.id);
            run();
          }}>{t.action.label}</button
        >
      {/if}
      <button type="button" class="osl-icon-btn" aria-label="Dismiss" onclick={() => ctl.dismiss(t.id)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="2" /></svg>
      </button>
    </div>
  {/each}
</div>
<div class="osl-sr" aria-live="polite" aria-atomic="true">{ctl.announcement}</div>
