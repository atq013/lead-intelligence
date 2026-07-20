import type { AgentAction, AgentState } from "@/agent/types";

function hasStrongEvidenceField(state: AgentState, field: string, minimumConfidence = 0.7): boolean {
  return state.evidence.some(
    (item) => item.field === field && item.value.trim().length > 0 && item.confidence >= minimumConfidence
  );
}

export function hasSufficientLeadContext(state: AgentState): boolean {
  const data = state.normalizedLeadData;
  const hasCompany = typeof data.company === "string" && data.company.trim().length > 0;
  const hasProblemOrGoal =
    typeof data.problem === "string" && data.problem.trim().length > 0
      ? true
      : typeof data.goal === "string" && data.goal.trim().length > 0
        ? true
        : Array.isArray(data.painPoints) && data.painPoints.some((item) => typeof item === "string" && item.trim().length > 0);

  return (
    (hasCompany || hasStrongEvidenceField(state, "company")) &&
    (hasProblemOrGoal || hasStrongEvidenceField(state, "operational_pain_point") || hasStrongEvidenceField(state, "business_goal"))
  );
}

export function getAllowedActions(state: AgentState): AgentAction[] {
  const actions: AgentAction[] = ["inspect_lead"];

  if (state.leadInspected) {
    actions.push("retrieve_portfolio");
  }

  if (state.research.status === "not_tried" && state.research.available !== false) {
    actions.push("research_company");
  }

  if (state.portfolioRetrieved) {
    actions.push("score_lead");
  }

  if (state.scoreCalculated || state.portfolioRetrieved) {
    actions.push("validate_evidence");
  }

  if (state.validated) {
    actions.push("generate_outreach");
  }

  actions.push("request_human_review", "finish");

  return Array.from(new Set(actions));
}

export function getSafeFallbackAction(state: AgentState, allowedActions: AgentAction[]): AgentAction {
  const can = (action: AgentAction) => allowedActions.includes(action);

  if (!state.leadInspected && can("inspect_lead")) return "inspect_lead";
  if (!state.portfolioRetrieved && can("retrieve_portfolio")) return "retrieve_portfolio";
  if (!state.scoreCalculated && can("score_lead")) return "score_lead";
  if (!state.validated && can("validate_evidence")) return "validate_evidence";
  if (state.validated && can("generate_outreach")) return "generate_outreach";
  if (can("request_human_review")) return "request_human_review";
  return "finish";
}

export function shouldOfferResearch(state: AgentState): boolean {
  return state.research.status === "not_tried" && state.research.available !== false;
}
