export function getMistralConfig() {
  const rawApiKey =
    process.env.MISTRAL_KEY_API ||
    process.env.MISTRAL_API_KEY ||
    "";

  const apiKey = rawApiKey.trim();
  const model = (process.env.MISTRAL_MODEL || "mistral-small-latest").trim();

  return {
    apiKey,
    model,
    hasApiKey: Boolean(apiKey),
    keyLength: apiKey.length,
    keyPreview: apiKey
      ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
      : "missing",
  };
}
