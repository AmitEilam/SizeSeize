import {
  extractMetaContent,
  extractProductImageFromHtml,
} from "@/lib/adapters/html";
import {
  AdapterError,
  DEFAULT_FETCH_HEADERS,
  type ProductAvailability,
  type ProductAdapter,
} from "@/lib/adapters/types";
import { shopifyAdapter } from "@/lib/adapters/shopify";
import {
  AVAILABLE_PHRASES,
  UNAVAILABLE_PHRASES,
} from "@/lib/monitoring/sizeMatch";

const TERMINALX_HOSTS = ["terminalx.com", "www.terminalx.com"];

/**
 * Terminal X: try Shopify-style JSON first; fall back to HTML size buttons.
 * Expand this adapter as DOM patterns are confirmed against live pages.
 */
export const terminalXAdapter: ProductAdapter = {
  id: "terminalx",

  canHandle(url: string) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return host === "terminalx.com";
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    try {
      if (shopifyAdapter.canHandle(url)) {
        return await shopifyAdapter.fetchAvailability(url);
      }
    } catch {
      // Continue to HTML heuristics
    }

    const res = await fetch(url, {
      headers: DEFAULT_FETCH_HEADERS,
      redirect: "follow",
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new AdapterError(
        `Terminal X fetch failed (${res.status})`,
        "terminalx",
      );
    }

    const html = await res.text();
    const productName = extractMetaContent(html, "og:title") ?? undefined;
    const productImageUrl = extractProductImageFromHtml(html) ?? undefined;
    const sizes = extractSizeButtons(html);

    if (sizes.length === 0) {
      throw new AdapterError(
        "Could not detect sizes on Terminal X page",
        "terminalx",
      );
    }

    return {
      productName,
      productImageUrl,
      availableSizes: sizes.filter((s) => s.available).map((s) => s.label),
      rawSignals: {
        source: "terminalx_html",
        hosts: TERMINALX_HOSTS,
        allSizes: sizes,
      },
    };
  },
};

type SizeButton = { label: string; available: boolean };

function extractSizeButtons(html: string): SizeButton[] {
  const results: SizeButton[] = [];

  const buttonRe =
    /<(?:button|div|span|li)[^>]*(?:size|מידה|variant)[^>]*>([\s\S]*?)<\/(?:button|div|span|li)>/gi;

  let match: RegExpExecArray | null;
  while ((match = buttonRe.exec(html)) !== null) {
    const block = match[0];
    const label = stripTags(match[1]).trim();
    if (!label || label.length > 12) continue;

    const lower = block.toLowerCase();
    const unavailable =
      lower.includes("disabled") ||
      lower.includes("sold-out") ||
      lower.includes("soldout") ||
      lower.includes("out-of-stock") ||
      lower.includes("unavailable") ||
      lower.includes("אזל") ||
      UNAVAILABLE_PHRASES.some((p) => lower.includes(p));

    const forcedAvailable = AVAILABLE_PHRASES.some((p) => lower.includes(p));

    results.push({
      label,
      available: forcedAvailable || !unavailable,
    });
  }

  const map = new Map<string, SizeButton>();
  for (const item of results) {
    const existing = map.get(item.label);
    if (!existing) {
      map.set(item.label, item);
    } else if (!item.available) {
      map.set(item.label, item);
    }
  }

  return [...map.values()];
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}
