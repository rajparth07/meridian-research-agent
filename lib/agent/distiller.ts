import { asRecord } from "@/lib/agent/json";
import type { CompleteJson } from "@/lib/agent/llm";
import type { Claim, DistilledClaim, LlmConfig } from "@/lib/agent/types";

export async function distillClaims(input: {
  llm: LlmConfig;
  question: string;
  claims: Claim[];
  complete: CompleteJson;
  signal?: AbortSignal;
}): Promise<DistilledClaim[]> {
  if (input.claims.length === 0) return [];
  const byId = new Map(input.claims.map((claim) => [claim.id, claim]));
  const listing = input.claims
    .map(
      (claim) =>
        `[${claim.id}] document ${claim.documentId} (relevance ${claim.relevance.toFixed(2)})\n${claim.text}\nQuote: ${claim.quote}`,
    )
    .join("\n\n");

  return input.complete(
    input.llm,
    `You are the distilling desk of Meridian.
Merge claims that assert the same fact. Drop claims that are off-topic, vague, or not useful for the question.
Keep the clearest wording. Every kept claim must list the claim ids it came from. Do not add new facts.

Return one JSON object:
{
  "claims": [
    { "text": "merged claim", "claim_ids": ["c1"] }
  ]
}`,
    `Question: ${input.question}\n\nClaims:\n${listing}`,
    (value) => parseDistilled(value, byId),
    input.signal,
  );
}

function parseDistilled(
  value: unknown,
  byId: Map<string, Claim>,
): DistilledClaim[] {
  const record = asRecord(value);
  const raw = Array.isArray(record.claims) ? record.claims : [];
  const distilled: DistilledClaim[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const claim = item as Record<string, unknown>;
    const text = typeof claim.text === "string" ? claim.text.trim().slice(0, 500) : "";
    const claimIds = Array.isArray(claim.claim_ids)
      ? claim.claim_ids.filter((id): id is string => typeof id === "string" && byId.has(id))
      : [];
    if (!text || claimIds.length === 0) continue;
    const documentIds = [
      ...new Set(claimIds.map((id) => byId.get(id)?.documentId).filter((id): id is string => Boolean(id))),
    ];
    distilled.push({
      id: `m${distilled.length + 1}`,
      text,
      claimIds,
      documentIds,
    });
  }

  if (distilled.length === 0) {
    throw new Error("Distillation removed every claim. Keep the claims that answer the question.");
  }
  return distilled;
}
