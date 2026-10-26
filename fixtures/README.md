# Shared fixtures

Scenarios every OpenSlot package tests against. They are the contract between `@openslot/core` and the adapters: when a fixture passes in the core and in an adapter, both agree on the behaviour.

Format: [`fixture.schema.json`](fixture.schema.json). A file holds shared data and a list of cases.

```jsonc
{
  "name": "conflict-with-buffer",          // must match the file name
  "description": "What the scenario shows",
  "timeZone": "UTC",
  "now": "2030-06-10T00:00:00.000Z",
  "hours": { "default": { "open": 600, "close": 1320 } },   // an HoursSpec: weekly, dates, default
  "resources": [...], "events": [...], "blackouts": [...],
  "staff": { "perBooking": 1, "spans": [...] },            // becomes a StaffModel
  "rules": { "durationMin": 60, "bufferMin": 15 },         // SlotRules shared by the cases
  "cases": [
    { "name": "13:00 is inside the buffer", "fn": "checkSlot", "input": { "start": "..." }, "expect": { "ok": false, "reason": "CONFLICT" } }
  ]
}
```

A case's `input` is merged over the shared data, then passed to the core function named by `fn`: `generateSlots`, `checkSlot`, `findOpenSlots`, `proposeReseat`, `proposeConflictResolution`, `dayCoverage` or `zonedToIso`. `expect` is matched as a subset: the listed fields must be equal and arrays must have the same length. The reference runner is [`packages/core/test/fixtures.test.ts`](../packages/core/test/fixtures.test.ts).

| Fixture                | Shows                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `dst-day`              | Slots across both New York DST changes; the skipped hour is never offered twice and the repeated hour is offered |
| `conflict-with-buffer` | A buffer on both sides of a booking; every `checkSlot` rejection reason                                          |
| `staff-shortfall`      | Fewer staff than resources: slots cap at the staff on shift; the day badge flags the uncovered evening           |
| `reseat`               | A two-move re-seat chain, and no plan when only one move is allowed                                              |
| `arrival-window`       | The same technicians as arrival windows and as exact times; closed weekends                                      |

Changing a fixture: add a case rather than widening an old one, and never change an expectation to match new behaviour without saying why in the PR.
