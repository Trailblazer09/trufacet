// ─────────────────────────────────────────────────────────────
// Core data contracts for TruFacet.
//
// The whole system flows in one direction:
//
//   raw input ──parse──▶ ActivityEvent[] ──engine──▶ Facts ──llm──▶ Insight
//
// The LLM only ever sees `Facts` (verified, computed numbers). It never
// touches raw events, so it cannot invent a statistic.
// ─────────────────────────────────────────────────────────────

/** A single thing a person did, at a point in time. Deliberately generic. */
export interface ActivityEvent {
  /** ISO-8601 timestamp. Required — everything keys off time. */
  timestamp: string;
  /** Broad bucket, e.g. "work", "exercise", "sleep", "code". */
  category: string;
  /** What happened, e.g. "focus_block", "run", "commit". Optional. */
  action?: string;
  /** A numeric magnitude where it makes sense (minutes, reps, lines). Optional. */
  value?: number;
  /** Anything else; passed through, never required. */
  metadata?: Record<string, unknown>;
}

/** A normalized event: timestamp parsed into useful parts, validated. */
export interface NormalizedEvent extends ActivityEvent {
  /** Epoch milliseconds. */
  t: number;
  /** 0 (Sun) – 6 (Sat). */
  weekday: number;
  /** 0 – 23 local hour. */
  hour: number;
  /** YYYY-MM-DD day key. */
  day: string;
  /** ISO week key, e.g. "2026-W24". */
  week: string;
}

// ── Facts: the output of the rule-based engine ──────────────────
// Each "finding" is a small, self-contained, human-readable claim plus
// the numbers that justify it. This is the ONLY thing the LLM receives.

export type FindingKind =
  | "streak"
  | "time_of_day"
  | "trend"
  | "consistency"
  | "anomaly"
  | "correlation";

export interface Finding {
  kind: FindingKind;
  /** A plain-English statement of the verified fact. */
  statement: string;
  /**
   * 0–1 how noteworthy this is, computed by the rule (not the LLM).
   * Used to rank which facts are worth surfacing.
   */
  salience: number;
  /** The raw numbers behind the statement, for auditing. */
  evidence: Record<string, number | string>;
}

export interface Facts {
  /** Window the analysis covers. */
  span: {
    from: string;
    to: string;
    days: number;
    eventCount: number;
    categories: string[];
  };
  /** All findings, already sorted by salience (most noteworthy first). */
  findings: Finding[];
}

// ── Insight: the final product returned to the user ─────────────

export interface Insight {
  /** The one-line headline the user reads first. */
  headline: string;
  /** 2–4 sentences of genuinely useful interpretation. */
  body: string;
  /** One concrete, optional suggestion. */
  suggestion: string;
  /** Which findings the LLM actually used, so the user can verify. */
  evidence: Finding[];
  /** Which provider/model produced the prose. */
  generatedBy: string;
}
