// GET /api/sample  → a fresh, realistic synthetic dataset for the one-click
// demo. Ends "today" so the recency-based findings (broken streaks, etc.)
// stay meaningful no matter when the reviewer runs it.

import { NextResponse } from "next/server";
import { generateHabits } from "@/lib/samples/generateHabits";

export const runtime = "nodejs";

export async function GET() {
  const events = generateHabits({ days: 70, seed: 42, endDate: new Date() });
  return NextResponse.json({ events });
}
