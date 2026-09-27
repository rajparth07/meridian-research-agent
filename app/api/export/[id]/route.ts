import { briefToMarkdown } from "@/lib/agent/markdown";
import { getRun } from "@/lib/agent/memory";
import { briefToPdf } from "@/lib/agent/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const run = await getRun(id);
  if (!run) {
    return Response.json({ error: "That brief is not in memory." }, { status: 404 });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "md";
  const stem = `meridian-${id.slice(0, 8)}`;

  if (format === "pdf") {
    const bytes = await briefToPdf(run);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stem}.pdf"`,
      },
    });
  }

  if (format === "trace") {
    return new Response(JSON.stringify(run, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}-trace.json"`,
      },
    });
  }

  return new Response(briefToMarkdown(run), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}.md"`,
    },
  });
}
