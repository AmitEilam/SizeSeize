import { extractJsonLdBlocks, extractNextData } from "@/lib/adapters/http";
import {
  extractProductImageFromHtml,
  normalizeImageUrl,
} from "@/lib/adapters/html";
import {
  failResult,
  okResult,
  type PageContext,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function collectNodes(value: unknown, out: JsonRecord[] = []): JsonRecord[] {
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out);
    return out;
  }
  const rec = asRecord(value);
  if (!rec) return out;
  out.push(rec);
  if (rec["@graph"]) collectNodes(rec["@graph"], out);
  return out;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sizeFromOffer(offer: JsonRecord): string | null {
  return (
    readString(offer.size) ||
    readString(offer.name) ||
    readString(asRecord(offer.itemOffered)?.size) ||
    readString(asRecord(offer.itemOffered)?.name)
  );
}

function offerAvailable(offer: JsonRecord): boolean | null {
  const availability = readString(offer.availability)?.toLowerCase() ?? "";
  if (!availability) return null;
  if (
    availability.includes("instock") ||
    availability.includes("instoreonly") ||
    availability.includes("limitedavailability") ||
    availability.includes("onlineonly")
  ) {
    return true;
  }
  if (
    availability.includes("outofstock") ||
    availability.includes("discontinued") ||
    availability.includes("soldout")
  ) {
    return false;
  }
  return null;
}

function fromJsonLd(html: string, pageUrl: string): ProductDetectionResult | null {
  const nodes = extractJsonLdBlocks(html).flatMap((block) => collectNodes(block));
  const products = nodes.filter((node) => {
    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];
    return types.some(
      (t) => typeof t === "string" && t.toLowerCase().includes("product"),
    );
  });

  if (products.length === 0) return null;

  const product = products[0];
  const productName =
    readString(product.name) || readString(asRecord(product.brand)?.name) || undefined;

  const imageValue = product.image;
  let productImageUrl: string | undefined;
  if (typeof imageValue === "string") {
    productImageUrl = normalizeImageUrl(imageValue, pageUrl) ?? undefined;
  } else if (Array.isArray(imageValue) && typeof imageValue[0] === "string") {
    productImageUrl = normalizeImageUrl(imageValue[0], pageUrl) ?? undefined;
  } else if (asRecord(imageValue)?.url) {
    productImageUrl =
      normalizeImageUrl(readString(asRecord(imageValue)?.url), pageUrl) ??
      undefined;
  }

  const offersRaw = product.offers;
  const offers: JsonRecord[] = [];
  if (Array.isArray(offersRaw)) {
    for (const offer of offersRaw) {
      const rec = asRecord(offer);
      if (rec) offers.push(rec);
    }
  } else {
    const rec = asRecord(offersRaw);
    if (rec) {
      if (Array.isArray(rec.offers)) {
        for (const offer of rec.offers) {
          const nested = asRecord(offer);
          if (nested) offers.push(nested);
        }
      } else {
        offers.push(rec);
      }
    }
  }

  if (offers.length === 0) {
    return null;
  }

  const sizedOffers = offers
    .map((offer) => ({
      size: sizeFromOffer(offer),
      available: offerAvailable(offer),
    }))
    .filter((o) => o.size && o.available !== null);

  if (sizedOffers.length >= 2) {
    const availableSizes = sizedOffers
      .filter((o) => o.available)
      .map((o) => o.size as string);

    return okResult("structured", {
      productName,
      productImageUrl,
      availableSizes,
      productInStock: availableSizes.length > 0,
      sizeAware: true,
      confidence: "high",
      rawSignals: { source: "json_ld", offerCount: offers.length },
    });
  }

  // Overall product Offer(s) without per-size data (size-less SKUs).
  const overallFlags = offers
    .map((offer) => offerAvailable(offer))
    .filter((flag): flag is boolean => flag !== null);

  if (overallFlags.length === 0) {
    return null;
  }

  const productInStock = overallFlags.some(Boolean);

  return okResult("structured", {
    productName,
    productImageUrl,
    availableSizes: [],
    productInStock,
    sizeAware: false,
    confidence: "high",
    rawSignals: {
      source: "json_ld_overall",
      offerCount: offers.length,
      stockOnly: true,
    },
  });
}

function fromEmbeddedVariantJson(html: string): ProductDetectionResult | null {
  // Conservative patterns: only accept explicit available/size pairs.
  const variantBlocks =
    html.match(
      /\{[^{}]*"(?:size|option1|Size)"\s*:\s*"[^"]+"[^{}]*"(?:available|isAvailable|in_stock|inStock)"\s*:\s*(?:true|false)[^{}]*\}/gi,
    ) ??
    html.match(
      /\{[^{}]*"(?:available|isAvailable|in_stock|inStock)"\s*:\s*(?:true|false)[^{}]*"(?:size|option1|Size)"\s*:\s*"[^"]+"[^{}]*\}/gi,
    );

  if (!variantBlocks || variantBlocks.length < 2) return null;

  const availableSizes: string[] = [];
  let parsed = 0;

  for (const block of variantBlocks) {
    try {
      const obj = JSON.parse(block) as JsonRecord;
      const size =
        readString(obj.size) ||
        readString(obj.option1) ||
        readString(obj.Size);
      const available =
        obj.available === true ||
        obj.isAvailable === true ||
        obj.in_stock === true ||
        obj.inStock === true;
      const unavailable =
        obj.available === false ||
        obj.isAvailable === false ||
        obj.in_stock === false ||
        obj.inStock === false;

      if (!size || (!available && !unavailable)) continue;
      parsed += 1;
      if (available) availableSizes.push(size);
    } catch {
      // ignore malformed fragments
    }
  }

  if (parsed < 2) return null;

  return okResult("structured", {
    availableSizes,
    confidence: "medium",
    rawSignals: { source: "embedded_variant_json", parsed },
  });
}

function fromNextData(html: string): ProductDetectionResult | null {
  const data = extractNextData<JsonRecord>(html);
  if (!data) return null;

  // Only accept clearly shaped size arrays with status/availability.
  const selected = asRecord(asRecord(asRecord(data.props)?.pageProps)?.selectedProduct);
  const sizes = selected?.sizes;
  if (!Array.isArray(sizes) || sizes.length < 2) return null;

  const mapped = sizes
    .map((item) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const label =
        readString(rec.label) ||
        readString(rec.localizedLabel) ||
        readString(rec.size);
      const status = readString(rec.status)?.toUpperCase();
      if (!label || !status) return null;
      return {
        label,
        available: status === "ACTIVE" || status === "IN_STOCK" || status === "AVAILABLE",
      };
    })
    .filter((x): x is { label: string; available: boolean } => Boolean(x));

  if (mapped.length < 2) return null;

  return okResult("structured", {
    productName:
      readString(asRecord(selected?.productInfo)?.fullTitle) ||
      readString(asRecord(selected?.productInfo)?.title) ||
      undefined,
    availableSizes: mapped.filter((m) => m.available).map((m) => m.label),
    confidence: "medium",
    rawSignals: { source: "next_data_sizes", count: mapped.length },
  });
}

/**
 * Layer 2: machine-readable structured product data (JSON-LD, embedded JSON, __NEXT_DATA__).
 * Does not guess from loose page text.
 */
export const structuredDataAdapter: ProductAdapter = {
  id: "structured",

  canHandle(_url: string, page?: PageContext) {
    return Boolean(page?.html);
  },

  async detect(
    _url: string,
    page?: PageContext,
  ): Promise<ProductDetectionResult> {
    if (!page?.html) {
      return failResult(
        "structured",
        "unsupported",
        "No page HTML available for structured detection.",
      );
    }

    const jsonLd = fromJsonLd(page.html, page.finalUrl);
    if (jsonLd) {
      if (!jsonLd.productImageUrl) {
        jsonLd.productImageUrl =
          extractProductImageFromHtml(page.html, page.finalUrl) ?? undefined;
      }
      return jsonLd;
    }

    const nextData = fromNextData(page.html);
    if (nextData) {
      if (!nextData.productImageUrl) {
        nextData.productImageUrl =
          extractProductImageFromHtml(page.html, page.finalUrl) ?? undefined;
      }
      return nextData;
    }

    const embedded = fromEmbeddedVariantJson(page.html);
    if (embedded) {
      if (!embedded.productImageUrl) {
        embedded.productImageUrl =
          extractProductImageFromHtml(page.html, page.finalUrl) ?? undefined;
      }
      return embedded;
    }

    return failResult(
      "structured",
      "unsupported",
      "No reliable structured size/availability data found.",
    );
  },
};
