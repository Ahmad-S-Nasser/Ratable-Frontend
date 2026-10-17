import type { ScoreResponse } from "@/lib/api/types";

/** A criterion with a shown score at 4.0 or more is a strength; at 3.0 or less a weakness. Adjustable in one place. */
export const STRENGTH_AT = 4;
export const WEAKNESS_AT = 3;

type Scored = { id: string; score: number };

/** Only criteria that have a score (at least 5 verified answers) are considered; nothing is guessed from fewer. */
export function strengthsAndWeaknesses(score: ScoreResponse): { strengths: Scored[]; weaknesses: Scored[] } {
  const scored = score.criteria.flatMap((c) => (c.score === null ? [] : [{ id: c.criterionId, score: c.score }]));
  return {
    strengths: scored.filter((c) => c.score >= STRENGTH_AT).sort((a, b) => b.score - a.score),
    weaknesses: scored.filter((c) => c.score <= WEAKNESS_AT).sort((a, b) => a.score - b.score),
  };
}
