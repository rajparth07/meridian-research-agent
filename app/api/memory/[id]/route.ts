import { deleteRun, getRun } from "@/lib/agent/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const run = await getRun(id);
  if (!run) {
    return Response.json({ error: "That brief is not in memory." }, { status: 404 });
  }
  return Response.json({ run });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const removed = await deleteRun(id);
  if (!removed) {
    return Response.json({ error: "That brief is not in memory." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
