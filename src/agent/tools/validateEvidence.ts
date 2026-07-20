import { z } from "zod";
import type { AgentState, ValidationResult } from "@/agent/types";
import { validateRuntimeState } from "@/agent/validation";

export const ValidateEvidenceInputSchema = z.object({
  correctionAttempt: z.number().int().min(0).default(0),
});

export const ValidateEvidenceOutputSchema = z.object({
  validation: z.any(),
});

export async function validateEvidence(_input: z.infer<typeof ValidateEvidenceInputSchema>, state: AgentState) {
  const validation: ValidationResult = validateRuntimeState(state);
  return { validation };
}
