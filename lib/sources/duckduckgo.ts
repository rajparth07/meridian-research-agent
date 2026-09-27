import { isPublicHttpUrl } from "@/lib/agent/safety";
import { decodeEntities, htmlToText, truncate } from "@/lib/agent/text";
import type { GatheredDocument } from "@/lib/agent/types";
import { mapPool } from "@/lib/agent/pool";
import { fetchText } from "@/lib/sources/http";

export interface WebHit {
  title: string;
  url: string;
  snippet: string;
}

export function parseDuckDuckGoResults(html: string): WebHit[] {
  const snippets = [...html.matchAll(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)].map(
    (match) => htmlToText(match[1] ?? ""),
  );
  const hits: WebHit[] = [];
  const anchors = html.matchAll(
    /class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  );
  let index = 0;
  for (const match of anchors) {
    const url = extractTarget(decodeEntities(match[1] ?? ""));
    const title = htmlToText(match[2] ?? "");
    if (!url || !title || !isPublicHttpUrl(url)) {
      index += 1;
      continue;
    }
    hits.push({ title, url, snippet: snippets[index] ?? "" });
    index += 1;
    if (hits.length >= 3) break;
  }
  return hits;
}

export async function searchDuckDuckGo(
  query: string,
  signal?: AbortSignal,
): Promise<GatheredDocument[]> {
  const searchUrl =
    "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const { text } = await fetchText(searchUrl, signal);
  const hits = parseDuckDuckGoResults(text);
  const pages = await mapPool(hits, 3, async (hit) => readPage(hit, signal));
  return pages.filter((page): page is GatheredDocument => page !== null);
}

async function readPage(
  hit: WebHit,
  signal: AbortSignal | undefined,
): Promise<GatheredDocument | null> {
  if (/\.pdf($|\?)/i.test(hit.url)) {
    return snippetDocument(hit);
  }
  try {
    const page = await fetchText(hit.url, signal, 8_000);
    if (!isPublicHttpUrl(page.finalUrl)) return snippetDocument(hit);
    const type = page.contentType.toLowerCase();
    if (type && !type.includes("html") && !type.includes("text/plain")) {
      return snippetDocument(hit);
    }
    const body = truncate(htmlToText(page.text), 4000);
    const text = body.length > 120 ? body : truncate(`${hit.snippet} ${body}`, 4000);
    if (text.length < 40) return null;
    return {
      source: "duckduckgo",
      title: hit.title,
      url: page.finalUrl,
      text,
    };
  } catch {
    return snippetDocument(hit);
  }
}

function snippetDocument(hit: WebHit): GatheredDocument | null {
  const text = truncate(hit.snippet, 1000);
  if (text.length < 40) return null;
  return {
    source: "duckduckgo",
    title: hit.title,
    url: hit.url,
    text,
  };
}

function extractTarget(href: string): string | null {
  const absolute = href.startsWith("//") ? `https:${href}` : href;
  try {
    const url = new URL(absolute, "https://duckduckgo.com");
    const redirected = url.searchParams.get("uddg");
    if (redirected) return redirected;
    if (url.hostname.endsWith("duckduckgo.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
