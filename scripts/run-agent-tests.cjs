/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function toPosixAbsolute(...parts) {
  return path.join(projectRoot, ...parts).replace(/\\/g, "/");
}

function rewriteAliases(source) {
  return source
    .replace(/from\s+["']@\/([^"']+)["']/g, (_match, spec) => `from "${toPosixAbsolute("src", spec)}"`)
    .replace(/require\(\s*["']@\/([^"']+)["']\s*\)/g, (_match, spec) => `require("${toPosixAbsolute("src", spec)}")`);
}

require.extensions[".ts"] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const rewritten = rewriteAliases(source);
  const result = ts.transpileModule(rewritten, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: filename,
  });

  module._compile(result.outputText, filename);
};

require.extensions[".tsx"] = require.extensions[".ts"];

const { runLeadAgent } = require(path.join(projectRoot, "src", "agent", "runAgent.ts"));
const { toolRegistry } = require(path.join(projectRoot, "src", "agent", "toolRegistry.ts"));
const { createEvidence } = require(path.join(projectRoot, "src", "agent", "evidence.ts"));

function createPlanner(sequence) {
  let index = 0;
  const calls = [];

  const planner = async (_state, allowedActions) => {
    const action = sequence[index] ?? sequence[sequence.length - 1];
    calls.push({ action, allowedActions: [...allowedActions] });
    index += 1;
    return {
      action,
      reason: `mock decision ${action}`,
      missingInformation: [],
      confidence: 0.9,
    };
  };

  planner.calls = calls;
  return planner;
}

function createTraceCollector() {
  const events = [];
  return {
    events,
    appendTraceEvent: async (event) => {
      events.push(event);
    },
  };
}

function createMockRegistry() {
  return {
    ...toolRegistry,
    generate_outreach: {
      ...toolRegistry.generate_outreach,
      execute: async (_input, state) => ({
        analysis: {
          leadSummary:
            state.summary ||
            `Lead summary for ${state.normalizedLeadData.company || state.normalizedLeadData.firstName || "the lead"}`,
          likelyPainPoints:
            state.painPoints.length > 0
              ? state.painPoints
              : ["manual research", "data quality", "entity classification"],
          bestServiceToPitch:
            state.recommendedService || "AI data classification and human-review workflow automation",
          matchingAestheTeQsProject: state.recommendedProject || "MappingClarity",
          outreachAngle:
            "Position AestheTeQs as a partner that can help reduce manual research time, improve data quality, and keep human review in the workflow.",
          followUpMessage:
            "Just following up on my earlier message in case this is relevant for your team.",
          discoveryQuestions:
            state.discoveryQuestions.length > 0
              ? state.discoveryQuestions
              : [
                  "Which workflows are most manual today?",
                  "Where would a searchable intelligence platform help most?",
                  "What would you want flagged for human review?",
                ],
          leadScore: Math.max(state.qualificationScore, 1),
        },
        evidence: [
          createEvidence({
            category: "generation",
            source: "mock",
            sourceIdentifier: state.runId,
            field: "final_analysis",
            value: "Mock final analysis generated for test.",
            confidence: 1,
            metadata: { fields: ["leadSummary", "likelyPainPoints", "bestServiceToPitch", "matchingAestheTeQsProject"] },
          }),
        ],
      }),
    },
  };
}

async function runWith(sequence, input) {
  const planner = createPlanner(sequence);
  const trace = createTraceCollector();
  const result = await runLeadAgent(input, {
    decideNextAction: planner,
    getToolDefinition: (action) => createMockRegistry()[action],
    appendTraceEvent: trace.appendTraceEvent,
  });
  return { result, planner, trace };
}

function getToolCount(result, toolName) {
  return result.state.toolExecutions.filter((execution) => execution.toolName === toolName).length;
}

function hasTrace(trace, type, fragment) {
  return trace.events.some((event) => event.type === type && (!fragment || JSON.stringify(event).includes(fragment)));
}

async function testResearchUnavailableAndSufficientInput() {
  const input = `
Sarah Mitchell is the Founder and CEO of CapitalBridge Insights, a growing B2B SaaS company that helps private equity firms and family offices research investment opportunities.

The company currently collects information from company websites, LinkedIn profiles, industry reports, spreadsheets, and several paid data providers. Their research team manually reviews and organizes this information before sharing it with investment professionals.

Sarah recently mentioned that the team is struggling with duplicated records, inconsistent company classifications, outdated contact details, and too much manual research. Analysts spend several hours verifying each target company before it can be added to their internal database.

CapitalBridge currently uses React, Node.js, PostgreSQL, and AWS. They are exploring AI-powered enrichment, automated entity classification, semantic search, and confidence-based validation. They want uncertain results to be flagged for human review rather than automatically accepted.

The company has approximately 35 employees and recently posted vacancies for a Senior Data Engineer and an AI Product Engineer. Their immediate goal is to reduce manual research time, improve data accuracy, and build a searchable intelligence platform for their clients.

Sarah is likely the main decision-maker, but the Head of Data and CTO would also be involved in evaluating a technical solution.
`.trim();

  const { result, trace } = await runWith(
    ["inspect_lead", "research_company", "retrieve_portfolio", "score_lead", "validate_evidence", "generate_outreach", "finish"],
    input
  );

  assert.equal(getToolCount(result, "researchCompany"), 1, "research_company should run only once");
  assert.ok(result.state.portfolioRetrieved, "portfolio retrieval should run");
  assert.ok(result.state.scoreCalculated, "scoring should run");
  assert.ok(result.state.validation, "validation should run");
  assert.ok(result.state.qualificationScore > 0, "qualificationScore should be greater than zero");
  assert.ok(result.analysis.leadSummary.length > 0, "analysis summary should not be empty");
  assert.ok(!hasTrace(trace, "guardrail_triggered", "Repeated action loop"), "repeated-action loop should not occur");
}

async function testPlannerRequestsUnavailableResearchTwice() {
  const input = `
Sarah Mitchell is the Founder and CEO of CapitalBridge Insights, a growing B2B SaaS company that helps private equity firms and family offices research investment opportunities.

The company currently collects information from company websites, LinkedIn profiles, industry reports, spreadsheets, and several paid data providers. Their research team manually reviews and organizes this information before sharing it with investment professionals.

Sarah recently mentioned that the team is struggling with duplicated records, inconsistent company classifications, outdated contact details, and too much manual research. Analysts spend several hours verifying each target company before it can be added to their internal database.

CapitalBridge currently uses React, Node.js, PostgreSQL, and AWS. They are exploring AI-powered enrichment, automated entity classification, semantic search, and confidence-based validation. They want uncertain results to be flagged for human review rather than automatically accepted.

The company has approximately 35 employees and recently posted vacancies for a Senior Data Engineer and an AI Product Engineer. Their immediate goal is to reduce manual research time, improve data accuracy, and build a searchable intelligence platform for their clients.

Sarah is likely the main decision-maker, but the Head of Data and CTO would also be involved in evaluating a technical solution.
`.trim();

  const { result, planner, trace } = await runWith(
    ["inspect_lead", "research_company", "research_company", "retrieve_portfolio", "score_lead", "validate_evidence", "generate_outreach", "finish"],
    input
  );

  assert.equal(getToolCount(result, "researchCompany"), 1, "second research attempt should be blocked");
  assert.ok(hasTrace(trace, "guardrail_triggered", "Planner selected a disallowed action"), "guardrail trace should exist");
  const secondPlannerCall = planner.calls.find((call, index) => index >= 2);
  assert.ok(secondPlannerCall, "planner should be called multiple times");
  assert.ok(
    !secondPlannerCall.allowedActions.includes("research_company"),
    "research_company should be removed from allowed actions after unavailable"
  );
  assert.ok(result.state.recommendedProject.length > 0, "safe fallback should continue the run");
}

async function testInsufficientInputRoutesHumanReview() {
  const input = "Sarah is a founder.";
  const { result, trace } = await runWith(
    ["inspect_lead", "research_company", "retrieve_portfolio", "score_lead", "validate_evidence", "request_human_review", "finish"],
    input
  );

  assert.equal(result.state.currentStatus, "awaiting_human_review", "status should become awaiting_human_review");
  assert.equal(result.analysis.linkedinMessage, "", "outreach should remain blocked");
  assert.ok(
    result.state.validation?.errors.some((error) => error.includes("Insufficient evidence")),
    "runtime validation should report insufficient evidence"
  );
  assert.ok(
    hasTrace(trace, "guardrail_triggered") || hasTrace(trace, "tool_result_summary"),
    "trace should contain evidence of the run"
  );
}

async function testBackwardCompatibleResponse() {
  const input = `
Sarah Mitchell is the Founder and CEO of CapitalBridge Insights, a growing B2B SaaS company that helps private equity firms and family offices research investment opportunities.

The company currently collects information from company websites, LinkedIn profiles, industry reports, spreadsheets, and several paid data providers. Their research team manually reviews and organizes this information before sharing it with investment professionals.

Sarah recently mentioned that the team is struggling with duplicated records, inconsistent company classifications, outdated contact details, and too much manual research. Analysts spend several hours verifying each target company before it can be added to their internal database.

CapitalBridge currently uses React, Node.js, PostgreSQL, and AWS. They are exploring AI-powered enrichment, automated entity classification, semantic search, and confidence-based validation. They want uncertain results to be flagged for human review rather than automatically accepted.

The company has approximately 35 employees and recently posted vacancies for a Senior Data Engineer and an AI Product Engineer. Their immediate goal is to reduce manual research time, improve data accuracy, and build a searchable intelligence platform for their clients.

Sarah is likely the main decision-maker, but the Head of Data and CTO would also be involved in evaluating a technical solution.
`.trim();

  const { result } = await runWith(
    ["inspect_lead", "research_company", "retrieve_portfolio", "score_lead", "validate_evidence", "generate_outreach", "finish"],
    input
  );

  assert.ok(result.analysis.leadSummary.length > 0, "leadSummary should be populated");
  assert.ok(result.analysis.likelyPainPoints.length > 0, "likelyPainPoints should be populated");
  assert.ok(result.analysis.bestServiceToPitch.length > 0, "bestServiceToPitch should be populated");
  assert.ok(result.analysis.matchingAestheTeQsProject.length > 0, "matching project should be populated");
  assert.ok(result.analysis.outreachAngle.length > 0, "outreach angle should be populated");
  assert.ok(result.analysis.linkedinMessage.length > 0, "LinkedIn message should be populated");
  assert.ok(result.analysis.followUpMessage.length > 0, "follow-up should be populated");
  assert.ok(result.analysis.discoveryQuestions.length > 0, "discovery questions should be populated");
  assert.ok(result.analysis.leadScore > 0, "lead score should be populated");
}

async function main() {
  const tests = [
    ["research unavailable but sufficient input", testResearchUnavailableAndSufficientInput],
    ["planner requests unavailable research twice", testPlannerRequestsUnavailableResearchTwice],
    ["genuinely insufficient input", testInsufficientInputRoutesHumanReview],
    ["backward-compatible response", testBackwardCompatibleResponse],
  ];

  let failed = 0;
  for (const [name, testFn] of tests) {
    try {
      await testFn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`${failed} test(s) failed`);
  }

  console.log(`All ${tests.length} agent regression tests passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
