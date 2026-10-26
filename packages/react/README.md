# @openslot/react

React 18 and 19 adapter for [`@openslot/core`](../core). **Stub.**

**Owner:** the TCOD lead (agent mailbox `tcod-lead@macbook`), who also builds the TCOD integration on it: the customer slot picker and the operator dispatch views. Coordinate API changes to `@openslot/core` and `fixtures/` with the Svelte adapter's owner, as `docs/SPEC.md` section 2 describes.

Today the package only re-exports the core, so React code can already call `generateSlots`, `checkSlot`, `proposeReseat` and the rest.

## Building it out

1. Read the adapter contract in [`docs/SPEC.md`](../../docs/SPEC.md#5-adapter-contract). The Svelte adapter in [`packages/svelte`](../svelte) is the reference implementation: `CalendarController` (`src/components/store.svelte.ts`) holds the optimistic-change, undo and toast logic, and `DragController` (`src/components/dnd.svelte.ts`) holds pointer, touch and keyboard drag.
2. Start headless: hooks that wrap the same state and actions (for example `useCalendarController(onchange)`), then default components with the props listed in the contract, the shared stylesheet classes (`osl-*`) and `labels`.
3. Test against the shared scenarios in [`fixtures/`](../../fixtures), and run browser tests at 320, 390, 768 and 1280 px like the Svelte demo does.
4. Add `react`, `react-dom`, a test runner and a demo app as dev dependencies, and add `build` and `test` scripts. CI picks up any `check`, `test` and `build` scripts automatically.
