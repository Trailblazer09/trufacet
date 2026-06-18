// Streaks & gaps: find the longest run of consecutive days a category was
// active, and flag categories that have recently fallen off.

import type { Finding, NormalizedEvent } from "../types";
import { clamp01, distinctDays, groupBy, spanDays } from "./util";

export function analyzeStreaks(events: NormalizedEvent[]): Finding[] {
  const findings: Finding[] = [];
  const byCat = groupBy(events, (e) => e.category);
  const lastDay = distinctDays(events).at(-1)!;
  const totalDays = spanDays(events);

  for (const [cat, evs] of byCat) {
    const days = [...new Set(evs.map((e) => e.day))].sort();
    if (days.length < 3) continue;

    const { longest, current } = streakLengths(days);

    // If a category happens on essentially every day, that's a constant,
    // not a streak — it's better described by the consistency analyzer.
    const coverage = days.length / totalDays;

    // A long streak relative to the window is noteworthy.
    if (longest >= 3 && coverage < 0.9) {
      const salience = clamp01(longest / Math.max(7, totalDays * 0.5));
      findings.push({
        kind: "streak",
        statement: `Longest "${cat}" streak was ${longest} days in a row.`,
        salience,
        evidence: { category: cat, longest_streak_days: longest, active_days: days.length },
      });
    }

    // A broken streak: was consistent, then stopped.
    const daysSinceLast = daysBetween(days.at(-1)!, lastDay);
    if (current === 0 && longest >= 4 && daysSinceLast >= 3) {
      findings.push({
        kind: "streak",
        statement: `"${cat}" had a ${longest}-day streak but hasn't happened in ${daysSinceLast} days.`,
        salience: clamp01(0.5 + daysSinceLast / 14),
        evidence: { category: cat, broken_after_days: longest, days_since_last: daysSinceLast },
      });
    }
  }
  return findings;
}

function streakLengths(sortedDays: string[]): { longest: number; current: number } {
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    if (daysBetween(sortedDays[i - 1], sortedDays[i]) === 1) run++;
    else run = 1;
    if (run > longest) longest = run;
  }
  // "current" run = the run ending at the last recorded day.
  let current = 1;
  for (let i = sortedDays.length - 1; i > 0; i--) {
    if (daysBetween(sortedDays[i - 1], sortedDays[i]) === 1) current++;
    else break;
  }
  return { longest, current };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
