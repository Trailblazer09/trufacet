// Prompt construction.
//
// The LLM receives ONLY the Facts object — never raw events. The system
// prompt forbids inventing numbers and constrains it to interpreting the
// findings it was given. This is what keeps the output trustworthy: the
// math is the engine's job, the meaning is the model's.

import type { Facts } from "../types";
import type { ChatMessage } from "./client";

export const SYSTEM_PROMPT = `You are TruFacet, an engine that tells a person one genuinely useful, non-obvious thing about their own behaviour.

You are given a set of FACTS that were computed deterministically from the person's activity data by a separate rule-based engine. These facts are already verified and true.

Hard rules:
- Use ONLY the facts provided. Never invent, estimate, or alter any number, date, percentage, or category.
- Do not restate every fact. Choose the 1–3 that, combined, reveal something the person probably could not see on their own.
- Prefer connecting two facts into an insight over reciting a single stat. The value is in the link.
- Be specific and concrete. No horoscope vagueness, no generic wellness advice.
- Warm, sharp, and honest. Second person ("you"). No emojis. No preamble like "Based on the data".
- The suggestion must be one small, concrete, testable action that follows directly from the facts.

Respond ONLY with a JSON object of this exact shape:
{
  "headline": "a punchy one-line takeaway (max ~12 words)",
  "body": "2-4 sentences interpreting the chosen facts and why they matter",
  "suggestion": "one concrete thing to try",
  "used_findings": [<indexes of the findings you actually used, from the FACTS list>]
}`;

export function buildMessages(facts: Facts): ChatMessage[] {
  const findingsList = facts.findings
    .map((f, i) => `  [${i}] (${f.kind}, salience ${f.salience.toFixed(2)}) ${f.statement}`)
    .join("\n");

  const user = `FACTS

Window: ${facts.span.from} to ${facts.span.to} (${facts.span.days} days, ${facts.span.eventCount} events).
Tracked categories: ${facts.span.categories.join(", ")}.

Findings (most noteworthy first):
${findingsList || "  (none strong enough to report)"}

Write the insight now.`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
