# OpenSlot specification

Status: draft 1 (2026-10-26). Phase 1 is in progress in this repository.

OpenSlot is an MIT-licensed calendar and booking-scheduling system. One framework-neutral core holds every scheduling rule; thin adapters render it in React and Svelte. It aims at the views and interactions people know from FullCalendar, plus the booking logic a scheduling product needs: slot generation, buffers, staff coverage, pooled resources, arrival windows and re-seat proposals.

Each item below is marked **[P1]** (phase 1: ported from working code, or new and implemented now) or **[P2]** (phase 2: designed here, not built yet).

## 1. Goals

1. **One source of scheduling truth.** A booking page, an operator calendar and a server check all call the same pure functions with the same data and get the same answer.
2. **Framework-neutral core.** `@openslot/core` is plain TypeScript with no DOM, no I/O, no clock reads it is not given and no runtime dependencies. It runs in browsers, Node, Deno, workers and on the server.
3. **Headless-first adapters.** Each adapter exposes state and actions first, then default components and CSS that hosts can restyle or replace.
4. **Hosts keep their data.** OpenSlot never stores, fetches or syncs. The host passes resources, rules, events and a time zone in, and gets decisions or proposals out. It persists changes itself and re-checks them on its server.
5. **Correct time.** Every day boundary and wall-clock time is computed in the calendar's IANA zone, never the host machine's. DST transitions are tested.
6. **Mobile-first and accessible.** It works from 320 to 1280 px and up, with 44 px touch targets, a keyboard alternative for every drag, screen-reader announcements and reduced motion.
7. **No domain policy in the core.** The core does arithmetic on resources, events and rules. Which services use arrival windows, how long a buffer is, and who may override a conflict are the host's decisions, passed in as data.

Non-goals: storage, sync, payments, notifications, authentication, and a hosted service.

## 2. Packages and ownership

| Package            | Contents                                                                                               | Owner                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `@openslot/core`   | Types, time zones, slots, occupancy, staff, assistant, shuffle, drag, layout, history, hours           | OpenSlot maintainers (seeded from EscapePlan)                                                                       |
| `@openslot/svelte` | Svelte 5 (runes) adapter: controller, drag controller, components, CSS, demo                           | OpenSlot maintainers (seeded from EscapePlan)                                                                       |
| `@openslot/react`  | React 18/19 adapter: hooks, components, demo                                                           | TCOD lead (`tcod-lead@macbook`), who also owns the TCOD integration (customer slot picker, operator dispatch views) |
| `@openslot/dom`    | Optional framework-free DOM helpers (pointer/touch drag, focus, measuring) shared by adapters **[P2]** | Whoever extracts it first, reviewed by both adapter owners                                                          |
| `fixtures/`        | Shared JSON scenarios: the contract both adapters test against                                         | Both. A change needs a passing core run and a note to the other adapter owner                                       |

Changes to `@openslot/core`'s public API go through a PR that updates this spec and the fixtures, and that the other adapter's owner reviews.

## 3. Feature map

FC = FullCalendar (the MIT standard and premium plugins). "Booking" means a typical booking product (Calendly, Acuity, SimplyBook, field-service dispatch tools).

### 3.1 Views and interaction

| Feature                                                            | Reference                      | OpenSlot                                               | Phase |
| ------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------ | ----- |
| Day and week time grid with overlap layout (columns, expand right) | FC timeGrid                    | `layoutDay`, Svelte `TimeGrid`                         | P1    |
| Month grid with "+N more"                                          | FC dayGrid                     | `layoutMonthWeek`, `monthGridDays`, Svelte `MonthGrid` | P1    |
| List / agenda                                                      | FC list                        | Svelte `ListView` (phone agenda with swipe)            | P1    |
| Resource day/week (one lane per resource)                          | FC resourceTimeGrid (premium)  | `resource-day`, `resource-week` views                  | P1    |
| Resource timeline (horizontal)                                     | FC resourceTimeline (premium)  | `timeline-day`, `timeline-week` views                  | P1    |
| Timeline month, year views; resource grouping/nesting              | FC premium                     |                                                        | P2    |
| Drag to move and resize, snap to grid                              | FC editable                    | `dragResult`, `snap`, `DragController`                 | P1    |
| Drag to create; drag external templates in                         | FC selectable, external drag   | `createRange`, sidebar templates                       | P1    |
| Touch long-press drag                                              | FC touch                       | Svelte `DragController`                                | P1    |
| Keyboard move mode (WCAG 2.5.7)                                    | not in FC                      | `M` then arrows, Enter, Escape                         | P1    |
| Drop on another event to swap                                      | not in FC                      | `planSwap` (resource, time or both)                    | P1    |
| Optimistic change with rollback and undo                           | not built in                   | `CalendarController`, `createHistory`, `invertChanges` | P1    |
| Now indicator, business hours shading                              | FC nowIndicator, businessHours | `hours` per day, now line                              | P1    |
| Mini month date picker                                             | common                         | Svelte `MiniMonth`                                     | P1    |
| Background events, selection constraints, `eventAllow` callbacks   | FC                             |                                                        | P2    |
| All-day and multi-day events, all-day row                          | FC                             |                                                        | P2    |
| Print view, iCal export                                            | FC plugins                     |                                                        | P2    |
| Virtualised rendering for 100+ resources                           | FC premium                     |                                                        | P2    |

### 3.2 Scheduling and booking logic

| Feature                                                                   | Reference       | OpenSlot                                              | Phase                                       |
| ------------------------------------------------------------------------- | --------------- | ----------------------------------------------------- | ------------------------------------------- |
| Opening hours per weekday and date, closed days                           | Booking         | `HoursFn`, `hoursFromSpec`                            | P1                                          |
| Slot generation on a grid, with duration, buffer, lead time and horizon   | Booking         | `generateSlots`                                       | P1 (new)                                    |
| Server re-check of one chosen slot with a reason                          | Booking         | `checkSlot`                                           | P1 (new)                                    |
| Exact times **and** arrival windows                                       | Field service   | `arrivalWindowMin`                                    | P1 (new)                                    |
| Blackouts (all resources or one)                                          | Booking         | `Blackout[]`                                          | P1 (new)                                    |
| Compatibility (only some resources can host an event)                     | Booking         | `compatKey` on events and resources                   | P1                                          |
| Party size against resource capacity                                      | Booking         | `size`, `capacity {min,max}`, `fits`                  | P1                                          |
| Pooled resources (any free one of a set)                                  | Booking         | a slot lists every free `resourceIds`                 | P1 (new)                                    |
| Staff coverage from shifts and time off; staff per booking                | Booking         | `availability`, `staffModel`, `dayCoverage`           | P1                                          |
| Slots capped by staff on shift                                            | Booking         | `generateSlots` caps `resourceIds`                    | P1 (new)                                    |
| Scheduling assistant: next open times across resources                    | Booking         | `findOpenSlots`, `nextOpenSlotPerResource`            | P1                                          |
| Re-seat proposals: free a resource by moving others (chains)              | not common      | `proposeReseat`, `proposeConflictResolution`          | P1                                          |
| Conflict detection with buffer                                            | Booking         | `conflictsFor`, `isFree`, `overlaps`                  | P1                                          |
| Asymmetric buffers (before vs after) and per-service buffers              | Booking         |                                                       | P2                                          |
| Seats: several bookings share one resource up to N seats (classes, tours) | Booking         |                                                       | P2                                          |
| Multi-resource bookings (one booking needs a room **and** a person)       | Booking         |                                                       | P2                                          |
| Recurrence (RFC 5545 RRULE, EXDATE, RDATE) expansion, with exceptions     | FC rrule plugin | `expandRecurrence`                                    | P2                                          |
| Reschedule and cancel policies (cutoffs, fees as data, allowed windows)   | Booking         | `checkReschedule`, `checkCancel` returning a decision | P2                                          |
| Minimum notice and daily booking caps per resource                        | Booking         |                                                       | P2                                          |
| Travel time between field jobs; route-aware windows                       | Field service   |                                                       | P2 (adapter or host input, not core policy) |
| Waitlist suggestions                                                      | Booking         |                                                       | P2                                          |

### 3.3 Time, language and access

| Feature                                                                                                       | OpenSlot                                 | Phase |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----- |
| IANA time zones from `Intl` (no tz library)                                                                   | `zonedToIso`, `zonedParts`, `todayIn`    | P1    |
| DST: skipped wall-clock times roll forward; repeated times pick the first; slot durations are elapsed minutes | `time.ts`, `slots.ts`; fixture `dst-day` | P1    |
| Display zone different from the resource zone (a customer abroad)                                             |                                          | P2    |
| Locale-aware dates and times (`Intl`, `locale` prop, `firstDay`)                                              | `format.ts`, `formatTime`                | P1    |
| Domain words set by the host (resource, event, size, ...)                                                     | Svelte `labels` prop                     | P1    |
| Full message catalogs and RTL layout                                                                          |                                          | P2    |
| 44 px targets, focus rings, roles, live announcements, reduced motion                                         | Svelte components and CSS                | P1    |
| Browser tests at 320, 390, 768 and 1280 px                                                                    | Playwright on the Svelte demo            | P1    |

## 4. Core API

### 4.1 Conventions

- **Instants** are ISO 8601 strings in UTC (`2030-06-10T18:00:00.000Z`). Intervals are half-open: `[start, end)`.
- **Local days** are `'YYYY-MM-DD'` strings in the calendar's zone.
- **Wall-clock times** are minutes from local midnight (`0` to `1440`).
- **Zones** are IANA names (`America/New_York`). Every function that needs one takes it as an argument.
- **Clock:** functions that depend on "now" take `now?: Date` and default to `new Date()`. Tests and servers always pass it.
- **Purity:** inputs are never mutated. Outputs are plain JSON-serialisable values.
- **Errors:** expected outcomes are values (`{ ok: false, reason }`, `{ error }`, `null`), not exceptions.

### 4.2 Data types

```ts
interface CalendarEvent {
  id: string;
  start: string;            // instant
  end: string;              // instant, exclusive
  resourceId?: string;
  title: string;
  calendarId?: string;      // status or category: colour and filter
  editable?: boolean;       // false: never moved, resized or swapped
  pinned?: boolean;         // never moved by re-seat proposals
  compatKey?: string;       // only resources with the same key may host it
  size?: number;            // checked against resource capacity
  version?: string;         // optimistic-concurrency token, echoed back
  meta?: Record<string, unknown>;
}

interface CalendarResource {
  id: string;
  title: string;
  color?: string;
  compatKey?: string;
  capacity?: { min: number; max: number };
  order?: number;
}

interface EventChange { id: string; start: string; end: string; resourceId?: string }

type DayHours = { open: number; close: number } | null;   // null = closed
type HoursFn = (date: string) => DayHours;
interface HoursSpec { weekly?: { [weekday 0-6]: DayHours }; dates?: Record<string, DayHours>; default?: DayHours }

interface Blackout { start: string; end: string; resourceId?: string }  // no resourceId: all resources
interface StaffSpan { userId: string; start: string; end: string; kind: 'shift' | 'time_off' }
interface StaffModel { available(start: string, end: string): number; perBooking?: number }

type ViewKind = 'day' | 'week' | 'month' | 'list' | 'resource-day' | 'resource-week' | 'timeline-day' | 'timeline-week';
```

### 4.3 Functions

| Module      | Exports                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time`      | `zonedToIso`, `zonedParts`, `todayIn`, `addDays`, `dayOfWeek`, `startOfWeek`, `daysBetween`, `dayList`, `monthGridDays`, `viewRange`, `formatTime`, `minutesBetween`, `addMinutesIso` |
| `hours`     | `hoursFromSpec(spec) → HoursFn`                                                                                                                                                       |
| `slots`     | `generateSlots(query) → Slot[]`, `checkSlot(ctx, rules, start, resourceId?) → SlotCheck`                                                                                              |
| `occupancy` | `overlaps`, `busyFor`, `conflictsFor`, `isFree`, `fits`, `byOrder`                                                                                                                    |
| `staff`     | `availability`, `availableCount`, `staffModel`, `dayCoverage`                                                                                                                         |
| `assistant` | `findOpenSlots`, `nextOpenSlotPerResource` (per-resource results for operator tools)                                                                                                  |
| `shuffle`   | `proposeReseat`, `proposeConflictResolution`, `planSwap`, `movesToChanges`, `applyChanges`, `invertChanges`                                                                           |
| `drag`      | `dragResult`, `createRange` (pointer deltas in minutes to snapped changes)                                                                                                            |
| `snap`      | `snap`, `clampToHours`, `yToMinutes`                                                                                                                                                  |
| `layout`    | `layoutDay` (time-grid columns), `layoutMonthWeek` (month cells)                                                                                                                      |
| `history`   | `createHistory` (bounded undo stack)                                                                                                                                                  |

### 4.4 Slot generation

```ts
interface SlotRules {
  durationMin: number;        // service length
  arrivalWindowMin?: number;  // omit for exact start times
  stepMin?: number;           // grid; default: the window, else 15
  bufferMin?: number;         // kept free on both sides of every booking
  leadMin?: number;           // earliest start after now
  horizonDays?: number;       // last bookable local day after today
  compatKey?: string;
  size?: number;
}
interface SlotContext {
  events: CalendarEvent[]; resources: CalendarResource[]; timeZone: string; hours: HoursFn;
  blackouts?: Blackout[]; staff?: StaffModel; excludeIds?: string[]; now?: Date;
}
interface Slot { start: string; end: string; arrival?: { from: string; to: string }; resourceIds: string[] }

generateSlots(query: SlotContext & SlotRules & { from: string; to?: string; limit?: number }): Slot[]
checkSlot(ctx: SlotContext, rules: SlotRules, start: string, resourceId?: string):
  { ok: true; resourceId: string } | { ok: false; reason: 'LEAD_TIME' | 'HORIZON' | 'CLOSED' | 'BLACKOUT' | 'NO_RESOURCE' | 'CONFLICT' | 'STAFF' }
```

Rules, in the order `checkSlot` applies them:

1. **Lead time:** `start >= now + leadMin`.
2. **Horizon:** the local day of `start` is at most `today + horizonDays`.
3. **Hours:** the whole held span `[start, start + window + duration)` lies inside the open hours of the local day it starts on.
4. **Blackouts:** no all-resource blackout overlaps the held span.
5. **Resources:** at least one resource fits `compatKey` and `size` (`NO_RESOURCE`), is not blacked out (`BLACKOUT`) and has no event within `bufferMin` of the held span (`CONFLICT`). `excludeIds` lets a rescheduled booking ignore itself.
6. **Staff:** with a staff model, the people on shift for the whole span, divided by `perBooking`, exceed the events already running then.

`generateSlots` walks each local day from the first grid time at or after opening, in steps of real elapsed minutes, so across DST every real start is offered once. Each slot lists all free resources (pooled booking: show the slot while `resourceIds` is not empty; the host picks or lets the customer pick). With a staff model the list is cut to the bookings staff can still take, so `resourceIds.length` is the slot's remaining capacity.

**Arrival windows vs exact times.** The core knows only `arrivalWindowMin`. With it, a slot promises arrival in `[start, start + window)` and holds the resource until `start + window + duration`, so the latest arrival still finishes inside open hours and before the next booking. Which services use windows, and how long they are, is host configuration: TCOD passes a window for field services and omits it for exact appointments.

**Server re-check.** The host calls `checkSlot` on its server, inside the transaction that writes the booking, with fresh events. A client slot list is only a proposal.

### 4.5 Proposals

`proposeReseat` returns the cheapest plan to seat a need: zero moves when a compatible resource is free, otherwise moves of existing events to other compatible resources at the same times (chains allowed, `maxMoves` default 3, pinned and non-editable events never move). `planSwap` returns the two changes of a swap or a reason (`COMPAT_MISMATCH`, `PINNED`, `NOT_EDITABLE`, `CAPACITY`, `OVERLAP`). Both are previews: the host shows them, applies them through its API, and re-checks on the server.

## 5. Adapter contract

Every adapter provides the same layers, so a host can stop at any of them.

1. **Re-export the core**, so one import gives components and math.
2. **Controller (headless state and actions).** The Svelte `CalendarController` is the reference:
   - `apply(events)`: the host's events with pending optimistic changes applied.
   - `commit(kind, changes, label, events)`: shows the change at once, calls the host's `onchange({ kind, changes, label })`, keeps it on success (with an Undo toast) and rolls it back with the host's error message on rejection.
   - `undo(events)`: sends the inverse changes as `kind: 'undo'`.
   - `refuse(ids, message)`: a refused drop, with no host call.
   - `toasts`, `announcement` (polite live region), `rejected` (ids to shake back), `canUndo`, `sync()` when new host data arrives.
   - `ChangeKind = 'move' | 'resize' | 'swap' | 'reseat' | 'undo'`.
3. **Drag controller.** Pointer, mouse and touch long-press (450 ms) drag; the output is a `DropResult` the calendar turns into an `EventChange` with `dragResult`. Keyboard move mode is required (M, arrows, Shift+arrows to resize, Enter, Escape).
4. **Default components** with the same props in both adapters where the frameworks allow: `events`, `resources`, `calendars`, `timeZone`, `view`, `date`, `hours`, `slotMin`, `snapMin`, `firstDay`, `locale`, `editable`, `bufferMin`, `templates`, `compatOptions`, `views`, `compactBelow`, `now`, `staff`, `labels`, callbacks `onchange`, `oncreate`, `onselect`, `onrangechange`, and render slots for event content, modal actions and details (Svelte snippets, React render props).
5. **CSS.** One stylesheet, root class `.osl`, every class prefixed `osl-`, every colour and size a `--osl-*` custom property with fallbacks to host tokens (`--color-*`) and system colours. Hosts restyle by overriding variables, not selectors.
6. **Labels.** Domain words and messages come from a `labels` object with neutral defaults (`Resource`, `Event`, `Size`, ...). The core never produces user-facing text except `dayCoverage().label`, whose noun is a parameter.
7. **Accessibility and layout (required):** 44 px targets; no page-level horizontal scroll from 320 px; phone layout below `compactBelow` (default 640 px) with agenda, single-resource chips and a floating new-event button; dialogs are native `<dialog>` with labelled titles; changes are announced; `prefers-reduced-motion` disables motion.
8. **Tests.** Each adapter runs the shared fixtures through its own state layer where it wraps core behaviour, and browser tests at 320, 390, 768 and 1280 px.

The React adapter is expected to expose the controller as hooks (for example `useCalendarController(onchange)` and `useDrag(...)`) and components with the same props. Its exact API is the React owner's call within this contract.

## 6. Fixtures

`fixtures/*.json` are shared scenarios validated by `fixtures/fixture.schema.json`. A fixture holds shared data (`timeZone`, `now`, `hours` as an `HoursSpec`, `resources`, `events`, `blackouts`, `staff`, `rules`) and `cases`. Each case names a core function (`fn`), an `input` merged over the shared data, and an `expect` matched as a subset (arrays must have the same length). The core runs every fixture in `packages/core/test/fixtures.test.ts`; adapters load the same files.

Phase 1 fixtures: `dst-day`, `conflict-with-buffer`, `staff-shortfall`, `reseat`, `arrival-window`. Rules for changing them: never edit an expectation to match new behaviour without saying why in the PR; add a case instead of widening an old one.

## 7. Versioning and releases

- Semantic versioning. All packages move in lockstep while below 1.0; a minor bump may break the API until 1.0, and the release notes say so.
- Packages are `private: true` until the owner creates the `@openslot` npm scope and approves the first publish. Nothing publishes to npm from this repository yet.
- `release.yml` runs only on manual dispatch: it checks the version, runs lint, typecheck, tests and builds, packs tarballs and creates a GitHub release with `RELEASE_NOTES.md`. It has no npm step.
- In the repository, packages export their TypeScript source; `publishConfig` switches the exports to built `dist/` files at publish time.
- CI runs on GitHub-hosted runners (public repository; free minutes). Self-hosted runners must never run pull requests from forks of this public repository.

## 8. Phase plan

**Phase 1 (port, now).** Core seeded from EscapePlan's calendar core (time, occupancy, staff, assistant, shuffle, snap, drag, layout, history, types) with neutral names and its tests; new `hours` and `slots` modules with fixtures; Svelte adapter seeded from EscapePlan's calendar components with a demo and Playwright tests; React package stub; CI.

**Phase 2 (new features).** In rough order of value to the two first hosts: asymmetric and per-service buffers; seats (shared capacity per resource); multi-resource bookings; RRULE expansion; reschedule and cancel policy checks; display zone separate from resource zone; all-day events; `@openslot/dom`; i18n catalogs and RTL; virtualised large resource lists; timeline month and year views.

## 9. Known phase 1 behaviour

- `findOpenSlots` (the operator assistant) checks staff per resource and does not cap a start time by remaining staff; `generateSlots` does. Fixture `staff-shortfall` records both.
- `findOpenSlots` and `createRange` compute end times on the wall clock (code that predates `generateSlots`); across a DST change they can differ from elapsed time. Phase 2 aligns them with `slots.ts`.
- Buffers are symmetric.
