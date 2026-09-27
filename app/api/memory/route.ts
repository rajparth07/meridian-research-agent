import { listRuns } from "@/lib/agent/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const runs = await listRuns(30);
  return Response.json({ runs });
}
