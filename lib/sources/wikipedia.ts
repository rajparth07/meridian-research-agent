import { truncate } from "@/lib/agent/text";
import type { GatheredDocument } from "@/lib/agent/types";
import { fetchJson } from "@/lib/sources/http";

interface SearchResponse {
  query?: { search?: Array<{ title?: string; pageid?: number }> };
}

interface ExtractResponse {
  query?: {
    pages?: Record<
      string,
      { title?: string; extract?: string; missing?: boolean }
    >;
  };
}

export async function searchWikipedia(
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&utf8=1&format=json&srlimit=3&srsearch=" +
    encodeURIComponent(query);
  const search = await fetchJson<SearchResponse>(searchUrl, signal);
  const hits = (search.query?.search ?? []).filter(
    (hit) => hit.pageid && hit.title,
  );
  const documents: GatheredDocument[] = [];

  for (const hit of hits) {
    const extractUrl =
      "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=4000&format=json&pageids=" +
      hit.pageid;
    const extract = await fetchJson<ExtractResponse>(extractUrl, signal);
    const page = extract.query?.pages?.[String(hit.pageid)];
    const text = truncate(page?.extract ?? "", 4000);
    if (!page || page.missing || text.length < 80) continue;
    const title = page.title || hit.title || "Wikipedia";
    documents.push({
      source: "wikipedia",
      title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
      text,
    });
  }

  return documents;
}
