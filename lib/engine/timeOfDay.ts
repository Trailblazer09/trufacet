// Time-of-day clustering: when during the day does each category cluster?
// Surfaces a person's rhythm — e.g. "your exercise is almost always evening".

import type { Finding, NormalizedEvent } from "../types";
import { clamp01, groupBy, mean, partOfDay, round } from "./util";

export function analyzeTimeOfDay(events: NormalizedEvent[]): Finding[] {
  const findings: Finding[] = [];
  const byCat = groupBy(events, (e) => e.category);

  for (const [cat, evs] of byCat) {
    if (evs.length < 5) continue;

    // Use circular stats so 23:00 and 01:00 are treated as close.
    const hours = evs.map((e) => e.hour);
    const { meanHour, concentration } = circularHour(hours);

    // concentration ∈ [0,1]; high = tightly clustered at one time.
    if (concentration >= 0.55) {
      const h = Math.round(meanHour) % 24;
      findings.push({
        kind: "time_of_day",
        statement: `"${cat}" almost always happens in ${partOfDay(h)} (around ${fmtHour(h)}).`,
        salience: clamp01(concentration),
        evidence: {
          category: cat,
          typical_hour: fmtHour(h),
          concentration: round(concentration, 2),
          samples: evs.length,
        },
      });
    }
  }

  // Overall "chronotype": is this person mostly a morning or night person?
  const allHours = events.map((e) => e.hour);
  const morning = allHours.filter((h) => h >= 5 && h < 12).length;
  const night = allHours.filter((h) => h >= 21 || h < 5).length;
  const total = allHours.length;
  if (total >= 10) {
    const mFrac = morning / total;
    const nFrac = night / total;
    if (mFrac >= 0.45 && mFrac > nFrac * 1.5) {
      findings.push({
        kind: "time_of_day",
        statement: `Most activity (${Math.round(mFrac * 100)}%) happens before noon — a morning-weighted rhythm.`,
        salience: clamp01(mFrac),
        evidence: { morning_fraction: round(mFrac, 2), night_fraction: round(nFrac, 2) },
      });
    } else if (nFrac >= 0.35 && nFrac > mFrac * 1.5) {
      findings.push({
        kind: "time_of_day",
        statement: `A lot of activity (${Math.round(nFrac * 100)}%) happens late at night — a night-weighted rhythm.`,
        salience: clamp01(nFrac + 0.2),
        evidence: { morning_fraction: round(mFrac, 2), night_fraction: round(nFrac, 2) },
      });
    }
  }

  return findings;
}

// Treat hours as angles on a 24h clock; returns mean hour and a 0–1
// concentration (mean resultant length R).
function circularHour(hours: number[]): { meanHour: number; concentration: number } {
  const ang = hours.map((h) => (h / 24) * 2 * Math.PI);
  const c = mean(ang.map(Math.cos));
  const s = mean(ang.map(Math.sin));
  const R = Math.sqrt(c * c + s * s);
  let theta = Math.atan2(s, c);
  if (theta < 0) theta += 2 * Math.PI;
  return { meanHour: (theta / (2 * Math.PI)) * 24, concentration: R };
}

function fmtHour(h: number): string {
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${am ? "am" : "pm"}`;
}
