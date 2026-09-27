import { AgentError, resolveLlmConfig } from "@/lib/agent/config";
import { runResearch } from "@/lib/agent/orchestrator";
import { stamp } from "@/lib/agent/text";
import type { AgentEvent } from "@/lib/agent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body with a query." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const query = typeof record.query === "string" ? record.query : "";
  if (query.trim().length < 3) {
    return Response.json(
      { error: "Ask a question of at least a few words." },
      { status: 400 },
    );
  }

  let llm;
  try {
    llm = resolveLlmConfig({
      apiKey: typeof record.apiKey === "string" ? record.apiKey : undefined,
      baseUrl: typeof record.baseUrl === "string" ? record.baseUrl : undefined,
      model: typeof record.model === "string" ? record.model : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model settings are invalid.";
    return Response.json({ error: message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent | { type: "error"; message: string; at: string }) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The browser closed the stream.
        }
      };
      try {
        for await (const event of runResearch({
          query,
          llm,
          signal: request.signal,
        })) {
          send(event);
        }
      } catch (error) {
        if (request.signal.aborted) return;
        const message =
          error instanceof AgentError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Research failed.";
        send({ type: "error", message, at: stamp() });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
