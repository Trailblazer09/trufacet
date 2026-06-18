// ─────────────────────────────────────────────────────────────
// Input parsing + validation.
//
// Accepts EITHER a JSON array of events OR a CSV with a header row.
// Produces clean NormalizedEvent[] or throws a clear, user-facing error.
// ─────────────────────────────────────────────────────────────

import type { ActivityEvent, NormalizedEvent } from "./types";

export class InputError extends Error {}

/** Detect format and parse to raw ActivityEvent[]. */
export function parseInput(raw: string): ActivityEvent[] {
  const text = raw.trim();
  if (!text) throw new InputError("Input is empty. Paste some events or load a sample.");

  // JSON if it starts like JSON.
  if (text[0] === "[" || text[0] === "{") {
    return parseJson(text);
  }
  // Otherwise assume CSV.
  return parseCsv(text);
}

function parseJson(text: string): ActivityEvent[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new InputError(`That isn't valid JSON: ${(e as Error).message}`);
  }
  const arr = Array.isArray(data) ? data : (data as { events?: unknown }).events;
  if (!Array.isArray(arr)) {
    throw new InputError('Expected a JSON array of events, or an object with an "events" array.');
  }
  return arr as ActivityEvent[];
}

// Minimal, dependency-free CSV reader. Handles quoted fields and commas
// inside quotes. Header row required; `timestamp` and `category` columns
// are mandatory, `action`/`value` optional, everything else → metadata.
function parseCsv(text: string): ActivityEvent[] {
  const rows = splitCsvRows(text);
  if (rows.length < 2) throw new InputError("CSV needs a header row and at least one data row.");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const tsIdx = header.indexOf("timestamp");
  const catIdx = header.indexOf("category");
  if (tsIdx === -1 || catIdx === -1) {
    throw new InputError('CSV must have at least "timestamp" and "category" columns.');
  }
  const actIdx = header.indexOf("action");
  const valIdx = header.indexOf("value");

  const events: ActivityEvent[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === "") continue; // blank line
    const ev: ActivityEvent = {
      timestamp: cells[tsIdx]?.trim() ?? "",
      category: cells[catIdx]?.trim() ?? "",
    };
    if (actIdx !== -1 && cells[actIdx]?.trim()) ev.action = cells[actIdx].trim();
    if (valIdx !== -1 && cells[valIdx]?.trim() !== "" && cells[valIdx] != null) {
      const n = Number(cells[valIdx]);
      if (!Number.isNaN(n)) ev.value = n;
    }
    // Stash any extra columns as metadata.
    const meta: Record<string, unknown> = {};
    header.forEach((h, i) => {
      if (![tsIdx, catIdx, actIdx, valIdx].includes(i) && cells[i]?.trim()) meta[h] = cells[i].trim();
    });
    if (Object.keys(meta).length) ev.metadata = meta;
    events.push(ev);
  }
  return events;
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Validate + enrich into NormalizedEvent[], sorted by time. */
export function normalize(events: ActivityEvent[]): NormalizedEvent[] {
  if (events.length === 0) throw new InputError("No events found in input.");

  const out: NormalizedEvent[] = [];
  let bad = 0;
  for (const ev of events) {
    if (!ev || typeof ev !== "object") { bad++; continue; }
    if (!ev.timestamp || !ev.category) { bad++; continue; }
    const t = Date.parse(ev.timestamp);
    if (Number.isNaN(t)) { bad++; continue; }
    const d = new Date(t);
    out.push({
      ...ev,
      category: String(ev.category).toLowerCase().trim(),
      t,
      weekday: d.getDay(),
      hour: d.getHours(),
      day: dayKey(d),
      week: isoWeekKey(d),
    });
  }

  if (out.length === 0) {
    throw new InputError("Every row was missing a valid `timestamp` or `category`.");
  }
  if (bad > out.length) {
    throw new InputError(`Most rows (${bad}) were invalid — check your timestamp/category fields.`);
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoWeekKey(d: Date): string {
  // ISO week number.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
