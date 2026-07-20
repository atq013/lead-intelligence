import { randomUUID } from "node:crypto";
import type { Evidence } from "@/agent/types";

export function createEvidence(input: Omit<Evidence, "id" | "collectedAt">): Evidence {
  return {
    ...input,
    id: randomUUID(),
    collectedAt: new Date().toISOString(),
  };
}

export function dedupeEvidence(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.source}:${item.sourceIdentifier}:${item.field}:${item.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

