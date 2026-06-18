// ─────────────────────────────────────────────────────────────
// Turn a GitHub user's recent public activity into TruFacet events.
//
// Uses GitHub's public Events API — no auth required. GitHub only exposes
// roughly the last 90 days / 300 events of public activity, which is plenty
// for time-of-day, weekday, streak, and cadence patterns. Set GITHUB_TOKEN
// to raise the unauthenticated rate limit (60/hr) if you hit it.
//
// Events are bucketed into categories (code / discussion / community) so the
// engine's cross-category correlations have something to work with.
// ─────────────────────────────────────────────────────────────

import type { ActivityEvent } from "./types";
import { commitType } from "./git";

export class GithubError extends Error {}

const API = "https://api.github.com";
const MAX_PAGES = 3; // 3 × 100 = up to 300 events (the API's practical ceiling)

export async function eventsFromGithubUser(
  username: string
): Promise<{ events: ActivityEvent[]; login: string }> {
  const user = (username || "").trim().replace(/^@/, "");
  if (!user) throw new GithubError("Enter a GitHub username.");
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(user)) {
    throw new GithubError(`"${user}" isn't a valid GitHub username.`);
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "trufacet",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || "";
  if (token) headers.Authorization = `Bearer ${token}`;

  const events: ActivityEvent[] = [];
  let login = user;

  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetch(
        `${API}/users/${encodeURIComponent(user)}/events/public?per_page=100&page=${page}`,
        { headers }
      );
    } catch (e) {
      throw new GithubError(`Could not reach GitHub. ${(e as Error).message.slice(0, 160)}`);
    }

    if (res.status === 404) throw new GithubError(`GitHub user "${user}" not found.`);
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining === "0" || res.status === 429) {
        throw new GithubError(
          "GitHub API rate limit reached. Try again later, or set GITHUB_TOKEN to raise the limit."
        );
      }
      throw new GithubError("GitHub denied the request (403).");
    }
    if (!res.ok) throw new GithubError(`GitHub request failed (${res.status}).`);

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const ev of batch) {
      if (ev?.actor?.login) login = ev.actor.login;
      mapEvent(events, ev);
    }
    if (batch.length < 100) break; // last page
  }

  if (events.length === 0) {
    throw new GithubError(
      `No recent public activity for "${user}". GitHub only exposes about the last 90 days of public events.`
    );
  }

  events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return { events, login };
}

// One GitHub event → one (or, for pushes, several) ActivityEvent(s).
function mapEvent(out: ActivityEvent[], ev: any): void {
  const ts = ev?.created_at;
  if (!ts || Number.isNaN(Date.parse(ts))) return;
  const repo = ev?.repo?.name || "";
  const type = ev?.type || "";

  // Pushes carry their individual commits — expand them so commit-message
  // classification (feat/fix/docs…) and cadence work like the git adapter.
  if (type === "PushEvent" && Array.isArray(ev?.payload?.commits) && ev.payload.commits.length) {
    for (const c of ev.payload.commits) {
      out.push({
        timestamp: ts,
        category: "code",
        action: commitType(c?.message || ""),
        metadata: { repo, message: String(c?.message || "").slice(0, 120) },
      });
    }
    return;
  }

  const { category, action } = classify(type);
  out.push({ timestamp: ts, category, action, metadata: { repo, type } });
}

function classify(type: string): { category: string; action: string } {
  switch (type) {
    case "PushEvent": // fallback when the push carries no expandable commit list
      return { category: "code", action: "push" };
    case "PullRequestEvent":
      return { category: "code", action: "pull_request" };
    case "CreateEvent":
      return { category: "code", action: "create" };
    case "DeleteEvent":
      return { category: "code", action: "delete" };
    case "PullRequestReviewEvent":
    case "PullRequestReviewCommentEvent":
      return { category: "discussion", action: "pr_review" };
    case "IssuesEvent":
      return { category: "discussion", action: "issue" };
    case "IssueCommentEvent":
    case "CommitCommentEvent":
      return { category: "discussion", action: "comment" };
    case "GollumEvent":
      return { category: "discussion", action: "wiki" };
    case "WatchEvent":
      return { category: "community", action: "star" };
    case "ForkEvent":
      return { category: "community", action: "fork" };
    case "ReleaseEvent":
      return { category: "community", action: "release" };
    case "PublicEvent":
      return { category: "community", action: "open_sourced" };
    case "MemberEvent":
      return { category: "community", action: "member" };
    default:
      return { category: "activity", action: (type || "event").replace(/Event$/, "").toLowerCase() || "event" };
  }
}
