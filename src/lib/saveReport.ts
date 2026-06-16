import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function shouldSaveReportsToFile() {
  const explicitlyEnabled = process.env.SAVE_REPORTS_TO_FILE === "true";
  const isProduction = process.env.NODE_ENV === "production";
  const isNetlify = process.env.NETLIFY === "true";

  if (isProduction || isNetlify) {
    return false;
  }

  return explicitlyEnabled;
}

export async function saveReport(report: unknown) {
  if (!shouldSaveReportsToFile()) {
    console.log("[REPORTS] Skipping file save in production/serverless environment.");
    return;
  }

  try {
    const reportsPath = path.join(process.cwd(), "data", "reports.json");

    let existingReports: unknown[] = [];

    try {
      const existing = await fs.readFile(reportsPath, "utf8");
      const parsed = JSON.parse(existing) as unknown;
      existingReports = Array.isArray(parsed) ? parsed : [];
    } catch {
      existingReports = [];
    }

    existingReports.unshift({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      report,
    });

    await fs.mkdir(path.dirname(reportsPath), { recursive: true });
    await fs.writeFile(
      reportsPath,
      JSON.stringify(existingReports, null, 2),
      "utf8"
    );

    console.log("[REPORTS] Report saved locally:", reportsPath);
  } catch (error) {
    console.error("[REPORTS] Failed to save report locally:", error);
  }
}
