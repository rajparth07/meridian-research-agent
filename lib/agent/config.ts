import type { LlmConfig } from "@/lib/agent/types";

export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentError";
  }
}

export function resolveLlmConfig(input?: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): LlmConfig {
  const baseUrl = (
    input?.baseUrl ||
    process.env.LLM_BASE_URL ||
    "https://api.openai.com/v1"
  ).trim();
  const model = (input?.model || process.env.LLM_MODEL || "gpt-4o-mini").trim();
  let apiKey = (input?.apiKey || process.env.LLM_API_KEY || "").trim();

  if (!apiKey && /(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(baseUrl)) {
    apiKey = "ollama";
  }

  if (!apiKey) {
    throw new AgentError(
      "No model API key is set. Open Model settings and paste a key, or set LLM_API_KEY in .env.local.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AgentError("The model base URL is not a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AgentError("The model base URL must start with http:// or https://.");
  }
  if (!model) {
    throw new AgentError("A model name is required.");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model };
}
