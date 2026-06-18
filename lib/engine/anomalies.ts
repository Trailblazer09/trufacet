// Anomalies: days that stand out from the person's own baseline.
// Looks at daily total volume (event count, and summed `value` where present)
// and flags days more than ~2 standard deviations from the mean.

import type { Finding, NormalizedEvent } from "../types";
import { clamp01, groupBy, mean, round, stdev } from "./util";

export function analyzeAnomalies(events: NormalizedEvent[]): Finding[] {
  const findings: Finding[] = [];

  const byDay = groupBy(events, (e) => e.day);
  const days = [...byDay.keys()].sort();
  if (days.length < 7) return findings; // need a baseline

  const counts = days.map((d) => byDay.get(d)!.length);
  const m = mean(counts);
  const sd = stdev(counts);
  if (sd === 0) return findings;

  // Find the single most extreme day in each direction.
  let hiDay = "";
  let hiZ = 0;
  let loDay = "";
  let loZ = 0;
  days.forEach((d, i) => {
    const z = (counts[i] - m) / sd;
    if (z > hiZ) { hiZ = z; hiDay = d; }
    if (z < loZ) { loZ = z; loDay = d; }
  });

  if (hiZ >= 2) {
    const dayEvents = byDay.get(hiDay)!;
    const topCat = dominantCategory(dayEvents);
    findings.push({
      kind: "anomaly",
      statement: `${prettyDate(hiDay)} was an unusually busy day (${dayEvents.length} events, ${round(hiZ, 1)}× above your norm), driven by "${topCat}".`,
      salience: clamp01(hiZ / 4),
      evidence: { day: hiDay, event_count: dayEvents.length, z_score: round(hiZ, 2), dominant: topCat },
    });
  }

  // A near-total quiet day amid otherwise active stretch is also notable.
  if (loZ <= -1.5 && counts[days.indexOf(loDay)] <= Math.max(1, m * 0.3)) {
    findings.push({
      kind: "anomaly",
      statement: `${prettyDate(loDay)} was unusually quiet compared with the rest of the window.`,
      salience: clamp01(Math.abs(loZ) / 4),
      evidence: { day: loDay, event_count: byDay.get(loDay)!.length, z_score: round(loZ, 2) },
    });
  }

  return findings;
}

function dominantCategory(evs: NormalizedEvent[]): string {
  const byCat = groupBy(evs, (e) => e.category);
  let top = "";
  let n = 0;
  for (const [c, list] of byCat) if (list.length > n) { n = list.length; top = c; }
  return top;
}

function prettyDate(day: string): string {
  const d = new Date(day + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
