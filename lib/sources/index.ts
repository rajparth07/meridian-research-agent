import type { GatheredDocument, SourceId } from "@/lib/agent/types";
import { searchArxiv } from "@/lib/sources/arxiv";
import { searchCrossref } from "@/lib/sources/crossref";
import { searchDuckDuckGo } from "@/lib/sources/duckduckgo";
import { searchHackerNews } from "@/lib/sources/hackernews";
import { searchMdn } from "@/lib/sources/mdn";
import { searchOpenAlex } from "@/lib/sources/openalex";
import { searchWikipedia } from "@/lib/sources/wikipedia";

export async function searchSource(
  source: SourceId,
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  switch (source) {
    case "wikipedia":
      return searchWikipedia(query, signal);
    case "openalex":
      return searchOpenAlex(query, signal);
    case "arxiv":
      return searchArxiv(query, signal);
    case "crossref":
      return searchCrossref(query, signal);
    case "hackernews":
      return searchHackerNews(query, signal);
    case "duckduckgo":
      return searchDuckDuckGo(query, signal);
    case "mdn":
      return searchMdn(query, signal);
  }
}
