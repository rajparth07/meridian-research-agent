import { asRecord } from "@/lib/agent/json";
import type { CompleteJson } from "@/lib/agent/llm";
import { mapPool } from "@/lib/agent/pool";
import { quoteIsGrounded, truncate } from "@/lib/agent/text";
import type { Claim, LlmConfig, SourceDocument } from "@/lib/agent/types";

export async function readDocuments(input: {
  llm: LlmConfig;
  question: string;
  documents: SourceDocument[];
  complete: CompleteJson;
  signal?: AbortSignal;
  onDocument?: (document: SourceDocument) => void;
}): Promise<Claim[]> {
  const batches = await mapPool(input.documents, 3, async (document) => {
    input.onDocument?.(document);
    return readOne(input, document);
  });
  return batches.flat().map((claim, index) => ({ ...claim, id: `c${index + 1}` }));
}

async function readOne(
  input: {
    llm: LlmConfig;
    question: string;
    complete: CompleteJson;
    signal?: AbortSignal;
  },
  document: SourceDocument,
): Promise<Array<Omit<Claim, "id">>> {
  const extracted = await input.complete(
    input.llm,
    `You are the reading desk of Meridian.
Extract claims from one document that help answer the question.
Use only facts present in the document. If it does not help, return no claims.
Every claim needs a quote copied from the document. relevance is a number from 0 to 1.

Return one JSON object:
{
  "relevant": true,
  "claims": [
    { "text": "self-contained claim", "quote": "supporting span copied from the document", "relevance": 0.8 }
  ]
}`,
    `Question: ${input.question}

Document ${document.id}
Title: ${document.title}
Source: ${document.source}
URL: ${document.url}

${truncate(document.text, 4500)}`,
    (value) => parseClaims(value, document),
    input.signal,
  );
  return extracted;
}

function parseClaims(
  value: unknown,
  document: SourceDocument,
): Array<Omit<Claim, "id">> {
  const record = asRecord(value);
  if (record.relevant === false) return [];
  const rawClaims = Array.isArray(record.claims) ? record.claims : [];
  const claims: Array<Omit<Claim, "id">> = [];

  for (const item of rawClaims) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const claim = item as Record<string, unknown>;
    const text = typeof claim.text === "string" ? claim.text.trim() : "";
    const quote = typeof claim.quote === "string" ? claim.quote.trim() : "";
    const relevance = typeof claim.relevance === "number" ? claim.relevance : 0;
    if (!text || !quote || relevance < 0.35) continue;
    if (!quoteIsGrounded(quote, document.text)) continue;
    claims.push({
      text: text.slice(0, 500),
      quote: quote.slice(0, 400),
      relevance: Math.min(1, relevance),
      documentId: document.id,
    });
    if (claims.length === 4) break;
  }

  return claims;
}
