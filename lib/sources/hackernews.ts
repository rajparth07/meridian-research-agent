import { htmlToText, truncate } from "@/lib/agent/text";
import type { GatheredDocument } from "@/lib/agent/types";
import { fetchJson } from "@/lib/sources/http";

interface Hit {
  objectID?: string;
  title?: string;
  url?: string;
  story_text?: string | null;
  author?: string;
  points?: number;
  created_at?: string;
}

interface SearchResponse {
  hits?: Hit[];
}

interface Item {
  text?: string | null;
  children?: Item[];
}

export async function searchHackerNews(
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  const url =
    "https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=3&query=" +
    encodeURIComponent(query);
  const payload = await fetchJson<SearchResponse>(url, signal);
  const documents: GatheredDocument[] = [];

  for (const hit of payload.hits ?? []) {
    if (!hit.objectID || !hit.title) continue;
    const item = await fetchJson<Item>(
      `https://hn.algolia.com/api/v1/items/${hit.objectID}`,
      signal,
    ).catch(() => null);
    const comments = collectComments(item?.children ?? [], 4);
    const story = hit.story_text ? htmlToText(hit.story_text) : "";
    const text = truncate(
      [
        story,
        hit.url ? `Linked page: ${hit.url}.` : "",
        hit.author ? `Posted by ${hit.author}.` : "",
        comments.length ? `Comments: ${comments.join(" ")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      4000,
    );
    if (text.length < 40) continue;
    documents.push({
      source: "hackernews",
      title: hit.title,
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      text,
      published: hit.created_at?.slice(0, 10),
      authors: hit.author ? [hit.author] : undefined,
    });
  }

  return documents;
}

function collectComments(nodes: Item[], limit: number): string[] {
  const comments: string[] = [];
  const queue = [...nodes];
  while (queue.length && comments.length < limit) {
    const node = queue.shift();
    if (!node) break;
    const text = node.text ? htmlToText(node.text) : "";
    if (text.length > 40) comments.push(truncate(text, 500));
    if (node.children?.length) queue.push(...node.children);
  }
  return comments;
}
