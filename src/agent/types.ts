import { z } from "zod";

export const AgentActionSchema = z.enum([
  "inspect_lead",
  "retrieve_portfolio",
  "research_company",
  "score_lead",
  "validate_evidence",
  "generate_outreach",
  "request_human_review",
  "finish",
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;

export const AgentStatusSchema = z.enum([
  "planning",
  "researching",
  "scoring",
  "validating",
  "awaiting_human_review",
  "completed",
  "failed",
]);

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const ResearchToolStatusSchema = z.enum([
  "not_tried",
  "completed",
  "unavailable",
  "failed",
  "timed_out",
]);

export type ResearchToolStatus = z.infer<typeof ResearchToolStatusSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  category: z.string(),
  source: z.string(),
  sourceIdentifier: z.string(),
  field: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  collectedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConflictSchema = z.object({
  field: z.string(),
  conflictingValues: z.array(z.string()).min(2),
  evidenceIds: z.array(z.string()).default([]),
  severity: z.enum(["low", "medium", "high"]),
  resolutionStatus: z.enum(["open", "resolved", "blocked"]),
});

export type Conflict = z.infer<typeof ConflictSchema>;

export const ToolExecutionSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  input: z.unknown(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

export const AgentDecisionSchema = z.object({
  action: AgentActionSchema,
  reason: z.string().min(1),
  missingInformation: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export const ValidationResultSchema = z.object({
  passed: z.boolean(),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  unsupportedClaims: z.array(z.string()).default([]),
  requiredAction: z.enum(["approve", "correct", "human_review", "reject"]),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const AgentStateSchema = z.object({
  runId: z.string(),
  objective: z.string(),
  originalLeadInput: z.string(),
  normalizedLeadInput: z.string().optional(),
  normalizedLeadData: z.record(z.string(), z.unknown()).default({}),
  leadInspected: z.boolean().default(false),
  portfolioRetrieved: z.boolean().default(false),
  scoreCalculated: z.boolean().default(false),
  validated: z.boolean().default(false),
  outreachGenerated: z.boolean().default(false),
  research: z
    .object({
      attempted: z.boolean().default(false),
      available: z.boolean().nullable().default(null),
      status: ResearchToolStatusSchema.default("not_tried"),
      retryable: z.boolean().default(true),
      reason: z.string().optional(),
      evidenceAdded: z.boolean().default(false),
    })
    .default({
      attempted: false,
      available: null,
      status: "not_tried",
      retryable: true,
      evidenceAdded: false,
    }),
  evidence: z.array(EvidenceSchema).default([]),
  toolExecutions: z.array(ToolExecutionSchema).default([]),
  qualificationScore: z.number().min(0).max(100).default(0),
  confidence: z.number().min(0).max(1).default(0),
  recommendedService: z.string().default(""),
  recommendedProject: z.string().default(""),
  summary: z.string().default(""),
  painPoints: z.array(z.string()).default([]),
  outreachMessage: z.string().default(""),
  followUp: z.string().default(""),
  discoveryQuestions: z.array(z.string()).default([]),
  uncertainties: z.array(z.string()).default([]),
  conflicts: z.array(ConflictSchema).default([]),
  errors: z.array(z.string()).default([]),
  currentStep: z.number().int().min(0).default(0),
  researchCallCount: z.number().int().min(0).default(0),
  consecutiveFailures: z.number().int().min(0).default(0),
  repeatedActionTracking: z.record(z.string(), z.number().int().min(0)).default({}),
  currentStatus: AgentStatusSchema.default("planning"),
  timestamps: z.object({
    startedAt: z.string(),
    updatedAt: z.string(),
    finishedAt: z.string().optional(),
  }),
  validation: ValidationResultSchema.optional(),
  agentMetadata: z
    .object({
      runId: z.string(),
      status: AgentStatusSchema,
      qualificationScore: z.number().min(0).max(100),
      confidence: z.number().min(0).max(1),
      evidence: z.array(EvidenceSchema),
      uncertainties: z.array(z.string()),
      conflicts: z.array(ConflictSchema),
      validation: ValidationResultSchema.optional(),
      traceSummary: z.array(z.string()),
    })
    .optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

export const NextActionDecisionSchema = AgentDecisionSchema;
