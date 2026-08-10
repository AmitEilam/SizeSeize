import { asosAdapter } from "@/lib/adapters/brands/asos";
import { adidasAdapter } from "@/lib/adapters/brands/adidas";
import { nextAdapter } from "@/lib/adapters/brands/next";
import { nikeAdapter } from "@/lib/adapters/brands/nike";
import { browserAdapter } from "@/lib/adapters/layers/browser";
import { genericDomAdapter } from "@/lib/adapters/layers/dom";
import { shopifyAdapter } from "@/lib/adapters/layers/shopify";
import { structuredDataAdapter } from "@/lib/adapters/layers/structured";
import {
  getPageBlockInfo,
  loadPageContext,
  type PageBlockInfo,
} from "@/lib/adapters/pageContext";
import {
  failResult,
  type PageContext,
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

type AttemptLog = {
  adapterId: string;
  status: ProductDetectionResult["status"];
  confidence?: ProductDetectionResult["confidence"];
  message?: string;
  httpStatus?: number;
};

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

function logDetect(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[detect] ${message}`, details);
  } else {
    console.info(`[detect] ${message}`);
  }
}

function recordAttempt(
  attempts: AttemptLog[],
  adapterId: string,
  result: ProductDetectionResult,
  httpStatus?: number,
) {
  const entry: AttemptLog = {
    adapterId,
    status: result.status,
    confidence: result.confidence,
    message: result.message,
    httpStatus:
      httpStatus ??
      (typeof result.rawSignals?.httpStatus === "number"
        ? result.rawSignals.httpStatus
        : undefined),
  };
  attempts.push(entry);
  logDetect(`adapter=${adapterId} status=${result.status}`, {
    confidence: result.confidence,
    message: result.message,
    httpStatus: entry.httpStatus,
  });
}

/**
 * Run adapters in order. Never abort early on "blocked" —
 * blocked from a cheap layer must still fall through to the browser.
 */
async function runAdapterChain(
  adapters: ProductAdapter[],
  url: string,
  page: PageContext | undefined,
  attempts: AttemptLog[],
): Promise<ProductDetectionResult | null> {
  for (const adapter of adapters) {
    if (!adapter.canHandle(url, page)) {
      logDetect(`adapter=${adapter.id} skipped`, { reason: "canHandle=false" });
      continue;
    }

    try {
      const result = await adapter.detect(url, page);
      recordAttempt(attempts, adapter.id, result, page?.status);
      if (isUsable(result)) return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Adapter threw";
      const failed = failResult(adapter.id, "error", message);
      recordAttempt(attempts, adapter.id, failed, page?.status);
    }
  }
  return null;
}

function withAttempts(
  result: ProductDetectionResult,
  attempts: AttemptLog[],
  blockInfo?: PageBlockInfo | null,
): ProductDetectionResult {
  return {
    ...result,
    rawSignals: {
      ...(result.rawSignals ?? {}),
      attempts,
      initialHttpStatus: blockInfo?.httpStatus ?? pageStatusFromAttempts(attempts),
      initialBlockReasons: blockInfo?.reasons ?? [],
    },
  };
}

function pageStatusFromAttempts(attempts: AttemptLog[]): number | undefined {
  return attempts.find((a) => typeof a.httpStatus === "number")?.httpStatus;
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
 *
 * A "blocked" signal from the initial fetch or an early adapter never fails the
 * pipeline by itself — the headless browser always gets a chance first.
 */
export async function detectProductAvailability(
  url: string,
): Promise<ProductDetectionResult> {
  const attempts: AttemptLog[] = [];
  let page: PageContext | undefined;
  let blockInfo: PageBlockInfo | null = null;

  try {
    page = await loadPageContext(url);
    blockInfo = getPageBlockInfo(page);
    logDetect("initial_fetch", {
      httpStatus: page.status,
      finalUrl: page.finalUrl,
      blocked: blockInfo.blocked,
      blockReasons: blockInfo.reasons,
      htmlBytes: page.html.length,
    });
  } catch (err) {
    const httpError =
      err instanceof Error ? err.message : "Failed to fetch product page.";
    logDetect("initial_fetch_failed", { error: httpError });

    const browserHit = await runAdapterChain(
      [browserAdapter],
      url,
      undefined,
      attempts,
    );
    if (browserHit && isUsable(browserHit)) {
      return withAttempts(browserHit, attempts, blockInfo);
    }

    return withAttempts(
      failResult("pipeline", "error", httpError, {
        attempts,
      }),
      attempts,
      blockInfo,
    );
  }

  // When the HTML looks blocked, skip DOM/structured on challenge HTML, but
  // still try Shopify/API + site adapters, then always the browser.
  const earlyAdapters: ProductAdapter[] = blockInfo.blocked
    ? [
        shopifyAdapter,
        ...siteSpecificAdapters.filter((adapter) =>
          adapter.canHandle(url, page),
        ),
      ]
    : [...httpLayerAdapters, ...siteSpecificAdapters];

  if (blockInfo.blocked) {
    logDetect(
      "initial_fetch_looks_blocked_continuing_to_api_and_browser",
      {
        httpStatus: blockInfo.httpStatus,
        reasons: blockInfo.reasons,
      },
    );
  }

  const earlyHit = await runAdapterChain(earlyAdapters, url, page, attempts);
  if (earlyHit && isUsable(earlyHit)) {
    return withAttempts(earlyHit, attempts, blockInfo);
  }

  // Final fallback — never return blocked/unsupported before this runs.
  logDetect("starting_browser_fallback", {
    priorAttempts: attempts.map((a) => `${a.adapterId}:${a.status}`),
    initialHttpStatus: blockInfo.httpStatus,
    initialBlockReasons: blockInfo.reasons,
  });

  const browserHit = await runAdapterChain(
    [browserAdapter],
    url,
    page,
    attempts,
  );
  if (browserHit && isUsable(browserHit)) {
    return withAttempts(browserHit, attempts, blockInfo);
  }

  const browserBlocked = browserHit?.status === "blocked";
  const earlyBlocked = attempts.some((a) => a.status === "blocked");
  const finalStatus =
    blockInfo.blocked || browserBlocked || earlyBlocked
      ? "blocked"
      : "unsupported";

  const message =
    finalStatus === "blocked"
      ? `The product site blocked automated access${
          blockInfo.httpStatus
            ? ` (HTTP ${blockInfo.httpStatus}${
                blockInfo.reasons.length
                  ? `: ${blockInfo.reasons.join(", ")}`
                  : ""
              })`
            : ""
        }. Headless browser fallback also failed.`
      : "Unable to confidently detect availability for this product page.";

  logDetect("pipeline_failed", {
    finalStatus,
    httpStatus: blockInfo.httpStatus,
    blockReasons: blockInfo.reasons,
    attempts: attempts.map((a) => `${a.adapterId}:${a.status}`),
  });

  return withAttempts(
    failResult("pipeline", finalStatus, message, {
      tried: listAdapters(),
      httpStatus: blockInfo.httpStatus,
      blockReasons: blockInfo.reasons,
      attempts,
    }),
    attempts,
    blockInfo,
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
