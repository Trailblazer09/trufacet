// POST /api/insights
// Body: { input?: string }  (raw JSON or CSV text)
//    or { events?: ActivityEvent[] }
// Returns: { facts, insight }  — or { error } with a 400/500.
//
// This is the whole pipeline in one place:
//   parse → normalize → runEngine (rules) → synthesize (LLM) → respond.

import { NextRequest, NextResponse } from "next/server";
import { InputError, normalize, parseInput } from "@/lib/parse";
import { runEngine } from "@/lib/engine";
import { synthesize } from "@/lib/llm/synthesize";
import type { ActivityEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { input?: string; events?: ActivityEvent[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  try {
    const rawEvents: ActivityEvent[] = Array.isArray(body.events)
      ? body.events
      : parseInput(body.input ?? "");

    const events = normalize(rawEvents);
    const facts = runEngine(events);
    const insight = await synthesize(facts);

    return NextResponse.json({ facts, insight });
  } catch (err) {
    if (err instanceof InputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("insights error", err);
    return NextResponse.json(
      { error: `Something went wrong: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
