# OpenSlot

**Calendar and booking scheduling for the web: one framework-neutral core, adapters for Svelte 5 and React.**

[![CI](https://github.com/kryptobaseddev/openslot/actions/workflows/ci.yml/badge.svg)](https://github.com/kryptobaseddev/openslot/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

OpenSlot covers FullCalendar-style views (day, week, month, agenda, resource lanes and timelines, with drag, resize and keyboard moves) and the scheduling rules a booking product needs: slot generation with buffers, lead time and horizon, exact times or arrival windows, blackouts, pooled resources, staff coverage, conflict detection and re-seat proposals. All rules live in a pure TypeScript core that runs the same in the browser and on your server.

> Status: **0.1, unreleased.** Phase 1 (a port of a calendar running in production at EscapePlan) is in this repository. Nothing is on npm yet.

## Packages

| Package                               | What it is                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@openslot/core`](packages/core)     | Pure TypeScript: time zones and DST, slots, occupancy, staff, assistant, re-seat and swap, drag and layout math. No DOM, no I/O, no dependencies. |
| [`@openslot/svelte`](packages/svelte) | Svelte 5 (runes) calendar: views, drag and drop, keyboard move mode, scheduling assistant, re-seat preview, optimistic changes with undo.         |
| [`@openslot/react`](packages/react)   | React 18/19 adapter. Stub; in progress.                                                                                                           |
| [`fixtures/`](fixtures)               | Shared JSON scenarios every package tests against.                                                                                                |

## How it fits together

```
your data (resources, events, hours, staff, rules, time zone)
        │
        ▼
@openslot/core  ──►  decisions and proposals (slots, conflicts, re-seat plans, changes)
        │
        ▼
adapter (Svelte / React): state + actions, default components, CSS variables
        │
        ▼
your API persists the change and re-checks it with the same core (checkSlot)
```

OpenSlot never stores or fetches anything. Your app owns persistence and calls the core again on the server before it writes.

## Quick look

```ts
import { generateSlots, checkSlot, hoursFromSpec } from '@openslot/core';

const hours = hoursFromSpec({ weekly: { 0: null, 6: null }, default: { open: 8 * 60, close: 17 * 60 } });
const ctx = { events, resources, timeZone: 'America/Chicago', hours, now: new Date() };

// Two-hour arrival windows for a 90-minute job, two weeks out
const slots = generateSlots({ ...ctx, durationMin: 90, arrivalWindowMin: 120, from: '2030-06-11', to: '2030-06-24', horizonDays: 14 });

// On the server, before writing the booking
const check = checkSlot(ctx, { durationMin: 90, arrivalWindowMin: 120 }, slots[0].start);
if (!check.ok) throw new Error(check.reason); // 'CONFLICT', 'STAFF', 'CLOSED', ...
```

```svelte
<script lang="ts">
  import { Calendar } from '@openslot/svelte';
  let view = $state('resource-day');
</script>

<Calendar {events} {resources} timeZone="America/New_York" bind:view labels={{ resource: 'Room', size: 'Party size' }} onchange={save} />
```

## Develop

Node 22+ and pnpm (see `packageManager` in `package.json`).

```sh
pnpm install
pnpm run lint        # prettier + eslint
pnpm run check       # tsc and svelte-check
pnpm run test        # vitest in every package, including the fixtures
pnpm run build       # core to dist/, svelte with svelte-package
pnpm run demo        # Svelte demo on http://localhost:4318
pnpm run test:e2e    # Playwright on the demo at 320, 390, 768 and 1280 px
```

Read [`docs/SPEC.md`](docs/SPEC.md) before changing the core API: it holds the feature map, the data types, the adapter contract and the fixture format.

## Credits

The Svelte calendar and the core began as EscapePlan's in-house calendar. Layout behaviour follows the documented behaviour of FullCalendar (MIT) and Schedule-X (MIT core); no premium code was used.

## License

[MIT](./LICENSE)
