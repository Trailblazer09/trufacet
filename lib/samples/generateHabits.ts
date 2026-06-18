// Realistic synthetic "daily life" data with genuine patterns baked in,
// so the engine has something real to find and the demo lands.
//
// Patterns intentionally embedded (the reviewer can verify the engine
// rediscovers them):
//   - Morning-weighted person: focus blocks cluster ~9am.
//   - Exercise is an evening, ~3x/week habit, mostly Mon/Wed/Sat.
//   - On days they exercise, they go to bed earlier (positive link).
//   - Focus output sags Thu/Fri (consistency dip late week).
//   - Reading is erratic — bursts then dry spells.
//   - A gentle upward trend in exercise over the weeks.

import type { ActivityEvent } from "../types";

// Small seedable RNG so samples are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function generateHabits(opts?: { days?: number; seed?: number; endDate?: Date }): ActivityEvent[] {
  const days = opts?.days ?? 70;
  const rand = rng(opts?.seed ?? 42);
  const end = opts?.endDate ?? new Date();
  const events: ActivityEvent[] = [];

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(end);
    date.setDate(end.getDate() - d);
    date.setHours(0, 0, 0, 0);
    const weekday = date.getDay(); // 0 Sun .. 6 Sat
    const weekProgress = (days - 1 - d) / days; // 0..1 across the window

    let exercisedToday = false;

    // ── Exercise: evening, ~Mon/Wed/Sat, trending up slightly over time.
    const exerciseDay = weekday === 1 || weekday === 3 || weekday === 6;
    const exerciseProb = (exerciseDay ? 0.75 : 0.12) + weekProgress * 0.15;
    if (rand() < exerciseProb) {
      exercisedToday = true;
      const hour = 18 + Math.floor(rand() * 3); // 18-20
      events.push(ev(date, hour, rand, "exercise", "workout", 25 + Math.floor(rand() * 35)));
    }

    // ── Focus blocks: morning person, fewer & shorter Thu/Fri.
    const lateWeek = weekday === 4 || weekday === 5;
    const blocks = lateWeek ? randInt(rand, 0, 2) : randInt(rand, 1, 4);
    for (let b = 0; b < blocks; b++) {
      const hour = 9 + b * 2 + Math.floor(rand() * 2); // clustered around morning
      const len = lateWeek ? 25 + Math.floor(rand() * 20) : 40 + Math.floor(rand() * 30);
      events.push(ev(date, Math.min(hour, 19), rand, "work", "focus_block", len));
    }

    // ── Reading: erratic — most days nothing, occasional binge.
    if (rand() < 0.22) {
      const sessions = randInt(rand, 1, 3);
      for (let r = 0; r < sessions; r++) {
        events.push(ev(date, 21 + Math.floor(rand() * 2), rand, "reading", "book", 15 + Math.floor(rand() * 40)));
      }
    }

    // ── Sleep (bedtime): earlier on exercise days, later otherwise.
    // Capped at 23 so a bedtime never rolls past midnight into the next
    // calendar day (which would distort day-keyed stats).
    const baseBed = exercisedToday ? 22 : 23;
    events.push(ev(date, baseBed, rand, "sleep", "bedtime"));
  }

  return events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function ev(
  base: Date,
  hour: number,
  rand: () => number,
  category: string,
  action: string,
  value?: number
): ActivityEvent {
  const d = new Date(base);
  d.setHours(hour, Math.floor(rand() * 60), 0, 0);
  const e: ActivityEvent = { timestamp: d.toISOString(), category, action };
  if (value != null) e.value = value;
  return e;
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}
