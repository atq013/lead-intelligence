import { NextRequest, NextResponse } from "next/server";
import { AnalyzeLeadRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  console.log("[API] Route called");
  try {
    const [{ runLeadAgent }, { saveReport }] = await Promise.all([
      import("@/agent/runAgent"),
      import("@/lib/saveReport"),
    ]);

    const body = (await request.json().catch((error) => {
      console.error("[API] Failed to parse request JSON:", error);
      return null;
    })) as unknown;
    console.log("[API] Request body received:", body === null ? "null" : typeof body);

    const inputValue = typeof body === "object" && body !== null ? (body as { input?: unknown }).input : undefined;
    console.log("[API] Input type:", typeof inputValue);
    console.log("[API] Input length:", typeof inputValue === "string" ? inputValue.length : 0);
    console.log(
      "[API] Input preview:",
      typeof inputValue === "string" ? inputValue.slice(0, 150) : "No string input provided"
    );

    const parsedBody = AnalyzeLeadRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message ?? "Please provide at least 20 characters of lead context.",
        },
        { status: 400 }
      );
    }

    const { input } = parsedBody.data;
    console.log("[API] Validation passed");
    console.log("[API] Before calling runLeadAgent");
    const result = await runLeadAgent(input);
    console.log("[API] After runLeadAgent succeeds");
    console.log("[API] Before saving report");
    try {
      await saveReport({
        input,
        analysis: result.analysis,
        agentMetadata: result.agentMetadata,
      });
      console.log("[API] After saving report succeeds");
    } catch (error) {
      console.error("[API] Report save failed, continuing without persistence:", error);
    }

    return NextResponse.json({ success: true, analysis: result.analysis, agentMetadata: result.agentMetadata });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API] Error object:", error);
    console.error("[API] Error message:", errorMessage);
    console.error("[API] Error stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        success: false,
        error: errorMessage.includes("Mistral")
          ? errorMessage
          : `Failed to analyze lead: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
