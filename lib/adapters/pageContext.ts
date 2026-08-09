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
  if (page.status === 403 || page.status === 429) return true;

  const lower = page.html.toLowerCase();
  const title =
    lower.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";

  // Cloudflare / bot interstitial pages (not ordinary product HTML that
  // merely loads a captcha script for checkout).
  if (
    lower.includes("cf-browser-verification") ||
    lower.includes("cdn-cgi/challenge-platform") ||
    (lower.includes("cf-challenge") && lower.includes("jschl"))
  ) {
    return true;
  }

  if (
    title.includes("just a moment") ||
    (title.includes("attention required") && lower.includes("cloudflare")) ||
    title === "access denied" ||
    title.includes("access denied")
  ) {
    return true;
  }

  // Short interstitial-style responses
  if (page.html.length < 8_000) {
    if (
      lower.includes("verify you are human") ||
      lower.includes("enable javascript and cookies to continue") ||
      (lower.includes("access denied") && !lower.includes("product"))
    ) {
      return true;
    }
  }

  return false;
}
