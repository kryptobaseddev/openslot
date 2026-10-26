<script lang="ts">
  import type { CalendarEvent, ReseatProposal } from '@openslot/core';
  import { getCalendarContext } from './context.js';
  import { timeRange } from './format.js';

  interface Props {
    proposal: ReseatProposal | null;
    events: CalendarEvent[];
    /** What the proposal makes room for (shown as the result line) */
    needLabel: string;
    onaccept: () => void;
    onreject: () => void;
  }

  let { proposal, events, needLabel, onaccept, onreject }: Props = $props();
  const ctx = getCalendarContext();
  let dialog: HTMLDialogElement | undefined = $state();
  const uid = $props.id();

  $effect(() => {
    if (!dialog) return;
    if (proposal && !dialog.open) dialog.showModal();
    else if (!proposal && dialog.open) dialog.close();
  });

  const byId = $derived(new Map(events.map((e) => [e.id, e])));
  const title = (id: string) => ctx.resource(id)?.title ?? id;
</script>

<dialog bind:this={dialog} class="osl-modal" aria-labelledby="{uid}-t" onclose={onreject}>
  {#if proposal}
    <div class="osl-modal-body">
      <span class="osl-sheet-grip" aria-hidden="true"></span>
      <h2 id="{uid}-t">{ctx.labels.shuffleTitle}</h2>
      <p>{ctx.labels.shuffleBody(proposal.moves.length)}</p>
      <table class="osl-shuffle">
        <thead>
          <tr><th scope="col">{ctx.labels.event}</th><th scope="col">Before</th><th scope="col">After</th></tr>
        </thead>
        <tbody>
          {#each proposal.moves as m (m.eventId)}
            {@const ev = byId.get(m.eventId)}
            <tr>
              <th scope="row">
                {ev?.title ?? m.eventId}
                {#if ev}<span class="osl-shuffle-time">{timeRange(ev.start, ev.end, ctx.tz, ctx.locale)}</span>{/if}
              </th>
              <td data-label="Before">{title(m.fromResourceId)}</td>
              <td data-label="After"><strong>{title(m.toResourceId)}</strong></td>
            </tr>
          {/each}
          <tr class="osl-shuffle-new">
            <th scope="row">{needLabel}</th>
            <td data-label="Before">—</td>
            <td data-label="After"><strong>{title(proposal.resourceId)}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="osl-modal-actions">
        <button type="button" class="osl-btn osl-btn-primary" onclick={onaccept}>Accept</button>
        <button type="button" class="osl-btn" onclick={onreject}>Reject</button>
      </div>
    </div>
  {/if}
</dialog>
