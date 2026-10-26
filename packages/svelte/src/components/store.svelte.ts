/**
 * Calendar controller: optimistic changes with rollback, undo history and
 * toasts. Views read `display`; every change goes through `commit`, which
 * shows the result at once, asks the host to persist it, and rolls back (with
 * the host's error message) when the host rejects.
 */
import { type CalendarEvent, type EventChange, applyChanges, invertChanges, createHistory } from '@openslot/core';
import type { ChangeKind, ChangeRequest } from './types.js';

export interface Toast {
  id: number;
  tone: 'info' | 'error';
  message: string;
  action?: { label: string; run: () => void };
}

export const UNDO_MS = 6000;

export class CalendarController {
  /** Changes shown before the host confirmed them, by event id */
  pending = $state<Record<string, EventChange & { settled?: boolean }>>({});
  toasts = $state<Toast[]>([]);
  /** Latest sentence for the aria-live region */
  announcement = $state('');
  /** Event ids that just rolled back (views shake them once) */
  rejected = $state<string[]>([]);

  #history = createHistory(20);
  #toastSeq = 0;
  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private persist: () => ((request: ChangeRequest) => Promise<void> | void) | undefined) {}

  /** Host events with pending changes applied. */
  apply(events: CalendarEvent[]): CalendarEvent[] {
    const changes = Object.values(this.pending);
    return changes.length === 0 ? events : applyChanges(events, changes);
  }

  /** New host data arrived: confirmed changes are now part of it. */
  sync(): void {
    const keep: typeof this.pending = {};
    for (const [id, c] of Object.entries(this.pending)) if (!c.settled) keep[id] = c;
    if (Object.keys(keep).length !== Object.keys(this.pending).length) this.pending = keep;
  }

  announce(message: string): void {
    this.announcement = message;
  }

  async commit(
    kind: ChangeKind,
    changes: EventChange[],
    label: string,
    events: CalendarEvent[],
    opts: { undoable?: boolean } = {}
  ): Promise<boolean> {
    if (changes.length === 0) return false;
    const undo = invertChanges(events, changes);
    const next = { ...this.pending };
    for (const c of changes) next[c.id] = { ...c };
    this.pending = next;
    this.announce(label);
    try {
      await this.persist()?.({ kind, changes, label });
      const settled = { ...this.pending };
      for (const c of changes) if (settled[c.id]) settled[c.id] = { ...settled[c.id], settled: true };
      this.pending = settled;
      if (opts.undoable !== false) {
        this.#history.push({ label, undo, redo: changes });
        this.toast({ tone: 'info', message: label, action: { label: 'Undo', run: () => void this.undo(events) } }, UNDO_MS);
      }
      return true;
    } catch (error) {
      const rolled = { ...this.pending };
      for (const c of changes) delete rolled[c.id];
      this.pending = rolled;
      this.rejected = changes.map((c) => c.id);
      setTimeout(() => (this.rejected = []), 600);
      const reason = error instanceof Error && error.message ? error.message : 'The change could not be saved.';
      const message = `${reason} Moved back.`;
      this.toast({ tone: 'error', message }, 8000);
      this.announce(message);
      return false;
    }
  }

  /** A drop the calendar refused before asking the host: the event shakes back with the reason. */
  refuse(ids: string[], message: string): void {
    this.rejected = ids;
    setTimeout(() => (this.rejected = []), 600);
    this.toast({ tone: 'error', message }, 6000);
    this.announce(message);
  }

  /** Revert the newest change (the Undo button, or Ctrl/Cmd+Z). */
  async undo(events: CalendarEvent[]): Promise<void> {
    const entry = this.#history.pop();
    if (!entry) return;
    this.dismissAll();
    await this.commit('undo', entry.undo, `Undid: ${entry.label}`, events, { undoable: false });
  }

  get canUndo(): boolean {
    return this.#history.size > 0;
  }

  toast(t: Omit<Toast, 'id'>, ms: number): number {
    const id = ++this.#toastSeq;
    this.toasts = [...this.toasts.slice(-2), { ...t, id }];
    this.#timers.set(
      id,
      setTimeout(() => this.dismiss(id), ms)
    );
    return id;
  }

  dismiss(id: number): void {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  dismissAll(): void {
    for (const t of this.toasts) this.dismiss(t.id);
  }

  destroy(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
  }
}
