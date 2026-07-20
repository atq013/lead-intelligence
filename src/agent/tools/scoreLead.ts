import { z } from "zod";
import type { AgentState, Evidence } from "@/agent/types";
import { createEvidence } from "@/agent/evidence";
import { SCORE_WEIGHTS } from "@/agent/config";

export const ScoreLeadInputSchema = z.object({
  evidenceIds: z.array(z.string()).default([]),
});

export const ScoreLeadOutputSchema = z.object({
  qualificationScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.any()),
});

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export async function scoreLead(input: z.infer<typeof ScoreLeadInputSchema>, state: AgentState) {
  const problemFit = state.evidence.length > 0 ? 70 : 30;
  const serviceFit = state.recommendedService ? 75 : 35;
  const evidenceQuality = Math.min(100, 40 + state.evidence.length * 12);
  const commercialPotential = state.normalizedLeadInput ? Math.min(100, 50 + Math.min(25, state.normalizedLeadInput.length / 100)) : 40;
  const portfolioRelevance = state.recommendedProject ? 85 : 30;

  const qualificationScore = clampScore(
    problemFit * SCORE_WEIGHTS.problemFit +
      serviceFit * SCORE_WEIGHTS.serviceFit +
      evidenceQuality * SCORE_WEIGHTS.evidenceQuality +
      commercialPotential * SCORE_WEIGHTS.commercialPotential +
      portfolioRelevance * SCORE_WEIGHTS.portfolioRelevance
  );

  const confidence = Math.min(1, Math.max(0, (state.evidence.length / 3) + (state.recommendedProject ? 0.25 : 0)));

  const evidence: Evidence[] = [
    createEvidence({
      category: "scoring",
      source: "deterministic_scoring",
      sourceIdentifier: state.runId,
      field: "qualification_score",
      value: String(qualificationScore),
      confidence,
      metadata: {
        problemFit,
        serviceFit,
        evidenceQuality,
        commercialPotential,
        portfolioRelevance,
        weights: SCORE_WEIGHTS,
        requestedEvidenceIds: input.evidenceIds,
      },
    }),
  ];

  return {
    qualificationScore,
    confidence,
    evidence,
  };
}

