// Shared statistical helpers for the rule engine. Dependency-free.

import type { NormalizedEvent } from "../types";

export function groupBy<T, K extends string | number>(
  arr: T[],
  key: (x: T) => K
): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of arr) {
    const k = key(x);
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Coefficient of variation: stdev / mean. Lower = more regular. */
export function cv(xs: number[]): number {
  const m = mean(xs);
  return m === 0 ? 0 : stdev(xs) / m;
}

/** Sorted list of distinct day keys present in the data. */
export function distinctDays(events: NormalizedEvent[]): string[] {
  return [...new Set(events.map((e) => e.day))].sort();
}

export function spanDays(events: NormalizedEvent[]): number {
  if (events.length < 2) return 1;
  const ms = events[events.length - 1].t - events[0].t;
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function weekdayName(n: number): string {
  return WEEKDAYS[n] ?? `day ${n}`;
}

/** Map an hour to a friendly part-of-day label. */
export function partOfDay(hour: number): string {
  if (hour < 5) return "the small hours";
  if (hour < 9) return "early morning";
  if (hour < 12) return "the morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "the afternoon";
  if (hour < 22) return "the evening";
  return "late at night";
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
