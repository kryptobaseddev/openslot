# @openslot/core

The framework-neutral heart of OpenSlot: pure TypeScript with no DOM, no I/O and no runtime dependencies. Give it plain data (resources, events, open hours, staff shifts, rules and an IANA time zone) and it returns decisions and proposals.

| Area                | Exports                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time zones and days | `zonedToIso`, `zonedParts`, `todayIn`, `addDays`, `startOfWeek`, `viewRange`, `monthGridDays`, `formatTime`, ...                                                    |
| Open hours          | `hoursFromSpec`                                                                                                                                                     |
| Booking slots       | `generateSlots` (exact times or arrival windows, buffers, lead time, horizon, blackouts, pooled resources, staff caps), `checkSlot` (server re-check with a reason) |
| Occupancy           | `conflictsFor`, `isFree`, `overlaps`, `fits`                                                                                                                        |
| Staff               | `availability`, `availableCount`, `staffModel`, `dayCoverage`                                                                                                       |
| Assistant           | `findOpenSlots`, `nextOpenSlotPerResource`                                                                                                                          |
| Re-seat and swap    | `proposeReseat`, `proposeConflictResolution`, `planSwap`, `applyChanges`, `invertChanges`, `movesToChanges`                                                         |
| Drag and layout     | `dragResult`, `createRange`, `snap`, `layoutDay`, `layoutMonthWeek`, `createHistory`                                                                                |

Conventions: instants are UTC ISO strings, intervals are half-open, local days are `'YYYY-MM-DD'` in the calendar's zone, wall-clock times are minutes from local midnight, and anything that depends on the clock takes `now`. The full API and semantics are in [`docs/SPEC.md`](../../docs/SPEC.md#4-core-api).
