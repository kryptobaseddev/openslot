# @openslot/svelte

A Svelte 5 (runes) calendar and resource scheduler on [`@openslot/core`](../core).

- Views: resource day and week, timeline day and week, day, week, month and agenda
- Drag to move, resize, create and swap; touch long-press; keyboard move mode (M, arrows, Enter, Escape)
- Optimistic changes: the calendar shows a move at once, calls your `onchange`, keeps it on success with an Undo toast, and rolls it back with your error message when you throw
- Scheduling assistant ("Find a time"), re-seat previews for conflicts, staff coverage badges
- Phone layout below 640 px: agenda with swipe, one resource at a time, a floating new-event button
- 44 px targets, native dialogs, live announcements, reduced motion; styled with `--osl-*` CSS variables

```svelte
<script lang="ts">
  import { Calendar, applyChanges, type ChangeRequest } from '@openslot/svelte';

  let events = $state(initialEvents);
  async function onchange(req: ChangeRequest) {
    await api.save(req.changes); // throw to roll back
    events = applyChanges(events, req.changes);
  }
</script>

<Calendar
  {events}
  {resources}
  timeZone="America/New_York"
  {onchange}
  labels={{ resource: 'Room', resources: 'Rooms', size: 'Party size' }}
/>
```

The demo in [`demo/`](demo) is also the Playwright harness: `pnpm run demo`, then `pnpm run test:e2e`.
