import { z } from "zod";
import { extractFirstName } from "@/lib/leadContext";
import { compactLeadInput } from "@/lib/leadContext";
import { createEvidence } from "@/agent/evidence";
import type { AgentState, Evidence } from "@/agent/types";
import { matchPortfolioProject } from "@/lib/portfolioMatcher";

export const InspectLeadInputSchema = z.object({
  leadInput: z.string().min(1),
});

export const InspectLeadOutputSchema = z.object({
  normalizedLeadInput: z.string(),
  normalizedLeadData: z.record(z.string(), z.unknown()),
  evidence: z.array(z.any()),
  uncertainties: z.array(z.string()),
  summary: z.string(),
  painPoints: z.array(z.string()),
});

function findField(leadInput: string, patterns: RegExp[]): string {
  const lines = leadInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line))) {
      return line;
    }
  }
  return "";
}

function extractCompany(leadInput: string): string {
  const companyMatch = leadInput.match(/(?:Founder|CEO|Co-founder|Founder and CEO|CEO|Managing Director|Director|Head of [A-Za-z ]+)\s+(?:of|at)\s+([A-Z][A-Za-z0-9&\-\s]{2,80}?)(?:[.,\n]|$)/i);
  return companyMatch?.[1]?.trim() ?? "";
}

function extractRole(leadInput: string): string {
  const roleMatch = leadInput.match(/\b(Founder and CEO|Founder|CEO|Co-founder|Managing Director|Director|Head of [A-Za-z ]+|Data Engineer|AI Product Engineer|Product Manager|CTO|Head of Data)\b/i);
  return roleMatch?.[1]?.trim() ?? "";
}

function extractIndustry(leadInput: string): string {
  const industryPatterns = [
    /private equity/i,
    /family office/i,
    /finance/i,
    /healthcare/i,
    /real estate/i,
    /recruitment/i,
    /SaaS/i,
    /B2B SaaS/i,
    /operations/i,
    /logistics/i,
    /manufacturing/i,
  ];

  const found = findField(leadInput, industryPatterns);
  return found || "";
}

function extractGoal(leadInput: string): string {
  const goalPatterns = [
    /goal/i,
    /want/i,
    /exploring/i,
    /improve/i,
    /reduce/i,
    /build/i,
    /searchable intelligence platform/i,
    /human review/i,
    /semantic search/i,
    /confidence-based validation/i,
  ];
  return findField(leadInput, goalPatterns);
}

function extractPainPoints(leadInput: string): string[] {
  const phrases = [
    "duplicated records",
    "inconsistent company classifications",
    "outdated contact details",
    "too much manual research",
    "manual review",
    "manual research time",
    "manual effort",
    "data accuracy",
    "human review",
    "semantic search",
  ];

  return phrases.filter((phrase) => leadInput.toLowerCase().includes(phrase.toLowerCase()));
}

function extractTechnologyStack(leadInput: string): string[] {
  const stack = ["React", "Node.js", "PostgreSQL", "AWS", "Python", "n8n", "LangChain", "Ollama"];
  return stack.filter((item) => new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(leadInput));
}

function extractDesiredCapabilities(leadInput: string): string[] {
  const caps = [
    "AI-powered enrichment",
    "automated entity classification",
    "semantic search",
    "confidence-based validation",
    "human review",
    "searchable intelligence platform",
    "data classification",
  ];
  return caps.filter((item) => leadInput.toLowerCase().includes(item.toLowerCase()));
}

export async function inspectLead(input: z.infer<typeof InspectLeadInputSchema>, state: AgentState) {
  const compactInput = compactLeadInput(input.leadInput);
  const firstName = extractFirstName(input.leadInput);
  const match = await matchPortfolioProject(compactInput);
  const company = extractCompany(input.leadInput);
  const role = extractRole(input.leadInput);
  const industry = extractIndustry(input.leadInput);
  const goal = extractGoal(input.leadInput);
  const painPoints = extractPainPoints(input.leadInput);
  const technologyStack = extractTechnologyStack(input.leadInput);
  const desiredCapabilities = extractDesiredCapabilities(input.leadInput);
  const businessGoals = goal ? [goal] : [];
  const evidence: Evidence[] = [
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "person_name",
      value: firstName,
      confidence: firstName !== "[Name]" ? 0.9 : 0.4,
      metadata: { leadType: match.leadType },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "company",
      value: company || match.projectName,
      confidence: company ? 0.9 : 0.4,
      metadata: { leadType: match.leadType, excerpt: compactInput.slice(0, 200) },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "role",
      value: role || match.leadType,
      confidence: role ? 0.85 : 0.5,
      metadata: { serviceAngle: match.serviceAngle },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "industry",
      value: industry || match.leadType,
      confidence: industry ? 0.8 : 0.5,
      metadata: { leadType: match.leadType },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "operational_pain_point",
      value: painPoints[0] || match.likelyPainPoint,
      confidence: painPoints.length > 0 ? 0.85 : 0.5,
      metadata: { painPoints },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "technology_stack",
      value: technologyStack.join(", "),
      confidence: technologyStack.length > 0 ? 0.85 : 0.4,
      metadata: { technologyStack },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "desired_capabilities",
      value: desiredCapabilities.join(", "),
      confidence: desiredCapabilities.length > 0 ? 0.85 : 0.4,
      metadata: { desiredCapabilities },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "business_goal",
      value: businessGoals[0] || "not stated",
      confidence: businessGoals.length > 0 ? 0.75 : 0.35,
      metadata: { businessGoals },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "decision_makers",
      value: "main decision-maker and technical leadership may be involved",
      confidence: 0.6,
      metadata: { identifiedDecisionMaker: firstName, company },
    }),
    createEvidence({
      category: "lead_input",
      source: "user_input",
      sourceIdentifier: state.runId,
      field: "human_review_expectations",
      value: "uncertain results should be flagged for human review",
      confidence: 1,
      metadata: { compactInput },
    }),
  ];

  const uncertainties = [] as string[];
  if (!input.leadInput.trim()) {
    uncertainties.push("Lead input is empty.");
  }
  if (compactInput.length < 80) {
    uncertainties.push("Lead input is very short and may not support confident routing.");
  }

  const summaryParts = [
    firstName !== "[Name]" ? `${firstName} appears to be involved in the lead.` : "Lead contact identified from the provided text.",
    company ? `Company context points to ${company}.` : "Company context was inferred from the provided description.",
    role ? `Primary role looks like ${role}.` : null,
    industry ? `Industry signal: ${industry}.` : null,
    painPoints.length > 0 ? `Likely problems include ${painPoints.join(", ")}.` : null,
    technologyStack.length > 0 ? `Current stack includes ${technologyStack.join(", ")}.` : null,
    desiredCapabilities.length > 0 ? `Desired capabilities include ${desiredCapabilities.join(", ")}.` : null,
  ].filter(Boolean);

  return {
    normalizedLeadInput: compactInput,
    normalizedLeadData: {
      firstName,
      company,
      role,
      industry,
      companyType: match.leadType,
      painPoints,
      technologyStack,
      desiredCapabilities,
      businessGoals,
      decisionMakers: firstName !== "[Name]" ? [firstName] : [],
      humanReviewExpectations: ["uncertain results should be flagged for human review"],
      leadType: match.leadType,
      projectHint: match.projectName,
    },
    evidence,
    uncertainties,
    summary: summaryParts.join(" "),
    painPoints: painPoints.length > 0 ? painPoints : [match.likelyPainPoint],
  };
}
