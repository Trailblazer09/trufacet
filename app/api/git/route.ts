// POST /api/git
// Body: { url: string, author?: string }
// Returns: { events, count }  — or { error } with a 400/500.
//
// Clones the given repo URL (blobless, into a temp dir), turns its commit
// history into TruFacet events, and returns them. The client then feeds
// these into /api/insights like any other input.
//
// Cloning happens server-side, so this works when TruFacet runs locally.
// On a read-only/serverless host without git it will return an error —
// by design, the rest of the app (paste/upload) still works there.

import { NextRequest, NextResponse } from "next/server";
import { eventsFromGit, GitError } from "@/lib/git";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  let body: { url?: string; author?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const url = (body.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "Provide a repository URL." }, { status: 400 });
  }

  try {
    const events = eventsFromGit({
      repo: url,
      author: body.author?.trim() || undefined,
      httpOnly: true,
    });
    return NextResponse.json({ events, count: events.length });
  } catch (err) {
    if (err instanceof GitError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("git route error", err);
    return NextResponse.json(
      { error: `Something went wrong: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
