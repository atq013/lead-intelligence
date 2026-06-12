import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { LeadAnalysisSchema, type LeadAnalysis } from "@/lib/schemas";
import { getRelevantPortfolioContext } from "@/lib/portfolioRetriever";

export async function analyzeLead(leadInput: string): Promise<LeadAnalysis> {
  console.log("[ANALYZE] Starting analyzeLead");
  console.log("[ANALYZE] Lead input length:", leadInput.length);
  console.log("[ANALYZE] Before calling getRelevantPortfolioContext");

  try {
    const portfolioContext = await getRelevantPortfolioContext(leadInput);
    console.log("[ANALYZE] After portfolio context is retrieved");
    console.log("[ANALYZE] Portfolio context length:", portfolioContext.length);
    console.log("[ANALYZE] Portfolio context preview:", portfolioContext.slice(0, 300));

    console.log("[ANALYZE] Before initializing ChatOllama");
    const model = new ChatOllama({
      model: "llama3.2:3b",
      temperature: 0.3,
      baseUrl: "http://localhost:11434",
    });

    console.log("[ANALYZE] Before creating structured model");
    const structuredModel = model.withStructuredOutput(LeadAnalysisSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        [
          "You are an internal lead intelligence assistant for AestheTeQs.",
          "",
          "AestheTeQs is a software and AI services company. It builds:",
          "",
          "AI-powered SaaS platforms",
          "RAG applications",
          "AI agents",
          "workflow automation",
          "CRM automation",
          "document processing tools",
          "full-stack dashboards",
          "cloud applications",
          "integrations using React, Node.js, Python, Supabase, GCP, AWS, n8n, OpenAI, Gemini, Vertex AI, and LangChain",
          "",
          "Your job:",
          "",
        "Analyze the pasted lead/company/profile/job text",
        "Identify likely business pain points",
        "Recommend the best AestheTeQs service or service category. This field must always describe a service, capability, or solution type, never a portfolio project name. Good examples: AI data classification and human-review workflow automation; AI review management and CRM workflow automation; AI job automation and ATS document generation; event operations dashboard and workflow management; geospatial property intelligence platform development. Bad examples: MappingClarity, Review Engine, ApplyIQ, Halo Solutions, CheckThisProperty.",
        "Select the most relevant AestheTeQs portfolio project from the provided portfolio context. This field must contain the actual project name only, and nothing else.",
        "Generate a professional LinkedIn message",
        "Generate a polite follow-up message",
        "Generate discovery call questions",
        "Score the lead from 1 to 10",
        "",
          "Rules:",
          "",
        "Do not invent private information",
        "If something is unknown, make a careful assumption and phrase it as likely or possible",
        "Prefer projects from the provided portfolio context",
        "Make the LinkedIn message specific to the pasted lead context. It should mention the lead's industry, the operational problem, the relevant AestheTeQs capability, and optionally the matching project. Keep it under 500 characters.",
        "The follow-up message must not assume there was a previous conversation. Avoid phrases like 'following up on our previous conversation'. Use phrases like 'Just following up on my earlier message...' or 'Wanted to quickly follow up in case this is relevant...'.",
        "The outreach angle must explain the business value, not just repeat the input. Frame it as how AestheTeQs helps improve operations, reduce manual work, or improve accuracy/compliance.",
        "Keep messages professional, human, and specific",
        "Avoid spammy language",
        "Return only structured output matching the schema",
      ].join("\n"),
      ],
      [
        "human",
        "Lead Input:\n{leadInput}\n\nPortfolio Context:\n{portfolioContext}",
      ],
    ]);

    const chain = prompt.pipe(structuredModel);

    console.log("[ANALYZE] Before invoking LangChain chain");
    const result = await chain.invoke({
      leadInput,
      portfolioContext,
    });
    console.log("[ANALYZE] After LangChain chain completes");
    console.log("[ANALYZE] Final result keys:", Object.keys(result as Record<string, unknown>));

    return result;
  } catch (error) {
    console.error("[ANALYZE] LangChain/Ollama error:", error);
    throw error;
  }
}
