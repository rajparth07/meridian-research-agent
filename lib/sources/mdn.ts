import { htmlToText, truncate } from "@/lib/agent/text";
import type { GatheredDocument } from "@/lib/agent/types";
import { fetchJson } from "@/lib/sources/http";

interface SearchHit {
  mdn_url?: string;
  title?: string;
  summary?: string;
}

interface SearchResponse {
  documents?: SearchHit[];
}

interface DocBlock {
  value?: { title?: string | null; content?: string };
}

interface DocResponse {
  doc?: { body?: DocBlock[]; title?: string; mdn_url?: string; summary?: string };
}

export async function searchMdn(
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  const searchUrl =
    "https://developer.mozilla.org/api/v1/search?q=" + encodeURIComponent(query);
  const payload = await fetchJson<SearchResponse>(searchUrl, signal);
  const hits = (payload.documents ?? [])
    .filter((hit) => hit.mdn_url && hit.title)
    .slice(0, 2);
  const documents: GatheredDocument[] = [];

  for (const hit of hits) {
    const pageUrl = `https://developer.mozilla.org${hit.mdn_url}`;
    const doc = await fetchJson<DocResponse>(`${pageUrl}/index.json`, signal).catch(
      () => null,
    );
    const body = mdnBody(doc?.doc?.body);
    const text = truncate(body || hit.summary || "", 4000);
    if (text.length < 40) continue;
    documents.push({
      source: "mdn",
      title: doc?.doc?.title || hit.title || "MDN",
      url: pageUrl,
      text,
    });
  }

  return documents;
}

function mdnBody(blocks: DocBlock[] | undefined): string {
  if (!blocks) return "";
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.value?.title) parts.push(block.value.title);
    if (block.value?.content) parts.push(htmlToText(block.value.content));
  }
  return parts.join(" ");
}
