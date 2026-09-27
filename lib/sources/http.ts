import { AgentError } from "@/lib/agent/config";

export const USER_AGENT = "MeridianResearch/1.0 (autonomous research agent)";

export async function fetchText(
  url: string,
  signal: AbortSignal | undefined,
  timeoutMs = 15_000,
): Promise<{ text: string; finalUrl: string; contentType: string }> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, {
      signal: combined,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/json,application/xml,text/plain;q=0.9,*/*;q=0.1",
      },
    });
  } catch (error) {
    if (signal?.aborted) throw new AgentError("Research was cancelled.");
    const message = error instanceof Error ? error.message : "request failed";
    throw new Error(`Fetch failed for ${url}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const reader = response.body?.getReader();
  if (!reader) {
    return { text: await response.text(), finalUrl: response.url || url, contentType };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  const limit = 180_000;
  while (received < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    received += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const text = new TextDecoder().decode(concat(chunks));
  return { text, finalUrl: response.url || url, contentType };
}

export async function fetchJson<T>(
  url: string,
  signal: AbortSignal | undefined,
  timeoutMs = 15_000,
): Promise<T> {
  const { text } = await fetchText(url, signal, timeoutMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${url}`);
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}
