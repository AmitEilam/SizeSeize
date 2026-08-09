import { asosAdapter } from "@/lib/adapters/brands/asos";
import { adidasAdapter } from "@/lib/adapters/brands/adidas";
import { nextAdapter } from "@/lib/adapters/brands/next";
import { nikeAdapter } from "@/lib/adapters/brands/nike";
import { genericDomAdapter } from "@/lib/adapters/layers/dom";
import { shopifyAdapter } from "@/lib/adapters/layers/shopify";
import { structuredDataAdapter } from "@/lib/adapters/layers/structured";
import { loadPageContext, looksBlocked } from "@/lib/adapters/pageContext";
import {
  failResult,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

/**
 * Site-specific adapters for custom storefronts.
 * Tried first when the host matches.
 */
const siteSpecificAdapters: ProductAdapter[] = [
  nikeAdapter,
  adidasAdapter,
  nextAdapter,
  asosAdapter,
];

/**
 * Generic layered detectors (in order):
 * 1. Shopify machine-readable product JSON
 * 2. Structured data (JSON-LD / embedded JSON / __NEXT_DATA__)
 * 3. Generic DOM (only when confidence is clear)
 */
const layerAdapters: ProductAdapter[] = [
  shopifyAdapter,
  structuredDataAdapter,
  genericDomAdapter,
];

export function listAdapters(): string[] {
  return [
    ...siteSpecificAdapters.map((a) => a.id),
    ...layerAdapters.map((a) => a.id),
  ];
}

function isUsable(result: ProductDetectionResult): boolean {
  return (
    result.status === "ok" &&
    (result.confidence === "high" || result.confidence === "medium")
  );
}

/**
 * Layered product detection entrypoint.
 * Monitoring code should call this and ignore website-specific details.
 */
export async function detectProductAvailability(
  url: string,
): Promise<ProductDetectionResult> {
  let page: Awaited<ReturnType<typeof loadPageContext>> | undefined;
  try {
    page = await loadPageContext(url);
  } catch (err) {
    return failResult(
      "pipeline",
      "error",
      err instanceof Error ? err.message : "Failed to fetch product page.",
    );
  }

  if (looksBlocked(page)) {
    // Site-specific APIs may still work without HTML (e.g. Nike feed).
    const hostAdapters = siteSpecificAdapters.filter((adapter) =>
      adapter.canHandle(url, page),
    );
    for (const adapter of hostAdapters) {
      const result = await adapter.detect(url, page);
      if (isUsable(result)) return result;
      if (result.status === "blocked") return result;
    }

    return failResult(
      "pipeline",
      "blocked",
      "The product site blocked automated access.",
      { httpStatus: page.status },
    );
  }

  // 1) Site-specific dedicated adapters
  for (const adapter of siteSpecificAdapters) {
    if (!adapter.canHandle(url, page)) continue;
    const result = await adapter.detect(url, page);
    if (isUsable(result)) return result;
    if (result.status === "blocked") return result;
    // If site-specific ran but couldn't detect, continue to generic layers.
  }

  // 2-4) Shopify → structured → DOM
  for (const adapter of layerAdapters) {
    if (!adapter.canHandle(url, page)) continue;
    const result = await adapter.detect(url, page);
    if (isUsable(result)) return result;
  }

  return failResult(
    "pipeline",
    "unsupported",
    "Unable to confidently detect available sizes for this product page.",
    {
      tried: listAdapters(),
    },
  );
}

/**
 * Back-compat wrapper used by monitoring.
 * Throws only for hard failures; unsupported is returned as a structured result
 * via detectProductAvailability — callers should prefer that.
 */
export async function fetchProductAvailability(url: string) {
  const result = await detectProductAvailability(url);
  if (result.status !== "ok") {
    const error = new Error(result.message || "Detection failed");
    (error as Error & { detection: ProductDetectionResult }).detection = result;
    throw error;
  }
  return {
    productName: result.productName,
    productImageUrl: result.productImageUrl,
    availableSizes: result.availableSizes,
    adapterId: result.adapterId,
    confidence: result.confidence,
    rawSignals: result.rawSignals,
  };
}
