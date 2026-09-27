import { decodeEntities, truncate } from "@/lib/agent/text";
import type { GatheredDocument } from "@/lib/agent/types";
import { fetchText } from "@/lib/sources/http";

export async function searchArxiv(
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  const url =
    "https://export.arxiv.org/api/query?start=0&max_results=3&search_query=all:" +
    encodeURIComponent(query);
  const { text } = await fetchText(url, signal, 25_000);
  return parseArxivFeed(text);
}

export function parseArxivFeed(xml: string): GatheredDocument[] {
  const documents: GatheredDocument[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const title = clean(tag(entry, "title"));
    const summary = truncate(clean(tag(entry, "summary")), 4000);
    const id = clean(tag(entry, "id"));
    const published = clean(tag(entry, "published")).slice(0, 10);
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      .map((match) => clean(match[1]))
      .filter(Boolean)
      .slice(0, 8);
    if (!title || !id.startsWith("http") || summary.length < 40) continue;
    documents.push({
      source: "arxiv",
      title,
      url: id,
      text: summary,
      published: published || undefined,
      authors,
    });
  }
  return documents;
}

function tag(entry: string, name: string): string {
  const match = entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match?.[1] ?? "";
}

function clean(value: string): string {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}
