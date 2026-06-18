// Week-over-week trends: is a category climbing or fading over the window?
// Uses a simple linear fit over weekly counts so a single spike doesn't lie.

import type { Finding, NormalizedEvent } from "../types";
import { clamp01, groupBy, mean, round } from "./util";

export function analyzeTrends(events: NormalizedEvent[]): Finding[] {
  const findings: Finding[] = [];
  const byCat = groupBy(events, (e) => e.category);

  // Need a few weeks for a trend to mean anything.
  const allWeeks = [...new Set(events.map((e) => e.week))].sort();
  if (allWeeks.length < 3) return findings;
  const weekIndex = new Map(allWeeks.map((w, i) => [w, i]));

  for (const [cat, evs] of byCat) {
    if (evs.length < 6) continue;

    const counts = new Array(allWeeks.length).fill(0);
    for (const e of evs) counts[weekIndex.get(e.week)!]++;

    const slope = linregSlope(counts);
    const avg = mean(counts);
    if (avg === 0) continue;

    // Normalize slope to "% change per week" relative to average volume.
    const pctPerWeek = (slope / avg) * 100;
    if (Math.abs(pctPerWeek) < 12) continue; // ignore flat-ish trends

    const rising = pctPerWeek > 0;
    findings.push({
      kind: "trend",
      statement: rising
        ? `"${cat}" has been climbing — up roughly ${Math.round(Math.abs(pctPerWeek))}% per week across the window.`
        : `"${cat}" has been fading — down roughly ${Math.round(Math.abs(pctPerWeek))}% per week across the window.`,
      salience: clamp01(Math.abs(pctPerWeek) / 60),
      evidence: {
        category: cat,
        pct_change_per_week: round(pctPerWeek),
        first_week_count: counts[0],
        last_week_count: counts[counts.length - 1],
        weeks: allWeeks.length,
      },
    });
  }
  return findings;
}

// Slope of best-fit line y = a + b·x, x = 0..n-1.
function linregSlope(y: number[]): number {
  const n = y.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = mean(xs);
  const my = mean(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (y[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
