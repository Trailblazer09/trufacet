
<img width="1895" height="998" alt="image" src="https://github.com/user-attachments/assets/50f01bd4-083c-4aa9-8b3c-f1df1e5ab5b0" />

<img width="1894" height="992" alt="image" src="https://github.com/user-attachments/assets/cbf2caf6-b46a-48f0-a3ad-c009dc6e23ad" />


 
<h1 align="center">
  <u><a href="https://trufacet.netlify.app/"><ins>TruFacet<ins></a>💎</u>
</h1>


**TruFacet takes a stream of your activity and tells you one genuinely useful thing about yourself that you couldn't see on your own.**

Not a dashboard. Not "you exercised 12 times." Something like:

> **You front-load your week and pay for it on Thursday.**
> Your focus blocks cluster in the morning and your longest, deepest sessions land Monday–Wednesday — but Thursday and Friday collapse to short, scattered ones. And the weeks you skip Wednesday's workout are the same weeks the slump starts a day early.
> **Try this:** protect one 45-minute morning block on Thursday this week and see if the slump moves.

---

## The idea: rules for truth, an LLM for meaning

The brief required **both** rule-based logic and an LLM. TruFacet uses them for the two things each is actually good at, with a hard wall between them:

```
raw input ──parse──▶ events ──RULE ENGINE──▶ Facts ──LLM──▶ Insight
                               (deterministic     (interprets, never
                                statistics)        invents a number)
```

- **The rule engine** (`lib/engine/`) computes every number: streaks, time-of-day clustering, week-over-week trends, cadence consistency, anomalous days, and cross-category correlations. Each finding carries a **salience score** and the **raw evidence** behind it. Given the same data it always returns the same facts.
- **The LLM** (`lib/llm/`) receives **only the Facts object** — never your raw events. Its job is to pick the 1–3 findings that, *combined*, reveal something non-obvious, and to phrase it like a human. Because it never sees raw data and is told to use only the provided numbers, **it cannot hallucinate a statistic.**

Every insight ships with the evidence that produced it, so it's auditable, not a black box.

---

## Run it (3 steps)

> Requires Node 18+ (built on Node 22).

```bash
# 1. install
npm install

# 2. add a FREE Groq key (no credit card): https://console.groq.com/keys
cp .env.example .env.local
#   then edit .env.local and set GROQ_API_KEY=...

# 3. run
npm run dev
```

Open **http://localhost:3000**, click **“Load sample data”**, then **“Show me my insight.”**

**No key handy?** TruFacet still runs. With no `GROQ_API_KEY` it returns a deterministic *rule-only* insight (clearly labelled), so the pipeline always produces real output.

---

## Giving it real input

The web UI accepts **JSON or CSV** — paste it, upload a file, or click *Load sample data*. The event schema is deliberately generic:

```json
[
  { "timestamp": "2026-06-10T09:14:00Z", "category": "work",     "action": "focus_block", "value": 52 },
  { "timestamp": "2026-06-10T18:30:00Z", "category": "exercise", "action": "run",         "value": 30 },
  { "timestamp": "2026-06-10T23:05:00Z", "category": "sleep",    "action": "bedtime" }
]
```

| Field | Required | Meaning |
|-------|----------|---------|
| `timestamp` | ✅ | ISO-8601. Everything keys off time. |
| `category` | ✅ | Broad bucket: `work`, `sleep`, `code`… |
| `action` | — | What happened: `focus_block`, `commit`… |
| `value` | — | A magnitude where it fits: minutes, reps, lines. |
| `metadata` | — | Anything else; passed through. |

CSV works too — just include a header row with at least `timestamp,category`.

### Turn your *real* data into input

**Just a GitHub username.** The web app has an **“Or pull from a GitHub user”** field: type a username (e.g. `torvalds`) and click **Fetch activity**. TruFacet pulls their recent public activity (pushes, PRs, issues, stars) via GitHub's public Events API — no auth required — and surfaces the person's coding rhythm. GitHub exposes roughly the last 90 days, which is plenty for time-of-day, weekday, and cadence patterns. (Set `GITHUB_TOKEN` to raise the unauthenticated rate limit if you hit it.)

**Pull from a git repo, right in the UI.** The web app also has an **“Or pull from a git repo”** field: paste a repo URL (e.g. `https://github.com/user/repo.git`), optionally give an author name/email to scope it to one person, and click **Fetch commits**. TruFacet clones the repo (commit history only), turns it into events, and drops them in — then click *Show me my insight*.

> **This one feature is local-only.** The repo-URL fetch clones **server-side** (it needs the `git` binary + a writable temp dir), so it only works when TruFacet runs **locally**. On a serverless host — **Vercel or Netlify** — this feature is unavailable; clicking *Fetch commits* there returns a clean error, so nothing breaks. Use the CLI below and paste the output instead. **Note:** the **GitHub-username** feature is *not* affected — it's just an API call and works fine on serverless, as do paste, upload, and the sample.

Or from the command line — point it at a **local path or a remote URL**:

```bash
# Remote URL (cloned to a temp dir, then cleaned up):
node scripts/git-to-events.mjs https://github.com/user/repo.git --author "Your Name" > events.json

# Or a local repo path:
node scripts/git-to-events.mjs /path/to/repo --author "Your Name" > events.json

# Or convert a CSV you already have:
node scripts/csv-to-events.mjs mydata.csv > events.json
```

Paste the result into the UI. The git adapter classifies commits (`feat`/`fix`/`docs`…) and TruFacet will surface your real coding rhythm, focus windows, and burnout-shaped gaps. Passing `--author` with a name/email that matches no commits exits with a clear error rather than producing nothing.

---

## API

```bash
curl -s localhost:3000/api/insights \
  -H 'content-type: application/json' \
  -d '{"input":"[{\"timestamp\":\"2026-06-10T09:00:00Z\",\"category\":\"work\"}]"}'
```

Returns `{ facts, insight }`. `GET /api/sample` returns a fresh synthetic dataset.

```bash
# Clone a repo's history into events (local-only; http(s) URLs):
curl -s localhost:3000/api/git \
  -H 'content-type: application/json' \
  -d '{"url":"https://github.com/user/repo.git","author":"Your Name"}'
```

`POST /api/git` returns `{ events, count }` — feed `events` straight into `/api/insights`.

```bash
# Turn a GitHub user's recent public activity into events:
curl -s localhost:3000/api/github \
  -H 'content-type: application/json' \
  -d '{"username":"torvalds"}'
```

`POST /api/github` returns `{ events, count, login }` — also feeds straight into `/api/insights`.

---

## Deploy (free — Vercel or Netlify)

It's stateless — no database, nothing to provision, $0.

1. Push this repo to GitHub.
2. Import it on **Vercel** ([vercel.com/new](https://vercel.com/new)) or **Netlify** (auto-detects Next.js — no config needed).
3. Add one environment variable: `GROQ_API_KEY` (optional: `GITHUB_TOKEN` to raise GitHub's rate limit).
4. Deploy.

**What runs on serverless (Vercel/Netlify):** paste/upload, Groq insights, the sample, and the **GitHub-username → insight** feature all work. The *only* feature that doesn't is the in-app **repo-URL clone** (`/api/git`) — serverless functions have no `git` binary or writable filesystem, so run the `git-to-events` CLI locally and paste the result instead. With no key set at all, the app still returns a deterministic rule-only insight. (On Netlify the default 10s function timeout is irrelevant here — Groq and GitHub calls finish in 1–2s.)

Groq is the default because it's free and fast. The LLM client is **pluggable**: set `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` to use Claude (Opus 4.8) instead — never required, off by default.

---

## Project layout

```
lib/engine/     rule-based analyzers → Facts  (the source of numeric truth)
lib/llm/        prompt + pluggable client → Insight  (meaning only)
lib/parse.ts    JSON/CSV parsing, validation, normalization
lib/git.ts      git history (local path or URL) → events  (used by the git API route)
lib/github.ts   a GitHub user's public activity → events  (used by the github API route)
lib/samples/    synthetic sample-data generator
app/            Next.js UI + /api routes (insights, sample, git, github)
scripts/        local CLIs: git→events, csv→events, sample generator
```

---

## What's done / what I'd do next

**Done & working:** end-to-end pipeline (real JSON/CSV in → insight out), 6 independent rule analyzers with salience + evidence, pluggable free LLM with a deterministic offline fallback, real-data adapters (git by **local path or remote URL**, in-app or via CLI, plus CSV), one-click demo, deployable to Vercel or Netlify as-is.

**Knowingly out of scope (and why):**
- **No persistence / multi-user history.** TruFacet is stateless by design so the free serverless demo (Vercel/Netlify) needs no database. *Next:* add Vercel KV/Postgres to store event streams per user and compute *cross-time* insights ("this month vs your baseline").
- **Correlation ≠ causation.** Findings like "you sleep earlier on workout days" are associations; the LLM is prompted to hedge, but it isn't causal inference. *Next:* lagged correlations + a minimum-sample gate before a link is shown.
- **Timestamps are treated as the viewer's local time.** Good enough for single-user data; *next:* carry per-event timezone.
- **No automated tests.** *Next:* unit tests on each analyzer with fixture datasets (the engine is pure functions, so this is straightforward).

---

Built as an engineering-intern assignment. The interesting decision here is the wall between the deterministic engine and the LLM — it's what makes the output both *useful* and *trustworthy*.
