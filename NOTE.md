# Submission note

**The single most important decision.** The brief required both rule-based logic and an LLM. The obvious path is to hand the LLM the raw data and ask it to "find insights." I refused that and put a hard wall between the two: a deterministic rule engine computes *every* number — streaks, time-of-day clustering, trends, cadence, anomalies, cross-category correlations — each with a salience score and the raw evidence behind it. The LLM receives **only** that facts object, never the raw events, and may only interpret numbers it was handed. So the math is always true, the model physically cannot hallucinate a statistic, and every insight ships with the findings that produced it — auditable, not a black box.

**The trade-off.** The LLM can only speak about patterns the engine already measures; it can't surface something the rules don't compute. Insight quality is therefore capped by my rule library's coverage, not the model's imagination. I accepted that ceiling on purpose: for a tool meant to tell you something true about yourself, a verifiable insight beats a cleverer one that might be invented. Correctness over surprise.

*(~190 words)*
