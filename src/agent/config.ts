export const AGENT_LIMITS = {
  maxSteps: 8,
  maxResearchCalls: 2,
  maxConsecutiveFailures: 2,
  maxExecutionTimeMs: 60000,
  maximumRepeatedActionCount: 2,
  minimumQualificationScore: 65,
  minimumConfidenceForOutreach: 0.75,
  maximumCorrectionAttempts: 1,
} as const;

export const SCORE_WEIGHTS = {
  problemFit: 0.3,
  serviceFit: 0.25,
  evidenceQuality: 0.2,
  commercialPotential: 0.15,
  portfolioRelevance: 0.1,
} as const;

export const KNOWN_SERVICES = [
  "custom software development",
  "AI workflow automation",
  "AI data classification and human-review workflow automation",
  "AI review management and CRM workflow automation",
  "AI job automation and ATS document generation",
  "event operations dashboard and workflow management",
  "geospatial property intelligence platform development",
  "SaaS platform development",
  "workflow automation",
  "CRM automation",
  "document processing",
  "dashboard development",
] as const;

