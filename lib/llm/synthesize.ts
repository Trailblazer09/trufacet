// Turn Facts into an Insight using the LLM, with guardrails on both ends.
//
// If the LLM is unavailable (no key) or fails, we fall back to a
// deterministic, rule-only insight so the system ALWAYS returns real
// output — satisfying "accept real input and return real output" even
// offline. The fallback is clearly labelled as such.

import type { Facts, Finding, Insight } from "../types";
import { getClient } from "./client";
import { buildMessages } from "./prompt";

export async function synthesize(facts: Facts): Promise<Insight> {
  const client = getClient();

  if (!client.available) {
    return { ...ruleOnlyInsight(facts), generatedBy: "rule-only (no LLM key set)" };
  }

  try {
    const messages = buildMessages(facts);
    const { text, model } = await client.chat(messages, { json: true });
    const parsed = extractJson(text);

    const used = pickUsed(parsed.used_findings, facts.findings);
    return {
      headline: String(parsed.headline || "").trim() || ruleOnlyInsight(facts).headline,
      body: String(parsed.body || "").trim(),
      suggestion: String(parsed.suggestion || "").trim(),
      evidence: used.length ? used : facts.findings.slice(0, 3),
      generatedBy: client.name,
    };
  } catch (err) {
    // Never fail the request just because the model hiccuped.
    const fb = ruleOnlyInsight(facts);
    return { ...fb, generatedBy: `rule-only (LLM error: ${(err as Error).message.slice(0, 120)})` };
  }
}

function pickUsed(idxs: unknown, findings: Finding[]): Finding[] {
  if (!Array.isArray(idxs)) return [];
  return idxs
    .map((i) => findings[Number(i)])
    .filter((f): f is Finding => Boolean(f));
}

// Tolerant JSON extraction — models sometimes wrap JSON in prose/fences.
function extractJson(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("model did not return parseable JSON");
  }
}

// ── Deterministic fallback ──────────────────────────────────────
// Stitches the top findings into a serviceable insight with no LLM.
function ruleOnlyInsight(facts: Facts): Insight {
  const top = facts.findings.slice(0, 3);
  if (top.length === 0) {
    return {
      headline: "Not enough signal yet",
      body: `Across ${facts.span.days} days and ${facts.span.eventCount} events, no pattern was strong enough to call out with confidence. More data over a longer window would surface real trends.`,
      suggestion: "Keep logging for another couple of weeks, then run TruFacet again.",
      evidence: [],
      generatedBy: "rule-only",
    };
  }
  return {
    headline: top[0].statement,
    body: top.map((f) => f.statement).join(" "),
    suggestion:
      "Pick the single pattern above that surprised you most and watch whether it holds next week.",
    evidence: top,
    generatedBy: "rule-only",
  };
}
