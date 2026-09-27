export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({
    hasServerKey: Boolean(process.env.LLM_API_KEY),
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
  });
}
