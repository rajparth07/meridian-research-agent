import { asRecord, asString } from "@/lib/agent/json";
import type { CompleteJson } from "@/lib/agent/llm";
import type {
  BriefFinding,
  CitedText,
  DistilledClaim,
  LlmConfig,
  MemorySnippet,
  ResearchBrief,
  SourceDocument,
} from "@/lib/agent/types";

export async function writeBrief(input: {
  llm: LlmConfig;
  query: string;
  question: string;
  claims: DistilledClaim[];
  documents: SourceDocument[];
  memory: MemorySnippet[];
  complete: CompleteJson;
  signal?: AbortSignal;
}): Promise<ResearchBrief> {
  const documents = new Map(input.documents.map((doc) => [doc.id, doc]));
  const listing = input.claims
    .map((claim) => {
      const refs = claim.documentIds
        .map((id) => {
          const doc = documents.get(id);
          return doc ? `${id} (${doc.source}: ${doc.title})` : id;
        })
        .join(", ");
      return `- ${claim.text}\n  documents: ${refs}`;
    })
    .join("\n");
  const memoryBlock = input.memory.length
    ? input.memory
        .map((item) => `- ${item.title}: ${item.overview}`)
        .join("\n")
    : "None.";

  const draft = await input.complete(
    input.llm,
    `You are the briefing desk of Meridian.
Write a research brief using only the distilled claims. Do not add facts from training data.
Every key point, finding, and actionable insight must cite document ids that appear in the claim list, such as "d1".
If the evidence is thin or conflicting, say so in gaps and use a lower confidence.
confidence must be "low", "medium", or "high".
Prior briefs are background only. Do not cite them as sources.

Return one JSON object:
{
  "title": "",
  "overview": "",
  "key_points": [{ "text": "", "source_ids": ["d1"] }],
  "findings": [{ "heading": "", "detail": "", "source_ids": ["d1"] }],
  "actionable_insights": [{ "text": "", "source_ids": ["d1"] }],
  "gaps": [],
  "confidence": "medium"
}`,
    `Original question: ${input.query}
Research question: ${input.question}

Distilled claims:
${listing}

Prior briefs:
${memoryBlock}`,
    (value) => parseBrief(value, documents),
    input.signal,
  );

  return draft;
}

function parseBrief(
  value: unknown,
  documents: Map<string, SourceDocument>,
): ResearchBrief {
  const record = asRecord(value);
  const valid = new Set(documents.keys());
  const keyPoints = citedList(record.key_points, valid);
  const findings = findingList(record.findings, valid);
  const actionableInsights = citedList(record.actionable_insights, valid);
  if (keyPoints.length + findings.length + actionableInsights.length === 0) {
    throw new Error("The brief did not cite any retrieved document.");
  }

  const cited = new Set<string>([
    ...keyPoints.flatMap((item) => item.sourceIds),
    ...findings.flatMap((item) => item.sourceIds),
    ...actionableInsights.flatMap((item) => item.sourceIds),
  ]);
  const confidence = record.confidence;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") {
    throw new Error("Brief confidence must be low, medium, or high.");
  }

  return {
    title: asString(record.title, "title").slice(0, 180),
    overview: asString(record.overview, "overview").slice(0, 1200),
    keyPoints,
    findings,
    actionableInsights,
    gaps: Array.isArray(record.gaps)
      ? record.gaps
          .filter((gap): gap is string => typeof gap === "string" && gap.trim().length > 0)
          .map((gap) => gap.trim().slice(0, 400))
          .slice(0, 6)
      : [],
    confidence,
    references: [...documents.values()].map((doc) => ({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      source: doc.source,
      cited: cited.has(doc.id),
      published: doc.published,
      authors: doc.authors,
    })),
  };
}

function citedList(value: unknown, valid: Set<string>): CitedText[] {
  if (!Array.isArray(value)) return [];
  const items: CitedText[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text.trim() : "";
    const sourceIds = sourceIdsOf(record.source_ids, valid);
    if (!text || sourceIds.length === 0) continue;
    items.push({ text: text.slice(0, 600), sourceIds });
    if (items.length === 8) break;
  }
  return items;
}

function findingList(value: unknown, valid: Set<string>): BriefFinding[] {
  if (!Array.isArray(value)) return [];
  const items: BriefFinding[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const heading = typeof record.heading === "string" ? record.heading.trim() : "";
    const detail = typeof record.detail === "string" ? record.detail.trim() : "";
    const sourceIds = sourceIdsOf(record.source_ids, valid);
    if (!heading || !detail || sourceIds.length === 0) continue;
    items.push({
      heading: heading.slice(0, 160),
      detail: detail.slice(0, 900),
      sourceIds,
    });
    if (items.length === 6) break;
  }
  return items;
}

function sourceIdsOf(value: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && valid.has(id)))];
}
