import { z } from "zod";

export const LeadAnalysisSchema = z.object({
  leadSummary: z.string(),
  likelyPainPoints: z.array(z.string()),
  bestServiceToPitch: z.string(),
  matchingAestheTeQsProject: z.string(),
  outreachAngle: z.string(),
  linkedinMessage: z.string(),
  followUpMessage: z.string(),
  discoveryQuestions: z.array(z.string()),
  leadScore: z.number().min(1).max(10),
});

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;

export const AnalyzeLeadRequestSchema = z.object({
  input: z.string().trim().min(20, "Please provide at least 20 characters of lead context."),
});

export type AnalyzeLeadRequest = z.infer<typeof AnalyzeLeadRequestSchema>;
