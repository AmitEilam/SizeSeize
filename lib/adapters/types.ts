import { cleanSizeLabels } from "@/lib/sizes";

/**
 * Layered product detection types.
 *
 * Monitoring code only consumes ProductDetectionResult.
 * Website details live inside adapters.
 */

export type DetectionStatus = "ok" | "unsupported" | "blocked" | "error";

export type DetectionConfidence = "high" | "medium" | "low";

export type ProductDetectionResult = {
  status: DetectionStatus;
  /** Which adapter produced the result */
  adapterId: string;
  productName?: string;
  productImageUrl?: string;
  /** Sizes confidently known to be in stock (may be empty). */
  availableSizes: string[];
  /**
   * Overall product availability when known.
   * Used for size-less monitoring (e.g. a racket that is simply in/out of stock).
   */
  productInStock?: boolean;
  /**
   * True when per-size availability was mapped (even if every size is OOS).
   * False for stock-only products with no meaningful size options.
   */
  sizeAware?: boolean;
  confidence: DetectionConfidence;
  /** Human-readable reason when status is not ok */
  message?: string;
  rawSignals?: Record<string, unknown>;
};

/** Shared page snapshot so layers can reuse one fetch. */
export type PageContext = {
  url: string;
  finalUrl: string;
  html: string;
  status: number;
};

export type ProductAdapter = {
  id: string;
  /**
   * Whether this adapter should attempt the URL/page.
   * Site-specific adapters match hosts.
   * Layer adapters (shopify/structured/dom) decide from URL + HTML signals.
   */
  canHandle(url: string, page?: PageContext): boolean;
  detect(url: string, page?: PageContext): Promise<ProductDetectionResult>;
};

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapterId?: string,
    public readonly status: DetectionStatus = "error",
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

export const DEFAULT_FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (compatible; SizeSeize/1.0; +https://sizeseize.app)",
  Accept: "text/html,application/json,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
};

/** @deprecated Use ProductDetectionResult. Kept for gradual migration. */
export type ProductAvailability = {
  productName?: string;
  productImageUrl?: string;
  availableSizes: string[];
  rawSignals?: Record<string, unknown>;
};

export function okResult(
  adapterId: string,
  partial: {
    productName?: string;
    productImageUrl?: string;
    availableSizes: string[];
    productInStock?: boolean;
    sizeAware?: boolean;
    confidence?: DetectionConfidence;
    rawSignals?: Record<string, unknown>;
  },
): ProductDetectionResult {
  const availableSizes = cleanSizeLabels(partial.availableSizes);
  const productInStock =
    typeof partial.productInStock === "boolean"
      ? partial.productInStock
      : availableSizes.length > 0;
  const sizeAware = partial.sizeAware ?? true;

  return {
    status: "ok",
    adapterId,
    productName: partial.productName,
    productImageUrl: partial.productImageUrl,
    availableSizes,
    productInStock,
    sizeAware,
    confidence: partial.confidence ?? "high",
    rawSignals: partial.rawSignals,
  };
}

export function failResult(
  adapterId: string,
  status: Exclude<DetectionStatus, "ok">,
  message: string,
  rawSignals?: Record<string, unknown>,
): ProductDetectionResult {
  return {
    status,
    adapterId,
    availableSizes: [],
    confidence: "low",
    message,
    rawSignals,
  };
}
