#!/usr/bin/env node
// Generate a realistic sample dataset and write it to data/sample-habits.json.
// Mirrors lib/samples/generateHabits.ts (kept standalone so it runs with no build).
//
// Usage: node scripts/generate-sample.mjs [--days 70] [--seed 42] [--out data/sample-habits.json]

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : def;
};
const days = Number(getArg("--days", 70));
const seed = Number(getArg("--seed", 42));
const out = getArg("--out", "data/sample-habits.json");

function rng(s) {
  s = s >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0xffffffff);
}
const rand = rng(seed);
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const end = new Date();
const events = [];

function ev(base, hour, category, action, value) {
  const d = new Date(base);
  d.setHours(hour, Math.floor(rand() * 60), 0, 0);
  const e = { timestamp: d.toISOString(), category, action };
  if (value != null) e.value = value;
  events.push(e);
}

for (let d = days - 1; d >= 0; d--) {
  const date = new Date(end);
  date.setDate(end.getDate() - d);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  const weekProgress = (days - 1 - d) / days;
  let exercised = false;

  const exerciseDay = weekday === 1 || weekday === 3 || weekday === 6;
  if (rand() < (exerciseDay ? 0.75 : 0.12) + weekProgress * 0.15) {
    exercised = true;
    ev(date, 18 + Math.floor(rand() * 3), "exercise", "workout", 25 + Math.floor(rand() * 35));
  }

  const lateWeek = weekday === 4 || weekday === 5;
  const blocks = lateWeek ? randInt(0, 2) : randInt(1, 4);
  for (let b = 0; b < blocks; b++) {
    const hour = Math.min(9 + b * 2 + Math.floor(rand() * 2), 19);
    const len = lateWeek ? 25 + Math.floor(rand() * 20) : 40 + Math.floor(rand() * 30);
    ev(date, hour, "work", "focus_block", len);
  }

  if (rand() < 0.22) {
    const sessions = randInt(1, 3);
    for (let r = 0; r < sessions; r++) ev(date, 21 + Math.floor(rand() * 2), "reading", "book", 15 + Math.floor(rand() * 40));
  }

  ev(date, exercised ? 22 : 23, "sleep", "bedtime");
}

events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(events, null, 2));
console.error(`Wrote ${events.length} events to ${out}`);
