import { asosAdapter } from "@/lib/adapters/brands/asos";
import { adidasAdapter } from "@/lib/adapters/brands/adidas";
import { nextAdapter } from "@/lib/adapters/brands/next";
import { nikeAdapter } from "@/lib/adapters/brands/nike";
import { browserAdapter } from "@/lib/adapters/layers/browser";
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
 * Site-specific adapters for custom storefronts (Nike, Adidas, …).
 * Tried after generic HTTP layers so broad detectors run first.
 */
const siteSpecificAdapters: ProductAdapter[] = [
  nikeAdapter,
  adidasAdapter,
  nextAdapter,
  asosAdapter,
];

/**
 * HTTP / static layered detectors (in order):
 * 1. Shopify machine-readable product JSON
 * 2. Structured data (JSON-LD / embedded JSON / __NEXT_DATA__)
 * 3. Generic DOM on the initial HTML response
 */
const httpLayerAdapters: ProductAdapter[] = [
  shopifyAdapter,
  structuredDataAdapter,
  genericDomAdapter,
];

export function listAdapters(): string[] {
  return [
    ...httpLayerAdapters.map((a) => a.id),
    ...siteSpecificAdapters.map((a) => a.id),
    browserAdapter.id,
  ];
}

function isUsable(result: ProductDetectionResult): boolean {
  return (
    result.status === "ok" &&
    (result.confidence === "high" || result.confidence === "medium")
  );
}

async function tryAdapters(
  adapters: ProductAdapter[],
  url: string,
  page?: Awaited<ReturnType<typeof loadPageContext>>,
): Promise<ProductDetectionResult | null> {
  for (const adapter of adapters) {
    if (!adapter.canHandle(url, page)) continue;
    const result = await adapter.detect(url, page);
    if (isUsable(result)) return result;
    if (result.status === "blocked") return result;
  }
  return null;
}

/**
 * Layered product detection entrypoint.
 *
 * Order:
 * 1. Shopify / API
 * 2. Structured data
 * 3. Generic HTML/DOM
 * 4. Site-specific adapters
 * 5. Headless browser (final fallback)
 */
export async function detectProductAvailability(
  url: string,
): Promise<ProductDetectionResult> {
  let page: Awaited<ReturnType<typeof loadPageContext>> | undefined;
  try {
    page = await loadPageContext(url);
  } catch (err) {
    // Still allow the browser fallback when the initial HTTP fetch fails.
    page = undefined;
    const httpError =
      err instanceof Error ? err.message : "Failed to fetch product page.";

    const browserOnly = await tryAdapters([browserAdapter], url, undefined);
    if (browserOnly && isUsable(browserOnly)) return browserOnly;

    return failResult("pipeline", "error", httpError);
  }

  if (looksBlocked(page)) {
    // Cheap layers may still work (Shopify .js / site APIs) without HTML.
    const hostAdapters = siteSpecificAdapters.filter((adapter) =>
      adapter.canHandle(url, page),
    );
    const early =
      (await tryAdapters(hostAdapters, url, page)) ||
      (shopifyAdapter.canHandle(url, page)
        ? await shopifyAdapter.detect(url, page)
        : null);

    if (early && isUsable(early)) return early;
    if (early?.status === "blocked") return early;

    const browser = await tryAdapters([browserAdapter], url, page);
    if (browser && isUsable(browser)) return browser;
    if (browser?.status === "blocked") return browser;

    return failResult(
      "pipeline",
      "blocked",
      "The product site blocked automated access.",
      { httpStatus: page.status },
    );
  }

  // 1-3) Shopify → structured → DOM
  const httpHit = await tryAdapters(httpLayerAdapters, url, page);
  if (httpHit) {
    if (isUsable(httpHit)) return httpHit;
    if (httpHit.status === "blocked") return httpHit;
  }

  // 4) Site-specific dedicated adapters
  const siteHit = await tryAdapters(siteSpecificAdapters, url, page);
  if (siteHit) {
    if (isUsable(siteHit)) return siteHit;
    if (siteHit.status === "blocked") return siteHit;
  }

  // 5) Headless browser — last resort after all cheaper methods fail
  const browserHit = await tryAdapters([browserAdapter], url, page);
  if (browserHit) {
    if (isUsable(browserHit)) return browserHit;
    if (browserHit.status === "blocked") return browserHit;
  }

  return failResult(
    "pipeline",
    "unsupported",
    "Unable to confidently detect availability for this product page.",
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
