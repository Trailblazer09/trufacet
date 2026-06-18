"use client";

import { useState } from "react";
import type { Facts, Finding, Insight } from "@/lib/types";

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [insight, setInsight] = useState<Insight | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoAuthor, setRepoAuthor] = useState("");
  const [fetching, setFetching] = useState(false);
  const [repoNote, setRepoNote] = useState("");
  const [ghUser, setGhUser] = useState("");
  const [ghFetching, setGhFetching] = useState(false);
  const [ghNote, setGhNote] = useState("");

  async function loadSample() {
    setError("");
    const res = await fetch("/api/sample");
    const data = await res.json();
    setInput(JSON.stringify(data.events, null, 2));
  }

  async function fetchFromRepo() {
    if (!repoUrl.trim()) return;
    setFetching(true);
    setError("");
    setRepoNote("");
    try {
      const res = await fetch("/api/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repoUrl, author: repoAuthor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not read that repository.");
      } else {
        setInput(JSON.stringify(data.events, null, 2));
        setRepoNote(
          `Loaded ${data.count} commit${data.count === 1 ? "" : "s"}${
            repoAuthor.trim() ? ` by "${repoAuthor.trim()}"` : ""
          } — now click “Show me my insight”.`
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetching(false);
    }
  }

  async function fetchFromGithubUser() {
    if (!ghUser.trim()) return;
    setGhFetching(true);
    setError("");
    setGhNote("");
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ghUser }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not read that GitHub user.");
      } else {
        setInput(JSON.stringify(data.events, null, 2));
        setGhNote(
          `Loaded ${data.count} public event${data.count === 1 ? "" : "s"} for @${data.login} — now click “Show me my insight”.`
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGhFetching(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setInput(await file.text());
    e.target.value = "";
  }

  async function analyze() {
    setLoading(true);
    setError("");
    setInsight(null);
    setFacts(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed.");
      } else {
        setInsight(data.insight);
        setFacts(data.facts);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav>
        <span className="nav-logo">
          TruFacet<span className="nav-logo-arrow" aria-hidden="true">↕</span>
        </span>
        <div className="nav-right">
          <button className="nav-btn" onClick={loadSample} disabled={loading}>
            Load sample data
          </button>
        </div>
      </nav>

      <section id="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" aria-hidden="true" /> Self-insight engine
        </div>
        <h1>
          <span className="h1-fade">One thing you couldn&apos;t</span>
          <span className="h1-fade">see on your own.</span>
        </h1>
        <p className="hero-sub">
          Feed it a stream of your activity. It finds the patterns you can&apos;t see from
          the inside — then tells you the one that matters. Rules do the math; an LLM does
          the meaning.
        </p>
      </section>
      <div className="hero-layer hero-layer-2" aria-hidden="true" />
      <div className="hero-layer hero-layer-3" aria-hidden="true" />

      <main className="wrap">
      <div className="card">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Paste activity events as JSON or CSV, e.g.\n\n[\n  { "timestamp": "2026-06-10T09:14:00Z", "category": "work", "action": "focus_block", "value": 52 },\n  { "timestamp": "2026-06-10T18:30:00Z", "category": "exercise", "action": "run", "value": 30 }\n]`}
        />
        <div className="row">
          <button className="primary" onClick={analyze} disabled={loading || !input.trim()}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Reading you…" : "Show me my insight"}
          </button>
          <button onClick={loadSample} disabled={loading}>
            Load sample data
          </button>
          <label className="file">
            <button
              type="button"
              onClick={(e) => (e.currentTarget.nextElementSibling as HTMLInputElement)?.click()}
            >
              Upload JSON / CSV
            </button>
            <input type="file" accept=".json,.csv,.txt,application/json,text/csv" onChange={onFile} />
          </label>
        </div>

        <div className="gitbox">
          <span className="gitlabel">Or pull from a git repo</span>
          <div className="row">
            <input
              type="text"
              className="gitinput grow"
              placeholder="https://github.com/user/repo.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <input
              type="text"
              className="gitinput"
              placeholder="Author (optional)"
              value={repoAuthor}
              onChange={(e) => setRepoAuthor(e.target.value)}
            />
            <button onClick={fetchFromRepo} disabled={fetching || !repoUrl.trim()}>
              {fetching ? <span className="spinner" /> : null}
              {fetching ? "Reading repo…" : "Fetch commits"}
            </button>
          </div>
          {repoNote ? <p className="hint" style={{ color: "var(--brand)" }}>{repoNote}</p> : null}
          <p className="hint" style={{ marginTop: 6 }}>
            Reads the repo&apos;s commit history (public repos). Give an author name or
            email to see one person&apos;s pattern. Works when TruFacet runs locally.
          </p>
        </div>

        <div className="gitbox">
          <span className="gitlabel">Or pull from a GitHub user</span>
          <div className="row">
            <input
              type="text"
              className="gitinput grow"
              placeholder="GitHub username, e.g. torvalds"
              value={ghUser}
              onChange={(e) => setGhUser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchFromGithubUser();
              }}
            />
            <button onClick={fetchFromGithubUser} disabled={ghFetching || !ghUser.trim()}>
              {ghFetching ? <span className="spinner" /> : null}
              {ghFetching ? "Reading activity…" : "Fetch activity"}
            </button>
          </div>
          {ghNote ? <p className="hint" style={{ color: "var(--brand)" }}>{ghNote}</p> : null}
          <p className="hint" style={{ marginTop: 6 }}>
            Reads the user&apos;s recent public activity (pushes, PRs, issues, stars).
            GitHub exposes roughly the last 90 days — enough to surface their coding
            rhythm and focus windows.
          </p>
        </div>

        <p className="hint">
          Your data is processed in-memory for this single request and never stored.
          Schema: <code>timestamp</code> (required), <code>category</code> (required),{" "}
          <code>action</code>, <code>value</code>, <code>metadata</code> (optional).
        </p>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {insight ? (
        <section className="result">
          <div className="insight-card">
            <h2>{insight.headline}</h2>
            <p className="body">{insight.body}</p>
            {insight.suggestion ? (
              <div className="suggestion">
                <b>Try this:</b> {insight.suggestion}
              </div>
            ) : null}
            <span className="badge">generated by {insight.generatedBy}</span>
          </div>

          {facts ? (
            <p className="span-line">
              Analysed {facts.span.eventCount} events across {facts.span.days} days (
              {facts.span.from} → {facts.span.to}) · {facts.span.categories.length} categories ·{" "}
              {facts.findings.length} patterns found.
            </p>
          ) : null}

          {insight.evidence?.length ? (
            <div className="evidence">
              <h3>The evidence behind this</h3>
              {insight.evidence.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </div>
          ) : null}

          {facts && facts.findings.length > insight.evidence.length ? (
            <details className="evidence">
              <summary className="muted small" style={{ cursor: "pointer" }}>
                Show all {facts.findings.length} patterns the engine found
              </summary>
              <div style={{ marginTop: 12 }}>
                {facts.findings.map((f, i) => (
                  <FindingRow key={i} f={f} />
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <footer>
        TruFacet · rule-based pattern engine + LLM interpretation.
        Built with ❤️ by Anmol Agarwal.
      </footer>
      </main>
    </>
  );
}

function FindingRow({ f }: { f: Finding }) {
  return (
    <div className="finding">
      <div className="top">
        <span className="kind">{f.kind.replace("_", " ")}</span>
        <span className="sal">salience {f.salience.toFixed(2)}</span>
      </div>
      <p className="stmt">{f.statement}</p>
      <div className="ev">{JSON.stringify(f.evidence)}</div>
    </div>
  );
}
