/** A small undo stack of event changes (newest last). */
import type { EventChange } from './types.js';

export interface HistoryEntry {
  label: string;
  undo: EventChange[];
  redo: EventChange[];
}

export interface History {
  push(entry: HistoryEntry): void;
  pop(): HistoryEntry | undefined;
  peek(): HistoryEntry | undefined;
  readonly size: number;
  clear(): void;
}

export function createHistory(limit = 20): History {
  const stack: HistoryEntry[] = [];
  return {
    push(entry) {
      stack.push(entry);
      if (stack.length > limit) stack.shift();
    },
    pop: () => stack.pop(),
    peek: () => stack[stack.length - 1],
    get size() {
      return stack.length;
    },
    clear() {
      stack.length = 0;
    }
  };
}
