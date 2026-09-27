import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runResearch } from "@/lib/agent/orchestrator";
import { searchSource } from "@/lib/sources";
import type { CompleteJson } from "@/lib/agent/llm";
import type { AgentEvent, SourceId } from "@/lib/agent/types";

async function main(): Promise<void> {
const query = "retrieval augmented generation";
const sources: SourceId[] = ["wikipedia", "openalex", "arxiv", "hackernews"];

const batches = await Promise.all(
  sources.map(async (source) => {
    try {
      const documents = await searchSource(source, query);
      return {
        source,
        ok: true,
        count: documents.length,
        documents: documents.map((document) => ({
          title: document.title,
          url: document.url,
          published: document.published,
          authors: document.authors,
          excerpt: document.text.slice(0, 700),
        })),
      };
    } catch (error) {
      return {
        source,
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "failed",
        documents: [],
      };
    }
  }),
);

const payload = {
  label: "Live source gather. This file is retrieval evidence, not a model-written brief.",
  query,
  generatedAt: new Date().toISOString(),
  note: "A full research transcript, including the model plan and brief, is downloaded from a finished run as Trace JSON.",
  sources: batches,
};

mkdirSync("docs/samples", { recursive: true });
writeFileSync("docs/samples/live-source-gather.json", JSON.stringify(payload, null, 2));
console.log(
  batches
    .map((batch) => `${batch.source}: ${batch.ok ? batch.count : batch.error}`)
    .join("\n"),
);

await writeWiringTrace();
}

async function writeWiringTrace(): Promise<void> {
  process.env.MERIDIAN_DATA_DIR = mkdtempSync(path.join(tmpdir(), "meridian-sample-"));
  const sentence = "A widget is a small mechanical device used in the example factory line.";
  const complete: CompleteJson = async (_config, system, user, parse) => {
    if (system.includes("planning desk")) {
      return parse({
        refined_question: "What is a widget?",
        why_these_sources: "Stub planner for the wiring trace. This is not a research result.",
        memory_ids_to_reuse: [],
        tasks: [{ source: "wikipedia", query: "widget", purpose: "Exercise the gather hook." }],
      });
    }
    if (system.includes("reading desk")) {
      return parse({
        relevant: true,
        claims: [{ text: "A widget is a small mechanical device.", quote: sentence, relevance: 0.9 }],
      });
    }
    if (system.includes("distilling desk")) {
      const ids = [...user.matchAll(/\bc\d+\b/g)].map((match) => match[0]);
      return parse({ claims: [{ text: "A widget is a small mechanical device.", claim_ids: [ids[0] ?? "c1"] }] });
    }
    return parse({
      title: "Wiring trace only",
      overview: "This brief was produced by a stub model to show the event shape. It is not research.",
      key_points: [{ text: "A widget is a small mechanical device.", source_ids: ["d1"] }],
      findings: [{ heading: "Definition", detail: "Stub finding.", source_ids: ["d1"] }],
      actionable_insights: [{ text: "Do not submit this file as a real research brief.", source_ids: ["d1"] }],
      gaps: ["Stub model."],
      confidence: "low",
    });
  };

  const events: AgentEvent[] = [];
  for await (const event of runResearch({
    query: "What is a widget?",
    llm: { baseUrl: "http://127.0.0.1:9/v1", apiKey: "stub", model: "stub" },
    complete,
    gather: async () => [
      {
        source: "wikipedia",
        title: "Widget",
        url: "https://en.wikipedia.org/wiki/Widget",
        text: sentence,
      },
    ],
  })) {
    events.push(event);
  }

  writeFileSync(
    "docs/samples/pipeline-wiring-trace.json",
    JSON.stringify(
      {
        label: "SYNTHETIC. Stub model. Not a research brief and not for the monitoring assessment.",
        events,
      },
      null,
      2,
    ),
  );
  console.log("wrote docs/samples/pipeline-wiring-trace.json");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
