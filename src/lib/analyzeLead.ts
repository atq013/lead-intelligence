import { ChatMistralAI } from "@langchain/mistralai";
import { LeadAnalysisSchema, type LeadAnalysis } from "@/lib/schemas";
import { compactLeadInput, extractFirstName } from "@/lib/leadContext";
import { matchPortfolioProject } from "@/lib/portfolioMatcher";
import { withTimeout } from "@/lib/withTimeout";

const MAX_PROMPT_INPUT_CHARS = 3200;
const FALLBACK_PARAGRAPH_1 =
  "Your work appears closely tied to the challenges and priorities described in the profile, especially around the business context shared.";
const FALLBACK_PARAGRAPH_2 =
  "I lead AestheTeQs, where we build practical AI systems, automation workflows, SaaS platforms, and dashboards around real business operations.";
const FALLBACK_PARAGRAPH_3 =
  "Would be glad to exchange perspectives, especially around where AI, automation, and better workflow systems can support this kind of work without adding unnecessary complexity.";
  
const FORBIDDEN_PROJECT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bMappingClarity\b/gi, "AI data classification and workflow automation"],
  [/\bMapping Clarity\b/gi, "AI data classification and workflow automation"],
  [/\bReview Engine\b/gi, "AI review management and customer communication automation"],
  [/\bApplyIQ\b/gi, "recruitment workflow automation"],
  [/\bHalo Solutions\b/gi, "operations dashboards and coordination workflows"],
  [/\bCheckThisProperty\b/gi, "geospatial dashboards and property intelligence tools"],
];

function normalizeLeadScore(value: unknown): number {
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
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }

  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function getMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof (item as { text?: unknown }).text === "string") {
          return (item as { text: string }).text;
        }
        return "";
      })
      .join("");
  }

  return "";
}

function buildLinkedInMessage({
  firstName,
  paragraph1,
  paragraph2,
  paragraph3,
}: {
  firstName: string;
  paragraph1: string;
  paragraph2: string;
  paragraph3: string;
}) {
  const safeFirstName = firstName?.trim() || "[Name]";

  return [
    `Hi ${safeFirstName},`,
    "",
    paragraph1.trim(),
    "",
    paragraph2.trim(),
    "",
    paragraph3.trim(),
    "",
    "Regards,",
    "Attique Ur Rehman",
    "Founder & CEO, AestheTeQs",
  ].join("\n");
}

function normalizeParagraph(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return sanitizeClientFacingText(trimmed
    .replace(/\b(?:he|she)\s+is\b/gi, "you are")
    .replace(/\b(?:he|she)\s+has\b/gi, "you have")
    .replace(/\b(?:he|she)\s+can\b/gi, "you can")
    .replace(/\b(?:his|her)\s+experience\b/gi, "your experience")
    .replace(/\bMelissa\s+is\b/gi, "Your work is")
    .replace(/\bMelissa\s+has\b/gi, "Your work has")
    .replace(/\bher\b(?=\s+(?:experience|work|passion|focus|approach|team|company)\b)/gi, "your")
    .replace(/\bhis\b(?=\s+(?:experience|work|passion|focus|approach|team|company)\b)/gi, "your"));
}

function sanitizeClientFacingText(value: string): string {
  return FORBIDDEN_PROJECT_REPLACEMENTS.reduce((text, [pattern, replacement]) => {
    return text.replace(pattern, replacement);
  }, value);
}

function normalizeParagraphs(modelOutput: Record<string, unknown> | null) {
  const paragraph1 = normalizeParagraph(
    modelOutput?.paragraph1,
    FALLBACK_PARAGRAPH_1
  );
  const paragraph2 = normalizeParagraph(
    modelOutput?.paragraph2,
    FALLBACK_PARAGRAPH_2
  );
  const paragraph3 = softenParagraph3(normalizeParagraph(
    modelOutput?.paragraph3,
    FALLBACK_PARAGRAPH_3
  ));

  return { paragraph1, paragraph2, paragraph3 };
}

function softenParagraph3(value: string): string {
  return value
    .replace(/\blet's discuss how (?:we|i) can help\b/gi, "would be glad to compare notes on where this could be useful")
    .replace(/\blet's discuss\b/gi, "would be glad to exchange perspectives")
    .replace(/\bwe can streamline your workflows\b/gi, "there may be useful perspective to share around improving the workflow")
    .replace(/\bwe can help streamline\b/gi, "there may be useful perspective to share around")
    .replace(/\bwe can help you\b/gi, "there may be useful overlap")
    .replace(/\bbook a call\b/gi, "exchange perspectives")
    .replace(/\bschedule a call\b/gi, "compare notes")
    .trim();
}

function buildLeadSummary(leadType: string, leadInput: string, likelyPainPoint: string): string {
  const firstLine = leadInput.split("\n").map((line) => line.trim()).find(Boolean) || "the profile";

  return `This appears to be a ${leadType} lead connected to ${firstLine.replace(/[:|]/g, "").slice(0, 120)}. The strongest angle is around ${likelyPainPoint}.`;
}

function buildLikelyPainPoints(likelyPainPoint: string, serviceAngle: string): string[] {
  return [
    likelyPainPoint,
    `Selecting the right digital workflow around ${serviceAngle.toLowerCase()} without overcomplicating operations`,
    "Improving visibility, consistency, or customer experience as the business grows",
  ];
}

function buildBestServiceToPitch(serviceAngle: string): string {
  return serviceAngle;
}

function buildOutreachAngle(leadType: string, serviceAngle: string, likelyPainPoint: string): string {
  return `A ${leadType} angle fits best here: position AestheTeQs around ${serviceAngle.toLowerCase()}. The message should connect that capability to ${likelyPainPoint} and keep the tone direct, practical, and specific.`;
}

function buildFollowUpMessage(firstName: string, serviceAngle: string): string {
  const safeFirstName = firstName?.trim() || "there";
  return `Hi ${safeFirstName}, just wanted to quickly follow up on my earlier message. If ${serviceAngle.toLowerCase()} feels relevant to your work, I would be glad to exchange a few thoughts.`;
}

function buildDiscoveryQuestions(leadType: string): string[] {
  return [
    `Which parts of your ${leadType} workflow still depend most on manual effort today?`,
    "Where would automation, a dashboard, or better system integration create the fastest win?",
    "Which tools, data sources, customer touchpoints, or team handoffs would need to connect for this to work well?",
  ];
}

function buildLeadScore(leadType: string, serviceAngle: string): number {
  const serviceText = serviceAngle.toLowerCase();

  if (leadType !== "general business") return 8;
  if (/ai|automation|software|saas|dashboard|workflow|integration|platform/.test(serviceText)) return 7;
  return 6;
}

function buildPromptText({
  leadInput,
  serviceAngle,
  likelyPainPoint,
  leadType,
}: {
  leadInput: string;
  serviceAngle: string;
  likelyPainPoint: string;
  leadType: string;
}) {
  return [
    "You are Attique Ur Rehman, Founder & CEO, AestheTeQs.",
    "Write a direct LinkedIn outreach message to the lead in first-person sender voice.",
    "Return valid JSON only with this shape:",
    '{ "paragraph1": "...", "paragraph2": "...", "paragraph3": "..." }',
    "",
    "Rules:",
    "- Write directly TO the lead using you, your, and your team.",
    "- Never write about the lead in third person.",
    "- Do not say Melissa is, Melissa has, her experience, she can, he can, his experience, or similar phrasing.",
    "- Do not make the message feel like an internal profile summary.",
    "- Do not say the lead can help AestheTeQs.",
    "- Do not say the lead is an ideal partner for AestheTeQs.",
    "- Do not say AestheTeQs is looking for talent.",
    "- Do not frame the message as if AestheTeQs is hiring the lead.",
    "- Do not include greeting or sign-off.",
    "- Do not mention internal AestheTeQs project names.",
    "- Mention only relevant services that make sense for the client's business.",
    "- Do not use a fixed list of services every time.",
    "- Dynamically adapt the service angle to the client's industry, business model, and likely pain point.",
    "- The client should feel that AestheTeQs understands their business and can build practical software, AI, and automation around their real workflow.",
    "- Paragraph 1 must be about the client/company only.",
    "- Paragraph 1 must mention something specific from the lead information.",
    "- Paragraph 1 must not mention AestheTeQs.",
    "- Paragraph 1 must not pitch services.",
    "- Paragraph 1 should feel like: Your work around X is interesting because Y.",
    "- Paragraph 2 must introduce Attique/AestheTeQs and only the relevant service angle.",
    "- Paragraph 2 must mention only services relevant to the lead's context.",
    "Paragraph 3 rules:",
    "- Paragraph 3 must be soft, consultative, and conversation-led.",
    "- It should create curiosity for a conversation, not directly sell the service.",
    "- It should not sound like we can help you with X.",
    "- It should not overexplain the solution.",
    "- It should not push too hard for a call.",
    "- It must connect to the client's industry, current direction, pain point, or opportunity.",
    "- It must use exactly one Paragraph 3 style from the style guide below.",
    "- Do not combine multiple CTA styles in one paragraph.",
    "- Keep Paragraph 3 to 1 or 2 sentences.",
    "",
    "Paragraph 3 style guide:",
    "- Strategic exchange style: use when the lead is corporate, executive, portfolio-led, product-led, or working across multiple business areas.",
    "- Strategic exchange pattern: Would love to exchange perspectives, especially around how [AI/software/data/workflow systems] can complement [their product/company/work] while opening new opportunities across [their wider business/portfolio/market].",
    "- Practical complexity style: use when the lead is in a complex technical, regulated, operational, finance, data, healthcare, logistics, or implementation-heavy environment.",
    "- Practical complexity pattern: Would be glad to compare notes, especially around where [AI/software/automation/data systems] can support [their workflow] without adding more complexity to [their environment].",
    "- Industry trend style: use for recruitment/talent leads or when the strongest reason to talk is a visible market shift.",
    "- Industry trend pattern: Would love to exchange perspectives, especially around how [AI/software/automation] is changing [industry/workflow], [specific process], and the demand for [specialized capability] in [market/region].",
    "- Project-stage curiosity style: use when the lead is building a startup, product, platform, AI tool, SaaS product, marketplace, internal system, or new digital initiative.",
    "- Project-stage curiosity pattern: I would appreciate learning more about where [company/product] is in that build. Would you be open to a brief conversation?",
    "- Ecosystem/client-base style: use when the lead works with multiple clients, organizations, communities, agencies, institutions, associations, or partners.",
    "- Ecosystem/client-base pattern: Given the clients and organizations you work with through [company/community], I think there is a conversation worth having. Are you open to a brief chat?",
    "- Casual builder style: use only when the lead sounds casual, founder-led, creative, community-driven, mission-driven, or product-builder oriented.",
    "- Casual builder pattern: Would love to connect and jam sometime, even if just to swap thoughts on building tech that [supports their mission/outcome].",
    "",
    "Paragraph 3 style rules:",
    "- Do not copy the examples word-for-word unless the context clearly fits.",
    "- Adapt the wording to the actual lead.",
    "- Choose only one style.",
    "- Corporate, finance, healthcare, public-sector, and formal leads must not use jam.",
    "- Founder/startup/product-builder leads can be more conversational.",
    "- Executive/corporate leads should be polished and strategic.",
    "- Recruitment/talent leads should usually use industry trend style.",
    "- Client-network, agency, community, or association leads should usually use ecosystem/client-base style.",
    "- Product/platform/SaaS/startup leads should usually use project-stage curiosity style.",
    "- Complex technical, regulated, or operational leads should usually use practical complexity style.",
    "",
    "Paragraph 3 examples:",
    "- Recruitment/talent: Would love to exchange perspectives, especially around how AI is changing recruitment workflows, candidate experience, and the way growing teams identify specialized talent without making the process feel less human.",
    "- Clothing/e-commerce: Would be glad to exchange perspectives, especially around how better storefront systems, customer workflows, and automation can support brand growth without making the shopping experience feel less personal.",
    "- Finance/data/operations: Would be happy to compare notes, especially around how AI and structured data workflows can reduce manual review while keeping accuracy, approvals, and visibility intact.",
    "- Product/SaaS founder: I would appreciate learning more about where your platform is in that build. Would you be open to a brief conversation?",
    "- Agency/community/client-base: Given the clients and organizations you work with, I think there is a conversation worth having around where automation and custom software can support the workflows behind that work. Are you open to a brief chat?",
    "- Casual founder/builder: Would love to connect and jam sometime, even if just to swap thoughts on building practical tech around the kind of workflows your team is trying to simplify.",
    "- Do not include project names anywhere in the paragraphs.",
    "- Do not include: I came across your profile.",
    "- Do not include: What stood out to me.",
    "- Do not include: Hope you are doing well.",
    "- Do not hard sell, exaggerate, or invent facts.",
    "- Keep each paragraph to 1 to 2 sentences.",
    "- Tone should match the client.",
    "- Return valid JSON only.",
    "",
    "AestheTeQs service universe includes custom software development, full-stack web applications, SaaS platforms, MVP development, AI-powered SaaS, AI agents, LLM applications, RAG applications, document intelligence, workflow automation, business process automation, CRM automation, lead management automation, customer communication automation, admin portals, dashboards, data platforms, document processing, API integrations, cloud applications, e-commerce platforms, Shopify/custom storefronts, booking/order/inventory workflows, geospatial platforms, property technology, review automation, recruitment and HR systems, event operations platforms, healthcare admin tools, education platforms, manufacturing/logistics workflows, finance/compliance workflows, marketplace portals, membership/subscription platforms, and AI-powered internal tools.",
    "",
    `Lead type: ${leadType}`,
    `Selected client-friendly service angle: ${serviceAngle}`,
    `Likely client pain point/opportunity: ${likelyPainPoint}`,
    "",
    "Lead input:",
    leadInput,
  ].join("\n");
}

function parseParagraphResponse(text: string) {
  try {
    return extractJsonObject(text);
  } catch (error) {
    console.log("[ANALYZE] Invalid JSON from Mistral, using fallback paragraphs");
    console.log("[ANALYZE] Parse error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function analyzeLead(leadInput: string): Promise<LeadAnalysis> {
  console.log("[ANALYZE] Starting analyzeLead");
  console.log("[ANALYZE] Lead input length:", leadInput.length);

  const compactInput = compactLeadInput(leadInput, MAX_PROMPT_INPUT_CHARS);
  console.log("[ANALYZE] Compact lead input length:", compactInput.length);

  const firstName = extractFirstName(leadInput);
  const portfolioMatch = await matchPortfolioProject(compactInput);
  const {
    matchingProjectName,
    serviceAngle,
    likelyPainPoint,
    leadType,
  } = portfolioMatch;

  const leadSummary = buildLeadSummary(leadType, compactInput, likelyPainPoint);
  const likelyPainPoints = buildLikelyPainPoints(likelyPainPoint, serviceAngle);
  const bestServiceToPitch = buildBestServiceToPitch(serviceAngle);
  const matchingAestheTeQsProject = matchingProjectName;
  const outreachAngle = buildOutreachAngle(leadType, serviceAngle, likelyPainPoint);
  const followUpMessage = sanitizeClientFacingText(buildFollowUpMessage(firstName, serviceAngle));
  const discoveryQuestions = buildDiscoveryQuestions(leadType);
  const leadScore = buildLeadScore(leadType, serviceAngle);

  if (!process.env.MISTRAL_KEY_API) {
    throw new Error("Missing MISTRAL_KEY_API in environment variables.");
  }

  console.log("[ANALYZE] LLM provider: mistral");
  console.log("[ANALYZE] Mistral model:", process.env.MISTRAL_MODEL || "mistral-small-latest");

  const model = new ChatMistralAI({
    apiKey: process.env.MISTRAL_KEY_API,
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
    temperature: 0.2,
    maxTokens: 700,
  });

  const promptText = buildPromptText({
    leadInput: compactInput,
    serviceAngle,
    likelyPainPoint,
    leadType,
  });

  const start = Date.now();
  console.log("[ANALYZE] Before Mistral invoke");

  let paragraphs = {
    paragraph1: FALLBACK_PARAGRAPH_1,
    paragraph2: FALLBACK_PARAGRAPH_2,
    paragraph3: FALLBACK_PARAGRAPH_3,
  };

  try {
    const response = await withTimeout(
      model.invoke(promptText),
      60000,
      "Mistral generation"
    );
    console.log("[ANALYZE] After Mistral invoke. Took:", Date.now() - start, "ms");

    const responseText = getMessageText((response as { content?: unknown }).content ?? response);
    const parsed = parseParagraphResponse(responseText);
    paragraphs = normalizeParagraphs(parsed);
  } catch (error) {
    console.log("[ANALYZE] Mistral generation failed or timed out, using fallback paragraphs");
    console.log("[ANALYZE] Error:", error instanceof Error ? error.message : String(error));
  }

  const paragraph1 = sanitizeClientFacingText(paragraphs.paragraph1);
  const paragraph2 = sanitizeClientFacingText(paragraphs.paragraph2);
  const paragraph3 = sanitizeClientFacingText(paragraphs.paragraph3);

  const linkedinMessage = sanitizeClientFacingText(buildLinkedInMessage({
    firstName,
    paragraph1,
    paragraph2,
    paragraph3,
  }));

  const finalResult: LeadAnalysis = {
    leadSummary,
    likelyPainPoints,
    bestServiceToPitch,
    matchingAestheTeQsProject,
    outreachAngle,
    linkedinParagraph1: paragraph1,
    linkedinParagraph2: paragraph2,
    linkedinParagraph3: paragraph3,
    linkedinMessage,
    followUpMessage,
    discoveryQuestions,
    leadScore: normalizeLeadScore(leadScore),
  };

  const validation = LeadAnalysisSchema.safeParse(finalResult);
  if (validation.success) {
    return validation.data;
  }

  return finalResult;
}
console.log("hi")
console.log("hi")