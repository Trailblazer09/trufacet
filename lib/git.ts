// ─────────────────────────────────────────────────────────────
// Turn a git repository's commit history into TruFacet activity events.
//
// Accepts EITHER a local path OR a remote URL. For a URL we do a quiet,
// blobless clone into a temp dir (commit metadata only — no file
// contents), extract, then delete the temp dir. This is the same logic
// the `git-to-events` CLI uses, exposed so the web app can pull a repo
// on the user's request.
//
// NOTE: server-side cloning works when TruFacet runs locally. It will not
// work on a read-only/serverless host (e.g. Vercel) that has no git.
// ─────────────────────────────────────────────────────────────

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ActivityEvent } from "./types";

export class GitError extends Error {}

// Only these transports are treated as remote URLs. We deliberately do
// NOT match git's `ext::`/`file://` transports — `ext::` can execute
// arbitrary commands, so anything else is treated as a local path.
const URL_RE = /^(https?:\/\/|git@[\w.-]+:|ssh:\/\/|git:\/\/)/i;

export function isRepoUrl(s: string): boolean {
  return URL_RE.test(s.trim());
}

export interface GitOptions {
  /** Local path or remote URL. */
  repo: string;
  /** Optional author filter (name or email substring). */
  author?: string;
  /** Restrict remote URLs to http(s) only — used by the web route. */
  httpOnly?: boolean;
}

/** Extract events from a local repo or a remote URL (cloned to a temp dir). */
export function eventsFromGit({ repo, author, httpOnly }: GitOptions): ActivityEvent[] {
  const target = (repo || "").trim();
  if (!target) throw new GitError("No repository path or URL provided.");

  if (isRepoUrl(target)) {
    if (httpOnly && !/^https?:\/\//i.test(target)) {
      throw new GitError("Only http(s) repository URLs are accepted here.");
    }
    return withClone(target, (dir) => extract(dir, author));
  }
  return extract(target, author);
}

function withClone<T>(url: string, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "trufacet-git-"));
  try {
    try {
      // Blobless + no checkout: fetch the full commit graph (we need every
      // commit's date for time-pattern analysis) without file contents.
      execFileSync(
        "git",
        ["clone", "--quiet", "--no-checkout", "--filter=blob:none", url, dir],
        { stdio: ["ignore", "ignore", "pipe"], timeout: 90_000 }
      );
    } catch (e) {
      throw new GitError(
        `Could not clone "${url}". Check the URL is correct and the repo is public. ${trim(e)}`
      );
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function extract(repoPath: string, author?: string): ActivityEvent[] {
  const gitArgs = [
    "-C",
    repoPath,
    "log",
    "--no-merges",
    "--pretty=format:%aI%x09%an%x09%ae%x09%s",
  ];
  if (author) gitArgs.push(`--author=${author}`);

  let raw: string;
  try {
    raw = execFileSync("git", gitArgs, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
    });
  } catch (e) {
    throw new GitError(`Could not read git history. ${trim(e)}`);
  }

  const events: ActivityEvent[] = [];
  for (const line of raw.split("\n")) {
    const [iso, name, email, ...rest] = line.split("\t");
    if (!iso || Number.isNaN(Date.parse(iso))) continue;
    const subject = rest.join("\t");
    events.push({
      timestamp: new Date(iso).toISOString(),
      category: "code",
      action: commitType(subject),
      metadata: {
        author: name?.trim() || "unknown",
        email: email?.trim() || "",
        subject: (subject || "").slice(0, 120),
      },
    });
  }

  if (events.length === 0) {
    if (author) {
      throw new GitError(
        `No commits matched author "${author}". Check the name/email — a substring works too (e.g. just your first name or the email).`
      );
    }
    throw new GitError("No commits found in that repository.");
  }

  events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return events;
}

export function commitType(subject = ""): string {
  const m = subject.match(/^(\w+)(\(.+?\))?!?:/);
  const known = ["feat", "fix", "docs", "refactor", "test", "chore", "style", "perf", "build", "ci"];
  if (m && known.includes(m[1].toLowerCase())) return `commit_${m[1].toLowerCase()}`;
  return "commit";
}

function trim(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 200);
}
