import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type TraceEvent = {
  runId: string;
  type: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export async function appendTraceEvent(event: TraceEvent): Promise<void> {
  const traceDir = path.join(process.cwd(), "data");
  const tracePath = path.join(traceDir, "agent-trace.jsonl");

  try {
    await mkdir(traceDir, { recursive: true });
    await appendFile(tracePath, `${JSON.stringify(event)}\n`, "utf8");
  } catch (error) {
    console.error("[TRACE] Failed to persist trace event:", error);
  }
}

