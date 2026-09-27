import { htmlToText, truncate } from "@/lib/agent/text";
import type { GatheredDocument } from "@/lib/agent/types";
import { fetchJson } from "@/lib/sources/http";

interface CrossrefItem {
  DOI?: string;
  URL?: string;
  title?: string[];
  abstract?: string;
  author?: Array<{ given?: string; family?: string }>;
  "container-title"?: string[];
  issued?: { "date-parts"?: number[][] };
}

interface CrossrefResponse {
  message?: { items?: CrossrefItem[] };
}

export async function searchCrossref(
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  const url =
    "https://api.crossref.org/works?rows=3&query=" + encodeURIComponent(query);
  const payload = await fetchJson<CrossrefResponse>(url, signal);
  const documents: GatheredDocument[] = [];

  for (const item of payload.message?.items ?? []) {
    const title = item.title?.[0]?.trim();
    if (!title) continue;
    const authors = (item.author ?? [])
      .map((person) => [person.given, person.family].filter(Boolean).join(" "))
      .filter(Boolean)
      .slice(0, 8);
    const year = item.issued?.["date-parts"]?.[0]?.[0];
    const venue = item["container-title"]?.[0];
    const abstract = item.abstract ? htmlToText(item.abstract) : "";
    const text = truncate(
      [
        abstract,
        venue ? `Published in ${venue}.` : "",
        authors.length ? `Authors: ${authors.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      4000,
    );
    if (text.length < 40) continue;
    const urlValue = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : "");
    if (!urlValue.startsWith("http")) continue;
    documents.push({
      source: "crossref",
      title,
      url: urlValue,
      text,
      published: year ? String(year) : undefined,
      authors,
    });
  }

  return documents;
}
