import { extractProductImageFromHtml } from "@/lib/adapters/html";
import { castroAdapter } from "@/lib/adapters/israeli/castro";
import { foxAdapter } from "@/lib/adapters/israeli/fox";
import { terminalXAdapter } from "@/lib/adapters/israeli/terminalx";
import { shopifyAdapter } from "@/lib/adapters/shopify";
import {
  AdapterError,
  DEFAULT_FETCH_HEADERS,
  type ProductAdapter,
  type ProductAvailability,
} from "@/lib/adapters/types";

/**
 * Ordered adapters: more specific hosts first, then Shopify, then none.
 * Add new site support by creating an adapter file and appending it here.
 */
const adapters: ProductAdapter[] = [
  terminalXAdapter,
  foxAdapter,
  castroAdapter,
  shopifyAdapter,
];

export function resolveAdapter(url: string): ProductAdapter | null {
  return adapters.find((adapter) => adapter.canHandle(url)) ?? null;
}

export function listAdapters(): string[] {
  return adapters.map((a) => a.id);
}

export async function fetchProductAvailability(
  url: string,
): Promise<ProductAvailability & { adapterId: string }> {
  const adapter = resolveAdapter(url);
  if (!adapter) {
    throw new AdapterError(
      "Unsupported site. SizeSeize currently supports Shopify product URLs and selected Israeli fashion sites (Terminal X, Fox, Castro). Add an adapter to expand coverage.",
    );
  }

  const result = await adapter.fetchAvailability(url);

  if (!result.productImageUrl) {
    try {
      const pageRes = await fetch(url, {
        headers: DEFAULT_FETCH_HEADERS,
        redirect: "follow",
        next: { revalidate: 0 },
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        result.productImageUrl =
          extractProductImageFromHtml(html, pageRes.url || url) ?? undefined;
      }
    } catch {
      // Image is optional; keep size data even if image lookup fails.
    }
  }

  return { ...result, adapterId: adapter.id };
}
