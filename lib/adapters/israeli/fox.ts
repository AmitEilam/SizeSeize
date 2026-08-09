import { extractProductImageFromHtml } from "@/lib/adapters/html";
import {
  AdapterError,
  DEFAULT_FETCH_HEADERS,
  type ProductAvailability,
  type ProductAdapter,
} from "@/lib/adapters/types";
import { shopifyAdapter } from "@/lib/adapters/shopify";
import { UNAVAILABLE_PHRASES } from "@/lib/monitoring/sizeMatch";

/**
 * Fox Israel: prefers Shopify product JSON when present; otherwise HTML heuristics.
 */
export const foxAdapter: ProductAdapter = {
  id: "fox",

  canHandle(url: string) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return host === "fox.co.il" || host.endsWith(".fox.co.il");
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    try {
      return await shopifyAdapter.fetchAvailability(url);
    } catch {
      // Fall through
    }

    const res = await fetch(url, {
      headers: DEFAULT_FETCH_HEADERS,
      redirect: "follow",
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new AdapterError(`Fox fetch failed (${res.status})`, "fox");
    }

    const html = await res.text();
    const nameMatch =
      html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

    const sizes = extractAvailableSizes(html);
    if (sizes.length === 0) {
      throw new AdapterError("Could not detect sizes on Fox page", "fox");
    }

    return {
      productName: nameMatch?.[1],
      productImageUrl:
        extractProductImageFromHtml(html, res.url || url) ?? undefined,
      availableSizes: sizes,
      rawSignals: { source: "fox_html" },
    };
  },
};

function extractAvailableSizes(html: string): string[] {
  const sizes: string[] = [];
  const re =
    /data-(?:size|value|option)=["']([^"']+)["'][^>]*(?:class=["'][^"']*["'])?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(html.length, match.index + match[0].length + 80);
    const context = html.slice(start, end).toLowerCase();
    const label = match[1].trim();
    if (!label || label.length > 12) continue;
    const unavailable =
      context.includes("disabled") ||
      UNAVAILABLE_PHRASES.some((p) => context.includes(p));
    if (!unavailable) sizes.push(label);
  }
  return [...new Set(sizes)];
}
