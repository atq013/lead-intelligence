export const MAX_COMPACT_LEAD_INPUT_CHARS = 3200;

export function compactLeadInput(leadInput: string, maxChars = MAX_COMPACT_LEAD_INPUT_CHARS): string {
  const trimmed = leadInput.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return trimmed.slice(0, maxChars);
}

export function extractFirstLine(leadInput: string): string {
  return leadInput
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

export function extractFirstName(leadInput: string): string {
  const firstLine = extractFirstLine(leadInput);

  if (!firstLine) return "[Name]";

  const cleaned = firstLine
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim();

  const firstName = cleaned.split(/\s+/)[0];

  return firstName || "[Name]";
}
