import { readFile } from "node:fs/promises";
import path from "node:path";

type PortfolioProject = {
  name: string;
  category: string;
  industries?: string[];
  services?: string[];
  summary: string;
  bestFor: string;
};

type LeadRule = {
  leadType: string;
  matchingProjectName: string;
  serviceAngle: string;
  likelyPainPoint: string;
  keywords: RegExp[];
  scoreBoost: number;
};

export type PortfolioMatch = {
  matchingProjectName: string;
  projectName: string;
  serviceAngle: string;
  likelyPainPoint: string;
  leadType: string;
  projectContext: string;
  projectSummary: string;
  projectCategory: string;
};

const LEAD_RULES: LeadRule[] = [
  {
    leadType: "recruitment/talent",
    matchingProjectName: "ApplyIQ",
    serviceAngle:
      "recruitment workflow automation, candidate experience systems, hiring dashboards, job/CV workflow automation, CRM-style talent pipelines, and employer brand workflow tools",
    likelyPainPoint:
      "fragmented hiring workflows, manual candidate tracking, and keeping the candidate experience consistent as teams scale",
    keywords: [
      /talent acquisition/i,
      /recruit(?:ment|er|ing)?/i,
      /hiring/i,
      /candidate/i,
      /employer brand/i,
      /people ops/i,
      /human resources/i,
      /hr\b/i,
      /staffing/i,
      /sourc(?:e|ing|er)/i,
      /cv/i,
      /job search/i,
    ],
    scoreBoost: 20,
  },
  {
    leadType: "fashion/e-commerce brand",
    matchingProjectName: "Review Engine",
    serviceAngle:
      "e-commerce platform development, product catalog workflows, customer retention automation, order/customer workflow automation, review automation, CRM workflows, and analytics dashboards",
    likelyPainPoint:
      "improving the online shopping experience, reducing manual order and customer operations, and scaling digital sales without losing brand quality",
    keywords: [
      /clothing/i,
      /fashion/i,
      /apparel/i,
      /brand/i,
      /shopify/i,
      /e-?commerce/i,
      /storefront/i,
      /product catalog/i,
      /retail/i,
      /online store/i,
      /merch/i,
    ],
    scoreBoost: 18,
  },
  {
    leadType: "construction/project operations",
    matchingProjectName: "Halo Solutions",
    serviceAngle:
      "project workflow automation, estimation tools, client portals, scheduling dashboards, document processing, and operational reporting systems",
    likelyPainPoint:
      "keeping projects, estimates, schedules, documents, and client updates coordinated as work moves across teams",
    keywords: [
      /construction/i,
      /contractor/i,
      /architecture/i,
      /engineering/i,
      /estimat(?:e|ing)/i,
      /job site/i,
      /project management/i,
      /site operations/i,
    ],
    scoreBoost: 17,
  },
  {
    leadType: "consulting/professional services",
    matchingProjectName: "MappingClarity",
    serviceAngle:
      "client intake automation, CRM workflows, reporting dashboards, document automation, knowledge tools, and AI-assisted internal systems",
    likelyPainPoint:
      "turning repeated client intake, reporting, documentation, and follow-up work into a cleaner operating system",
    keywords: [
      /consult(?:ant|ing|ancy)/i,
      /advisor/i,
      /agency/i,
      /professional services/i,
      /fractional/i,
      /coach/i,
      /client service/i,
    ],
    scoreBoost: 16,
  },
  {
    leadType: "healthcare/clinic",
    matchingProjectName: "Review Engine",
    serviceAngle:
      "patient communication workflows, booking systems, admin automation, review management, CRM workflows, dashboards, and secure internal tools",
    likelyPainPoint:
      "reducing manual admin work while keeping patient communication, bookings, follow-ups, and service quality consistent",
    keywords: [
      /healthcare/i,
      /clinic/i,
      /patient/i,
      /doctor/i,
      /dental/i,
      /therapy/i,
      /medical/i,
      /appointment/i,
      /practice/i,
    ],
    scoreBoost: 18,
  },
  {
    leadType: "manufacturing/logistics",
    matchingProjectName: "Halo Solutions",
    serviceAngle:
      "operational workflow automation, internal dashboards, inventory/order tracking systems, reporting tools, ERP integrations, and AI-assisted process automation",
    likelyPainPoint:
      "connecting inventory, orders, reporting, and operational handoffs so teams can see and manage work more clearly",
    keywords: [
      /manufactur/i,
      /logistics/i,
      /warehouse/i,
      /inventory/i,
      /supply chain/i,
      /erp/i,
      /order tracking/i,
      /fulfillment/i,
    ],
    scoreBoost: 18,
  },
  {
    leadType: "SaaS/product",
    matchingProjectName: "MappingClarity",
    serviceAngle:
      "MVP development, SaaS architecture, AI feature development, scalable backend systems, dashboards, API integrations, cloud deployment, and workflow automation",
    likelyPainPoint:
      "building product features, integrations, dashboards, and backend foundations quickly without creating technical debt",
    keywords: [
      /saas/i,
      /software product/i,
      /product founder/i,
      /startup/i,
      /mvp/i,
      /platform/i,
      /api/i,
      /cloud/i,
      /backend/i,
      /integration/i,
    ],
    scoreBoost: 18,
  },
  {
    leadType: "marketing/content/brand",
    matchingProjectName: "Review Engine",
    serviceAngle:
      "AI content workflows, campaign dashboards, CRM automation, lead workflows, buyer journey automation, AI visibility tools, and data-backed reporting systems",
    likelyPainPoint:
      "connecting campaigns, leads, reporting, and customer touchpoints so growth work is easier to track and improve",
    keywords: [
      /marketing/i,
      /content/i,
      /campaign/i,
      /brand strategy/i,
      /seo/i,
      /buyer journey/i,
      /lead generation/i,
      /growth/i,
      /copywriting/i,
    ],
    scoreBoost: 16,
  },
  {
    leadType: "finance/data operations",
    matchingProjectName: "MappingClarity",
    serviceAngle:
      "AI data classification, document processing, reporting dashboards, approval workflows, audit trails, human-review workflows, and data automation",
    likelyPainPoint:
      "manual review, messy records, fragmented data, and the need for clearer auditability and reporting",
    keywords: [
      /finance/i,
      /financial/i,
      /spreadsheet/i,
      /records/i,
      /audit/i,
      /classification/i,
      /compliance/i,
      /data review/i,
      /document processing/i,
      /reporting/i,
    ],
    scoreBoost: 18,
  },
  {
    leadType: "local service business",
    matchingProjectName: "Review Engine",
    serviceAngle:
      "website development, booking workflows, lead capture automation, CRM automation, customer follow-up automation, review automation, and admin dashboards",
    likelyPainPoint:
      "capturing leads, handling bookings, following up with customers, and managing reputation without too much manual admin work",
    keywords: [
      /local business/i,
      /service business/i,
      /booking/i,
      /appointment/i,
      /customer follow/i,
      /lead capture/i,
      /reviews/i,
      /home services/i,
      /salon/i,
      /restaurant/i,
    ],
    scoreBoost: 15,
  },
  {
    leadType: "real estate/property",
    matchingProjectName: "CheckThisProperty",
    serviceAngle:
      "geospatial dashboards, property search, zoning/risk layers, real estate portals, map-based workflows, and property intelligence tools",
    likelyPainPoint:
      "making property, location, zoning, and risk information easier to search, compare, and act on",
    keywords: [
      /real estate/i,
      /property/i,
      /geospatial/i,
      /zoning/i,
      /location/i,
      /map/i,
      /maps/i,
      /gis/i,
      /broker/i,
      /listing/i,
    ],
    scoreBoost: 18,
  },
  {
    leadType: "event/live operations",
    matchingProjectName: "Halo Solutions",
    serviceAngle:
      "event operations platforms, incident reporting workflows, live dashboards, team coordination tools, safety workflows, and operational communication systems",
    likelyPainPoint:
      "keeping live teams coordinated with clearer incident reporting, real-time visibility, and operational follow-through",
    keywords: [
      /event/i,
      /events/i,
      /incident/i,
      /safety/i,
      /security/i,
      /live operations/i,
      /venue/i,
      /festival/i,
      /coordination/i,
    ],
    scoreBoost: 18,
  },
];

const DEFAULT_SERVICE_ANGLE =
  "custom software development, AI workflow automation, SaaS platform development, dashboards, integrations, cloud applications, and practical internal tools";

const DEFAULT_LIKELY_PAIN_POINT =
  "manual workflows, disconnected tools, limited visibility, and the need for practical digital systems that fit the way the business already operates";

async function readPortfolioProjects(): Promise<PortfolioProject[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "portfolio.json");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PortfolioProject[]) : [];
  } catch (error) {
    console.error("[MATCHER] Error reading portfolio file:", error);
    return [];
  }
}

function scoreRule(leadText: string, rule: LeadRule): number {
  return rule.keywords.reduce((score, keyword) => {
    return keyword.test(leadText) ? score + rule.scoreBoost : score;
  }, 0);
}

function buildContextText(project: PortfolioProject | undefined, match: Pick<PortfolioMatch, "serviceAngle" | "likelyPainPoint" | "leadType">): string {
  if (!project) {
    return [
      `Lead Type: ${match.leadType}`,
      `Client-Friendly Service Angle: ${match.serviceAngle}`,
      `Likely Pain Point: ${match.likelyPainPoint}`,
    ].join("\n");
  }

  const industries = Array.isArray(project.industries) ? project.industries.join(", ") : "";
  const services = Array.isArray(project.services) ? project.services.join(", ") : "";

  return [
    `Internal Project Name: ${project.name}`,
    `Category: ${project.category}`,
    industries ? `Industries: ${industries}` : null,
    services ? `Capability Signals: ${services}` : null,
    `Summary: ${project.summary}`,
    `Best For: ${project.bestFor}`,
    `Lead Type: ${match.leadType}`,
    `Client-Friendly Service Angle: ${match.serviceAngle}`,
    `Likely Pain Point: ${match.likelyPainPoint}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function pickBestRule(leadInput: string): LeadRule | null {
  const leadText = leadInput.toLowerCase();
  const scoredRules = LEAD_RULES.map((rule) => ({
    rule,
    score: scoreRule(leadText, rule),
  })).sort((left, right) => right.score - left.score);

  return scoredRules[0]?.score ? scoredRules[0].rule : null;
}

export async function matchPortfolioProject(leadInput: string): Promise<PortfolioMatch> {
  const projects = await readPortfolioProjects();
  const selectedRule = pickBestRule(leadInput);
  const defaultProject = projects.find((project) => project.name === "MappingClarity") ?? projects[0];
  const matchingProjectName = selectedRule?.matchingProjectName ?? defaultProject?.name ?? "MappingClarity";
  const project = projects.find((item) => item.name === matchingProjectName) ?? defaultProject;

  const match = {
    matchingProjectName,
    projectName: matchingProjectName,
    serviceAngle: selectedRule?.serviceAngle ?? DEFAULT_SERVICE_ANGLE,
    likelyPainPoint: selectedRule?.likelyPainPoint ?? DEFAULT_LIKELY_PAIN_POINT,
    leadType: selectedRule?.leadType ?? "general business",
    projectSummary: project?.summary ?? "General AestheTeQs software, AI, automation, SaaS, dashboard, and integration capability.",
    projectCategory: project?.category ?? "custom software and AI systems",
  };

  return {
    ...match,
    projectContext: buildContextText(project, match),
  };
}

export async function getRelevantPortfolioContext(leadInput: string): Promise<string> {
  const match = await matchPortfolioProject(leadInput);
  return match.projectContext;
}
