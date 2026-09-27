import { truncate } from "@/lib/agent/text";
import type { GatheredDocument } from "@/lib/agent/types";
import { fetchJson } from "@/lib/sources/http";

interface OpenAlexWork {
  display_name?: string;
  publication_year?: number;
  doi?: string;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { landing_page_url?: string | null };
  id?: string;
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
}

export async function searchOpenAlex(
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  const url =
    "https://api.openalex.org/works?per-page=3&search=" +
    encodeURIComponent(query);
  const payload = await fetchJson<OpenAlexResponse>(url, signal);
  const documents: GatheredDocument[] = [];

  for (const work of payload.results ?? []) {
    const title = work.display_name?.trim();
    if (!title) continue;
    const abstract = reconstructAbstract(work.abstract_inverted_index);
    const authors = (work.authorships ?? [])
      .map((item) => item.author?.display_name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 8);
    const text = truncate(
      [abstract, authors.length ? `Authors: ${authors.join(", ")}.` : ""]
        .filter(Boolean)
        .join(" "),
      4000,
    );
    if (text.length < 40) continue;
    documents.push({
      source: "openalex",
      title,
      url: work.doi || work.primary_location?.landing_page_url || work.id || "",
      text,
      published: work.publication_year ? String(work.publication_year) : undefined,
      authors,
    });
  }

  return documents.filter((doc) => doc.url.startsWith("http"));
}

export function reconstructAbstract(
  inverted: Record<string, number[]> | null | undefined,
): string {
  if (!inverted) return "";
  const pairs: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const position of positions) pairs.push([position, word]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  return pairs.map((pair) => pair[1]).join(" ");
}
