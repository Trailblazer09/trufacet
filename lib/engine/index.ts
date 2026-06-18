// The rule-based engine: run every analyzer, assemble a Facts object.
// This layer is fully deterministic — given the same events it always
// produces the same facts. It is the single source of numeric truth;
// the LLM downstream may only interpret what appears here.

import type { Facts, NormalizedEvent } from "../types";
import { spanDays } from "./util";
import { analyzeStreaks } from "./streaks";
import { analyzeTimeOfDay } from "./timeOfDay";
import { analyzeTrends } from "./trends";
import { analyzeConsistency } from "./consistency";
import { analyzeAnomalies } from "./anomalies";
import { analyzeCorrelations } from "./correlations";

export function buildFacts(events: NormalizedEvent[]): Facts {
  const findings = [
    ...analyzeStreaks(events),
    ...analyzeTimeOfDay(events),
    ...analyzeTrends(events),
    ...analyzeConsistency(events),
    ...analyzeAnomalies(events),
    ...analyzeCorrelations(events),
  ].sort((a, b) => b.salience - a.salience);

  const categories = [...new Set(events.map((e) => e.category))].sort();

  return {
    span: {
      from: events[0].day,
      to: events[events.length - 1].day,
      days: spanDays(events),
      eventCount: events.length,
      categories,
    },
    findings,
  };
}

export { buildFacts as runEngine };
