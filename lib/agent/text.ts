export function htmlToText(html: string): string {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point > 0 && point < 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return point > 0 && point < 0x10ffff ? String.fromCodePoint(point) : "";
    });
}

export function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function quoteIsGrounded(quote: string, documentText: string): boolean {
  const normalizedQuote = normalizeSpace(quote);
  const normalizedDocument = normalizeSpace(documentText);
  if (normalizedQuote.length < 20) return false;
  if (normalizedDocument.includes(normalizedQuote)) return true;
  const window = normalizedQuote.slice(0, 80);
  return window.length >= 24 && normalizedDocument.includes(window);
}

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const query = url.searchParams.toString();
    return `${url.protocol}//${url.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw.trim();
  }
}

export function stamp(): string {
  return new Date().toISOString();
}
