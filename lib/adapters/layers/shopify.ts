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

type ShopifyVariant = {
  id?: number;
  title?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  available?: boolean;
  featured_image?: { src?: string } | null;
};

type ShopifyProductJson = {
  title?: string;
  featured_image?: string | { src?: string } | null;
  images?: Array<string | { src?: string }>;
  variants?: ShopifyVariant[];
  options?: Array<{ name?: string; values?: string[] }>;
};

function productJsonUrl(productUrl: string): string | null {
  try {
    const url = new URL(productUrl);
    const match = url.pathname.match(/\/products\/([^/?#]+)/i);
    if (!match) return null;
    return `${url.origin}/products/${match[1]}.js`;
  } catch {
    return null;
  }
}

function looksLikeShopify(url: string, page?: PageContext): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("myshopify.com")) return true;
    if (/\/products\//i.test(parsed.pathname)) return true;
  } catch {
    return false;
  }

  if (!page) return false;
  const html = page.html;
  return (
    html.includes("cdn.shopify.com") ||
    html.includes("Shopify.theme") ||
    html.includes("window.Shopify") ||
    html.includes('name="shopify-digital-wallet"') ||
    html.includes("Shopify.shop")
  );
}

function extractImage(data: ShopifyProductJson, pageUrl?: string): string | null {
  const featured = data.featured_image;
  if (typeof featured === "string") {
    const fromFeatured = normalizeImageUrl(featured, pageUrl);
    if (fromFeatured) return fromFeatured;
  } else if (featured && typeof featured === "object") {
    const fromFeaturedObj = normalizeImageUrl(featured.src, pageUrl);
    if (fromFeaturedObj) return fromFeaturedObj;
  }

  const first = data.images?.[0];
  if (typeof first === "string") {
    const fromFirst = normalizeImageUrl(first, pageUrl);
    if (fromFirst) return fromFirst;
  }
  if (first && typeof first === "object") {
    const fromFirstObj = normalizeImageUrl(first.src, pageUrl);
    if (fromFirstObj) return fromFirstObj;
  }

  const variantImage = data.variants?.find((v) => v.featured_image?.src)
    ?.featured_image?.src;
  return normalizeImageUrl(variantImage, pageUrl);
}

function extractSizeFromVariant(
  variant: ShopifyVariant,
  options: ShopifyProductJson["options"],
): string | null {
  const sizeOptionIndex = (options ?? []).findIndex((opt) => {
    const name = (opt.name ?? "").toLowerCase();
    return (
      name.includes("size") ||
      name.includes("מידה") ||
      name === "sizes" ||
      name === "מידת"
    );
  });

  if (sizeOptionIndex === 0 && variant.option1) return variant.option1;
  if (sizeOptionIndex === 1 && variant.option2) return variant.option2;
  if (sizeOptionIndex === 2 && variant.option3) return variant.option3;

  // Only treat option1 as size when it is the sole option dimension
  if (
    (options?.length === 1 || (!variant.option2 && !variant.option3)) &&
    variant.option1
  ) {
    return variant.option1;
  }

  return null;
}

async function loadProductJson(
  jsonUrl: string,
): Promise<ShopifyProductJson | null> {
  const res = await fetch(jsonUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (compatible; SizeSeize/1.0; +https://sizeseize.app)",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as ShopifyProductJson;
  } catch {
    return null;
  }
}

function isPlaceholderSize(size: string): boolean {
  return /^default\s*title$/i.test(size.trim());
}

function fromProductJson(
  data: ShopifyProductJson,
  pageUrl: string,
  source: string,
): ProductDetectionResult {
  const variants = data.variants ?? [];
  if (variants.length === 0) {
    return failResult(
      "shopify",
      "unsupported",
      "Shopify product JSON had no variants.",
      { source },
    );
  }

  const hasAvailabilityFlag = variants.some((v) => typeof v.available === "boolean");
  if (!hasAvailabilityFlag) {
    return failResult(
      "shopify",
      "unsupported",
      "Shopify variants did not expose availability flags.",
      { source },
    );
  }

  const productInStock = variants.some((v) => v.available === true);
  const mappedSizes = variants
    .map((v) => extractSizeFromVariant(v, data.options))
    .filter((s): s is string => Boolean(s));
  const realSizes = mappedSizes.filter((s) => !isPlaceholderSize(s));
  const sizeAware = realSizes.length > 0;

  if (!sizeAware) {
    // Single-SKU / no size options: overall stock only (e.g. padel racket).
    return okResult("shopify", {
      productName: data.title,
      productImageUrl: extractImage(data, pageUrl) ?? undefined,
      availableSizes: [],
      productInStock,
      sizeAware: false,
      confidence: "high",
      rawSignals: { source, variantCount: variants.length, stockOnly: true },
    });
  }

  const availableSizes = variants
    .filter((v) => v.available)
    .map((v) => extractSizeFromVariant(v, data.options))
    .filter((s): s is string => typeof s === "string" && !isPlaceholderSize(s));

  return okResult("shopify", {
    productName: data.title,
    productImageUrl: extractImage(data, pageUrl) ?? undefined,
    availableSizes,
    productInStock,
    sizeAware: true,
    confidence: "high",
    rawSignals: { source, variantCount: variants.length },
  });
}

/**
 * Layer 1: Shopify product JSON (.js) / embedded Shopify product data.
 * Prefers machine-readable variant availability over HTML scraping.
 */
export const shopifyAdapter: ProductAdapter = {
  id: "shopify",

  canHandle(url: string, page?: PageContext) {
    return looksLikeShopify(url, page);
  },

  async detect(url: string, page?: PageContext): Promise<ProductDetectionResult> {
    const directJson = productJsonUrl(url);
    if (directJson) {
      const data = await loadProductJson(directJson);
      if (data) {
        const result = fromProductJson(data, url, "shopify_product_js");
        if (result.status === "ok" && !result.productImageUrl && page) {
          result.productImageUrl =
            extractProductImageFromHtml(page.html, page.finalUrl) ?? undefined;
        }
        return result;
      }
    }

    if (!page || page.status >= 400) {
      return failResult(
        "shopify",
        "unsupported",
        "Shopify product JSON was unavailable.",
      );
    }

    const resolvedJson = productJsonUrl(page.finalUrl) || productJsonUrl(url);
    if (!resolvedJson) {
      return failResult(
        "shopify",
        "unsupported",
        "Could not resolve a Shopify product handle.",
      );
    }

    const data = await loadProductJson(resolvedJson);
    if (!data) {
      return failResult(
        "shopify",
        "unsupported",
        "Shopify product JSON could not be loaded after resolving the handle.",
      );
    }

    const result = fromProductJson(data, page.finalUrl, "shopify_html_then_js");
    if (result.status === "ok" && !result.productImageUrl) {
      result.productImageUrl =
        extractProductImageFromHtml(page.html, page.finalUrl) ?? undefined;
    }
    return result;
  },
};
