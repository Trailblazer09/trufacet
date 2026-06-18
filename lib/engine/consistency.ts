// Consistency: which habits are clockwork, and which are erratic?
// Two angles — how many days of the week it shows up, and how even the
// gaps between occurrences are (coefficient of variation of inter-event gaps).

import type { Finding, NormalizedEvent } from "../types";
import { clamp01, cv, groupBy, round } from "./util";

export function analyzeConsistency(events: NormalizedEvent[]): Finding[] {
  const findings: Finding[] = [];
  const byCat = groupBy(events, (e) => e.category);

  for (const [cat, evs] of byCat) {
    const days = [...new Set(evs.map((e) => e.day))].sort();
    if (days.length < 5) continue;

    // Gaps (in days) between successive active days.
    const gaps: number[] = [];
    for (let i = 1; i < days.length; i++) {
      gaps.push(Math.round((Date.parse(days[i]) - Date.parse(days[i - 1])) / 86400000));
    }
    const variability = cv(gaps); // 0 = perfectly regular cadence

    if (variability <= 0.4) {
      findings.push({
        kind: "consistency",
        statement: `"${cat}" is remarkably regular — it recurs on an even cadence.`,
        salience: clamp01(0.7 - variability),
        evidence: { category: cat, gap_variability: round(variability, 2), active_days: days.length },
      });
    } else if (variability >= 1.1) {
      findings.push({
        kind: "consistency",
        statement: `"${cat}" is erratic — long dry spells punctuated by bursts.`,
        salience: clamp01(0.3 + variability / 4),
        evidence: { category: cat, gap_variability: round(variability, 2), active_days: days.length },
      });
    }

    // Which weekday is it most concentrated on?
    const byWd = groupBy(evs, (e) => e.weekday);
    let topWd = -1;
    let topCount = 0;
    for (const [wd, list] of byWd) {
      if (list.length > topCount) { topCount = list.length; topWd = wd; }
    }
    const frac = topCount / evs.length;
    if (frac >= 0.4 && evs.length >= 6) {
      findings.push({
        kind: "consistency",
        statement: `"${cat}" is heavily a ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][topWd]}-day thing (${Math.round(frac * 100)}% of them).`,
        salience: clamp01(frac),
        evidence: { category: cat, top_weekday: topWd, weekday_fraction: round(frac, 2) },
      });
    }
  }
  return findings;
}
