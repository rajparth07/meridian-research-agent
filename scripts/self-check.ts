import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { CompleteJson } from "@/lib/agent/llm";

async function main(): Promise<void> {
process.env.MERIDIAN_DATA_DIR = mkdtempSync(path.join(tmpdir(), "meridian-"));

const { quoteIsGrounded, canonicalUrl } = await import("@/lib/agent/text");
const { isPublicHttpUrl } = await import("@/lib/agent/safety");
const { parseDuckDuckGoResults } = await import("@/lib/sources/duckduckgo");
const { parseArxivFeed } = await import("@/lib/sources/arxiv");
const { reconstructAbstract } = await import("@/lib/sources/openalex");
const { assignDocuments } = await import("@/lib/agent/gather");
const { briefToMarkdown } = await import("@/lib/agent/markdown");
const { briefToPdf } = await import("@/lib/agent/pdf");
const { getRun } = await import("@/lib/agent/memory");
const { runResearch } = await import("@/lib/agent/orchestrator");
const { searchSource } = await import("@/lib/sources");

type Complete = CompleteJson;

function check(name: string, run: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(run)
    .then(() => {
      console.log(`ok  ${name}`);
    });
}

const checks: Array<Promise<void>> = [];

checks.push(
  check("quote grounding", () => {
    const document = "A widget is a small mechanical device used in the example factory line.";
    assert.equal(
      quoteIsGrounded("A widget is a small mechanical device used in the example factory line.", document),
      true,
    );
    assert.equal(quoteIsGrounded("This sentence was never written.", document), false);
    assert.equal(quoteIsGrounded("short", document), false);
  }),
);

checks.push(
  check("public url guard", () => {
    assert.equal(isPublicHttpUrl("https://en.wikipedia.org/wiki/Widget"), true);
    assert.equal(isPublicHttpUrl("http://127.0.0.1/secret"), false);
    assert.equal(isPublicHttpUrl("http://localhost/admin"), false);
    assert.equal(isPublicHttpUrl("http://169.254.169.254/latest"), false);
    assert.equal(isPublicHttpUrl("http://10.0.0.8/"), false);
    assert.equal(isPublicHttpUrl("file:///etc/passwd"), false);
    assert.equal(isPublicHttpUrl("https://user:pass@example.com/"), false);
  }),
);

checks.push(
  check("duplicate documents", () => {
    const packed = assignDocuments([
      {
        source: "wikipedia",
        title: "Widget",
        url: "https://en.wikipedia.org/wiki/Widget?utm_source=newsletter",
        text: "A widget is a small mechanical device.",
      },
      {
        source: "wikipedia",
        title: "Widget again",
        url: "https://en.wikipedia.org/wiki/Widget",
        text: "duplicate page",
      },
      {
        source: "arxiv",
        title: "On widgets",
        url: "https://arxiv.org/abs/1234.5678",
        text: "A separate paper.",
      },
    ]);
    assert.equal(packed.documents.length, 2);
    assert.equal(packed.droppedDuplicates, 1);
    assert.deepEqual(
      packed.documents.map((doc) => doc.id),
      ["d1", "d2"],
    );
    assert.equal(canonicalUrl(packed.documents[0].url).includes("utm_"), false);
  }),
);

checks.push(
  check("duckduckgo parser", () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fwidgets&amp;rut=abc">Widget handbook</a>
      <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fwidgets">A practical guide to widgets in the shop.</a>
    `;
    const hits = parseDuckDuckGoResults(html);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.url, "https://example.com/widgets");
    assert.match(hits[0]?.title ?? "", /Widget handbook/);
  }),
);

checks.push(
  check("arxiv parser", () => {
    const xml = `<?xml version="1.0"?><feed><entry>
      <id>https://arxiv.org/abs/1706.03762</id>
      <title>Attention is all you need</title>
      <summary>We propose a new simple network architecture for sequence transduction.</summary>
      <published>2017-06-12T00:00:00Z</published>
      <author><name>Ashish Vaswani</name></author>
    </entry></feed>`;
    const docs = parseArxivFeed(xml);
    assert.equal(docs.length, 1);
    assert.equal(docs[0]?.title, "Attention is all you need");
    assert.equal(docs[0]?.authors?.[0], "Ashish Vaswani");
  }),
);

checks.push(
  check("openalex abstract", () => {
    const text = reconstructAbstract({
      is: [1],
      This: [0],
      abstract: [2],
    });
    assert.equal(text, "This is abstract");
  }),
);

checks.push(
  check("agent loop with stub model", async () => {
    const sentence = "A widget is a small mechanical device used in the example factory line.";
    const complete: Complete = async (_config, system, user, parse) => {
      if (system.includes("planning desk")) {
        return parse({
          refined_question: "What is a widget?",
          why_these_sources:
            "An encyclopedia can define the term and a scholarly index can show whether the term is used in papers.",
          memory_ids_to_reuse: [],
          tasks: [
            { source: "wikipedia", query: "widget", purpose: "Find a definition." },
            { source: "openalex", query: "widget mechanism", purpose: "Check scholarly usage." },
          ],
        });
      }
      if (system.includes("reading desk")) {
        return parse({
          relevant: true,
          claims: [
            {
              text: "A widget is a small mechanical device.",
              quote: sentence,
              relevance: 0.9,
            },
          ],
        });
      }
      if (system.includes("distilling desk")) {
        const ids = [...user.matchAll(/\bc\d+\b/g)].map((match) => match[0]);
        return parse({
          claims: [
            {
              text: "A widget is a small mechanical device.",
              claim_ids: [ids[0] ?? "c1"],
            },
          ],
        });
      }
      if (system.includes("briefing desk")) {
        return parse({
          title: "What a widget is",
          overview: "The retrieved material describes a widget as a small mechanical device.",
          key_points: [
            { text: "A widget is a small mechanical device.", source_ids: ["d1"] },
          ],
          findings: [
            {
              heading: "Definition",
              detail: "The source describes a widget as a small mechanical device used on a factory line.",
              source_ids: ["d1"],
            },
          ],
          actionable_insights: [
            { text: "Use that definition when labeling the part.", source_ids: ["d1"] },
          ],
          gaps: ["The sources do not say how common widgets are."],
          confidence: "medium",
        });
      }
      throw new Error(`Unexpected model stage: ${system.slice(0, 80)}`);
    };

    let savedId = "";
    for await (const event of runResearch({
      query: "What is a widget?",
      llm: { baseUrl: "http://127.0.0.1:9/v1", apiKey: "test", model: "stub" },
      complete,
      gather: async () => [
        {
          source: "wikipedia",
          title: "Widget",
          url: "https://en.wikipedia.org/wiki/Widget",
          text: sentence,
        },
        {
          source: "openalex",
          title: "Widget notes",
          url: "https://openalex.org/W1",
          text: sentence,
        },
      ],
    })) {
      if (event.type === "saved") savedId = event.id;
    }

    const run = await getRun(savedId);
    assert.ok(run);
    assert.equal(run.plan.tasks.length, 2);
    assert.equal(run.brief.keyPoints[0]?.sourceIds[0], "d1");
    assert.match(briefToMarkdown(run), /## Key points/);
    assert.match(briefToMarkdown(run), /## References/);
    const pdf = await briefToPdf(run);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
    assert.ok(run.events.some((event) => event.type === "plan"));
    assert.ok(run.events.some((event) => event.type === "distill_done"));
  }),
);

checks.push(
  check("live wikipedia", async () => {
    const docs = await searchSource("wikipedia", "retrieval augmented generation");
    assert.ok(docs.length > 0, "Wikipedia returned no documents");
    assert.ok(docs[0]?.url.includes("wikipedia.org"));
    assert.ok((docs[0]?.text.length ?? 0) > 80);
  }),
);

checks.push(
  check("live openalex", async () => {
    const docs = await searchSource("openalex", "retrieval augmented generation");
    assert.ok(docs.length > 0, "OpenAlex returned no documents");
    assert.ok((docs[0]?.text.length ?? 0) > 40);
  }),
);

  await Promise.all(checks);
  console.log("all checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
