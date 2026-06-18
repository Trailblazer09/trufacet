// POST /api/github
// Body: { username: string }
// Returns: { events, count, login }  — or { error } with a 400/500.
//
// Pulls a GitHub user's recent public activity (Events API) and turns it into
// TruFacet events. The client then feeds `events` into /api/insights like any
// other input. No auth needed; set GITHUB_TOKEN to raise the rate limit.

import { NextRequest, NextResponse } from "next/server";
import { eventsFromGithubUser, GithubError } from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const username = (body.username || "").trim();
  if (!username) {
    return NextResponse.json({ error: "Provide a GitHub username." }, { status: 400 });
  }

  try {
    const { events, login } = await eventsFromGithubUser(username);
    return NextResponse.json({ events, count: events.length, login });
  } catch (err) {
    if (err instanceof GithubError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("github route error", err);
    return NextResponse.json(
      { error: `Something went wrong: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
