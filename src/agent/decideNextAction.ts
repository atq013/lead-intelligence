import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentDecisionSchema, type AgentDecision, type AgentState } from "@/agent/types";
import { getMistralConfig } from "@/lib/mistralConfig";
import { withTimeout } from "@/lib/withTimeout";

function summarizeState(state: AgentState): string {
  return [
    `Status: ${state.currentStatus}`,
    `Step: ${state.currentStep}`,
    `Evidence count: ${state.evidence.length}`,
    `Confidence: ${state.confidence}`,
    `Qualification score: ${state.qualificationScore}`,
    `Recommended project: ${state.recommendedProject || "none"}`,
    `Recommended service: ${state.recommendedService || "none"}`,
    `Uncertainties: ${state.uncertainties.join(" | ") || "none"}`,
    `Conflicts: ${state.conflicts.length}`,
    `Research calls: ${state.researchCallCount}`,
  ].join("\n");
}

export async function decideNextAction(state: AgentState, allowedActions: string[]): Promise<AgentDecision> {
  const mistralConfig = getMistralConfig();
  const model = new ChatMistralAI({
    apiKey: mistralConfig.apiKey,
    model: mistralConfig.model,
    temperature: 0.1,
    maxTokens: 200,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      [
        "You are a bounded lead-analysis controller.",
        "Choose exactly one next action from the allowed actions.",
        "Do not output chain-of-thought.",
        "Return only structured JSON.",
        `Allowed actions: ${allowedActions.join(", ")}`,
      ].join("\n"),
    ],
    [
      "human",
      `Current state:\n${summarizeState(state)}\n\nLead input:\n${state.originalLeadInput.slice(0, 1000)}`,
    ],
  ]);

  const chain = prompt.pipe(model.withStructuredOutput(AgentDecisionSchema));

  try {
    const result = await withTimeout(chain.invoke({}), 15000, "agent decision");
    return AgentDecisionSchema.parse(result);
  } catch (error) {
    console.error("[AGENT] Decision error:", error);
    throw error;
  }
}
