import { z } from "zod";
import type { AgentAction, AgentState } from "@/agent/types";
import { inspectLead, InspectLeadInputSchema, InspectLeadOutputSchema } from "@/agent/tools/inspectLead";
import { retrievePortfolio, RetrievePortfolioInputSchema, RetrievePortfolioOutputSchema } from "@/agent/tools/retrievePortfolio";
import { researchCompany, ResearchCompanyInputSchema, ResearchCompanyOutputSchema } from "@/agent/tools/researchCompany";
import { scoreLead, ScoreLeadInputSchema, ScoreLeadOutputSchema } from "@/agent/tools/scoreLead";
import { validateEvidence, ValidateEvidenceInputSchema, ValidateEvidenceOutputSchema } from "@/agent/tools/validateEvidence";
import { generateOutreach, GenerateOutreachInputSchema, GenerateOutreachOutputSchema } from "@/agent/tools/generateOutreach";

type ToolDefinition<I, O> = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  execute: (input: I, state: AgentState) => Promise<O>;
};

export const toolRegistry: Record<AgentAction, ToolDefinition<unknown, unknown>> = {
  inspect_lead: {
    name: "inspectLead",
    description: "Inspect and normalize the lead input.",
    inputSchema: InspectLeadInputSchema,
    outputSchema: InspectLeadOutputSchema,
    execute: async (input, state) => inspectLead(InspectLeadInputSchema.parse(input), state),
  },
  retrieve_portfolio: {
    name: "retrievePortfolio",
    description: "Retrieve relevant AestheTeQs portfolio context.",
    inputSchema: RetrievePortfolioInputSchema,
    outputSchema: RetrievePortfolioOutputSchema,
    execute: async (input, state) => retrievePortfolio(RetrievePortfolioInputSchema.parse(input), state),
  },
  research_company: {
    name: "researchCompany",
    description: "Attempt company research through a local-safe adapter.",
    inputSchema: ResearchCompanyInputSchema,
    outputSchema: ResearchCompanyOutputSchema,
    execute: async (input, state) => researchCompany(ResearchCompanyInputSchema.parse(input), state),
  },
  score_lead: {
    name: "scoreLead",
    description: "Calculate deterministic lead qualification score.",
    inputSchema: ScoreLeadInputSchema,
    outputSchema: ScoreLeadOutputSchema,
    execute: async (input, state) => scoreLead(ScoreLeadInputSchema.parse(input), state),
  },
  validate_evidence: {
    name: "validateEvidence",
    description: "Validate evidence and final output compatibility.",
    inputSchema: ValidateEvidenceInputSchema,
    outputSchema: ValidateEvidenceOutputSchema,
    execute: async (input, state) => validateEvidence(ValidateEvidenceInputSchema.parse(input), state),
  },
  generate_outreach: {
    name: "generateOutreach",
    description: "Generate the final compatible analysis payload.",
    inputSchema: GenerateOutreachInputSchema,
    outputSchema: GenerateOutreachOutputSchema,
    execute: async (input, state) => generateOutreach(GenerateOutreachInputSchema.parse(input), state),
  },
  request_human_review: {
    name: "requestHumanReview",
    description: "Route to human review.",
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: async () => ({}),
  },
  finish: {
    name: "finish",
    description: "Finish the run.",
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: async () => ({}),
  },
};

export function getToolDefinition(action: AgentAction) {
  return toolRegistry[action];
}

export function assertKnownAction(action: string): asserts action is AgentAction {
  if (!(action in toolRegistry)) {
    throw new Error(`Unknown agent action: ${action}`);
  }
}
