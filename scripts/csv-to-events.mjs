#!/usr/bin/env node
// Convert a CSV file to TruFacet's JSON event format (optional convenience).
// The web UI already accepts CSV directly — this is just for scripting.
//
// Usage:
//   node scripts/csv-to-events.mjs path/to/data.csv [--out events.json]
//
// CSV must have a header row with at least `timestamp` and `category`.

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const out = outIdx !== -1 ? args[outIdx + 1] : null;

if (!file) {
  console.error("Usage: node scripts/csv-to-events.mjs path/to/data.csv [--out events.json]");
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const rows = splitRows(text);
const header = rows[0].map((h) => h.trim().toLowerCase());
const ts = header.indexOf("timestamp");
const cat = header.indexOf("category");
const act = header.indexOf("action");
const val = header.indexOf("value");
if (ts === -1 || cat === -1) {
  console.error('CSV must have "timestamp" and "category" columns.');
  process.exit(1);
}

const events = [];
for (let r = 1; r < rows.length; r++) {
  const c = rows[r];
  if (c.length === 1 && c[0] === "") continue;
  if (!c[ts] || Number.isNaN(Date.parse(c[ts]))) continue;
  const ev = { timestamp: new Date(c[ts].trim()).toISOString(), category: c[cat].trim().toLowerCase() };
  if (act !== -1 && c[act]?.trim()) ev.action = c[act].trim();
  if (val !== -1 && c[val]?.trim() && !Number.isNaN(Number(c[val]))) ev.value = Number(c[val]);
  events.push(ev);
}
events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

function splitRows(t) {
  const rows = [];
  let f = "", row = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const json = JSON.stringify(events, null, 2);
if (out) {
  writeFileSync(out, json);
  console.error(`Wrote ${events.length} events to ${out}`);
} else {
  process.stdout.write(json + "\n");
}
