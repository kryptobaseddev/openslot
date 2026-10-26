<script lang="ts">
  /*
   * Demo and Playwright harness. Times are in America/New_York on a fixed
   * day; "now" is pinned so screenshots and tests are stable. Moves into the
   * 18:00 slot of "Studio B" are refused, as a host API would answer 409.
   */
  import {
    Calendar,
    applyChanges,
    zonedToIso,
    type CalendarEvent,
    type ChangeRequest,
    type EventDraft,
    type ViewKind
  } from '../src/index.js';

  const TZ = 'America/New_York';
  const DAY = '2030-06-10';
  const params = new URLSearchParams(location.search);
  let view = $state<ViewKind>((params.get('view') as ViewKind) ?? 'resource-day');
  let date = $state(DAY);
  const at = (h: number, m = 0) => zonedToIso(DAY, h * 60 + m, TZ);
  const ev = (
    id: string,
    title: string,
    resource: string,
    h: number,
    len = 60,
    status = 'confirmed',
    extra: Partial<CalendarEvent> = {}
  ): CalendarEvent => ({
    id,
    title,
    resourceId: resource,
    start: at(h),
    end: new Date(Date.parse(at(h)) + len * 60_000).toISOString(),
    calendarId: status,
    compatKey: resource === 'lab' ? 'lab' : 'studio',
    size: 4,
    ...extra
  });

  let events = $state<CalendarEvent[]>([
    ev('b1', 'Rivera party', 'studio-a', 12),
    ev('b2', 'Okafor', 'studio-b', 12),
    ev('b3', 'Chen', 'studio-a', 15, 90, 'checked_in'),
    ev('b4', 'Lab night', 'lab', 17, 60, 'pending'),
    ev('b5', 'Pinned VIP', 'studio-b', 14, 60, 'confirmed', { pinned: true }),
    // Double-booked against the pinned VIP: "Resolve conflict" re-seats it
    { ...ev('b6', 'Walk-in Diaz', 'studio-b', 13), start: at(13, 30), end: at(14, 30) }
  ]);
  let log = $state<string[]>([]);
  let created = $state<EventDraft | null>(null);

  async function onchange(req: ChangeRequest) {
    await new Promise((r) => setTimeout(r, 50));
    for (const c of req.changes) {
      if (c.resourceId === 'studio-b' && c.start === at(18)) throw new Error('Studio B is booked 6:00 – 7:00 PM.');
    }
    events = applyChanges(events, req.changes);
    log = [...log, `${req.kind}: ${req.label}`];
  }
</script>

<main style="block-size: 100dvh; display: flex; flex-direction: column">
  <div style="flex: 1; min-block-size: 0">
    <Calendar
      {events}
      bind:view
      bind:date
      timeZone={TZ}
      now={new Date(at(13, 30))}
      resources={[
        { id: 'studio-a', title: 'Studio A', compatKey: 'studio', capacity: { min: 2, max: 8 }, order: 1 },
        { id: 'studio-b', title: 'Studio B', compatKey: 'studio', capacity: { min: 2, max: 8 }, order: 2 },
        { id: 'lab', title: 'The Lab', compatKey: 'lab', capacity: { min: 2, max: 6 }, order: 3 }
      ]}
      calendars={[
        { id: 'confirmed', label: 'Confirmed', colorVar: '--demo-confirmed' },
        { id: 'pending', label: 'Pending', colorVar: '--demo-pending' },
        { id: 'checked_in', label: 'Checked in', colorVar: '--demo-checked' }
      ]}
      templates={[
        { id: 'studio', label: 'Studio (60 min)', durationMin: 60, compatKey: 'studio', calendarId: 'confirmed' },
        { id: 'lab', label: 'Lab (90 min)', durationMin: 90, compatKey: 'lab', calendarId: 'pending' }
      ]}
      compatOptions={[
        { value: 'studio', label: 'Studio' },
        { value: 'lab', label: 'Lab' }
      ]}
      hours={() => ({ open: 10 * 60, close: 22 * 60 })}
      {onchange}
      oncreate={(d) => (created = d)}
    />
  </div>
  <output data-testid="log" style="font: 12px monospace">{log.join(' | ')}</output>
  <output data-testid="created" style="font: 12px monospace"
    >{created ? `${created.resourceId ?? ''} ${created.start} ${created.end}` : ''}</output
  >
</main>

<style>
  :global(:root) {
    --demo-confirmed: oklch(0.65 0.15 250);
    --demo-pending: oklch(0.78 0.15 80);
    --demo-checked: oklch(0.7 0.15 150);
  }
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: Canvas;
  }
</style>
