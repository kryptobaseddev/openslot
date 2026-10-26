## OpenSlot 0.1.0 (unreleased)

First cut. `@openslot/core` and `@openslot/svelte` go to npm; `@openslot/react` is a private stub.

- **@openslot/core:** time zones and DST, occupancy, staff coverage, scheduling assistant, re-seat and swap proposals, drag, layout and history, ported from EscapePlan's calendar with neutral names. New: `generateSlots` and `checkSlot` (exact times or arrival windows, buffers, lead time, horizon, blackouts, pooled resources, staff caps) and `hoursFromSpec`.
- **@openslot/svelte:** the EscapePlan Svelte 5 calendar on top of the core, with a `labels` prop for domain words, a demo and Playwright tests at 320 to 1280 px.
- **@openslot/react:** stub that re-exports the core.
- **fixtures:** five shared scenarios (DST, buffers, staff shortfall, re-seat, arrival windows).
