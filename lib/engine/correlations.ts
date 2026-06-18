// Correlations: do two categories tend to happen on the same days — or
// pointedly avoid each other? This is where the non-obvious "you didn't
// know this about yourself" findings come from.
//
// We build a per-day presence vector for each category and compute the
// phi coefficient (correlation of two binary variables) across days.

import type { Finding, NormalizedEvent } from "../types";
import { clamp01, distinctDays, groupBy, round } from "./util";

export function analyzeCorrelations(events: NormalizedEvent[]): Finding[] {
  const findings: Finding[] = [];
  const days = distinctDays(events);
  if (days.length < 8) return findings;

  const byCat = groupBy(events, (e) => e.category);
  const cats = [...byCat.keys()].filter((c) => {
    const activeDays = new Set(byCat.get(c)!.map((e) => e.day)).size;
    // Need a category that's neither too rare nor every-single-day.
    return activeDays >= 3 && activeDays <= days.length - 2;
  });

  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const presence = new Map<string, boolean[]>();
  for (const c of cats) {
    const vec = new Array(days.length).fill(false);
    for (const e of byCat.get(c)!) vec[dayIndex.get(e.day)!] = true;
    presence.set(c, vec);
  }

  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const a = presence.get(cats[i])!;
      const b = presence.get(cats[j])!;
      const phi = phiCoefficient(a, b);
      if (Math.abs(phi) < 0.35) continue;

      const together = a.filter((x, k) => x && b[k]).length;
      if (phi > 0) {
        findings.push({
          kind: "correlation",
          statement: `On days you do "${cats[i]}", you also tend to do "${cats[j]}" (and vice versa).`,
          salience: clamp01(phi),
          evidence: { a: cats[i], b: cats[j], phi: round(phi, 2), days_together: together },
        });
      } else {
        findings.push({
          kind: "correlation",
          statement: `"${cats[i]}" and "${cats[j]}" rarely share a day — when one happens, the other usually doesn't.`,
          salience: clamp01(Math.abs(phi)),
          evidence: { a: cats[i], b: cats[j], phi: round(phi, 2), days_together: together },
        });
      }
    }
  }

  // Keep only the strongest few correlations to avoid noise.
  return findings.sort((x, y) => y.salience - x.salience).slice(0, 4);
}

// Phi coefficient for two boolean vectors of equal length.
function phiCoefficient(a: boolean[], b: boolean[]): number {
  let n11 = 0, n10 = 0, n01 = 0, n00 = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) n11++;
    else if (a[i] && !b[i]) n10++;
    else if (!a[i] && b[i]) n01++;
    else n00++;
  }
  const num = n11 * n00 - n10 * n01;
  const den = Math.sqrt((n11 + n10) * (n01 + n00) * (n11 + n01) * (n10 + n00));
  return den === 0 ? 0 : num / den;
}
