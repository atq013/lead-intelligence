import type { Conflict, Evidence } from "@/agent/types";

export function detectConflicts(evidence: Evidence[]): Conflict[] {
  const byField = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const existing = byField.get(item.field) ?? [];
    existing.push(item);
    byField.set(item.field, existing);
  }

  const conflicts: Conflict[] = [];
  for (const [field, items] of byField.entries()) {
    const uniqueValues = Array.from(new Set(items.map((item) => item.value).filter(Boolean)));
    if (uniqueValues.length > 1) {
      conflicts.push({
        field,
        conflictingValues: uniqueValues,
        evidenceIds: items.map((item) => item.id),
        severity: uniqueValues.length > 2 ? "high" : "medium",
        resolutionStatus: "open",
      });
    }
  }

  return conflicts;
}

export function unresolvedHighSeverityConflictExists(conflicts: Conflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === "high" && conflict.resolutionStatus !== "resolved");
}

