import { z } from "zod";
import { matchPortfolioProject } from "@/lib/portfolioMatcher";
import { getRelevantPortfolioContext } from "@/lib/portfolioRetriever";
import { createEvidence } from "@/agent/evidence";
import type { AgentState, Evidence } from "@/agent/types";

export const RetrievePortfolioInputSchema = z.object({
  leadInput: z.string().min(1),
});

export const RetrievePortfolioOutputSchema = z.object({
  recommendedProject: z.string(),
  recommendedService: z.string(),
  portfolioContext: z.string(),
  evidence: z.array(z.any()),
});

export async function retrievePortfolio(input: z.infer<typeof RetrievePortfolioInputSchema>, state: AgentState) {
  const match = await matchPortfolioProject(input.leadInput);
  const portfolioContext = await getRelevantPortfolioContext(input.leadInput);

  const evidence: Evidence[] = [
    createEvidence({
      category: "portfolio_match",
      source: "local_portfolio",
      sourceIdentifier: `${state.runId}:${match.projectName}`,
      field: "recommended_project",
      value: match.projectName,
      confidence: 0.86,
      metadata: {
        projectSummary: match.projectSummary,
        projectCategory: match.projectCategory,
      },
    }),
    createEvidence({
      category: "portfolio_match",
      source: "local_portfolio",
      sourceIdentifier: `${state.runId}:${match.projectName}`,
      field: "recommended_service",
      value: match.serviceAngle,
      confidence: 0.8,
      metadata: { leadType: match.leadType },
    }),
  ];

  return {
    recommendedProject: match.projectName,
    recommendedService: match.serviceAngle,
    portfolioContext,
    evidence,
  };
}
