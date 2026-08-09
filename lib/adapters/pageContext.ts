import {
  DEFAULT_FETCH_HEADERS,
  type PageContext,
} from "@/lib/adapters/types";

/** Fetch the product page once for layered detectors. */
export async function loadPageContext(url: string): Promise<PageContext> {
  const res = await fetch(url, {
    headers: DEFAULT_FETCH_HEADERS,
    redirect: "follow",
    next: { revalidate: 0 },
  });

  const html = await res.text();
  return {
    url,
    finalUrl: res.url || url,
    html,
    status: res.status,
  };
}

export function looksBlocked(page: PageContext): boolean {
  const lower = page.html.toLowerCase();
  return (
    page.status === 403 ||
    page.status === 429 ||
    lower.includes("access denied") ||
    lower.includes("cf-challenge") ||
    lower.includes("captcha")
  );
}
