import { LeadAnalysisSchema } from "@/lib/schemas";
import type { AgentState, ValidationResult } from "@/agent/types";
import { KNOWN_SERVICES, AGENT_LIMITS } from "@/agent/config";
import { hasSufficientLeadContext } from "@/agent/routing";

function isKnownProject(project: string): boolean {
  return ["MappingClarity", "Review Engine", "ApplyIQ", "Halo Solutions", "CheckThisProperty"].includes(project);
}

function serviceLooksValid(service: string): boolean {
  const normalized = service.toLowerCase();
  return KNOWN_SERVICES.some((known) => normalized.includes(known.toLowerCase())) || normalized.length > 6;
}

export function validateFinalOutput(state: AgentState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unsupportedClaims: string[] = [];

  const analysisCandidate = {
    leadSummary: state.summary,
    likelyPainPoints: state.painPoints,
    bestServiceToPitch: state.recommendedService,
    matchingAestheTeQsProject: state.recommendedProject,
    outreachAngle: state.outreachMessage,
    linkedinMessage: state.outreachMessage,
    followUpMessage: state.followUp,
    discoveryQuestions: state.discoveryQuestions,
    leadScore: state.qualificationScore,
  };

  const analysisCheck = LeadAnalysisSchema.safeParse(analysisCandidate);
  if (!analysisCheck.success) {
    errors.push("Final output does not match the expected analysis schema.");
  }

  if (!serviceLooksValid(state.recommendedService)) {
    errors.push("Recommended service is not a valid service/category.");
  }

  if (!isKnownProject(state.recommendedProject)) {
    errors.push("Recommended portfolio project is unknown.");
  }

  if (state.confidence < AGENT_LIMITS.minimumConfidenceForOutreach) {
    errors.push("Confidence is below the outreach threshold.");
  }

  if (state.qualificationScore < AGENT_LIMITS.minimumQualificationScore) {
    errors.push("Qualification score is below the outreach threshold.");
  }

  if (!state.summary.trim()) {
    errors.push("Summary is missing.");
  }

  if (!state.outreachMessage.trim()) {
    warnings.push("Outreach message is absent.");
  }

  if (state.uncertainties.length > 0) {
    warnings.push(...state.uncertainties);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    unsupportedClaims,
    requiredAction: errors.length === 0 ? "approve" : "human_review",
  };
}

export function validateRuntimeState(state: AgentState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unsupportedClaims: string[] = [];

  if (state.research.status === "unavailable") {
    warnings.push("External company research was unavailable; analysis is using user-provided and local portfolio evidence.");
  }

  if (!hasSufficientLeadContext(state)) {
    errors.push("Insufficient evidence to confidently continue without review.");
  }

  if (state.conflicts.some((conflict) => conflict.severity === "high" && conflict.resolutionStatus !== "resolved")) {
    errors.push("Unresolved high-severity conflicts require human review.");
  }

  if (state.consecutiveFailures >= AGENT_LIMITS.maxConsecutiveFailures) {
    errors.push("Too many consecutive failures.");
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    unsupportedClaims,
    requiredAction: errors.length === 0 ? "approve" : "human_review",
  };
}
