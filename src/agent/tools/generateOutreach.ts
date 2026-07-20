import { z } from "zod";
import type { AgentState, Evidence } from "@/agent/types";
import { createEvidence } from "@/agent/evidence";
import { analyzeLead as legacyAnalyzeLead } from "@/lib/analyzeLead";

export const GenerateOutreachInputSchema = z.object({
  leadInput: z.string().min(1),
});

export const GenerateOutreachOutputSchema = z.object({
  analysis: z.any(),
  evidence: z.array(z.any()),
});

export async function generateOutreach(input: z.infer<typeof GenerateOutreachInputSchema>, state: AgentState) {
  const legacyAnalysis = await legacyAnalyzeLead(input.leadInput);

  const analysis = {
    ...legacyAnalysis,
    bestServiceToPitch: state.recommendedService || legacyAnalysis.bestServiceToPitch,
    matchingAestheTeQsProject: state.recommendedProject || legacyAnalysis.matchingAestheTeQsProject,
    leadScore: state.qualificationScore || legacyAnalysis.leadScore,
  };

  const evidence: Evidence[] = [
    createEvidence({
      category: "generation",
      source: "legacy_analysis",
      sourceIdentifier: state.runId,
      field: "final_analysis",
      value: "Generated final compatible analysis payload.",
      confidence: state.confidence,
      metadata: { fields: Object.keys(analysis) },
    }),
  ];

  return { analysis, evidence };
}

