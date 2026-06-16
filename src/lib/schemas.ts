import { z } from "zod";

export const LeadScoreSchema: z.ZodType<number> = z
  .any()
  .transform((value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.min(10, Math.max(1, Math.round(value)));
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.min(10, Math.max(1, Math.round(parsed)));
      }
    }

    return 6;
  })
  .pipe(z.number().int().min(1).max(10));

const LeadAnalysisSharedSchema = z.object({
  leadSummary: z.string(),
  likelyPainPoints: z.array(z.string()),
  bestServiceToPitch: z.string(),
  matchingAestheTeQsProject: z.string(),
  outreachAngle: z.string(),
  linkedinParagraph1: z.string(),
  linkedinParagraph2: z.string(),
  linkedinParagraph3: z.string(),
  followUpMessage: z.string(),
  discoveryQuestions: z.array(z.string()),
  leadScore: LeadScoreSchema,
});

export const LeadAnalysisDraftSchema = LeadAnalysisSharedSchema;

export const LeadAnalysisSchema = LeadAnalysisSharedSchema.extend({
  linkedinMessage: z.string(),
});

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;
export type LeadAnalysisDraft = z.infer<typeof LeadAnalysisDraftSchema>;

export const AnalyzeLeadRequestSchema = z.object({
  input: z.string().trim().min(20, "Please provide at least 20 characters of lead context."),
});

export type AnalyzeLeadRequest = z.infer<typeof AnalyzeLeadRequestSchema>;
