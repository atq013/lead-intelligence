import { z } from "zod";
import type { AgentState } from "@/agent/types";
import { ResearchToolStatusSchema } from "@/agent/types";

export const ResearchCompanyInputSchema = z.object({
  leadInput: z.string().min(1),
});

export const ResearchCompanyOutputSchema = z.object({
  status: ResearchToolStatusSchema,
  available: z.literal(false),
  retryable: z.boolean(),
  evidenceAdded: z.boolean(),
  summary: z.string(),
  reason: z.string(),
  evidence: z.array(z.any()),
});

export async function researchCompany(input: z.infer<typeof ResearchCompanyInputSchema>, state: AgentState) {
  const inputLength = input.leadInput.length;
  void state.runId;
  return {
    status: "unavailable" as const,
    available: false as const,
    retryable: false,
    evidenceAdded: false,
    summary: `Research unavailable in this local-first build for input length ${inputLength}.`,
    reason: "External company research is unavailable in the local-first build, so the agent should continue with user-provided and local portfolio evidence.",
    evidence: [],
  };
}
