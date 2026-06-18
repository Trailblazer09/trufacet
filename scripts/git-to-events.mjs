#!/usr/bin/env node
// Turn a real git repository's history into TruFacet activity events.
//
// Usage:
//   node scripts/git-to-events.mjs [path-or-url] [--author "Your Name"] [--out events.json]
//
//   path-or-url : a local repo path OR a remote URL (https/ssh/git). A URL is
//                 cloned (blobless) into a temp dir and removed afterwards.
//
// Defaults: current directory, all authors, prints to stdout.
// Pipe or save the result, then paste it into the TruFacet web UI.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
let repo = ".";
let author = null;
let out = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--author") author = args[++i];
  else if (args[i] === "--out") out = args[++i];
  else if (!args[i].startsWith("--")) repo = args[i];
}

// `ext::`/`file::` transports are intentionally not treated as URLs.
const isUrl = /^(https?:\/\/|git@[\w.-]+:|ssh:\/\/|git:\/\/)/i.test(repo.trim());

let cloneDir = null;
let repoPath = repo;
if (isUrl) {
  cloneDir = mkdtempSync(join(tmpdir(), "trufacet-git-"));
  try {
    execFileSync(
      "git",
      ["clone", "--quiet", "--no-checkout", "--filter=blob:none", repo, cloneDir],
      { stdio: ["ignore", "ignore", "inherit"], timeout: 90_000 }
    );
  } catch (e) {
    cleanup();
    console.error(`Could not clone "${repo}". Check the URL and that the repo is public.`);
    console.error(e.message);
    process.exit(1);
  }
  repoPath = cloneDir;
}

const gitArgs = [
  "-C",
  repoPath,
  "log",
  "--no-merges",
  "--pretty=format:%aI%x09%an%x09%ae%x09%s",
];
if (author) gitArgs.push(`--author=${author}`);

let raw;
try {
  raw = execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  cleanup();
  console.error(`Could not read git history from "${repo}".`);
  console.error(e.message);
  process.exit(1);
}

const events = [];
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
events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

cleanup();

if (events.length === 0) {
  if (author) {
    console.error(`No commits matched author "${author}". Check the name/email — a substring works too.`);
  } else {
    console.error(`No commits found in "${repo}".`);
  }
  process.exit(1);
}

function cleanup() {
  if (cloneDir) {
    try { rmSync(cloneDir, { recursive: true, force: true }); } catch {}
    cloneDir = null;
  }
}

function commitType(subject = "") {
  const m = subject.match(/^(\w+)(\(.+?\))?!?:/);
  const known = ["feat", "fix", "docs", "refactor", "test", "chore", "style", "perf", "build", "ci"];
  if (m && known.includes(m[1].toLowerCase())) return `commit_${m[1].toLowerCase()}`;
  return "commit";
}

const json = JSON.stringify(events, null, 2);
if (out) {
  writeFileSync(out, json);
  console.error(`Wrote ${events.length} events to ${out}`);
} else {
  process.stdout.write(json + "\n");
}
