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

export function normalizeImageUrl(
  raw: string | null | undefined,
  baseUrl?: string,
): string | null {
  if (!raw) return null;

  let trimmed = raw.trim().replace(/&amp;/gi, "&").replace(/&quot;/gi, "");
  // Strip wrapping quotes left by messy meta tags
  trimmed = trimmed.replace(/^["']|["']$/g, "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (baseUrl && (trimmed.startsWith("/") || trimmed.startsWith("./"))) {
    try {
      return new URL(trimmed, baseUrl).toString();
    } catch {
      return null;
    }
  }

  return null;
}

export function extractProductImageFromHtml(
  html: string,
  pageUrl?: string,
): string | null {
  const candidates = [
    extractMetaContent(html, "og:image"),
    extractMetaContent(html, "og:image:secure_url"),
    extractMetaContent(html, "twitter:image"),
    extractMetaContent(html, "twitter:image:src"),
    html.match(
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    )?.[1],
    html.match(
      /itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
    )?.[1],
    html.match(
      /content=["']([^"']+)["'][^>]+itemprop=["']image["']/i,
    )?.[1],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate, pageUrl);
    if (normalized) return normalized;
  }

  return null;
}
