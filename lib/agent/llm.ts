import { AgentError } from "@/lib/agent/config";
import { extractJson } from "@/lib/agent/json";
import type { LlmConfig } from "@/lib/agent/types";

export type CompleteJson = <T>(
  config: LlmConfig,
  system: string,
  user: string,
  parse: (value: unknown) => T,
  signal?: AbortSignal,
) => Promise<T>;

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export const completeJson: CompleteJson = async (
  config,
  system,
  user,
  parse,
  signal,
) => {
  let feedback = "";
  let lastError = "The model did not return usable JSON.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await chat(
      config,
      [
        { role: "system", content: system },
        {
          role: "user",
          content: feedback
            ? `${user}\n\nYour previous reply could not be used: ${feedback}\nReturn only one JSON object.`
            : user,
        },
      ],
      signal,
      attempt === 0,
    );

    try {
      return parse(extractJson(raw));
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Invalid JSON.";
      feedback = lastError;
    }
  }

  throw new AgentError(lastError);
};

async function chat(
  config: LlmConfig,
  messages: ChatMessage[],
  signal: AbortSignal | undefined,
  jsonMode: boolean,
): Promise<string> {
  const endpoint = `${config.baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0.2,
    messages,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  let response = await postChat(endpoint, config.apiKey, body, signal);
  if (response.status === 400 && jsonMode) {
    delete body.response_format;
    response = await postChat(endpoint, config.apiKey, body, signal);
  }

  const payload = await response.text();
  const safePayload = redact(payload, config.apiKey);
  if (!response.ok) {
    throw new AgentError(providerError(response.status, safePayload));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new AgentError("The model provider returned a non-JSON response.");
  }

  const choice = readChoice(parsed);
  if (choice.finishReason === "length") {
    throw new AgentError("The model response was cut off before it finished.");
  }
  if (!choice.content.trim()) {
    throw new AgentError("The model returned an empty reply.");
  }
  return choice.content;
}

async function postChat(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<Response> {
  const timeout = AbortSignal.timeout(90_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    return await fetch(endpoint, {
      method: "POST",
      signal: combined,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw new AgentError("Research was cancelled.");
    const message = error instanceof Error ? error.message : "request failed";
    throw new AgentError(`Could not reach the model provider. ${message}`);
  }
}

function readChoice(payload: unknown): { content: string; finishReason?: string } {
  if (!payload || typeof payload !== "object") {
    throw new AgentError("The model provider returned an unexpected payload.");
  }
  const record = payload as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: unknown };
    }>;
    error?: { message?: string };
  };
  if (record.error?.message) {
    throw new AgentError(record.error.message);
  }
  const content = record.choices?.[0]?.message?.content;
  return {
    content: messageText(content),
    finishReason: record.choices?.[0]?.finish_reason,
  };
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
}

function providerError(status: number, body: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    detail = parsed.error?.message ?? "";
  } catch {
    detail = body.slice(0, 280);
  }
  if (status === 401 || status === 403) {
    return "The model provider rejected the API key.";
  }
  if (status === 404) {
    return `The model or endpoint was not found. ${detail}`.trim();
  }
  if (status === 429) {
    return "The model provider rate-limited the request. Wait a moment and run it again.";
  }
  return `The model provider returned ${status}. ${detail}`.trim();
}

function redact(value: string, secret: string): string {
  if (!secret) return value;
  return value.split(secret).join("[redacted]");
}
