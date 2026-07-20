import { randomUUID } from "node:crypto";
import { AGENT_LIMITS } from "@/agent/config";
import { dedupeEvidence } from "@/agent/evidence";
import { detectConflicts } from "@/agent/conflicts";
import { decideNextAction } from "@/agent/decideNextAction";
import { getAllowedActions, getSafeFallbackAction, hasSufficientLeadContext } from "@/agent/routing";
import { appendTraceEvent } from "@/agent/traceStore";
import { AgentStateSchema, type AgentAction, type AgentState } from "@/agent/types";
import { assertKnownAction, getToolDefinition } from "@/agent/toolRegistry";
import { validateFinalOutput, validateRuntimeState } from "@/agent/validation";

export type RuntimeDeps = {
  decideNextAction?: typeof decideNextAction;
  getToolDefinition?: typeof getToolDefinition;
  appendTraceEvent?: typeof appendTraceEvent;
  validateRuntimeState?: typeof validateRuntimeState;
  validateFinalOutput?: typeof validateFinalOutput;
};

function createInitialState(leadInput: string): AgentState {
  const now = new Date().toISOString();
  return AgentStateSchema.parse({
    runId: randomUUID(),
    objective: "Analyze lead and return structured intelligence",
    originalLeadInput: leadInput,
    normalizedLeadData: {},
    leadInspected: false,
    portfolioRetrieved: false,
    scoreCalculated: false,
    validated: false,
    outreachGenerated: false,
    research: {
      attempted: false,
      available: null,
      status: "not_tried",
      retryable: true,
      evidenceAdded: false,
    },
    evidence: [],
    toolExecutions: [],
    qualificationScore: 0,
    confidence: 0,
    recommendedService: "",
    recommendedProject: "",
    summary: "",
    painPoints: [],
    outreachMessage: "",
    followUp: "",
    discoveryQuestions: [],
    uncertainties: [],
    conflicts: [],
    errors: [],
    currentStep: 0,
    researchCallCount: 0,
    consecutiveFailures: 0,
    repeatedActionTracking: {},
    currentStatus: "planning",
    timestamps: { startedAt: now, updatedAt: now },
  });
}

function buildSummaryFallback(state: AgentState): string {
  if (state.summary.trim()) {
    return state.summary;
  }

  const data = state.normalizedLeadData;
  const parts = [
    typeof data.firstName === "string" && data.firstName.trim() ? `${data.firstName} is the lead contact.` : "",
    typeof data.company === "string" && data.company.trim() ? `Company context points to ${data.company}.` : "",
    typeof data.role === "string" && data.role.trim() ? `Role signal: ${data.role}.` : "",
    typeof data.industry === "string" && data.industry.trim() ? `Industry signal: ${data.industry}.` : "",
    Array.isArray(data.painPoints) && data.painPoints.length > 0
      ? `Likely pain points include ${data.painPoints.join(", ")}.`
      : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "Lead context was inspected, but no detailed summary was generated.";
}

function buildFinalAnalysisFromState(state: AgentState) {
  return {
    leadSummary: buildSummaryFallback(state),
    likelyPainPoints:
      state.painPoints.length > 0
        ? state.painPoints
        : (state.normalizedLeadData.painPoints as string[] | undefined) ?? [],
    bestServiceToPitch: state.recommendedService || "custom software development and workflow automation",
    matchingAestheTeQsProject: state.recommendedProject || "MappingClarity",
    outreachAngle: state.outreachGenerated ? state.outreachMessage : "",
    linkedinMessage: state.outreachGenerated ? state.outreachMessage : "",
    followUpMessage: state.outreachGenerated ? state.followUp : "",
    discoveryQuestions:
      state.discoveryQuestions.length > 0
        ? state.discoveryQuestions
        : [
            "What parts of your workflow still depend most on manual effort?",
            "Where would automation or AI create the fastest operational win?",
            "What systems or data sources would need to connect for this to work well?",
          ],
    leadScore: state.qualificationScore,
  };
}

function buildToolInput(action: AgentAction, state: AgentState, correctionAttempts: number) {
  switch (action) {
    case "inspect_lead":
      return { leadInput: state.originalLeadInput };
    case "retrieve_portfolio":
      return { leadInput: state.normalizedLeadInput ?? state.originalLeadInput };
    case "research_company":
      return { leadInput: state.normalizedLeadInput ?? state.originalLeadInput };
    case "score_lead":
      return { evidenceIds: state.evidence.map((item) => item.id) };
    case "validate_evidence":
      return { correctionAttempt: correctionAttempts };
    case "generate_outreach":
      return { leadInput: state.normalizedLeadInput ?? state.originalLeadInput };
    default:
      return {};
  }
}

export async function runLeadAgent(leadInput: string, deps: RuntimeDeps = {}) {
  const decisionRunner = deps.decideNextAction ?? decideNextAction;
  const toolLookup = deps.getToolDefinition ?? getToolDefinition;
  const traceWriter = deps.appendTraceEvent ?? appendTraceEvent;
  const validateRuntime = deps.validateRuntimeState ?? validateRuntimeState;
  const validateFinal = deps.validateFinalOutput ?? validateFinalOutput;

  let state = createInitialState(leadInput);
  const traceSummary: string[] = [];

  await traceWriter({
    runId: state.runId,
    type: "run_started",
    message: "Run started",
    timestamp: state.timestamps.startedAt,
    data: { inputLength: leadInput.length, preview: leadInput.slice(0, 150) },
  });

  let correctionAttempts = 0;

  while (state.currentStep < AGENT_LIMITS.maxSteps) {
    const elapsedMs = Date.now() - new Date(state.timestamps.startedAt).getTime();
    if (elapsedMs > AGENT_LIMITS.maxExecutionTimeMs) {
      state = {
        ...state,
        currentStatus: "awaiting_human_review",
        uncertainties: [...state.uncertainties, "Execution time limit reached."],
      };
      traceSummary.push("Execution time limit reached.");
      await traceWriter({
        runId: state.runId,
        type: "guardrail_triggered",
        message: "Time limit reached",
        timestamp: new Date().toISOString(),
      });
      break;
    }

    const allowedActions = getAllowedActions(state);
    const decision = await decisionRunner(state, allowedActions);

    if (!decision || !decision.action) {
      throw new Error("Model returned no decision.");
    }

    assertKnownAction(decision.action);
    let action: AgentAction = decision.action;

    if (!allowedActions.includes(action)) {
      const fallbackAction = getSafeFallbackAction(state, allowedActions);
      await traceWriter({
        runId: state.runId,
        type: "guardrail_triggered",
        message: "Planner selected a disallowed action",
        timestamp: new Date().toISOString(),
        data: { requestedAction: action, fallbackAction },
      });
      traceSummary.push(`Planner action ${action} was disallowed; fallback ${fallbackAction} used.`);
      state = {
        ...state,
        errors: [...state.errors, `Planner selected disallowed action: ${action}`],
      };
      action = fallbackAction;
    }

    const repeatedCount = (state.repeatedActionTracking[action] ?? 0) + 1;
    if (repeatedCount > AGENT_LIMITS.maximumRepeatedActionCount) {
      const fallbackAction = getSafeFallbackAction(state, allowedActions);
      await traceWriter({
        runId: state.runId,
        type: "guardrail_triggered",
        message: "Repeated action loop",
        timestamp: new Date().toISOString(),
        data: { action, fallbackAction },
      });
      traceSummary.push(`Repeated action loop detected for ${action}; fallback ${fallbackAction} used.`);
      action = fallbackAction;
    }

    state = {
      ...state,
      currentStep: state.currentStep + 1,
      repeatedActionTracking: {
        ...state.repeatedActionTracking,
        [action]: (state.repeatedActionTracking[action] ?? 0) + 1,
      },
      timestamps: { ...state.timestamps, updatedAt: new Date().toISOString() },
    };

    traceSummary.push(`Decision: ${action} (${decision.reason})`);
    await traceWriter({
      runId: state.runId,
      type: "agent_decision",
      message: decision.reason,
      timestamp: new Date().toISOString(),
      data: { ...decision, action },
    });

    if (action === "request_human_review") {
      state = { ...state, currentStatus: "awaiting_human_review" };
      break;
    }

    if (action === "finish") {
      break;
    }

    const tool = toolLookup(action);
    const toolInput = buildToolInput(action, state, correctionAttempts);
    const startedAt = new Date().toISOString();
    const executionId = randomUUID();

    state = {
      ...state,
      toolExecutions: [
        ...state.toolExecutions,
        {
          id: executionId,
          toolName: tool.name,
          input: toolInput,
          startedAt,
        },
      ],
    };

    await traceWriter({
      runId: state.runId,
      type: "tool_execution_started",
      message: tool.name,
      timestamp: startedAt,
      data: { action },
    });

    try {
      const parsedInput = tool.inputSchema.safeParse(toolInput);
      if (!parsedInput.success) {
        throw new Error(`Invalid input for tool ${tool.name}`);
      }

      const result = await tool.execute(parsedInput.data, state);
      const parsedOutput = tool.outputSchema.safeParse(result);
      if (!parsedOutput.success) {
        throw new Error(`Invalid output for tool ${tool.name}`);
      }

      const output = parsedOutput.data as Record<string, unknown>;
      const evidenceFromResult = Array.isArray(output.evidence) ? (output.evidence as unknown[]) : [];
      const nextEvidence = dedupeEvidence([
        ...state.evidence,
        ...(evidenceFromResult as Parameters<typeof dedupeEvidence>[0]),
      ]);

      const nextState: AgentState = {
        ...state,
        evidence: nextEvidence,
        uncertainties: [...state.uncertainties],
        leadInspected: state.leadInspected || action === "inspect_lead",
        portfolioRetrieved: state.portfolioRetrieved || action === "retrieve_portfolio",
        scoreCalculated: state.scoreCalculated || action === "score_lead",
        validated: state.validated || action === "validate_evidence",
        outreachGenerated: state.outreachGenerated || action === "generate_outreach",
        currentStatus:
          action === "validate_evidence"
            ? "validating"
            : action === "score_lead"
              ? "scoring"
              : action === "research_company" || action === "retrieve_portfolio" || action === "inspect_lead"
                ? "researching"
                : state.currentStatus,
        toolExecutions: state.toolExecutions.map((execution) =>
          execution.id === executionId
            ? {
                ...execution,
                finishedAt: new Date().toISOString(),
                success: true,
              }
            : execution
        ),
      };

      if ("normalizedLeadInput" in output) {
        nextState.normalizedLeadInput = output.normalizedLeadInput as string;
      }
      if ("normalizedLeadData" in output) {
        nextState.normalizedLeadData = output.normalizedLeadData as Record<string, unknown>;
      }
      if ("summary" in output) {
        nextState.summary = output.summary as string;
      }
      if ("painPoints" in output) {
        nextState.painPoints = Array.isArray(output.painPoints) ? (output.painPoints as string[]) : nextState.painPoints;
      }
      if ("recommendedProject" in output) {
        nextState.recommendedProject = output.recommendedProject as string;
      }
      if ("recommendedService" in output) {
        nextState.recommendedService = output.recommendedService as string;
      }
      if ("qualificationScore" in output) {
        nextState.qualificationScore = output.qualificationScore as number;
      }
      if ("confidence" in output) {
        nextState.confidence = output.confidence as number;
      }
      if ("analysis" in output) {
        const analysis = output.analysis as {
          leadSummary?: string;
          likelyPainPoints?: string[];
          bestServiceToPitch?: string;
          matchingAestheTeQsProject?: string;
          outreachAngle?: string;
          followUpMessage?: string;
          discoveryQuestions?: string[];
          leadScore?: number;
        };

        nextState.summary = analysis.leadSummary ?? nextState.summary;
        nextState.painPoints = analysis.likelyPainPoints ?? nextState.painPoints;
        nextState.recommendedService = analysis.bestServiceToPitch ?? nextState.recommendedService;
        nextState.recommendedProject = analysis.matchingAestheTeQsProject ?? nextState.recommendedProject;
        nextState.outreachMessage = analysis.outreachAngle ?? nextState.outreachMessage;
        nextState.followUp = analysis.followUpMessage ?? nextState.followUp;
        nextState.discoveryQuestions = analysis.discoveryQuestions ?? nextState.discoveryQuestions;
        nextState.qualificationScore = analysis.leadScore ?? nextState.qualificationScore;
        nextState.outreachGenerated = true;
        nextState.currentStatus = "completed";
      }

      if (action === "research_company") {
        const researchStatus: "completed" | "unavailable" | "failed" | "timed_out" =
          (output.status as "completed" | "unavailable" | "failed" | "timed_out" | undefined) ?? "unavailable";
        const researchUnavailable = researchStatus === "unavailable";
        nextState.research = {
          attempted: true,
          available: researchUnavailable ? false : true,
          status: researchStatus,
          retryable: Boolean(output.retryable ?? researchStatus !== "unavailable"),
          reason: typeof output.reason === "string" ? output.reason : state.research.reason,
          evidenceAdded: Boolean(output.evidenceAdded),
        };

        if (researchUnavailable) {
          nextState.uncertainties = [
            ...nextState.uncertainties,
            "External company research was unavailable; analysis uses user-provided and local portfolio evidence.",
          ];
        }
      }

      nextState.conflicts = detectConflicts(nextState.evidence);
      nextState.validation = action === "generate_outreach" ? validateFinal(nextState) : validateRuntime(nextState);
      state = nextState;

      await traceWriter({
        runId: state.runId,
        type: "tool_result_summary",
        message: tool.name,
        timestamp: new Date().toISOString(),
        data: {
          evidenceCount: state.evidence.length,
          qualificationScore: state.qualificationScore,
          confidence: state.confidence,
          researchStatus: state.research.status,
        },
      });

      const currentValidation = state.validation ?? validateRuntime(state);

      if (action === "validate_evidence" && currentValidation.requiredAction === "human_review") {
        state = { ...state, currentStatus: "awaiting_human_review" };
        break;
      }

      if (action === "generate_outreach") {
        if (currentValidation.passed) {
          state = { ...state, currentStatus: "completed" };
          break;
        }

        correctionAttempts += 1;
        if (correctionAttempts > AGENT_LIMITS.maximumCorrectionAttempts) {
          state = { ...state, currentStatus: "awaiting_human_review" };
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const researchUnavailableError = action === "research_company" && /unavailable|not available|missing/i.test(message);
      const researchTimedOut = action === "research_company" && /timed out/i.test(message);

      const nextResearch =
        action === "research_company"
          ? {
              attempted: true,
              available: false,
              status: (researchTimedOut ? "timed_out" : researchUnavailableError ? "unavailable" : "failed") as
                | "timed_out"
                | "unavailable"
                | "failed",
              retryable: false,
              reason: message,
              evidenceAdded: false,
            }
          : state.research;

      state = {
        ...state,
        research: nextResearch,
        consecutiveFailures:
          action === "research_company" && (researchUnavailableError || researchTimedOut)
            ? state.consecutiveFailures
            : state.consecutiveFailures + 1,
        errors: [...state.errors, message],
        uncertainties:
          action === "research_company"
            ? [
                ...state.uncertainties,
                "External company research was unavailable or failed; analysis uses user-provided and local portfolio evidence.",
              ]
            : state.uncertainties,
        toolExecutions: state.toolExecutions.map((execution) =>
          execution.id === executionId
            ? {
                ...execution,
                finishedAt: new Date().toISOString(),
                success: false,
                error: message,
              }
            : execution
        ),
      };

      await traceWriter({
        runId: state.runId,
        type: "tool_failure",
        message,
        timestamp: new Date().toISOString(),
        data: { tool: tool.name, action },
      });

      if (state.consecutiveFailures >= AGENT_LIMITS.maxConsecutiveFailures) {
        state = { ...state, currentStatus: "awaiting_human_review" };
        break;
      }
    }

    if (state.currentStatus === "completed" || state.currentStatus === "awaiting_human_review") {
      break;
    }
  }

  const finalValidation = state.outreachGenerated ? validateFinal(state) : validateRuntime(state);
  const finalState = AgentStateSchema.parse({
    ...state,
    validation: finalValidation,
    agentMetadata: {
      runId: state.runId,
      status: state.currentStatus,
      qualificationScore: state.qualificationScore,
      confidence: state.confidence,
      evidence: state.evidence,
      uncertainties: state.uncertainties,
      conflicts: state.conflicts,
      validation: finalValidation,
      traceSummary,
    },
    timestamps: {
      ...state.timestamps,
      finishedAt: state.timestamps.finishedAt ?? new Date().toISOString(),
    },
  });

  await traceWriter({
    runId: finalState.runId,
    type: finalState.currentStatus === "completed" ? "run_completed" : "run_failed",
    message: finalState.currentStatus === "completed" ? "Run completed" : "Run ended with review or failure",
    timestamp: new Date().toISOString(),
    data: {
      status: finalState.currentStatus,
      qualificationScore: finalState.qualificationScore,
      confidence: finalState.confidence,
      sufficientContext: hasSufficientLeadContext(finalState),
    },
  });

  return {
    analysis: buildFinalAnalysisFromState(finalState),
    agentMetadata: finalState.agentMetadata,
    state: finalState,
  };
}
