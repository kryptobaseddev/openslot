<script lang="ts">
  import { onDestroy } from 'svelte';
  import { animate } from 'motion';
  import {
    type CalendarEvent,
    type CalendarResource,
    type DayHours,
    type EventChange,
    type ViewKind,
    addDays,
    minutesBetween,
    todayIn,
    viewRange,
    zonedParts,
    zonedToIso,
    findOpenSlots,
    type OpenSlot,
    dayCoverage,
    staffModel,
    type DayCoverage,
    conflictsFor,
    fits,
    planSwap,
    proposeConflictResolution,
    proposeReseat,
    movesToChanges,
    type ReseatProposal,
    snap
  } from '@openslot/core';
  import { setCalendarContext, type CalendarContext } from './context.js';
  import { DragController, type DropResult } from './dnd.svelte.js';
  import { CalendarController } from './store.svelte.js';
  import { dayLabel, titleFor, timeOf, VIEW_LABELS } from './format.js';
  import type { CalendarProps, EventDraft, EventTemplate } from './types.js';
  import { resolveLabels } from './labels.js';
  import Toolbar from './Toolbar.svelte';
  import Sidebar from './Sidebar.svelte';
  import Assistant from './Assistant.svelte';
  import TimeGrid from './TimeGrid.svelte';
  import Timeline from './Timeline.svelte';
  import MonthGrid from './MonthGrid.svelte';
  import ListView from './ListView.svelte';
  import EventModal from './EventModal.svelte';
  import ShufflePreview from './ShufflePreview.svelte';
  import Toasts from './Toasts.svelte';
  import '../calendar.css';

  let {
    events,
    resources = [],
    calendars = [],
    timeZone,
    view = $bindable('resource-day'),
    date = $bindable(''),
    hours,
    dayStartMin = 9 * 60,
    dayEndMin = 22 * 60,
    slotMin = 15,
    snapMin = 15,
    firstDay = 0,
    locale,
    editable = true,
    bufferMin = 0,
    templates = [],
    compatOptions = [],
    views = ['resource-day', 'resource-week', 'timeline-day', 'day', 'week', 'month', 'list'],
    compactBelow = 640,
    sidebarOpen = $bindable(true),
    fab = true,
    now: nowProp,
    staff,
    labels: labelOverrides,
    onchange,
    oncreate,
    onselect,
    onrangechange,
    eventContent,
    eventActions,
    eventDetails
  }: CalendarProps = $props();

  const labels = $derived(resolveLabels(labelOverrides));

  // ── clock ────────────────────────────────────────────────────────────
  let tick = $state(new Date());
  $effect(() => {
    const timer = setInterval(() => (tick = new Date()), 30_000);
    return () => clearInterval(timer);
  });
  const now = $derived(nowProp ?? tick);
  onDestroy(() => {
    ctl.destroy();
    dnd.cancel();
  });
  const today = $derived(todayIn(timeZone, now));
  $effect.pre(() => {
    if (!date) date = today;
  });
  const day = $derived(date || today);

  // ── layout mode ──────────────────────────────────────────────────────
  let width = $state(1024);
  const compact = $derived(width < compactBelow);
  const PHONE_VIEWS: ViewKind[] = ['list', 'resource-day', 'day'];
  const offered = $derived(compact ? PHONE_VIEWS.filter((v) => views.includes(v) || v === 'list') : views);
  // Phones start on the agenda and keep their own view choice
  let phoneView = $state<ViewKind>('list');
  let drawer = $state(false);
  const sideShown = $derived(compact ? drawer : sidebarOpen);
  const active = $derived<ViewKind>(compact ? phoneView : offered.includes(view) ? view : offered[0]);
  // The phone agenda shows one day at a time
  const range = $derived(viewRange(compact && active === 'list' ? 'day' : active, day, firstDay));
  const title = $derived(
    compact && range.days.length === 1
      ? dayLabel(range.days[0], locale, { weekday: 'short', month: 'short', day: 'numeric' })
      : titleFor(active, range.days, locale)
  );

  $effect(() => {
    onrangechange?.({ from: range.from, to: range.to, view: active });
  });

  // ── filters ──────────────────────────────────────────────────────────
  let hiddenCalendars = $state(new Set<string>());
  let hiddenResources = $state(new Set<string>());
  let phoneResource = $state<string | null>(null);
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const ordered = $derived([...resources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)));
  const visibleResources = $derived(ordered.filter((r) => !hiddenResources.has(r.id)));
  const laneResources = $derived.by<CalendarResource[]>(() => {
    if (active === 'day' || active === 'week' || active === 'month' || active === 'list') return [];
    if (compact) {
      const pick = visibleResources.find((r) => r.id === phoneResource) ?? visibleResources[0];
      return pick ? [pick] : [];
    }
    return visibleResources;
  });

  // ── data ─────────────────────────────────────────────────────────────
  const ctl = new CalendarController(() => onchange);
  $effect.pre(() => {
    void events;
    ctl.sync();
  });
  const all = $derived(ctl.apply(events));
  const shown = $derived(
    all.filter(
      (e) =>
        !(e.calendarId && hiddenCalendars.has(e.calendarId)) &&
        !(e.resourceId && hiddenResources.has(e.resourceId)) &&
        (laneResources.length !== 1 || !compact || e.resourceId === laneResources[0].id)
    )
  );
  const marked = $derived(new Set(all.map((e) => zonedParts(e.start, timeZone).date)));
  const conflicts = $derived.by(() => {
    const out = new Set<string>();
    const byRes = new Map<string, CalendarEvent[]>();
    for (const e of all) {
      if (!e.resourceId) continue;
      if (!byRes.has(e.resourceId)) byRes.set(e.resourceId, []);
      byRes.get(e.resourceId)!.push(e);
    }
    for (const list of byRes.values()) {
      list.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length && Date.parse(list[j].start) < Date.parse(list[i].end); j++) {
          out.add(list[i].id);
          out.add(list[j].id);
        }
      }
    }
    return out;
  });

  const hoursFor = (d: string): DayHours => (hours ? hours(d) : { open: dayStartMin, close: dayEndMin });
  const bounds = $derived.by(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of range.days) {
      const h = hoursFor(d);
      if (h) {
        lo = Math.min(lo, h.open);
        hi = Math.max(hi, h.close);
      }
    }
    for (const e of shown) {
      const p = zonedParts(e.start, timeZone);
      if (!range.days.includes(p.date)) continue;
      lo = Math.min(lo, p.minutes);
      hi = Math.max(hi, p.minutes + minutesBetween(e.start, e.end));
    }
    if (!Number.isFinite(lo)) [lo, hi] = [dayStartMin, dayEndMin];
    return { start: Math.max(0, Math.floor(lo / 60) * 60), end: Math.min(24 * 60, Math.ceil(hi / 60) * 60) };
  });

  // ── staffing ──────────────────────────────────────────────────
  const staffing = $derived(staff ? staffModel(staff.spans, staff.perBooking ?? 1) : undefined);
  const coverage = $derived.by(() => {
    const out = new Map<string, DayCoverage>();
    if (!staff) return out;
    for (const d of range.days) {
      const c = dayCoverage(staff.spans, d, timeZone, hoursFor, snapMin, staff.noun);
      if (c) out.set(d, c);
    }
    return out;
  });

  const defaultDuration = $derived(templates[0]?.durationMin ?? 60);
  const byId = $derived(new Map(all.map((e) => [e.id, e])));

  // ── drag and drop ────────────────────────────────────────────────────
  const dnd = new DragController({
    timeZone: () => timeZone,
    snapMin: () => snapMin,
    editable: () => editable,
    onDrop: (r) => void handleDrop(r),
    onTap: (id) => {
      const ev = byId.get(id);
      if (ev) select(ev);
    },
    onLaneTap: ({ date: d, resourceId, minutes }) => {
      const start = zonedToIso(d, minutes, timeZone);
      requestCreate({ start, end: new Date(Date.parse(start) + defaultDuration * 60_000).toISOString(), resourceId });
    }
  });

  const ghost = $derived.by<CalendarEvent | null>(() => {
    const p = dnd.preview;
    if (!p) return null;
    const src = dnd.draggingId ? byId.get(dnd.draggingId) : undefined;
    return {
      id: '__ghost',
      title: p.swapWith ? `Swap with ${byId.get(p.swapWith)?.title ?? ''}` : (src?.title ?? labels.newEvent),
      start: p.start,
      end: p.end,
      resourceId: p.resourceId,
      calendarId: src?.calendarId
    };
  });

  function describe(ev: CalendarEvent, change: EventChange): string {
    const where = change.resourceId && change.resourceId !== ev.resourceId ? ` in ${resourceOf(change.resourceId)?.title ?? ''}` : '';
    return `Moved ${ev.title} to ${timeOf(change.start, timeZone, locale)}${where}`;
  }

  const resourceOf = (id: string | undefined) => (id ? resources.find((r) => r.id === id) : undefined);

  function clash(change: EventChange, ignore: string[]): CalendarEvent[] {
    if (!change.resourceId) return [];
    return conflictsFor(all, change.resourceId, change.start, change.end, bufferMin, ignore);
  }

  async function settle(id: string) {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    await Promise.resolve();
    const el = document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`);
    if (el) animate(el, { scale: [0.96, 1] }, { type: 'spring', bounce: 0, visualDuration: 0.2 });
  }

  async function handleDrop(r: DropResult) {
    const p = r.preview;
    if (r.kind === 'create' || r.kind === 'template') {
      requestCreate({ start: p.start, end: p.end, resourceId: p.resourceId, template: r.template });
      return;
    }
    const ev = r.eventId ? byId.get(r.eventId) : undefined;
    if (!ev) return;

    if (p.swapWith && r.kind === 'move') {
      const other = byId.get(p.swapWith)!;
      const overlapInTime = Date.parse(ev.start) < Date.parse(other.end) && Date.parse(other.start) < Date.parse(ev.end);
      const mode = ev.resourceId === other.resourceId ? 'time' : overlapInTime ? 'resource' : 'both';
      const plan = planSwap(ev, other, mode, { resources, events: all, bufferMin });
      if (!Array.isArray(plan)) {
        ctl.refuse([ev.id], labels.swapErrors[plan.error] ?? 'Cannot swap.');
        return;
      }
      if (await ctl.commit('swap', plan, `Swapped ${ev.title} and ${other.title}`, all)) for (const c of plan) void settle(c.id);
      return;
    }

    const change: EventChange = { id: ev.id, start: p.start, end: p.end, resourceId: p.resourceId ?? ev.resourceId };
    const target = resourceOf(change.resourceId);
    if (target && change.resourceId !== ev.resourceId && !fits(target, ev.compatKey, ev.size)) {
      ctl.refuse([ev.id], target.compatKey !== ev.compatKey ? labels.incompatible(target.title) : labels.tooLarge(target.title));
      return;
    }
    const blocking = clash(change, [ev.id]);
    if (blocking.length > 0) {
      const proposal = proposeReseat({
        need: {
          start: change.start,
          end: change.end,
          compatKey: ev.compatKey,
          size: ev.size,
          preferredResourceId: change.resourceId,
          excludeEventId: ev.id
        },
        events: all,
        resources,
        bufferMin
      });
      if (proposal && proposal.resourceId === change.resourceId && proposal.moves.length > 0) {
        offerShuffle(proposal, ev.title, async () => {
          const moves = movesToChanges(all, proposal.moves);
          await ctl.commit('reseat', [...moves, change], `${describe(ev, change)} and re-seated ${moves.length}`, all);
        });
        return;
      }
      ctl.refuse([ev.id], `That time overlaps ${blocking.map((b) => b.title).join(', ')}.`);
      return;
    }
    const kind = r.kind === 'move' ? 'move' : 'resize';
    if (await ctl.commit(kind, [change], describe(ev, change), all)) void settle(ev.id);
  }

  // ── create ───────────────────────────────────────────────────────────
  function requestCreate(draft: EventDraft) {
    const compatKey = draft.template?.compatKey;
    const target = resourceOf(draft.resourceId);
    if (draft.resourceId && clash({ id: '__new', ...draft }, []).length > 0) {
      const proposal = proposeReseat({
        need: { start: draft.start, end: draft.end, compatKey: compatKey ?? target?.compatKey, preferredResourceId: draft.resourceId },
        events: all,
        resources,
        bufferMin
      });
      if (proposal && proposal.moves.length > 0) {
        offerShuffle(proposal, draft.template?.label ?? labels.newEvent, async () => {
          const ok = await ctl.commit('reseat', movesToChanges(all, proposal.moves), `Re-seated ${labels.eventsLower}`, all);
          if (ok) oncreate?.({ ...draft, resourceId: proposal.resourceId });
        });
        return;
      }
      if (proposal) {
        oncreate?.({ ...draft, resourceId: proposal.resourceId });
        return;
      }
      ctl.toast({ tone: 'error', message: labels.noneFree }, 6000);
      return;
    }
    oncreate?.(draft);
  }

  function search(q: { durationMin: number; size?: number; compatKey?: string }, excludeIds: string[] = []): OpenSlot[] {
    return findOpenSlots({
      events: all,
      resources: visibleResources,
      durationMin: q.durationMin,
      size: q.size,
      compatKey: q.compatKey,
      from: day < today ? today : day,
      to: addDays(day < today ? today : day, 13),
      timeZone,
      hours: hoursFor,
      stepMin: snapMin,
      bufferMin,
      now,
      excludeIds,
      staff: staffing,
      limit: 8
    });
  }

  function addNext(template?: EventTemplate) {
    const [slot] = search({ durationMin: template?.durationMin ?? defaultDuration, compatKey: template?.compatKey });
    if (slot) requestCreate({ start: slot.start, end: slot.end, resourceId: slot.resourceId, template });
    else {
      const start = zonedToIso(day, snap(Math.max(bounds.start, zonedParts(now, timeZone).minutes), 60), timeZone);
      requestCreate({ start, end: new Date(Date.parse(start) + defaultDuration * 60_000).toISOString(), template });
    }
  }

  // ── shuffle preview ──────────────────────────────────────────────────
  let shuffle = $state<{ proposal: ReseatProposal; label: string; accept: () => Promise<void> } | null>(null);
  function offerShuffle(proposal: ReseatProposal, label: string, accept: () => Promise<void>) {
    shuffle = { proposal, label, accept };
  }

  // ── selection / modal ────────────────────────────────────────────────
  let selected = $state<string | null>(null);
  const selectedEvent = $derived(selected ? (byId.get(selected) ?? null) : null);
  function select(ev: CalendarEvent) {
    selected = ev.id;
    onselect?.(ev);
  }

  function findTimes(ev: CalendarEvent): OpenSlot[] {
    return search({ durationMin: minutesBetween(ev.start, ev.end), size: ev.size, compatKey: ev.compatKey }, [ev.id]);
  }

  async function moveTo(ev: CalendarEvent, slot: OpenSlot) {
    selected = null;
    const change = { id: ev.id, start: slot.start, end: slot.end, resourceId: slot.resourceId };
    if (await ctl.commit('move', [change], describe(ev, change), all)) void settle(ev.id);
  }

  function resolve(ev: CalendarEvent) {
    const proposal = proposeConflictResolution({ eventId: ev.id, events: all, resources, bufferMin });
    selected = null;
    if (!proposal) {
      ctl.toast({ tone: 'error', message: labels.noneCompatibleFree }, 6000);
      return;
    }
    offerShuffle(proposal, ev.title, async () => {
      await ctl.commit('reseat', movesToChanges(all, proposal.moves), `Resolved the conflict for ${ev.title}`, all);
    });
  }

  // ── navigation ───────────────────────────────────────────────────────
  function transition(fn: () => void) {
    const doc = typeof document !== 'undefined' ? (document as Document & { startViewTransition?: (cb: () => void) => unknown }) : null;
    if (doc?.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(fn);
    else fn();
  }
  function step(dir: -1 | 1) {
    const n = active === 'month' ? 0 : range.days.length;
    transition(() => {
      if (active === 'month') {
        const [y, m] = day.split('-').map(Number);
        const t = new Date(Date.UTC(y, m - 1 + dir, 1));
        date = t.toISOString().slice(0, 10);
      } else date = addDays(day, dir * n);
    });
  }
  const setView = (v: ViewKind) =>
    transition(() => {
      if (compact) phoneView = v;
      else view = v;
    });
  const setSidebar = (open: boolean) => {
    if (compact) drawer = open;
    else sidebarOpen = open;
  };
  const openDay = (d: string) =>
    transition(() => {
      date = d;
      if (compact) phoneView = resources.length > 0 ? 'resource-day' : 'day';
      else if (active === 'month' || active === 'week' || active === 'resource-week' || active === 'timeline-week') {
        view = active === 'timeline-week' ? 'timeline-day' : active === 'resource-week' || resources.length > 0 ? 'resource-day' : 'day';
      }
    });

  // ── keyboard move mode (WCAG 2.5.7) ──────────────────────────────────
  let kb = $state<{ id: string; change: EventChange } | null>(null);
  const laneOrder = $derived(laneResources.length > 0 ? laneResources : visibleResources);
  function kbStart(ev: CalendarEvent) {
    kb = { id: ev.id, change: { id: ev.id, start: ev.start, end: ev.end, resourceId: ev.resourceId } };
    dnd.preview = { date: zonedParts(ev.start, timeZone).date, resourceId: ev.resourceId, start: ev.start, end: ev.end };
    ctl.announce(`Moving ${ev.title}. Arrow keys move, Shift with up or down changes the length, Enter drops, Escape cancels.`);
  }
  function kbNudge(ev: CalendarEvent, key: string, shift: boolean): boolean {
    if (!kb) return false;
    let { start, end, resourceId } = kb.change;
    const ms = snapMin * 60_000;
    const horizontal = active === 'timeline-day' || active === 'timeline-week';
    const timeBack = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const timeFwd = horizontal ? 'ArrowRight' : 'ArrowDown';
    const otherBack = horizontal ? 'ArrowUp' : 'ArrowLeft';
    const otherFwd = horizontal ? 'ArrowDown' : 'ArrowRight';
    if (key === timeBack || key === timeFwd) {
      const d = key === timeFwd ? ms : -ms;
      if (shift) end = new Date(Math.max(Date.parse(start) + ms, Date.parse(end) + d)).toISOString();
      else {
        start = new Date(Date.parse(start) + d).toISOString();
        end = new Date(Date.parse(end) + d).toISOString();
      }
    } else if (key === otherBack || key === otherFwd) {
      const dir = key === otherFwd ? 1 : -1;
      const idx = laneOrder.findIndex((r) => r.id === resourceId);
      if (laneOrder.length > 1 && idx !== -1 && laneOrder[idx + dir]) resourceId = laneOrder[idx + dir].id;
      else {
        start = new Date(Date.parse(start) + dir * 86_400_000).toISOString();
        end = new Date(Date.parse(end) + dir * 86_400_000).toISOString();
      }
    } else return false;
    kb = { id: ev.id, change: { id: ev.id, start, end, resourceId } };
    dnd.preview = { date: zonedParts(start, timeZone).date, resourceId, start, end };
    ctl.announce(`${timeOf(start, timeZone, locale)}${resourceId ? `, ${resourceOf(resourceId)?.title ?? ''}` : ''}`);
    return true;
  }
  function kbCommit() {
    const k = kb;
    kb = null;
    dnd.preview = null;
    if (!k) return;
    const ev = byId.get(k.id);
    if (!ev) return;
    const resized = minutesBetween(k.change.start, k.change.end) !== minutesBetween(ev.start, ev.end);
    void handleDrop({ kind: resized ? 'resize-end' : 'move', eventId: ev.id, preview: { date: '', ...k.change } });
  }
  function kbCancel() {
    kb = null;
    dnd.preview = null;
    ctl.announce('Move cancelled.');
  }

  let root: HTMLDivElement | undefined = $state();
  function onkeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && ctl.canUndo) {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      void ctl.undo(all);
    }
  }

  setCalendarContext({
    get tz() {
      return timeZone;
    },
    get locale() {
      return locale;
    },
    get snapMin() {
      return snapMin;
    },
    get slotMin() {
      return slotMin;
    },
    get editable() {
      return editable && !!onchange;
    },
    get now() {
      return now;
    },
    get compact() {
      return compact;
    },
    get resources() {
      return resources;
    },
    get labels() {
      return labels;
    },
    dnd,
    ctl,
    get eventContent() {
      return eventContent;
    },
    get conflicts() {
      return conflicts;
    },
    coverage: (d) => coverage.get(d),
    calendar: (id) => (id ? calendars.find((c) => c.id === id) : undefined),
    resource: resourceOf,
    select,
    keyboardStart: kbStart,
    keyboardNudge: kbNudge,
    keyboardCommit: kbCommit,
    keyboardCancel: kbCancel,
    get keyboardId() {
      return kb?.id ?? null;
    },
    openDay
  } satisfies CalendarContext);

  const timeline = $derived(active === 'timeline-day' || active === 'timeline-week');
  const grid = $derived(active === 'day' || active === 'week' || active === 'resource-day' || active === 'resource-week');
  const ppm = $derived(compact ? 1.1 : 1.25);
  const tlPpm = $derived(active === 'timeline-week' ? 0.6 : compact ? 1.6 : 2);
</script>

<svelte:window onkeydown={(e) => root?.contains(e.target as Node) && onkeydown(e)} />

<div
  class="osl"
  class:osl-is-compact={compact}
  class:osl-side-open={sideShown}
  bind:clientWidth={width}
  bind:this={root}
  role="region"
  aria-roledescription="calendar"
  aria-label="{title}, {VIEW_LABELS[active]}"
>
  <p id="osl-move-help" class="osl-sr">Press M to move with the arrow keys, or Enter to open.</p>

  {#if sideShown}
    {#if compact}
      <button type="button" class="osl-scrim" aria-label="Close sidebar" onclick={() => setSidebar(false)}></button>
    {/if}
    <Sidebar
      date={day}
      {today}
      {firstDay}
      {calendars}
      resources={ordered}
      {templates}
      {hiddenCalendars}
      {hiddenResources}
      {marked}
      onpick={(d) => {
        transition(() => (date = d));
        if (compact) drawer = false;
      }}
      onadd={() => addNext()}
      ontoggleCalendar={(id) => (hiddenCalendars = toggle(hiddenCalendars, id))}
      ontoggleResource={(id) => (hiddenResources = toggle(hiddenResources, id))}
      onuseTemplate={(t) => addNext(t)}
      onclose={() => setSidebar(false)}
    >
      <Assistant
        {compatOptions}
        durations={[...new Set([...templates.map((t) => t.durationMin), 30, 60, 90, 120])].sort((a, b) => a - b)}
        search={(q) => search(q)}
        onpick={(s) => requestCreate({ start: s.start, end: s.end, resourceId: s.resourceId })}
      />
    </Sidebar>
  {/if}

  <div class="osl-main">
    <Toolbar
      {title}
      view={active}
      views={offered}
      date={day}
      sidebarOpen={sideShown}
      canUndo={ctl.canUndo}
      onview={setView}
      ondate={(d) => transition(() => (date = d))}
      onstep={step}
      ontoday={() => transition(() => (date = today))}
      ontoggleSidebar={() => setSidebar(!sideShown)}
      onundo={() => void ctl.undo(all)}
    />

    {#if compact && active === 'resource-day' && visibleResources.length > 1}
      <div class="osl-chips" role="radiogroup" aria-label={labels.resource}>
        {#each visibleResources as r (r.id)}
          <button
            type="button"
            role="radio"
            class="osl-chip-btn"
            aria-checked={laneResources[0]?.id === r.id}
            onclick={() => (phoneResource = r.id)}>{r.title}</button
          >
        {/each}
      </div>
    {/if}

    <div class="osl-body" class:osl-dragging-on={dnd.preview !== null}>
      {#if grid}
        <TimeGrid
          days={range.days}
          resources={laneResources}
          events={shown}
          {ghost}
          startMin={bounds.start}
          endMin={bounds.end}
          {ppm}
          {hoursFor}
        />
      {:else if timeline}
        <Timeline
          days={range.days}
          resources={visibleResources}
          events={shown}
          {ghost}
          startMin={bounds.start}
          endMin={bounds.end}
          ppm={tlPpm}
          {hoursFor}
        />
      {:else if active === 'month'}
        <MonthGrid days={range.days} date={day} events={shown} {ghost} maxPerDay={compact ? 2 : 4} />
      {:else}
        <ListView days={range.days} events={shown} resources={visibleResources} groupByResource={compact} onswipe={(dir) => step(dir)} />
      {/if}
    </div>

    {#if compact && fab}
      <button type="button" class="osl-fab" aria-label={labels.newEvent} onclick={() => addNext()}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.5" /></svg>
      </button>
    {/if}
  </div>

  <EventModal
    event={selectedEvent}
    onclose={() => (selected = null)}
    {findTimes}
    onmoveTo={moveTo}
    onresolve={resolve}
    actions={eventActions}
    details={eventDetails}
  />
  <ShufflePreview
    proposal={shuffle?.proposal ?? null}
    events={all}
    needLabel={shuffle?.label ?? ''}
    onaccept={() => {
      const s = shuffle;
      shuffle = null;
      void s?.accept();
    }}
    onreject={() => (shuffle = null)}
  />
  <Toasts {ctl} />
</div>
