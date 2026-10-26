/**
 * Event layout. Time grid: overlapping events form a cluster and are packed
 * greedily into columns (earliest first, longer first on ties); each event
 * then widens to the right across columns that stay free for its whole time,
 * the documented behaviour of FullCalendar and Schedule-X.
 */

export interface TimedItem {
  id: string;
  startMin: number;
  endMin: number;
}

export interface PlacedItem {
  id: string;
  /** zero-based column inside its cluster */
  col: number;
  /** columns in the cluster */
  cols: number;
  /** columns the event covers (>= 1) */
  span: number;
}

export function layoutDay(items: TimedItem[]): PlacedItem[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - b.startMin - (a.endMin - a.startMin));
  const out: PlacedItem[] = [];
  let cluster: TimedItem[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns: TimedItem[][] = [];
    const colOf = new Map<string, number>();
    for (const item of cluster) {
      let c = columns.findIndex((col) => col[col.length - 1].endMin <= item.startMin);
      if (c === -1) {
        c = columns.length;
        columns.push([]);
      }
      columns[c].push(item);
      colOf.set(item.id, c);
    }
    const cols = columns.length;
    for (const item of cluster) {
      const col = colOf.get(item.id)!;
      let span = 1;
      for (let c = col + 1; c < cols; c++) {
        const blocked = columns[c].some((o) => o.startMin < item.endMin && item.startMin < o.endMin);
        if (blocked) break;
        span++;
      }
      out.push({ id: item.id, col, cols, span });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return out;
}

export interface DayItem {
  id: string;
  /** local day 'YYYY-MM-DD' */
  date: string;
}

/** Month cells: per day, the first `maxPerDay` events and how many are hidden (+N more). */
export function layoutMonthWeek<T extends DayItem>(
  items: T[],
  days: string[],
  maxPerDay: number
): Map<string, { visible: T[]; more: number }> {
  const out = new Map<string, { visible: T[]; more: number }>();
  for (const day of days) {
    const all = items.filter((i) => i.date === day);
    // When everything does not fit, one row is kept for the "+N more" link
    const fit = all.length > maxPerDay ? Math.max(0, maxPerDay - 1) : all.length;
    out.set(day, { visible: all.slice(0, fit), more: all.length - fit });
  }
  return out;
}
