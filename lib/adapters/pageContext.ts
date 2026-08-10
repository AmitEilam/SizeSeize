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

export type PageBlockInfo = {
  blocked: boolean;
  httpStatus: number;
  /** Machine-readable reasons, e.g. http_403, cloudflare_challenge */
  reasons: string[];
};

/**
 * Detect bot-block / challenge responses from the initial HTTP fetch.
 * Callers should still continue to API layers + headless browser before failing.
 */
export function getPageBlockInfo(page: PageContext): PageBlockInfo {
  const reasons: string[] = [];
  const lower = page.html.toLowerCase();
  const title =
    lower.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";

  if (page.status === 403) reasons.push("http_403");
  if (page.status === 429) reasons.push("http_429");
  if (page.status >= 400 && page.status !== 403 && page.status !== 429) {
    reasons.push(`http_${page.status}`);
  }

  if (
    lower.includes("cf-browser-verification") ||
    lower.includes("cdn-cgi/challenge-platform") ||
    (lower.includes("cf-challenge") && lower.includes("jschl"))
  ) {
    reasons.push("cloudflare_challenge");
  }

  if (title.includes("just a moment")) {
    reasons.push("cloudflare_just_a_moment");
  }
  if (title.includes("attention required") && lower.includes("cloudflare")) {
    reasons.push("cloudflare_attention_required");
  }
  if (title === "access denied" || title.includes("access denied")) {
    reasons.push("access_denied_title");
  }

  if (page.html.length < 8_000) {
    if (lower.includes("verify you are human")) {
      reasons.push("verify_human_interstitial");
    }
    if (lower.includes("enable javascript and cookies to continue")) {
      reasons.push("js_cookie_interstitial");
    }
    if (lower.includes("access denied") && !lower.includes("product")) {
      reasons.push("access_denied_body");
    }
  }

  // Soft signals alone on a 200 with a large HTML body are not enough —
  // only treat as blocked when we have a hard status or challenge marker.
  const hard =
    page.status === 403 ||
    page.status === 429 ||
    reasons.some(
      (r) =>
        r.startsWith("cloudflare_") ||
        r.startsWith("access_denied") ||
        r === "verify_human_interstitial" ||
        r === "js_cookie_interstitial",
    );

  return {
    blocked: hard,
    httpStatus: page.status,
    reasons: hard
      ? reasons
      : reasons.filter((r) => r.startsWith("http_")),
  };
}

export function looksBlocked(page: PageContext): boolean {
  return getPageBlockInfo(page).blocked;
}
