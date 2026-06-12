import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

type StoredReport = {
  id: string;
  input: string;
  analysis: unknown;
  createdAt: string;
};

async function readExistingReports(filePath: string): Promise<StoredReport[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredReport[]) : [];
  } catch {
    return [];
  }
}

export async function saveReport(input: string, analysis: unknown): Promise<void> {
  try {
    console.log("[SAVE] Saving report");
    const dataDir = path.join(process.cwd(), "data");
    const filePath = path.join(dataDir, "reports.json");
    console.log("[SAVE] reports.json path:", filePath);
    const existingReports = await readExistingReports(filePath);
    console.log("[SAVE] Existing file read successfully");
    console.log("[SAVE] Number of existing reports:", existingReports.length);

    const newReportId = randomUUID();
    console.log("[SAVE] New report ID:", newReportId);

    const nextReports: StoredReport[] = [
      {
        id: newReportId,
        input,
        analysis,
        createdAt: new Date().toISOString(),
      },
      ...existingReports,
    ];

    console.log("[SAVE] Number of reports after adding:", nextReports.length);
    await mkdir(dataDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(nextReports, null, 2), "utf8");
    console.log("[SAVE] Write succeeded");
  } catch (error) {
    console.error("[SAVE] Exact error:", error);
    throw error;
  }
}
