import { NextRequest, NextResponse } from "next/server";
import { analyzeLead } from "@/lib/analyzeLead";
import { saveReport } from "@/lib/saveReport";
import { AnalyzeLeadRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  console.log("[API] Route called");
  try {
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
    console.log("[API] Before calling analyzeLead");
    const analysis = await analyzeLead(input);
    console.log("[API] After analyzeLead succeeds");
    console.log("[API] Before saving report");
    await saveReport(input, analysis);
    console.log("[API] After saving report succeeds");

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[API] Error object:", error);
    console.error("[API] Error message:", errorMessage);
    console.error("[API] Error stack:", errorStack);

    return NextResponse.json(
      {
        success: false,
        error:
          process.env.NODE_ENV !== "production"
            ? errorMessage
            : "Failed to analyze lead. Check your MISTRAL_KEY_API and model configuration.",
      },
      { status: 500 }
    );
  }
}
