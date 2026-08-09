import {
  AdapterError,
  DEFAULT_FETCH_HEADERS,
  type ProductAvailability,
  type ProductAdapter,
} from "@/lib/adapters/types";
import { shopifyAdapter } from "@/lib/adapters/shopify";

/**
 * Castro Israel starter adapter — Shopify JSON when available.
 */
export const castroAdapter: ProductAdapter = {
  id: "castro",

  canHandle(url: string) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return host === "castro.com" || host.endsWith(".castro.com");
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    try {
      return await shopifyAdapter.fetchAvailability(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new AdapterError(
        `Castro adapter could not parse product (${message}). Add DOM selectors as needed.`,
        "castro",
      );
    }
  },
};

/** Shared probe used by registry diagnostics. */
export async function probePageTitle(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: DEFAULT_FETCH_HEADERS,
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const html = await res.text();
  return (
    html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
    null
  );
}
