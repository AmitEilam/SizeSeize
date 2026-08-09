/** Shared HTML metadata helpers for adapters. */

export function extractMetaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const reAlt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    "i",
  );
  const reName = new RegExp(
    `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const reNameAlt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`,
    "i",
  );
  return (
    html.match(re)?.[1] ??
    html.match(reAlt)?.[1] ??
    html.match(reName)?.[1] ??
    html.match(reNameAlt)?.[1] ??
    null
  );
}

export function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return null;
}

export function extractProductImageFromHtml(html: string): string | null {
  return normalizeImageUrl(
    extractMetaContent(html, "og:image") ??
      extractMetaContent(html, "og:image:secure_url") ??
      extractMetaContent(html, "twitter:image") ??
      extractMetaContent(html, "twitter:image:src"),
  );
}
