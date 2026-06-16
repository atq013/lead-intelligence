import { NextResponse } from "next/server";
import { ChatMistralAI } from "@langchain/mistralai";
import { getMistralConfig } from "@/lib/mistralConfig";
import { withTimeout } from "@/lib/withTimeout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const config = getMistralConfig();

  const diagnostics = {
    runtime: "nodejs",
    provider: "mistral",
    model: config.model,
    hasApiKey: config.hasApiKey,
    keyLength: config.keyLength,
    keyPreview: config.keyPreview,
  };

  if (!config.hasApiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing Mistral API key. Expected MISTRAL_KEY_API or MISTRAL_API_KEY.",
        diagnostics,
      },
      { status: 500 }
    );
  }

  try {
    const model = new ChatMistralAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0,
      maxTokens: 20,
    });

    const response = await withTimeout(
      model.invoke("Reply with exactly: OK"),
      20000,
      "Mistral debug test"
    );

    return NextResponse.json({
      success: true,
      diagnostics,
      response:
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content),
      tookMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[DEBUG_MISTRAL] Error object:", error);
    console.error(
      "[DEBUG_MISTRAL] Error message:",
      error instanceof Error ? error.message : String(error)
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        diagnostics,
        tookMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
